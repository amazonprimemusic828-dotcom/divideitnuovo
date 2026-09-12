import "@testing-library/jest-dom";
import { randomUUID } from "node:crypto";

// jsdom 20 lacks these APIs supported by the browsers targeted by the app.
if (!AbortSignal.prototype.throwIfAborted) {
  Object.defineProperty(AbortSignal.prototype, "throwIfAborted", {
    configurable: true,
    value: function (this: AbortSignal) {
      if (this.aborted) throw this.reason ?? new DOMException("Cancelled", "AbortError");
    },
  });
}
if (!crypto.randomUUID) Object.defineProperty(crypto, "randomUUID", { configurable: true, value: randomUUID });

if (typeof window !== "undefined") Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
