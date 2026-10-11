import type { Appointment } from "../types";

// Move these presets to configuration when meeting settings are added.
export const meetingDurationPresets = [90, 15] as const;
// Replace these choices with backend configuration when available.
export const meetingLocationOptions = ["שיחת טלפון", "קליניקה"] as const;
export function defaultMeetingStart(day = new Date()) {
  const start = new Date(day);
  start.setHours(10, 0, 0, 0);
  return start;
}
export function meetingEnd(start: string, minutes: number) {
  if (!Number.isInteger(minutes) || minutes <= 0) return "";
  const end = new Date(+new Date(start) + minutes * 60_000);
  return Number.isFinite(+end) ? end.toISOString() : "";
}

export function weekStart(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}
export function shiftDay(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
export function appointmentRange(
  anchor: Date,
  visibleRange: [Date, Date] | null,
): [Date, Date] {
  const start = weekStart(anchor);
  const end = shiftDay(start, 7);
  if (!visibleRange) return [start, end];
  // The dashboard needs the selected week even in the calendar's day view.
  return [
    new Date(Math.min(+start, +visibleRange[0])),
    new Date(Math.max(+end, +visibleRange[1])),
  ];
}
const timeFormat = new Intl.DateTimeFormat("he-IL", {
  hour: "2-digit",
  minute: "2-digit",
});
export const dayFormat = new Intl.DateTimeFormat("he-IL", {
  weekday: "long",
  day: "numeric",
  month: "long",
});
export const time = (s: string) => timeFormat.format(new Date(s));
export const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
export function appointmentsForDay(events: Appointment[], day: Date) {
  const start = new Date(day);
  start.setHours(0, 0, 0, 0);
  const end = shiftDay(start, 1);
  return events
    .filter(
      (event) =>
        +new Date(event.start_time) < +end &&
        +new Date(event.end_time) > +start,
    )
    .sort(
      (a, b) =>
        +new Date(a.start_time) - +new Date(b.start_time) || a.id - b.id,
    );
}
