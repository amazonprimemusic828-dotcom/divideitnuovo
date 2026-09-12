import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_GENERATED_BYTES, MAX_IMAGE_BYTES } from "@/features/avatar-ai/contracts";
import { prepareGeneratedAvatar, prepareSelfie, prepareStyleReference } from "@/features/avatar-ai/selfie";

const file = (type = "image/jpeg") => new File(["image-fixture"], "private-original-name", { type });
const signal = () => new AbortController().signal;
let dimensions: [number, number];
let decoding: "load" | "error" | "pending";
let images: LocalImage[];
let canvases: HTMLCanvasElement[];
let encodedDimensions: number[][];
let output: Blob | null | undefined;
const drawImage = vi.fn();

class LocalImage {
  naturalWidth: number;
  naturalHeight: number;
  crossOrigin = "";
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private source = "";

  constructor() {
    [this.naturalWidth, this.naturalHeight] = dimensions;
    images.push(this);
  }

  get src() { return this.source; }
  set src(value: string) {
    this.source = value;
    if (!value || decoding === "pending") return;
    queueMicrotask(() => {
      if (decoding === "error") this.onerror?.();
      else this.onload?.();
    });
  }
}

beforeEach(() => {
  dimensions = [1600, 1200];
  decoding = "load";
  images = [];
  canvases = [];
  encodedDimensions = [];
  output = undefined;
  drawImage.mockReset();
  let urlCount = 0;
  vi.stubGlobal("URL", class extends URL {
    static createObjectURL = vi.fn(() => `blob:decoder-${++urlCount}`);
    static revokeObjectURL = vi.fn();
  });
  vi.stubGlobal("Image", LocalImage);
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("No network during image preparation")));
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
    canvases.push(this);
    return { drawImage, imageSmoothingQuality: "low" } as unknown as CanvasRenderingContext2D;
  });
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (this: HTMLCanvasElement, callback, type) {
    encodedDimensions.push([this.width, this.height]);
    callback(output === undefined ? new Blob(["re-encoded-pixels"], { type }) : output);
  });
});

