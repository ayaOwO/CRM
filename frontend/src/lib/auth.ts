import { api } from "./api";
import { setSession } from "./session";

export async function login(username: string, password: string) {
  const form = new FormData();
  form.set("username", username);
  form.set("password", password);
  const token = await api<unknown>("/auth/login", "POST", form);
  if (typeof token !== "string" || !token.trim()) {
    throw new Error("השרת החזיר תשובת התחברות לא תקינה. נסו שוב.");
  }
  const settings = await api<unknown>(
    "/user/settings",
    "GET",
    undefined,
    token,
  );
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    throw new Error("לא ניתן לטעון את הגדרות החשבון. נסו להתחבר שוב.");
  }
  setSession({
    username,
    settings: settings as Record<string, unknown>,
    token,
  });
}

export async function signup(
  username: string,
  email: string,
  password: string,
) {
  await api("/auth/signup", "POST", { username, email, password });
}
