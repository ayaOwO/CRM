import { api } from "./api";
import { setSession } from "./session";

export async function login(username: string, password: string) {
  const form = new FormData();
  form.set("username", username);
  form.set("password", password);
  // FastAPI serializes the current (settings, token) tuple as a JSON array.
  const result = await api<unknown>("/auth/login", "POST", form);
  if (
    !Array.isArray(result) ||
    result.length !== 2 ||
    !result[0] ||
    typeof result[0] !== "object" ||
    Array.isArray(result[0]) ||
    typeof result[1] !== "string" ||
    !result[1]
  ) {
    throw new Error("השרת החזיר תשובת התחברות לא תקינה. נסו שוב.");
  }
  setSession({ username, settings: result[0], token: result[1] });
}

export async function signup(
  username: string,
  email: string,
  password: string,
) {
  await api("/auth/signup", "POST", { username, email, password });
}
