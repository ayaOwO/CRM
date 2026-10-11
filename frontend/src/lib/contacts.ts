import type { Contact } from "../types";

export const fullName = (c: Contact) => `${c.first_name} ${c.last_name}`;
export const matchesContactName = (c: Contact, search: string) =>
  fullName(c).toLocaleLowerCase().includes(search.trim().toLocaleLowerCase());
export function safeLink(value: string | null): string | undefined {
  if (!value) return;
  try {
    const u = new URL(value);
    return ["http:", "https:"].includes(u.protocol) ? u.href : undefined;
  } catch {
    return;
  }
}

export const initials = (c: Contact) =>
  `${c.first_name[0] ?? ""}${c.last_name[0] ?? ""}`;
