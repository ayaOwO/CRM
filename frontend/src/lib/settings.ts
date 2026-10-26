import { api } from "./api";
import { getSession, setSession } from "./session";

export async function saveUserSettings(changes: Record<string, unknown>) {
  const session = getSession();
  if (!session) throw new Error("יש להתחבר כדי לשמור הגדרות.");
  const settings = await api<Record<string, unknown>>(
    "/user/settings",
    "PUT",
    { ...session.settings, ...changes },
    session.token,
  );
  if (getSession()?.token === session.token)
    setSession({ ...session, settings });
}
