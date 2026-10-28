export const uiConfig = {
  toastDurationMs: 3500,
  recentContactLimit: 5,
};

export const backendHealthConfig = {
  timeoutMs: 60_000,
  pollIntervalMs: 60_000,
  initialRetryMs: 5_000,
  maxRetryMs: 60_000,
  backoffFactor: 2,
};
