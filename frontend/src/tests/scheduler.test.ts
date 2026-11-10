import { afterEach, describe, expect, it, vi } from "vitest";
import { guestApi } from "../lib/scheduler";

afterEach(() => vi.unstubAllGlobals());
describe("guest booking transport", () => {
  it("sends a private management token in a header and includes cookies", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ id: 1 }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetcher);
    await guestApi(
      "/guest/appointments/1",
      "PATCH",
      { start_time: "2027-01-05T09:00:00Z" },
      "private-token",
    );
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe("/guest/appointments/1");
    expect(options.credentials).toBe("include");
    expect(options.headers["X-Booking-Token"]).toBe("private-token");
    expect(options.headers.Authorization).toBeUndefined();
    expect(url).not.toContain("private-token");
  });
  it("preserves booking conflict details and handles empty cancellation responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ detail: "This time is no longer available" }),
            { status: 409 },
          ),
        )
        .mockResolvedValueOnce(new Response(null, { status: 204 })),
    );
    await expect(guestApi("/booking/code", "POST", {})).rejects.toThrow(
      "This time is no longer available",
    );
    await expect(
      guestApi("/guest/appointments/1", "DELETE"),
    ).resolves.toBeUndefined();
  });
});
