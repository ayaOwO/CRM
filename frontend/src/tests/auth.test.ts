import { afterEach, describe, expect, it, vi } from "vitest";
import { login, signup } from "../lib/auth";
import { api } from "../lib/api";
import { getSession, setSession } from "../lib/session";

afterEach(() => {
  setSession(null);
  vi.unstubAllGlobals();
});
describe("authentication API contract", () => {
  it("sends JSON signup, form login, and bearer-authenticated CRM requests", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("null", { status: 201 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([{ themeColor: "#245c50" }, "access-token"]),
        ),
      )
      .mockResolvedValueOnce(new Response("[]"));
    vi.stubGlobal("fetch", fetch);
    await signup("user+one", "test@example.com", "p&ss word");
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
      username: "user+one",
      email: "test@example.com",
      password: "p&ss word",
    });
    expect(getSession()).toBeNull();
    await login("user+one", "p&ss word");
    const request = fetch.mock.calls[1][1];
    expect(request.body).toBeInstanceOf(FormData);
    expect(request.body.get("username")).toBe("user+one");
    expect(request.body.get("password")).toBe("p&ss word");
    // The browser must supply the multipart boundary.
    expect(request.headers["Content-Type"]).toBeUndefined();
    expect(request.headers.Authorization).toBeUndefined();
    expect(getSession()?.settings).toEqual({ themeColor: "#245c50" });
    await api("/contacts");
    expect(fetch.mock.calls[2][1].headers.Authorization).toBe(
      "Bearer access-token",
    );
  });
  it("rejects failed or malformed login and shows signup-specific conflicts", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{}, null])))
      .mockResolvedValueOnce(new Response("{}", { status: 409 }));
    vi.stubGlobal("fetch", fetch);
    await expect(login("user", "wrong")).rejects.toThrow(
      "שם המשתמש או הסיסמה שגויים",
    );
    await expect(login("user", "wrong")).rejects.toThrow(
      "תשובת התחברות לא תקינה",
    );
    expect(getSession()).toBeNull();
    await expect(
      signup("user", "test@example.com", "password"),
    ).rejects.toThrow("כבר בשימוש");
  });
  it("clears a rejected session and omits its token on subsequent requests", async () => {
    setSession({ username: "user", token: "expired", settings: {} });
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 401 }))
      .mockResolvedValueOnce(new Response("[]"));
    vi.stubGlobal("fetch", fetch);
    await expect(api("/contacts")).rejects.toThrow("תוקף ההתחברות פג");
    expect(getSession()).toBeNull();
    await api("/contacts");
    expect(fetch.mock.calls[1][1].headers.Authorization).toBeUndefined();
  });
  it("supports blocked storage and clears credentials on logout", () => {
    vi.stubGlobal("sessionStorage", {
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    });
    setSession({ username: "user", token: "token", settings: {} });
    expect(getSession()?.token).toBe("token");
    setSession(null);
    expect(getSession()).toBeNull();
  });
});
