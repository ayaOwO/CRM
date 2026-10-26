import { getSession, setSession } from "./session";

export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
  accessToken?: string,
): Promise<T> {
  const authRequest = path.startsWith("/auth/");
  const token = authRequest ? undefined : (accessToken ?? getSession()?.token);
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined && !(body instanceof FormData))
    headers["Content-Type"] =
      body instanceof URLSearchParams
        ? "application/x-www-form-urlencoded"
        : "application/json";
  let response: Response;
  try {
    response = await fetch(
      `${import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? ""}${path}`,
      {
        method,
        headers,
        body:
          body === undefined
            ? undefined
            : body instanceof FormData
              ? body
              : body instanceof URLSearchParams
                ? body.toString()
                : JSON.stringify(body),
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
    if (response.status === 401) {
      if (!authRequest && getSession()?.token === token)
        setSession(null, "תוקף ההתחברות פג. יש להתחבר מחדש.");
      throw new Error(
        authRequest
          ? "שם המשתמש או הסיסמה שגויים. בדקו את הפרטים ונסו שוב."
          : "תוקף ההתחברות פג. יש להתחבר מחדש.",
      );
    }
    if (authRequest && response.status === 409)
      throw new Error(
        "שם המשתמש או כתובת הדוא״ל כבר בשימוש. נסו להתחבר או לבחור פרטים אחרים.",
      );
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

export const errorText = (error: unknown) =>
  error instanceof Error ? error.message : "אירעה שגיאה. נסו שוב.";