afterEach(() => {
  expect(fetch).not.toHaveBeenCalled();
  for (const canvas of canvases) {
    expect(canvas.width).toBe(0);
    expect(canvas.height).toBe(0);
  }
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("local selfie preprocessing", () => {
  it.each(["image/jpeg", "image/png", "image/webp"])("decodes %s locally and creates a fresh JPEG from pixels", async (type) => {
    const original = file(type);
    const prepared = await prepareSelfie(original, signal());
    expect(prepared).toBeInstanceOf(File);
    expect(prepared).not.toBe(original);
    expect(prepared.name).toBe("selfie.jpg");
    expect(prepared.type).toBe("image/jpeg");
    expect(URL.createObjectURL).toHaveBeenCalledExactlyOnceWith(original);
    expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith("blob:decoder-1");
    expect(images[0].crossOrigin).toBe("anonymous");
    expect(drawImage).toHaveBeenCalledExactlyOnceWith(images[0], 0, 0, 1024, 768);
    expect(encodedDimensions).toEqual([[1024, 768]]);
    expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenCalledWith(expect.any(Function), "image/jpeg", 0.92);
  });

  it("preserves portrait proportions instead of cropping the face", async () => {
    dimensions = [640, 1280];
    await prepareSelfie(file(), signal());
    expect(drawImage).toHaveBeenCalledWith(images[0], 0, 0, 512, 1024);
  });

  it("does not enlarge an already small valid selfie", async () => {
    dimensions = [256, 384];
    await prepareSelfie(file(), signal());
    expect(encodedDimensions).toEqual([[256, 384]]);
  });

  it.each([[255, 512], [512, 255], [8193, 256], [8192, 4096], [0, 0]])("rejects unsafe decoded dimensions %i × %i before creating a canvas", async (width, height) => {
      dimensions = [width, height];
      await expect(prepareSelfie(file(), signal())).rejects.toMatchObject({ code: "INVALID_IMAGE" });
      expect(drawImage).not.toHaveBeenCalled();
      expect(URL.revokeObjectURL).toHaveBeenCalledOnce();
    });

  it("rejects corrupt image bytes even when the MIME type is allowed", async () => {
    decoding = "error";
    await expect(prepareSelfie(file(), signal())).rejects.toMatchObject({ code: "INVALID_IMAGE" });
    expect(URL.revokeObjectURL).toHaveBeenCalledOnce();
    expect(drawImage).not.toHaveBeenCalled();
  });

  it.each([
    null,
    new Blob([], { type: "image/jpeg" }),
    new Blob(["wrong output format"], { type: "image/png" }),
    new Blob([new Uint8Array(MAX_IMAGE_BYTES + 1)], { type: "image/jpeg" }),
  ])("rejects failed, empty, unexpected or oversized encoding %#", async (blob) => {
    output = blob;
    await expect(prepareSelfie(file(), signal())).rejects.toMatchObject({ code: "REQUEST_TOO_LARGE" });
  });

  it("fails safely when a canvas context is unavailable", async () => {
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null);
    await expect(prepareSelfie(file(), signal())).rejects.toMatchObject({ code: "REQUEST_TOO_LARGE" });
    expect(HTMLCanvasElement.prototype.toBlob).not.toHaveBeenCalled();
  });

  it("releases canvas memory even if drawing throws", async () => {
    drawImage.mockImplementationOnce(() => { throw new Error("Decoder failure"); });
    await expect(prepareSelfie(file(), signal())).rejects.toThrow("Decoder failure");
    expect(canvases).toHaveLength(1);
  });
});

describe("temporary image lifecycle", () => {
  it("never creates an object URL for an already-cancelled preparation", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(prepareSelfie(file(), controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it("aborts decoding, clears callbacks and revokes its temporary object URL", async () => {
    decoding = "pending";
    const controller = new AbortController();
    const preparation = prepareSelfie(file(), controller.signal);
    const assertion = expect(preparation).rejects.toMatchObject({ name: "AbortError" });
    controller.abort();
    await assertion;
    expect(images[0].src).toBe("");
    expect(images[0].onload).toBeNull();
    expect(images[0].onerror).toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith("blob:decoder-1");
    expect(drawImage).not.toHaveBeenCalled();
  });

  it("times out a decoder without leaving a live URL or callbacks", async () => {
    vi.useFakeTimers();
    decoding = "pending";
    const preparation = prepareSelfie(file(), signal());
    const assertion = expect(preparation).rejects.toMatchObject({ code: "INVALID_IMAGE" });
    await vi.advanceTimersByTimeAsync(15_000);
    await assertion;
    expect(images[0].src).toBe("");
    expect(images[0].onload).toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalledOnce();
  });

  it("discards an encoded file when cancellation happens during encoding", async () => {
    let finish!: BlobCallback;
    vi.mocked(HTMLCanvasElement.prototype.toBlob).mockImplementationOnce((callback) => { finish = callback; });
    const controller = new AbortController();
    const preparation = prepareSelfie(file(), controller.signal);
    const assertion = expect(preparation).rejects.toMatchObject({ name: "AbortError" });
    await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
    controller.abort();
    finish(new Blob(["pixels"], { type: "image/jpeg" }));
    await assertion;
  });
});

describe("local style-reference preparation", () => {
  it("re-encodes a square reference as a separate 512px PNG", async () => {
    dimensions = [1024, 1024];
    const original = file("image/png");
    const reference = await prepareStyleReference(original, signal());
    expect(reference).not.toBe(original);
    expect(reference.name).toBe("style.png");
    expect(reference.type).toBe("image/png");
    expect(encodedDimensions).toEqual([[512, 512]]);
  });

  it.each([[512, 640], [128, 128], [4097, 4097]])("rejects invalid reference dimensions %i × %i", async (width, height) => {
    dimensions = [width, height];
    await expect(prepareStyleReference(file(), signal())).rejects.toMatchObject({ code: "STYLE_REFERENCE_UNAVAILABLE" });
  });

  it("reports reference decoding failures without substituting another portrait", async () => {
    decoding = "error";
    await expect(prepareStyleReference(file(), signal())).rejects.toMatchObject({ code: "STYLE_REFERENCE_UNAVAILABLE" });
  });
});

describe("local generated-image normalization", () => {
  it("creates fresh square WebP files without carrying the source name forward", async () => {
    dimensions = [1024, 1024];
    const first = await prepareGeneratedAvatar(file("image/png"), signal());
    const second = await prepareGeneratedAvatar(file("image/png"), signal());
    expect(first.type).toBe("image/webp");
    expect(first.name).toMatch(/^avatar-ai-.+\.webp$/);
    expect(first.name).not.toContain("private-original-name");
    expect(second.name).not.toBe(first.name);
    expect(encodedDimensions).toEqual([[512, 512], [512, 512]]);
  });

  it.each([[640, 512], [255, 255], [4097, 4097]])("rejects invalid output dimensions %i × %i", async (width, height) => {
    dimensions = [width, height];
    await expect(prepareGeneratedAvatar(file(), signal())).rejects.toMatchObject({ code: "GENERATION_FAILED" });
  });

  it.each([
    new File([], "empty.png", { type: "image/png" }),
    new File(["not an image"], "result.html", { type: "text/html" }),
    new File([new Uint8Array(MAX_GENERATED_BYTES + 1)], "large.png", { type: "image/png" }),
  ])("rejects unsafe generated files before decoding %#", async (generated) => {
    await expect(prepareGeneratedAvatar(generated, signal())).rejects.toMatchObject({ code: "GENERATION_FAILED" });
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
});
