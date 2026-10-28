export const backendHealthConfig = {
  timeoutMs: 60_000,
  pollIntervalMs: 15_000,
  initialRetryMs: 5_000,
  maxRetryMs: 60_000,
  backoffFactor: 2,
};
