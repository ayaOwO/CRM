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

export const errorText = (error: unknown) =>
  error instanceof Error ? error.message : "אירעה שגיאה. נסו שוב.";
