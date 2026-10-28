import { afterEach, expect, it, vi } from "vitest";
import { backendHealthy } from "../lib/api";

afterEach(() => vi.unstubAllGlobals());

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
  expect(fetch).toHaveBeenLastCalledWith("/health", {
    signal,
    cache: "no-store",
  });
});
