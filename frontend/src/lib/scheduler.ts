import { api } from "./api";

export interface TimeSpan {
  start: string;
  end: string;
}
export interface SchedulerData {
  title: string;
  location: string;
  timezone: string;
  duration_minutes: number;
  buffer_minutes: number;
  slot_minutes: number;
  min_notice_hours: number;
  max_advance_days: number;
  window_start: string | null;
  window_end: string | null;
  cancel_notice_hours: number;
  allow_cancel: boolean;
  allow_reschedule: boolean;
  price: string;
  terms: string;
  repeat: (TimeSpan & { day: number })[];
  overrides: { date: string; intervals: TimeSpan[] }[];
}
export interface Scheduler extends SchedulerData {
  id: number;
}
export interface GuestBooking {
  id: number;
  title: string;
  location: string;
  timezone: string;
  start_time: string;
  end_time: string;
  cancel_notice_hours: number;
  allow_cancel: boolean;
  allow_reschedule: boolean;
  scheduler_available: boolean;
}
export const defaultScheduler = (): SchedulerData => ({
  title: "",
  location: "קליניקה",
  timezone: "Asia/Jerusalem",
  duration_minutes: 90,
  buffer_minutes: 15,
  slot_minutes: 30,
  min_notice_hours: 24,
  max_advance_days: 60,
  window_start: null,
  window_end: null,
  cancel_notice_hours: 24,
  allow_cancel: true,
  allow_reschedule: true,
  price: "",
  terms: "",
  repeat: [],
  overrides: [],
});
export const schedulers = () => api<Scheduler[]>("/scheduler");
const base = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";
export async function guestApi<T>(
  path: string,
  method = "GET",
  body?: unknown,
  management?: string,
  captcha?: string,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`${base}${path}`, {
    method,
    credentials: "include",
    cache: "no-store",
    signal,
    headers: {
      "Content-Type": "application/json",
      ...(management ? { "X-Booking-Token": management } : {}),
      ...(captcha ? { "X-Captcha-Token": captcha } : {}),
    },
    body: method === "GET" ? undefined : JSON.stringify(body ?? {}),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(
      typeof data?.detail === "string"
        ? data.detail
        : "לא ניתן להשלים את הפעולה. בדקו את הפרטים ונסו שוב.",
    );
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
export function downloadCalendar(booking: GuestBooking) {
  const escape = (s: string) =>
    s
      .replace(/\\/g, "\\\\")
      .replace(/\r?\n/g, "\\n")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;");
  const stamp = (s: string) =>
    new Date(s)
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}Z$/, "Z");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CRM//Appointments//HE",
    "BEGIN:VEVENT",
    `UID:appointment-${booking.id}@${location.hostname}`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(booking.start_time)}`,
    `DTEND:${stamp(booking.end_time)}`,
    `SUMMARY:${escape(booking.title)}`,
    `LOCATION:${escape(booking.location)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  // Fold by UTF-8 octets, preserving multi-byte Hebrew characters.
  const encoder = new TextEncoder();
  const fold = (line: string) => {
    let out = "",
      column = 0;
    for (const ch of line) {
      const size = encoder.encode(ch).length;
      if (column + size > 75) {
        out += "\r\n ";
        column = 1;
      }
      out += ch;
      column += size;
    }
    return out;
  };
  const url = URL.createObjectURL(
    new Blob([lines.map(fold).join("\r\n") + "\r\n"], {
      type: "text/calendar;charset=utf-8",
    }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "appointment.ics";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const bookingDate = (value: string, timezone: string) =>
  new Intl.DateTimeFormat("he-IL", {
    timeZone: timezone,
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(value));
