// Plausible analytics inline snippet globals.
// The dashboard-generated snippet uses bare `plausible` and `window.plausible`
// references that TypeScript cannot resolve without these declarations.
interface PlausibleQueue {
  q?: unknown[];
  o?: Record<string, unknown>;
  init?: (options?: Record<string, unknown>) => void;
  (...args: unknown[]): void;
}

declare var plausible: PlausibleQueue;

interface Window {
  plausible?: PlausibleQueue;
}
