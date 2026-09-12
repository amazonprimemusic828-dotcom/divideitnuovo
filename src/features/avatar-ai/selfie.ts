import { AvatarAIError, MAX_GENERATED_BYTES, MAX_IMAGE_BYTES, MAX_SELFIE_BYTES, SELFIE_TYPES } from "./contracts";

export function validateSelfie(file: File): void {
  if (!SELFIE_TYPES.some((type) => type === file.type) || file.size === 0) {
    throw new AvatarAIError("INVALID_IMAGE");
  }
  if (file.size > MAX_SELFIE_BYTES) throw new AvatarAIError("IMAGE_TOO_LARGE");
}

function loadImage(file: File, signal: AbortSignal, errorCode = "INVALID_IMAGE"): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.crossOrigin = "anonymous";
    const cleanup = () => {
      URL.revokeObjectURL(url);
      signal.removeEventListener("abort", cancel);
      window.clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
    };
    const cancel = () => {
      cleanup();
      image.src = "";
      reject(new DOMException("Cancelled", "AbortError"));
    };
    const timer = window.setTimeout(() => {
      cleanup();
      image.src = "";
      reject(new AvatarAIError(errorCode));
    }, 15_000);
    image.onload = () => { cleanup(); resolve(image); };
    image.onerror = () => { cleanup(); reject(new AvatarAIError(errorCode)); };
    signal.addEventListener("abort", cancel, { once: true });
    if (signal.aborted) cancel();
    else image.src = url;
  });
}

async function encodeImage(image: HTMLImageElement, width: number, height: number, type: string, name: string, signal: AbortSignal, errorCode: string): Promise<File> {
  signal.throwIfAborted();
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  try {
    const context = canvas.getContext("2d");
    if (!context) throw new AvatarAIError(errorCode);
    context.imageSmoothingQuality = "high";
    // Re-encoding removes EXIF/GPS metadata; contain preserves the entire face.
    context.drawImage(image, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.92));
    signal.throwIfAborted();
    if (!blob || !blob.size || blob.type !== type || blob.size > MAX_IMAGE_BYTES) throw new AvatarAIError(errorCode);
    return new File([blob], name, { type });
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}

export async function prepareSelfie(file: File, signal: AbortSignal): Promise<File> {
  validateSelfie(file);
  signal.throwIfAborted();
  const image = await loadImage(file, signal);
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  if (Math.min(width, height) < 256 || Math.max(width, height) > 8192 || width * height > 32_000_000) {
    throw new AvatarAIError("INVALID_IMAGE");
  }
  const scale = Math.min(1, 1024 / Math.max(width, height));
  return encodeImage(image, Math.round(width * scale), Math.round(height * scale), "image/jpeg", "selfie.jpg", signal, "REQUEST_TOO_LARGE");
}

export async function prepareStyleReference(file: File, signal: AbortSignal): Promise<File> {
  validateSelfie(file);
  signal.throwIfAborted();
  const image = await loadImage(file, signal, "STYLE_REFERENCE_UNAVAILABLE");
  if (image.naturalWidth !== image.naturalHeight || image.naturalWidth < 256 || image.naturalWidth > 4096) {
    throw new AvatarAIError("STYLE_REFERENCE_UNAVAILABLE");
  }
  return encodeImage(image, 512, 512, "image/png", "style.png", signal, "STYLE_REFERENCE_UNAVAILABLE");
}

export async function prepareGeneratedAvatar(file: File, signal: AbortSignal): Promise<File> {
  if (!file.size || file.size > MAX_GENERATED_BYTES || !SELFIE_TYPES.some((type) => type === file.type)) {
    throw new AvatarAIError("GENERATION_FAILED");
  }
  signal.throwIfAborted();
  const image = await loadImage(file, signal, "GENERATION_FAILED");
  if (image.naturalWidth !== image.naturalHeight || image.naturalWidth < 256 || image.naturalWidth > 4096) {
    throw new AvatarAIError("GENERATION_FAILED");
  }
  return encodeImage(image, 512, 512, "image/webp", `avatar-ai-${crypto.randomUUID()}.webp`, signal, "GENERATION_FAILED");
}
