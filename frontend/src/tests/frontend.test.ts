import { describe, expect, it, vi, afterEach } from "vitest";
import { api } from "../lib/api";
import { dateInput, layoutEvents, shiftDay, weekStart } from "../lib/calendar";
import { matchesContactName, safeLink } from "../lib/contacts";
import type { Appointment, Contact } from "../types";
function event(id: number, start: Date, end: Date): Appointment {
  return {
    id,
    start_time: start.toISOString(),
    end_time: end.toISOString(),
    location: "Office",
    guests: [],
  };
}
const hour = (date: Date, h: number) => {
  const d = new Date(date);
  d.setHours(h, 0, 0, 0);
  return d;
};
afterEach(() => vi.unstubAllGlobals());
describe("client name search", () => {
  const contact: Contact = {
    id: 1,
    first_name: "Ada",
    last_name: "Lovelace",
    phone_number: "0501234567",
    notes: null,
    google_docs_link: null,
    created_at: "2026-10-11T00:00:00Z",
  };
  it("matches first name, last name, and full name", () => {
    for (const search of ["ada", " LOVE ", "Ada Lovelace", ""]) {
      expect(matchesContactName(contact, search)).toBe(true);
    }
  });
  it("does not match phone numbers", () => {
    expect(matchesContactName(contact, "050123")).toBe(false);
    expect(matchesContactName(contact, "0501234567")).toBe(false);
  });
});
describe("calendar and link boundaries", () => {
  it("starts Sunday and preserves local calendar dates", () => {
    const day = new Date(2026, 9, 14, 12);
    const start = weekStart(day);
    expect(start.getDay()).toBe(0);
    expect(start.getHours()).toBe(0);
    expect(dateInput(hour(shiftDay(start, 1), 9))).toBe("2026-10-12T09:00");
  });
  it("shares lanes for overlaps and resets for separate groups", () => {
    const day = new Date(2026, 9, 11);
    const result = layoutEvents(
      [
        event(1, hour(day, 9), hour(day, 11)),
        event(2, hour(day, 10), hour(day, 12)),
        event(3, hour(day, 12), hour(day, 13)),
      ],
      day,
    );
    expect(result.map((e) => [e.lane, e.lanes])).toEqual([
      [0, 2],
      [1, 2],
      [0, 1],
    ]);
  });
  it("clips overnight appointments and excludes adjacent dates", () => {
    const day = new Date(2026, 9, 11);
    const tomorrow = shiftDay(day, 1);
    const result = layoutEvents(
      [
        event(1, hour(shiftDay(day, -1), 23), hour(day, 1)),
        event(2, hour(day, 23), hour(tomorrow, 1)),
        event(3, hour(tomorrow, 1), hour(tomorrow, 2)),
      ],
      day,
    );
    expect(result.map((e) => e.event.id)).toEqual([1, 2]);
    expect(result[0].start).toBe(+day);
    expect(result[1].end).toBe(+tomorrow);
  });
  it("allows only valid http(s) links", () => {
    expect(safeLink("javascript:alert(1)")).toBeUndefined();
    expect(safeLink("not a url")).toBeUndefined();
    expect(safeLink("https://docs.google.com/test")).toBe(
      "https://docs.google.com/test",
    );
  });
});
describe("API responses", () => {
  it("handles 204 deletion without parsing JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
    );
    expect(await api("/contacts/1", "DELETE")).toBeUndefined();
  });
  it("reports linked-client conflicts in Hebrew", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("{}", { status: 409 })),
    );
    await expect(api("/contacts/1", "DELETE")).rejects.toThrow("לא ניתן למחוק");
  });
  it("reports connection failures in Hebrew", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );
    await expect(api("/contacts")).rejects.toThrow("לא ניתן להתחבר");
  });
});
