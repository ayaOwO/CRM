import { afterEach, describe, expect, it, vi } from "vitest";
import { login, signup } from "../lib/auth";
import { api } from "../lib/api";
import { getSession, setSession } from "../lib/session";
import { saveUserSettings } from "../lib/settings";

afterEach(() => {
  setSession(null);
  vi.unstubAllGlobals();
});
describe("authentication API contract", () => {
  it("saves account preferences without dropping unrelated settings", async () => {
    setSession({
      username: "user",
      token: "token",
      settings: { locale: "he" },
    });
    const settings = { locale: "he", themeColor: "#663399" };
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(settings)));
    vi.stubGlobal("fetch", fetch);
    await saveUserSettings({ themeColor: "#663399" });
    expect(fetch.mock.calls[0][0]).toBe("/user/settings");
    expect(fetch.mock.calls[0][1].method).toBe("PUT");
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe("Bearer token");
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual(settings);
    expect(getSession()?.settings).toEqual(settings);
  });
  it("preserves saved preferences on failure and supports retry", async () => {
    setSession({
      username: "user",
      token: "token",
      settings: { themeColor: "#245c50" },
    });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response("{}", { status: 500 }))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ themeColor: "#663399" })),
        ),
    );
    await expect(saveUserSettings({ themeColor: "#663399" })).rejects.toThrow();
    expect(getSession()?.settings.themeColor).toBe("#245c50");
    await saveUserSettings({ themeColor: "#663399" });
    expect(getSession()?.settings.themeColor).toBe("#663399");
  });
  it("does not restore a logged-out session when a save completes", async () => {
    setSession({ username: "user", token: "token", settings: {} });
    let finish!: (response: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            finish = resolve;
          }),
      ),
    );
    const pending = saveUserSettings({ themeColor: "#663399" });
    setSession(null);
    finish(new Response(JSON.stringify({ themeColor: "#663399" })));
    await pending;
    expect(getSession()).toBeNull();
  });
  it("sends form login, fetches settings with the token, then authenticates CRM requests", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("null", { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify("access-token")))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ themeColor: "#245c50" })),
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
    expect(fetch.mock.calls[2][0]).toBe("/user/settings");
    expect(fetch.mock.calls[2][1].headers.Authorization).toBe(
      "Bearer access-token",
    );
    expect(getSession()?.settings).toEqual({ themeColor: "#245c50" });
    await api("/contacts");
    expect(fetch.mock.calls[3][1].headers.Authorization).toBe(
      "Bearer access-token",
    );
  });
  it("waits for settings before publishing the session", async () => {
    let resolveSettings!: (response: Response) => void;
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify("access-token")))
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveSettings = resolve;
          }),
      );
    vi.stubGlobal("fetch", fetch);
    const pending = login("user", "password");
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(getSession()).toBeNull();
    resolveSettings(new Response("{}"));
    await pending;
    expect(getSession()).toEqual({
      username: "user",
      token: "access-token",
      settings: {},
    });
  });
  it.each([null, [], "invalid"])(
    "rejects invalid settings %j without creating a session",
    async (settings) => {
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValueOnce(new Response(JSON.stringify("access-token")))
          .mockResolvedValueOnce(new Response(JSON.stringify(settings))),
      );
      await expect(login("user", "password")).rejects.toThrow("הגדרות החשבון");
      expect(getSession()).toBeNull();
    },
  );
  it("keeps login available when loading settings fails", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify("access-token")))
      .mockResolvedValueOnce(new Response("{}", { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify("retry-token")))
      .mockResolvedValueOnce(new Response("{}"));
    vi.stubGlobal("fetch", fetch);
    await expect(login("user", "password")).rejects.toThrow();
    expect(getSession()).toBeNull();
    await login("user", "password");
    expect(getSession()?.token).toBe("retry-token");
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
