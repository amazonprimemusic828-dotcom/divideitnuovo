import type { Client as GradioClient } from "@gradio/client";
import { AVATAR_GENERATION_SETTINGS, AVATAR_PROMPT, AVATAR_PROVIDER_CONFIG } from "./config";
import { AvatarAIError, isAvatarTokenValid, MAX_GENERATED_BYTES, MAX_IMAGE_BYTES, type AvatarGenerationOptions, type GeneratedAvatar } from "./contracts";
import { prepareGeneratedAvatar, validateSelfie } from "./selfie";

const GENERATION_TIMEOUT_MS = 180_000;

function providerError(failure: unknown): AvatarAIError {
  if (failure instanceof AvatarAIError) return failure;
  const details = failure && typeof failure === "object" ? failure as Record<string, unknown> : {};
  const message = [typeof failure === "string" ? failure : "", details.message, details.code, details.status, details.title].join(" ");
  if (/quota|rate.?limit|too many requests|\b429\b/i.test(message)) return new AvatarAIError("QUOTA_EXCEEDED");
  if (/\b40[13]\b|unauthori[sz]ed|forbidden|invalid.*token|authentication|log.?in|sign.?in/i.test(message)) return new AvatarAIError("TOKEN_REJECTED");
  if (/queue.*full|busy|overload|sleeping|paused|unavailable|\b50[234]\b|could not (load|resolve)|failed to fetch|fetch failed|network|connection/i.test(message)) return new AvatarAIError("SPACE_UNAVAILABLE");
  return new AvatarAIError("GENERATION_FAILED");
}

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const cancel = () => reject(signal.reason);
    signal.addEventListener("abort", cancel, { once: true });
    promise.then(
      (value) => { signal.removeEventListener("abort", cancel); resolve(value); },
      (error) => { signal.removeEventListener("abort", cancel); reject(error); },
    );
    if (signal.aborted) cancel();
  });
}

async function downloadAvatar(data: unknown[], signal: AbortSignal): Promise<GeneratedAvatar> {
  const output = data[0];
  if (!output || typeof output !== "object" || !("url" in output) || typeof output.url !== "string") {
    throw new AvatarAIError("GENERATION_FAILED");
  }
  const url = new URL(output.url, AVATAR_PROVIDER_CONFIG.origin);
  if (url.origin !== AVATAR_PROVIDER_CONFIG.origin || !url.pathname.startsWith("/gradio_api/file=") || url.username || url.password) {
    throw new AvatarAIError("GENERATION_FAILED");
  }
  // Only download the official Space's result; never forward the user's token to a returned URL.
  const response = await fetch(url.href, { signal, credentials: "omit", cache: "no-store", redirect: "error" });
  if (!response.ok) throw providerError({ status: response.status });
  if (Number(response.headers.get("content-length")) > MAX_GENERATED_BYTES) throw new AvatarAIError("GENERATION_FAILED");
  const image = await response.blob();
  const file = await prepareGeneratedAvatar(new File([image], "generated-avatar", { type: image.type }), signal);
  return { file };
}

export async function generateAvatar(
  file: File,
  options: AvatarGenerationOptions,
  signal: AbortSignal,
): Promise<GeneratedAvatar> {
  signal.throwIfAborted();
  if (!options.consent) throw new AvatarAIError("CONSENT_REQUIRED");
  const token = options.accessToken?.trim();
  if (token && !isAvatarTokenValid(token)) throw new AvatarAIError("INVALID_TOKEN");
  validateSelfie(file);
  if (file.size > MAX_IMAGE_BYTES) throw new AvatarAIError("REQUEST_TOO_LARGE");

  const deadline = new AbortController();
  const cancel = () => deadline.abort(signal.reason);
  signal.addEventListener("abort", cancel, { once: true });
  const activeSignal = deadline.signal;
  const timer = setTimeout(() => deadline.abort(new AvatarAIError("GENERATION_TIMEOUT")), GENERATION_TIMEOUT_MS);
  let client: GradioClient | undefined;
  let job: ReturnType<GradioClient["submit"]> | undefined;
  let receivedResult = false;

  try {
    activeSignal.throwIfAborted();
    const { Client, handle_file } = await import("@gradio/client");
    activeSignal.throwIfAborted();
    const connection = Client.connect(AVATAR_PROVIDER_CONFIG.origin, {
      ...(token ? { token: token as `hf_${string}` } : {}),
      events: ["data", "status"],
      credentials: "omit",
      // The Gradio client otherwise saves input/output history in localStorage by default.
      record_history: false,
    });
    void connection.then((connected) => { if (activeSignal.aborted) connected.close(); }, () => undefined);
    client = await abortable(connection, activeSignal);
    activeSignal.throwIfAborted();

    const gradioFetch = client.fetch.bind(client);
    client.fetch = (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      const cleanup = url.origin === AVATAR_PROVIDER_CONFIG.origin && /\/gradio_api\/(cancel|reset)$/.test(url.pathname);
      // Stop uploads and queue submission after cancellation, but still allow best-effort remote cleanup.
      const requestSignal = cleanup ? AbortSignal.timeout(5_000) : activeSignal;
      return gradioFetch(input, { ...init, signal: init?.signal ? AbortSignal.any([requestSignal, init.signal]) : requestSignal });
    };
    job = client.submit(AVATAR_PROVIDER_CONFIG.apiName, {
      prompt: AVATAR_PROMPT,
      input_images: [{ image: handle_file(file), caption: null }],
      ...AVATAR_GENERATION_SETTINGS,
    });

    while (true) {
      const event = await abortable(job.next(), activeSignal);
      activeSignal.throwIfAborted();
      if (event.done) break;
      const message = event.value;
      if (!message || typeof message !== "object" || !("type" in message)) continue;
      if (message.type === "status" && "stage" in message && message.stage === "error") throw providerError(message);
      if (message.type === "data" && "data" in message && Array.isArray(message.data)) {
        receivedResult = true;
        return await downloadAvatar(message.data, activeSignal);
      }
    }
    throw new AvatarAIError("GENERATION_FAILED");
  } catch (failure) {
    activeSignal.throwIfAborted();
    throw providerError(failure);
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", cancel);
    if (job) {
      if (!receivedResult && job.event_id()) void job.cancel().catch(() => undefined);
      void job.return();
    }
    client?.close();
  }
}
