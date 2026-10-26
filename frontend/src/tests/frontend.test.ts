import { describe, expect, it, vi, afterEach } from "vitest";
import { api } from "../lib/api";
import {
  appointmentsForDay,
  shiftDay,
  weekStart,
  meetingDurationPresets,
  meetingEnd,
  defaultMeetingStart,
  appointmentRange,
} from "../lib/calendar";
import { matchesContactName, safeLink } from "../lib/contacts";
import type { Appointment, Contact } from "../types";
import { createAppTheme, defaultThemeColor, readThemeColor } from "../theme";
const localDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
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
describe("theme preferences", () => {
  it("reads each account's saved color and rejects malformed settings", () => {
    expect(readThemeColor({ themeColor: "#663399" })).toBe("#663399");
    expect(readThemeColor({ themeColor: "#245c50" })).toBe("#245c50");
    for (const themeColor of [null, 123, "broken", "#123", "#1234567"]) {
      expect(readThemeColor({ themeColor })).toBe(defaultThemeColor);
    }
    expect(readThemeColor({})).toBe(defaultThemeColor);
    expect(readThemeColor()).toBe(defaultThemeColor);
  });
  it("updates theme tints while preserving RTL and component defaults", () => {
    const original = createAppTheme(defaultThemeColor);
    const changed = createAppTheme("#663399");
    expect(changed.palette.primary.light).not.toBe(
      original.palette.primary.light,
    );
    expect(changed.palette.action.selected).not.toBe(
      original.palette.action.selected,
    );
    expect(changed.palette.background.default).not.toBe(
      original.palette.background.default,
    );
    expect(changed.direction).toBe("rtl");
    expect(changed.components?.MuiTextField?.defaultProps?.size).toBe("small");
  });
});
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
  it("loads the selected week in day view and the full grid in month view", () => {
    const anchor = new Date(2026, 9, 14, 12);
    const start = weekStart(anchor);
    const end = shiftDay(start, 7);
    expect(appointmentRange(anchor, null)).toEqual([start, end]);
    expect(
      appointmentRange(anchor, [shiftDay(start, 3), shiftDay(start, 4)]),
    ).toEqual([start, end]);
    const monthRange: [Date, Date] = [
      new Date(2026, 8, 27),
      new Date(2026, 10, 8),
    ];
    expect(appointmentRange(anchor, monthRange)).toEqual(monthRange);
  });
  it("defaults to 10am for 90 minutes and supports custom positive whole minutes", () => {
    const day = new Date(2026, 9, 11, 16, 42);
    const start = defaultMeetingStart(day);
    expect(localDate(start)).toBe("2026-10-11T10:00");
    expect(
      localDate(
        new Date(meetingEnd(start.toISOString(), meetingDurationPresets[0])),
      ),
    ).toBe("2026-10-11T11:30");
    expect(localDate(new Date(meetingEnd(start.toISOString(), 37)))).toBe(
      "2026-10-11T10:37",
    );
    expect(day.getHours()).toBe(16);
    for (const minutes of [0, -15, 1.5, NaN, Infinity]) {
      expect(meetingEnd(start.toISOString(), minutes)).toBe("");
    }
  });
  it("calculates preset meeting lengths across midnight and handles a cleared start", () => {
    const start = "2026-10-11T23:45:00+03:00";
    expect(
      meetingDurationPresets.map((minutes) => meetingEnd(start, minutes)),
    ).toEqual(["2026-10-11T22:15:00.000Z", "2026-10-11T21:00:00.000Z"]);
    expect(meetingEnd("", 90)).toBe("");
  });
  it("starts Sunday and preserves local calendar dates", () => {
    const day = new Date(2026, 9, 14, 12);
    const start = weekStart(day);
    expect(start.getDay()).toBe(0);
    expect(start.getHours()).toBe(0);
    expect(localDate(hour(shiftDay(start, 1), 9))).toBe("2026-10-12T09:00");
  });
  it("includes overnight appointments and excludes adjacent dates", () => {
    const day = new Date(2026, 9, 11);
    const tomorrow = shiftDay(day, 1);
    const result = appointmentsForDay(
      [
        event(1, hour(shiftDay(day, -1), 23), hour(day, 1)),
        event(2, hour(day, 23), hour(tomorrow, 1)),
        event(3, hour(tomorrow, 1), hour(tomorrow, 2)),
      ],
      day,
    );
    expect(result.map((e) => e.id)).toEqual([1, 2]);
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
