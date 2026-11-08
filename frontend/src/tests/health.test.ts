import { afterEach, expect, it, vi } from "vitest";
import { backendHealthy, watchBackendHealth } from "../lib/api";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("recognizes the backend and recovers after unavailable responses", async () => {
  const fetch = vi
    .fn()
    .mockRejectedValueOnce(new TypeError("offline"))
    .mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
    .mockResolvedValueOnce(new Response("<html>Frontend</html>"))
    .mockResolvedValueOnce(new Response(JSON.stringify({ service: "other" })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ service: "crm" })));
  vi.stubGlobal("fetch", fetch);
  const signal = new AbortController().signal;
  for (let attempt = 0; attempt < 4; attempt++) {
    expect(await backendHealthy(signal)).toBe(false);
  }
  expect(await backendHealthy(signal)).toBe(true);
  expect(fetch).toHaveBeenLastCalledWith("/status", {
    signal: expect.any(AbortSignal),
    cache: "no-store",
  });
});

it("allows a slow startup, times out stalled requests, and can recover", async () => {
  vi.useFakeTimers();
  const fetch = vi
    .fn()
    .mockImplementationOnce(
      (_url, { signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(new Error("aborted")));
        }),
    )
    .mockResolvedValueOnce(new Response(JSON.stringify({ service: "crm" })));
  vi.stubGlobal("fetch", fetch);
  const signal = new AbortController().signal;
  const pending = backendHealthy(signal);
  await vi.advanceTimersByTimeAsync(5_000);
  expect(fetch.mock.calls[0][1].signal.aborted).toBe(false);
  await vi.advanceTimersByTimeAsync(55_000);
  expect(await pending).toBe(false);
  expect(await backendHealthy(signal)).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});

it("cancels the in-flight request when the component unmounts", async () => {
  vi.useFakeTimers();
  vi.stubGlobal(
    "fetch",
    vi.fn(
      (_url, { signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(new Error("aborted")));
        }),
    ),
  );
  const controller = new AbortController();
  const pending = backendHealthy(controller.signal);
  controller.abort();
  expect(await pending).toBe(false);
  expect(vi.getTimerCount()).toBe(0);
});

it("backs off on failure, caps retries, stops on recovery, and checks immediately on reload", async () => {
  vi.useFakeTimers();
  const fetch = vi.fn().mockRejectedValue(new TypeError("offline"));
  vi.stubGlobal("fetch", fetch);
  const onStatus = vi.fn();
  const stop = watchBackendHealth(onStatus);
  expect(fetch).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(0);
  let requests = 1;
  for (const delay of [5_000, 10_000, 20_000, 40_000, 60_000, 60_000]) {
    await vi.advanceTimersByTimeAsync(delay - 1);
    expect(fetch).toHaveBeenCalledTimes(requests);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetch).toHaveBeenCalledTimes(++requests);
  }
  fetch.mockResolvedValueOnce(new Response(JSON.stringify({ service: "crm" })));
  await vi.advanceTimersByTimeAsync(60_000);
  expect(onStatus).toHaveBeenLastCalledWith(true);
  requests = fetch.mock.calls.length;
  expect(vi.getTimerCount()).toBe(0);
  await vi.advanceTimersByTimeAsync(300_000);
  expect(fetch).toHaveBeenCalledTimes(requests);
  stop();
  expect(vi.getTimerCount()).toBe(0);
  const stopReloaded = watchBackendHealth(onStatus);
  expect(fetch).toHaveBeenCalledTimes(requests + 1);
  stopReloaded();
  await vi.advanceTimersByTimeAsync(0);
  expect(vi.getTimerCount()).toBe(0);
});
