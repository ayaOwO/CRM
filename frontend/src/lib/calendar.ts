import type { Appointment } from "../types";

// Move these presets to configuration when meeting settings are added.
export const meetingDurationPresets = [90, 15] as const;
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

export function dateInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
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
export function layoutEvents(events: Appointment[], day: Date) {
  const end = shiftDay(day, 1).getTime();
  const ordered = events
    .filter(
      (e) => +new Date(e.start_time) < end && +new Date(e.end_time) > +day,
    )
    .map((e) => ({
      event: e,
      start: Math.max(+day, +new Date(e.start_time)),
      end: Math.min(end, +new Date(e.end_time)),
      lane: 0,
      lanes: 1,
    }))
    .sort((a, b) => a.start - b.start || a.end - b.end);
  let group: typeof ordered = [];
  let groupEnd = 0;
  const finish = () => {
    const lanes = Math.max(1, ...group.map((e) => e.lane + 1));
    group.forEach((e) => (e.lanes = lanes));
  };
  for (const item of ordered) {
    if (item.start >= groupEnd) {
      finish();
      group = [];
    }
    const occupied = new Set(
      group.filter((e) => e.end > item.start).map((e) => e.lane),
    );
    while (occupied.has(item.lane)) item.lane++;
    group.push(item);
    groupEnd = Math.max(...group.map((e) => e.end));
  }
  finish();
  return ordered;
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
export const shortDayFormat = new Intl.DateTimeFormat("he-IL", {
  weekday: "short",
  day: "numeric",
  month: "numeric",
});
export const time = (s: string) => timeFormat.format(new Date(s));
export const isSameDay = (a: Date, b: Date) =>
  a.toDateString() === b.toDateString();

export const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
export function appointmentsForDay(events: Appointment[], day: Date) {
  const start = new Date(day);
  start.setHours(0, 0, 0, 0);
  return layoutEvents(events, start).map((item) => item.event);
}
