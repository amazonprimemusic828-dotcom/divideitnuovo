import { StrictMode, type ComponentProps } from "react";
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AvatarAIGenerator from "@/features/avatar-ai/AvatarAIGenerator";
import AvatarSelector from "@/components/settings/AvatarSelector";
import { AvatarAIError } from "@/features/avatar-ai/contracts";
import { generateAvatar } from "@/features/avatar-ai/client";
import { useAvatarGenerator } from "@/features/avatar-ai/useAvatarGenerator";
import { prepareSelfie } from "@/features/avatar-ai/selfie";
import ReviewApp from "@/preview/ReviewApp";

vi.mock("@/features/avatar-ai/client", () => ({
  generateAvatar: vi.fn(),
}));
vi.mock("@/features/avatar-ai/selfie", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/features/avatar-ai/selfie")>(),
  prepareSelfie: vi.fn(),
}));

const original = new File(["selfie-fixture"], "my-selfie.jpg", { type: "image/jpeg" });
const inputLabel = "Carica un selfie per creare il tuo avatar AI";
const storageWrite = vi.fn();
const databaseOpen = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  let count = 0;
  vi.stubGlobal("URL", class extends URL {
    static createObjectURL = vi.fn(() => `blob:avatar-test-${++count}`);
    static revokeObjectURL = vi.fn();
  });
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network access is forbidden in local preview")));
  vi.stubGlobal("indexedDB", { open: databaseOpen });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(storageWrite);
  vi.mocked(prepareSelfie).mockResolvedValue(original);
  vi.mocked(generateAvatar).mockResolvedValue({ file: new File(["ai-result"], "avatar-ai-test.webp", { type: "image/webp" }) });
});

