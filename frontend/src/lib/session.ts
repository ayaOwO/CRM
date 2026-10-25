export type Session = {
  username: string;
  token: string;
  settings: Record<string, unknown>;
};
const storageKey = "crm.session";
function restore(): Session | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
    return value &&
      typeof value.username === "string" &&
      typeof value.token === "string" &&
      value.token &&
      value.settings &&
      typeof value.settings === "object" &&
      !Array.isArray(value.settings)
      ? value
      : null;
  } catch {
    return null;
  }
}
let session = restore();
let notice = "";
export const getSessionNotice = () => notice;
const listeners = new Set<() => void>();
export const getSession = () => session;
export function subscribeSession(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function setSession(value: Session | null, message = "") {
  session = value;
  notice = message;
  try {
    if (value) sessionStorage.setItem(storageKey, JSON.stringify(value));
    else sessionStorage.removeItem(storageKey);
  } catch {
    /* Storage may be blocked; the in-memory session still works. */
  }
  listeners.forEach((listener) => listener());
}
