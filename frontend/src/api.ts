export interface Contact {
  id: number;
  first_name: string;
  last_name: string;
  phone_number: string | null;
  notes: string | null;
  google_docs_link: string | null;
  created_at: string;
}
export interface Appointment {
  id: number;
  guests: number[];
  location: string;
  start_time: string;
  end_time: string;
}
export const fullName = (c: Contact) => `${c.first_name} ${c.last_name}`;
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(
      `${import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? ""}${path}`,
      {
        method,
        headers:
          body === undefined ? {} : { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      },
    );
  } catch {
    throw new Error("לא ניתן להתחבר לשרת. בדקו את החיבור ונסו שוב.");
  }
  if (!response.ok) {
    let detail = "";
    try {
      const data = await response.json();
      if (typeof data.detail === "string") detail = data.detail;
    } catch {
      /* Non-JSON server error. */
    }
    if (response.status === 409)
      throw new Error(
        "לא ניתן למחוק מטופל המשויך לפגישות. יש להסיר את השיוך תחילה.",
      );
    if (response.status === 404)
      throw new Error("הרשומה לא נמצאה. יש לרענן את הנתונים.");
    if (response.status === 422)
      throw new Error(`יש לבדוק את פרטי הטופס.${detail ? ` ${detail}` : ""}`);
    throw new Error("הפעולה נכשלה. נסו שוב או בדקו את החיבור לשרת.");
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
export function safeLink(value: string | null): string | undefined {
  if (!value) return;
  try {
    const u = new URL(value);
    return ["http:", "https:"].includes(u.protocol) ? u.href : undefined;
  } catch {
    return;
  }
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