afterEach(() => {
  cleanup();
  expect(fetch).not.toHaveBeenCalled();
  expect(storageWrite).not.toHaveBeenCalled();
  expect(databaseOpen).not.toHaveBeenCalled();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function setup(overrides: Partial<ComponentProps<typeof AvatarAIGenerator>> = {}) {
  const props = { onConfirm: vi.fn(), onConfirmed: vi.fn(), ...overrides };
  return { ...render(<AvatarAIGenerator {...props} />), props };
}

function getTokenInput() {
  if (!screen.queryByLabelText("Token Hugging Face (facoltativo)")) {
    fireEvent.click(screen.getByRole("button", { name: "Account e quota" }));
  }
  return screen.getByLabelText("Token Hugging Face (facoltativo)");
}

async function chooseSelfie(file = original) {
  fireEvent.change(screen.getByLabelText(inputLabel), { target: { files: [file] } });
  await waitFor(() => expect(screen.getByRole("button", { name: "Cambia selfie" })).toBeEnabled());
  return screen.getByAltText("Il tuo selfie di riferimento");
}

describe("ZeroGPU selfie-to-avatar flow", () => {
  it("keeps account details collapsed and does not connect while opening or editing options", () => {
    setup();
    expect(screen.getByRole("button", { name: "Account e quota" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByLabelText("Token Hugging Face (facoltativo)")).not.toBeInTheDocument();
    const token = getTokenInput();
    fireEvent.change(token, { target: { value: `hf_${"x".repeat(34)}` } });
    fireEvent.blur(token);
    expect(screen.getByText("Token inserito")).toBeInTheDocument();
    expect(screen.getByText(/Cambiare token sullo stesso account non la ripristina/)).toBeInTheDocument();
    expect(generateAvatar).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("labels unchanged Studio references as examples, never as generated results", () => {
    setup();
    expect(screen.getAllByAltText(/Riferimento di stile Studio/)).toHaveLength(2);
    expect(screen.getByText("Esempi di stile, non un risultato generato.")).toBeInTheDocument();
    expect(screen.queryByAltText("Avatar 3D generato dal tuo selfie")).not.toBeInTheDocument();
    expect(generateAvatar).not.toHaveBeenCalled();
  });

  it("explains that only the selfie conditions identity and does not claim unsupported controls", () => {
    setup();
    expect(screen.getByText(/Solo premendo Genera vengono inviati a Hugging Face il selfie e il prompt di stile/)).toBeInTheDocument();
    expect(screen.getByText(/Luca e Giulia restano esempi nell’interfaccia e non vengono inviati al modello/)).toBeInTheDocument();
    expect(screen.getByText(/Questo endpoint non espone controlli di denoising o peso immagine/)).toBeInTheDocument();
    expect(screen.getByLabelText("Prompt di stile del generatore")).toHaveTextContent("The selfie is the only identity reference");
    expect(generateAvatar).not.toHaveBeenCalled();
  });

  it("opens quota guidance without retrying or clearing the provider error", async () => {
    vi.mocked(generateAvatar).mockRejectedValueOnce(new AvatarAIError("QUOTA_EXCEEDED"));
    setup();
    await chooseSelfie();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Genera il mio avatar" }));
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Gestisci account e quota" }));
    expect(screen.getByRole("button", { name: "Account e quota" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("La quota ZeroGPU è esaurita");
    expect(generateAvatar).toHaveBeenCalledOnce();
    expect(screen.getByAltText("Il tuo selfie di riferimento")).toBeInTheDocument();
  });

  it("requires a selfie and consent and starts with an empty optional token", () => {
    setup();
    const generate = screen.getByRole("button", { name: "Genera il mio avatar" });
    expect(generate).toBeDisabled();
    expect(generate).toHaveAccessibleDescription(/Servono un selfie e il consenso/);
    expect(screen.getByText("ZeroGPU · generazione reale")).toBeInTheDocument();
    const token = getTokenInput();
    expect(token).toHaveValue("");
    expect(token).toHaveAttribute("type", "password");
    expect(token).toHaveAttribute("autocomplete", "off");
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(screen.getByRole("checkbox")).toBeDisabled();
    expect(screen.queryByRole("link", { name: "Scarica avatar" })).not.toBeInTheDocument();
    expect(screen.queryByText(/OpenAI|Leonardo|Vercel|Gateway/i)).not.toBeInTheDocument();
  });

  it("keeps the consent checkbox compact with a clickable associated label", async () => {
    setup();
    await chooseSelfie();
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toHaveClass("no-touch-min");
    const label = screen.getByText("Acconsento all’invio del selfie a Hugging Face.");
    fireEvent.click(label);
    expect(checkbox).toBeChecked();
    fireEvent.click(label);
    expect(checkbox).not.toBeChecked();
  });

  it("prepares only the selected photo and cannot generate, confirm or persist it", async () => {
    const { props } = setup();
    const preview = await chooseSelfie();
    expect(prepareSelfie).toHaveBeenCalledExactlyOnceWith(original, expect.any(AbortSignal));
    expect(URL.createObjectURL).toHaveBeenCalledExactlyOnceWith(original);
    expect(preview).toHaveAttribute("src", "blob:avatar-test-1");
    expect(screen.getByText(original.name)).toBeInTheDocument();
    expect(screen.getByText("Il tuo avatar apparirà qui")).toBeInTheDocument();
    const generate = screen.getByRole("button", { name: "Genera il mio avatar" });
    expect(generate).toBeDisabled();
    fireEvent.click(generate);
    expect(props.onConfirm).not.toHaveBeenCalled();
    expect(props.onConfirmed).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Imposta come foto profilo" })).not.toBeInTheDocument();
    expect(screen.queryByAltText("Avatar 3D generato dal tuo selfie")).not.toBeInTheDocument();
  });

  it.each(["", `hf_${"x".repeat(34)}`])("sends the prepared selfie after consent and renders the returned image %#", async (accessToken) => {
    const { props } = setup();
    await chooseSelfie();
    fireEvent.change(getTokenInput(), { target: { value: accessToken } });
    fireEvent.click(screen.getByRole("checkbox"));
    const generate = screen.getByRole("button", { name: "Genera il mio avatar" });
    expect(generate).toBeEnabled();
    fireEvent.click(generate);
    expect(await screen.findByAltText("Avatar 3D generato dal tuo selfie")).toHaveAttribute("src", "blob:avatar-test-2");
    expect(generateAvatar).toHaveBeenCalledExactlyOnceWith(original, { accessToken, consent: true }, expect.any(AbortSignal));
    expect(screen.getByRole("link", { name: "Scarica avatar" })).toHaveAttribute("href", "blob:avatar-test-2");
    expect(props.onConfirm).not.toHaveBeenCalled();
    expect(props.onConfirmed).not.toHaveBeenCalled();
  });

  it("checks consent even if a caller bypasses the disabled button", async () => {
    const { result } = renderHook(() => useAvatarGenerator());
    act(() => result.current.chooseFiles([original] as unknown as FileList));
    await waitFor(() => expect(result.current.phase).toBe("ready"));
    await act(async () => result.current.generate());
    expect(result.current.canGenerate).toBe(false);
    expect(result.current.error?.code).toBe("CONSENT_REQUIRED");
    expect(result.current.result).toBeNull();
    expect(result.current.phase).toBe("ready");
    expect(generateAvatar).not.toHaveBeenCalled();
  });

  it("keeps the selfie and allows manual retry after a quota error", async () => {
    vi.mocked(generateAvatar).mockRejectedValueOnce(new AvatarAIError("QUOTA_EXCEEDED"));
    setup();
    await chooseSelfie();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Genera il mio avatar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("quota ZeroGPU");
    expect(screen.getByAltText("Il tuo selfie di riferimento")).toHaveAttribute("src", "blob:avatar-test-1");
    expect(screen.getByRole("button", { name: "Riprova manualmente" })).toBeEnabled();
    expect(screen.getByRole("alert")).toHaveTextContent("Un nuovo token dello stesso account non la azzera");
    expect(generateAvatar).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Riprova manualmente" }));
    expect(await screen.findByAltText("Avatar 3D generato dal tuo selfie")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("retains the last generated avatar if regeneration fails", async () => {
    setup();
    await chooseSelfie();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Genera il mio avatar" }));
    await screen.findByAltText("Avatar 3D generato dal tuo selfie");
    vi.mocked(generateAvatar).mockRejectedValueOnce(new AvatarAIError("SPACE_UNAVAILABLE"));
    fireEvent.click(screen.getByRole("button", { name: "Rigenera avatar" }));
    await screen.findByRole("alert");
    expect(screen.getByAltText("Avatar 3D generato dal tuo selfie")).toHaveAttribute("src", "blob:avatar-test-2");
    expect(screen.getByRole("link", { name: "Scarica avatar" })).toBeInTheDocument();
  });

  it("blocks duplicate submissions and ignores a late result after cancellation", async () => {
    let finish!: (value: { file: File }) => void;
    vi.mocked(generateAvatar).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    setup();
    await chooseSelfie();
    fireEvent.click(screen.getByRole("checkbox"));
    const generate = screen.getByRole("button", { name: "Genera il mio avatar" });
    fireEvent.click(generate);
    fireEvent.click(generate);
    expect(generateAvatar).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Generazione in corso…" })).toBeDisabled();
    const signal = vi.mocked(generateAvatar).mock.calls[0][2];
    fireEvent.click(screen.getByRole("button", { name: "Interrompi attesa" }));
    expect(signal.aborted).toBe(true);
    await act(async () => finish({ file: original }));
    expect(screen.queryByAltText("Avatar 3D generato dal tuo selfie")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Genera il mio avatar" })).toBeEnabled();
  });

  it("validates token syntax locally on blur without revealing it in the error", () => {
    setup();
    const token = getTokenInput();
    fireEvent.change(token, { target: { value: "private-invalid-token-value" } });
    fireEvent.blur(token);
    expect(token).toHaveAttribute("aria-invalid", "true");
    expect(token).toHaveAccessibleDescription(expect.stringContaining(new AvatarAIError("INVALID_TOKEN").message));
    expect(screen.getByRole("alert")).toHaveTextContent("Questo controllo è solo locale");
    expect(screen.getByRole("alert")).not.toHaveTextContent("private-invalid-token-value");
    fireEvent.click(screen.getByRole("button", { name: "Cancella token" }));
    expect(token).toHaveValue("");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it.each(["", "   ", `hf_${"x".repeat(34)}`])("accepts empty or syntactically correct optional credentials %# without connecting", (value) => {
    setup();
    const token = getTokenInput();
    fireEvent.change(token, { target: { value } });
    fireEvent.blur(token);
    expect(token).toHaveAttribute("aria-invalid", "false");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("does not erase an unrelated photo error while editing the token", async () => {
    setup();
    vi.mocked(prepareSelfie).mockRejectedValueOnce(new AvatarAIError("INVALID_IMAGE"));
    fireEvent.change(screen.getByLabelText(inputLabel), { target: { files: [original] } });
    await screen.findByRole("alert");
    const token = getTokenInput();
    fireEvent.change(token, { target: { value: `hf_${"x".repeat(34)}` } });
    fireEvent.blur(token);
    expect(screen.getByRole("alert")).toHaveTextContent(new AvatarAIError("INVALID_IMAGE").message);
  });

  it("clears the token and consent when removing the selfie", async () => {
    setup();
    await chooseSelfie();
    fireEvent.change(getTokenInput(), { target: { value: `hf_${"x".repeat(34)}` } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Rimuovi" }));
    expect(getTokenInput()).toHaveValue("");
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(screen.getByRole("checkbox")).toBeDisabled();
  });

  it("requires fresh consent for a replacement photo", async () => {
    setup();
    await chooseSelfie();
    fireEvent.click(screen.getByRole("checkbox"));
    await chooseSelfie(new File(["different-fixture"], "other.jpg", { type: "image/jpeg" }));
    expect(screen.getByRole("checkbox")).not.toBeChecked();
  });

  it("opens the native picker from both upload and replacement buttons", async () => {
    setup();
    const input = screen.getByLabelText(inputLabel);
    const openPicker = vi.spyOn(input, "click").mockImplementation(() => undefined);
    fireEvent.click(screen.getByRole("button", { name: /Carica il tuo selfie/ }));
    expect(openPicker).toHaveBeenCalledOnce();
    await chooseSelfie();
    fireEvent.click(screen.getByRole("button", { name: "Cambia selfie" }));
    expect(openPicker).toHaveBeenCalledTimes(2);
    expect(input).toHaveAttribute("accept", "image/jpeg,image/png,image/webp");
    expect(input).toHaveClass("sr-only", "max-w-px");
  });

  it("replaces the preview only after preparation succeeds and revokes the old URL", async () => {
    setup();
    await chooseSelfie();
    const other = new File(["other-selfie"], "other.png", { type: "image/png" });
    const prepared = new File(["prepared-image"], "selfie.jpg", { type: "image/jpeg" });
    vi.mocked(prepareSelfie).mockResolvedValueOnce(prepared);
    const preview = await chooseSelfie(other);
    expect(preview).toHaveAttribute("src", "blob:avatar-test-2");
    expect(screen.getByText(other.name)).toBeInTheDocument();
    expect(URL.createObjectURL).toHaveBeenLastCalledWith(prepared);
    expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith("blob:avatar-test-1");
  });

  it.each(["INVALID_IMAGE", "IMAGE_TOO_LARGE", "REQUEST_TOO_LARGE"])("displays %s with an accessible input error", async (code) => {
    setup();
    const error = new AvatarAIError(code);
    vi.mocked(prepareSelfie).mockRejectedValueOnce(error);
    fireEvent.change(screen.getByLabelText(inputLabel), { target: { files: [original] } });
    expect(await screen.findByRole("alert")).toHaveTextContent(error.message);
    expect(screen.getByLabelText(inputLabel)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText(inputLabel)).toHaveAccessibleDescription(expect.stringContaining(error.message));
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Carica il tuo selfie/ })).toBeEnabled();
  });

  it("retains the previous selfie when a replacement is invalid and clears the error on retry", async () => {
    setup();
    await chooseSelfie();
    vi.mocked(prepareSelfie).mockRejectedValueOnce(new AvatarAIError("INVALID_IMAGE"));
    fireEvent.change(screen.getByLabelText(inputLabel), { target: { files: [original] } });
    await screen.findByRole("alert");
    expect(screen.getByAltText("Il tuo selfie di riferimento")).toHaveAttribute("src", "blob:avatar-test-1");
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    await chooseSelfie();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByLabelText(inputLabel)).toHaveAttribute("aria-invalid", "false");
    expect(screen.getByAltText("Il tuo selfie di riferimento")).toHaveAttribute("src", "blob:avatar-test-2");
  });

  it("does not expose raw decoder errors or mark them as AI failures", async () => {
    setup();
    vi.mocked(prepareSelfie).mockRejectedValueOnce(new Error("Internal decoder details"));
    fireEvent.change(screen.getByLabelText(inputLabel), { target: { files: [original] } });
    expect(await screen.findByRole("alert")).toHaveTextContent(new AvatarAIError("INVALID_IMAGE").message);
    expect(screen.queryByText("Internal decoder details")).not.toBeInTheDocument();
  });

  it.each(["picker", "drop"])("rejects multiple files from %s before preparing anything", async (method) => {
    setup();
    const files = [original, original];
    if (method === "picker") fireEvent.change(screen.getByLabelText(inputLabel), { target: { files } });
    else fireEvent.drop(screen.getByRole("button", { name: /Carica il tuo selfie/ }), { dataTransfer: { files } });
    expect(await screen.findByRole("alert")).toHaveTextContent("Scegli una sola foto alla volta");
    expect(prepareSelfie).not.toHaveBeenCalled();
  });

  it("supports dropping a photo and clears drag feedback", async () => {
    setup();
    const zone = screen.getByRole("button", { name: /Carica il tuo selfie/ });
    fireEvent.dragOver(zone, { dataTransfer: { dropEffect: "none" } });
    expect(zone).toHaveTextContent("Lascia qui il tuo selfie");
    fireEvent.dragLeave(zone);
    expect(zone).toHaveTextContent("Carica il tuo selfie");
    fireEvent.dragOver(zone, { dataTransfer: { dropEffect: "none" } });
    fireEvent.drop(zone, { dataTransfer: { files: [original] } });
    expect(await screen.findByAltText("Il tuo selfie di riferimento")).toHaveAttribute("src", "blob:avatar-test-1");
    fireEvent.click(screen.getByRole("button", { name: "Rimuovi" }));
    expect(screen.getByRole("button", { name: /Carica il tuo selfie/ })).not.toHaveClass("is-dragging");
  });

  it("ignores an empty picker selection without losing the current preview", async () => {
    setup();
    await chooseSelfie();
    fireEvent.change(screen.getByLabelText(inputLabel), { target: { files: [] } });
    expect(screen.getByAltText("Il tuo selfie di riferimento")).toHaveAttribute("src", "blob:avatar-test-1");
    expect(prepareSelfie).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  });

  it("prevents parallel preparation and discards late completion after cancellation", async () => {
    let finish!: (file: File) => void;
    vi.mocked(prepareSelfie).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const onBusyChange = vi.fn();
    setup({ onBusyChange });
    const input = screen.getByLabelText(inputLabel);
    fireEvent.change(input, { target: { files: [original] } });
    fireEvent.change(input, { target: { files: [original] } });
    expect(prepareSelfie).toHaveBeenCalledOnce();
    expect(input).toBeDisabled();
    expect(onBusyChange).toHaveBeenCalledWith(true, false);
    const signal = vi.mocked(prepareSelfie).mock.calls[0][1];
    fireEvent.click(screen.getByRole("button", { name: "Annulla preparazione" }));
    expect(signal.aborted).toBe(true);
    expect(onBusyChange).toHaveBeenLastCalledWith(false, false);
    await act(async () => finish(original));
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(screen.queryByAltText("Il tuo selfie di riferimento")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Carica il tuo selfie/ })).toBeEnabled();
  });

  it("retains a valid preview and accepts a retry while an aborted decode finishes", async () => {
    setup();
    await chooseSelfie();
    let finishAborted!: (file: File) => void;
    let finishRetry!: (file: File) => void;
    vi.mocked(prepareSelfie)
      .mockImplementationOnce(() => new Promise((resolve) => { finishAborted = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { finishRetry = resolve; }));
    const other = new File(["other-selfie"], "other.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByLabelText(inputLabel), { target: { files: [other] } });
    fireEvent.click(screen.getByRole("button", { name: "Annulla preparazione" }));
    expect(screen.getByAltText("Il tuo selfie di riferimento")).toHaveAttribute("src", "blob:avatar-test-1");
    fireEvent.change(screen.getByLabelText(inputLabel), { target: { files: [other] } });
    await act(async () => finishAborted(original));
    expect(screen.getByRole("button", { name: "Annulla preparazione" })).toBeInTheDocument();
    expect(URL.createObjectURL).toHaveBeenCalledOnce();
    await act(async () => finishRetry(other));
    expect(screen.getByAltText("Il tuo selfie di riferimento")).toHaveAttribute("src", "blob:avatar-test-2");
    expect(screen.getByText(other.name)).toBeInTheDocument();
  });

  it("aborts preparation on unmount without creating a late preview", async () => {
    let finish!: (file: File) => void;
    vi.mocked(prepareSelfie).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const view = setup();
    fireEvent.change(screen.getByLabelText(inputLabel), { target: { files: [original] } });
    const signal = vi.mocked(prepareSelfie).mock.calls[0][1];
    view.unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => finish(original));
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it("removes the photo, validation errors and its object URL from the panel", async () => {
    setup();
    await chooseSelfie();
    fireEvent.change(screen.getByLabelText(inputLabel), { target: { files: [original, original] } });
    fireEvent.click(screen.getByRole("button", { name: "Rimuovi" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByAltText("Il tuo selfie di riferimento")).not.toBeInTheDocument();
    expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith("blob:avatar-test-1");
    expect(screen.getByRole("button", { name: /Carica il tuo selfie/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Genera il mio avatar" })).toBeDisabled();
  });

  it("revokes its preview on unmount under StrictMode", async () => {
    const view = render(<StrictMode><AvatarAIGenerator onConfirm={vi.fn()} /></StrictMode>);
    await chooseSelfie();
    view.unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith("blob:avatar-test-1");
  });

  it("blocks file preparation when the parent disables the panel", () => {
    setup({ disabled: true });
    const input = screen.getByLabelText(inputLabel);
    const zone = screen.getByRole("button", { name: /Carica il tuo selfie/ });
    expect(input).toBeDisabled();
    expect(zone).toBeDisabled();
    fireEvent.change(input, { target: { files: [original] } });
    fireEvent.drop(zone, { dataTransfer: { files: [original] } });
    expect(prepareSelfie).not.toHaveBeenCalled();
  });
});

describe("explicit session-only profile confirmation", () => {
  async function generateResult() {
    await chooseSelfie();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Genera il mio avatar" }));
    await screen.findByAltText("Avatar 3D generato dal tuo selfie");
  }

  it("passes only the generated file after an explicit click and does not generate again", async () => {
    const { props } = setup();
    await generateResult();
    const generated = (await vi.mocked(generateAvatar).mock.results[0].value).file;
    const confirm = screen.getByRole("button", { name: "Imposta come foto profilo" });
    expect(confirm).toBeEnabled();
    expect(confirm).toHaveAccessibleDescription(/fino al ricaricamento/);
    expect(props.onConfirm).not.toHaveBeenCalled();
    fireEvent.click(confirm);
    await waitFor(() => expect(props.onConfirmed).toHaveBeenCalledOnce());
    expect(props.onConfirm).toHaveBeenCalledExactlyOnceWith(generated);
    expect(generated).not.toBe(original);
    expect(generateAvatar).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Foto profilo impostata" })).toBeDisabled();
    expect(screen.getByRole("link", { name: "Scarica avatar" })).toBeInTheDocument();
  });

  it("does not offer profile confirmation without a callback", async () => {
    setup({ onConfirm: undefined });
    await generateResult();
    expect(screen.queryByRole("button", { name: "Imposta come foto profilo" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Scarica avatar" })).toBeInTheDocument();
  });

  it("blocks duplicate confirmation, regeneration and replacement while applying the photo", async () => {
    let finish!: () => void;
    const onConfirm = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    const onBusyChange = vi.fn();
    const { props } = setup({ onConfirm, onBusyChange });
    await generateResult();
    const confirm = screen.getByRole("button", { name: "Imposta come foto profilo" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onBusyChange).toHaveBeenLastCalledWith(true, true);
    expect(screen.getByRole("button", { name: "Imposto la foto…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Rigenera avatar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cambia selfie" })).toBeDisabled();
    expect(screen.getByLabelText(inputLabel)).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Annulla preparazione" })).not.toBeInTheDocument();
    expect(props.onConfirmed).not.toHaveBeenCalled();
    await act(async () => finish());
    expect(props.onConfirmed).toHaveBeenCalledOnce();
    expect(onBusyChange).toHaveBeenLastCalledWith(false, false);
  });

  it("retains the image and allows retry if the session update fails", async () => {
    const onConfirm = vi.fn().mockRejectedValueOnce(new Error("Internal profile details")).mockResolvedValue(undefined);
    const { props } = setup({ onConfirm });
    await generateResult();
    fireEvent.click(screen.getByRole("button", { name: "Imposta come foto profilo" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(new AvatarAIError("PROFILE_UPDATE_FAILED").message);
    expect(screen.queryByText("Internal profile details")).not.toBeInTheDocument();
    expect(props.onConfirmed).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Scarica avatar" })).toHaveAttribute("href", "blob:avatar-test-2");
    fireEvent.click(screen.getByRole("button", { name: "Imposta come foto profilo" }));
    await waitFor(() => expect(props.onConfirmed).toHaveBeenCalledOnce());
    expect(onConfirm).toHaveBeenCalledTimes(2);
    expect(generateAvatar).toHaveBeenCalledOnce();
  });

  it("requires a new explicit confirmation after regeneration", async () => {
    const { props } = setup();
    await generateResult();
    fireEvent.click(screen.getByRole("button", { name: "Imposta come foto profilo" }));
    await screen.findByRole("button", { name: "Foto profilo impostata" });
    const replacement = new File(["new-result"], "replacement.webp", { type: "image/webp" });
    vi.mocked(generateAvatar).mockResolvedValueOnce({ file: replacement });
    fireEvent.click(screen.getByRole("button", { name: "Rigenera avatar" }));
    const confirm = await screen.findByRole("button", { name: "Imposta come foto profilo" });
    expect(confirm).toBeEnabled();
    expect(props.onConfirm).toHaveBeenCalledOnce();
    fireEvent.click(confirm);
    await waitFor(() => expect(props.onConfirm).toHaveBeenLastCalledWith(replacement));
    expect(props.onConfirm).toHaveBeenCalledTimes(2);
  });

  it("guards confirmation when there is no result or the parent disables the hook", async () => {
    const onConfirm = vi.fn();
    const { result, rerender } = renderHook(({ disabled }) => useAvatarGenerator({ disabled, onConfirm }), { initialProps: { disabled: false } });
    await act(async () => result.current.confirm());
    expect(onConfirm).not.toHaveBeenCalled();
    act(() => result.current.chooseFiles([original] as unknown as FileList));
    await waitFor(() => expect(result.current.phase).toBe("ready"));
    act(() => result.current.updateConsent(true));
    await act(async () => result.current.generate());
    expect(result.current.canConfirm).toBe(true);
    rerender({ disabled: true });
    await act(async () => result.current.confirm());
    expect(result.current.canConfirm).toBe(false);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("does not close a new panel when an old confirmation resolves after unmount", async () => {
    let finish!: () => void;
    const onConfirm = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    const view = setup({ onConfirm });
    await generateResult();
    fireEvent.click(screen.getByRole("button", { name: "Imposta come foto profilo" }));
    view.unmount();
    await act(async () => finish());
    expect(view.props.onConfirmed).not.toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:avatar-test-1");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:avatar-test-2");
  });
});

describe("existing avatar selector integration", () => {
  it("keeps the selfie, token and consent when changing modes without generating", async () => {
    render(<AvatarSelector onAvatarSelect={vi.fn()} onFileUpload={vi.fn()} onGeneratedAvatar={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Cambia avatar" }));
    await chooseSelfie();
    const token = `hf_${"x".repeat(34)}`;
    fireEvent.change(getTokenInput(), { target: { value: token } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.keyDown(screen.getByRole("tab", { name: "Collezione Studio" }), { key: "Enter" });
    expect(screen.getAllByRole("radio")).toHaveLength(6);
    fireEvent.keyDown(screen.getByRole("tab", { name: "Crea con AI" }), { key: "Enter" });
    expect(screen.getByAltText("Il tuo selfie di riferimento")).toHaveAttribute("src", "blob:avatar-test-1");
    expect(getTokenInput()).toHaveValue(token);
    expect(screen.getByRole("checkbox")).toBeChecked();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    expect(generateAvatar).not.toHaveBeenCalled();
  });

  it("preserves the six Studio choices and their explicit selection flow", async () => {
    const onSelect = vi.fn();
    const onGeneratedAvatar = vi.fn();
    render(<AvatarSelector currentAvatar="/avatars/premium/luca.png" onAvatarSelect={onSelect} onFileUpload={vi.fn()} onGeneratedAvatar={onGeneratedAvatar} />);
    fireEvent.click(screen.getByRole("button", { name: "Cambia avatar" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("region", { name: "Nessuno è come te." })).toBeInTheDocument();
    fireEvent.keyDown(within(dialog).getByRole("tab", { name: "Collezione Studio" }), { key: "Enter" });
    expect(within(dialog).getAllByRole("radio")).toHaveLength(6);
    expect(within(dialog).queryByRole("region", { name: "Nessuno è come te." })).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("radio", { name: /Sofia/ }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Usa questo avatar" }));
    await waitFor(() => expect(onSelect).toHaveBeenCalledWith("/avatars/premium/sofia.png"));
    expect(onGeneratedAvatar).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("constrains the hidden profile-photo input without breaking the native picker", async () => {
    const onFileUpload = vi.fn();
    render(<AvatarSelector onAvatarSelect={vi.fn()} onFileUpload={onFileUpload} onGeneratedAvatar={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Cambia avatar" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.keyDown(within(dialog).getByRole("tab", { name: "La tua foto" }), { key: "Enter" });
    const input = within(dialog).getByLabelText("Carica la tua foto");
    expect(input).toHaveClass("sr-only", "max-w-px");
    const openPicker = vi.spyOn(input, "click").mockImplementation(() => undefined);
    fireEvent.click(within(dialog).getByRole("button", { name: /Scegli una foto dal tuo dispositivo/ }));
    expect(openPicker).toHaveBeenCalledOnce();
    expect(onFileUpload).not.toHaveBeenCalled();
  });

  it("never forwards the uploaded selfie to profile, upload or generation callbacks", async () => {
    const onAvatarSelect = vi.fn();
    const onFileUpload = vi.fn();
    const onGeneratedAvatar = vi.fn();
    render(<AvatarSelector onAvatarSelect={onAvatarSelect} onFileUpload={onFileUpload} onGeneratedAvatar={onGeneratedAvatar} />);
    fireEvent.click(screen.getByRole("button", { name: "Cambia avatar" }));
    await chooseSelfie();
    expect(onAvatarSelect).not.toHaveBeenCalled();
    expect(onFileUpload).not.toHaveBeenCalled();
    expect(onGeneratedAvatar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Genera il mio avatar" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(onGeneratedAvatar).not.toHaveBeenCalled();
  });

  it("only confirms the generated result and closes after the session callback completes", async () => {
    let finish!: () => void;
    const onGeneratedAvatar = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    const onAvatarSelect = vi.fn();
    const onFileUpload = vi.fn();
    render(<AvatarSelector onAvatarSelect={onAvatarSelect} onFileUpload={onFileUpload} onGeneratedAvatar={onGeneratedAvatar} />);
    fireEvent.click(screen.getByRole("button", { name: "Cambia avatar" }));
    await chooseSelfie();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Genera il mio avatar" }));
    await screen.findByAltText("Avatar 3D generato dal tuo selfie");
    fireEvent.click(screen.getByRole("button", { name: "Imposta come foto profilo" }));
    expect(onGeneratedAvatar).toHaveBeenCalledOnce();
    expect(onAvatarSelect).not.toHaveBeenCalled();
    expect(onFileUpload).not.toHaveBeenCalled();
    expect(screen.getByRole("tab", { name: "Collezione Studio" })).toBeDisabled();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Close" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await act(async () => finish());
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:avatar-test-2");
  });

  it("clears the temporary selfie on close and starts empty when reopened", async () => {
    render(<AvatarSelector onAvatarSelect={vi.fn()} onFileUpload={vi.fn()} onGeneratedAvatar={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Cambia avatar" }));
    await chooseSelfie();
    fireEvent.change(getTokenInput(), { target: { value: `hf_${"x".repeat(34)}` } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith("blob:avatar-test-1");
    fireEvent.click(screen.getByRole("button", { name: "Cambia avatar" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByAltText("Il tuo selfie di riferimento")).not.toBeInTheDocument();
    expect(getTokenInput()).toHaveValue("");
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(screen.getByRole("button", { name: /Carica il tuo selfie/ })).toBeEnabled();
  });
});

describe("shared profile state in the local review app", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/Settings");
    vi.stubGlobal("IntersectionObserver", class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    });
    vi.stubGlobal("ResizeObserver", class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    });
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    vi.spyOn(window, "Image").mockImplementation(() => {
      const image = document.createElement("img");
      // jsdom does not decode images; simulate Radix Avatar's successful preload.
      Object.defineProperties(image, {
        complete: { value: true },
        naturalWidth: { value: 1024 },
      });
      queueMicrotask(() => image.dispatchEvent(new Event("load")));
      return image;
    });
  });

  const accountImage = () => screen.getByRole("button", { name: "Apri menu account" }).querySelector("img");

  it("updates the top-right icon in memory, survives panel close and navigation, and resets on a fresh session", async () => {
    const view = render(<ReviewApp />);
    await waitFor(() => expect(accountImage()).not.toBeNull());
    const initialAvatar = accountImage()!.getAttribute("src");
    fireEvent.click(screen.getAllByRole("button", { name: "Cambia avatar" })[0]);
    await chooseSelfie();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Genera il mio avatar" }));
    await screen.findByAltText("Avatar 3D generato dal tuo selfie");
    expect(document.querySelector('[aria-label="Apri menu account"] img')).toHaveAttribute("src", initialAvatar);
    fireEvent.click(screen.getByRole("button", { name: "Imposta come foto profilo" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(accountImage()).toHaveAttribute("src", "blob:avatar-test-3"));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:avatar-test-1");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:avatar-test-2");
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith("blob:avatar-test-3");
    const generated = (await vi.mocked(generateAvatar).mock.results[0].value).file;
    expect(URL.createObjectURL).toHaveBeenLastCalledWith(generated);

    fireEvent.click(within(screen.getByRole("navigation", { name: "Navigazione applicazione" })).getByRole("link", { name: "Panoramica" }));
    await waitFor(() => expect(window.location.pathname).toBe("/Dashboard"));
    expect(accountImage()).toHaveAttribute("src", "blob:avatar-test-3");
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith("blob:avatar-test-3");

    fireEvent.keyDown(screen.getByRole("button", { name: "Apri menu account" }), { key: "ArrowDown" });
    const menu = await screen.findByRole("menu");
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Il tuo profilo" }));
    await waitFor(() => expect(window.location.pathname).toBe("/Settings"));
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Cambia avatar" }).length).toBeGreaterThan(0));
    expect(accountImage()).toHaveAttribute("src", "blob:avatar-test-3");
    fireEvent.click(screen.getAllByRole("button", { name: "Cambia avatar" })[0]);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByAltText("Avatar 3D generato dal tuo selfie")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Imposta come foto profilo" })).not.toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(accountImage()).toHaveAttribute("src", "blob:avatar-test-3");

    view.unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:avatar-test-3");
    render(<ReviewApp />);
    await waitFor(() => expect(accountImage()).toHaveAttribute("src", initialAvatar));
    expect(storageWrite).not.toHaveBeenCalled();
    expect(databaseOpen).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
});
