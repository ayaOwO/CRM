import { useMemo, useState, useSyncExternalStore } from "react";
import { CacheProvider } from "@emotion/react";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { heIL } from "@mui/x-date-pickers/locales";
import "dayjs/locale/he";
import { createAppTheme, readThemeColor, rtlCache } from "../theme";
import BookingView from "../views/BookingView";
import App from "./App";
import AuthView from "../views/AuthView";
import { getSession, subscribeSession, setSession } from "../lib/session";
import { saveUserSettings } from "../lib/settings";
import { errorText } from "../lib/api";

export default function AppRoot() {
  const session = useSyncExternalStore(
    subscribeSession,
    getSession,
    () => null,
  );
  const [preview, setPreview] = useState<{
    token: string;
    color: string;
  } | null>(null);
  const [themeSaving, setThemeSaving] = useState(false);
  const [themeSaveError, setThemeSaveError] = useState("");
  const savedColor = readThemeColor(session?.settings);
  const themeColor =
    session && preview?.token === session.token ? preview.color : savedColor;
  const theme = useMemo(() => createAppTheme(themeColor), [themeColor]);
  const changeThemeColor = (color: string) => {
    if (session) setPreview({ token: session.token, color });
    setThemeSaveError("");
  };
  const saveTheme = async () => {
    if (themeSaving || !session) return;
    setThemeSaving(true);
    setThemeSaveError("");
    try {
      await saveUserSettings({ themeColor });
    } catch (error) {
      if (getSession()?.token === session.token)
        setThemeSaveError(errorText(error));
    } finally {
      setThemeSaving(false);
    }
  };
  return (
    <CacheProvider value={rtlCache}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <LocalizationProvider
          dateAdapter={AdapterDayjs}
          adapterLocale="he"
          localeText={
            heIL.components.MuiLocalizationProvider.defaultProps.localeText
          }
        >
          {location.pathname.startsWith("/book/") ||
          location.pathname === "/manage" ? (
            <BookingView
              code={
                location.pathname.startsWith("/book/")
                  ? location.pathname.split("/")[2]
                  : undefined
              }
            />
          ) : session ? (
            <App
              key={session.token}
              username={session.username}
              onLogout={() => setSession(null)}
              themeColor={themeColor}
              onThemeColorChange={changeThemeColor}
              themeSaveError={
                preview?.token === session.token ? themeSaveError : ""
              }
              themeSaving={themeSaving}
              themeDirty={themeColor !== savedColor}
              onSaveTheme={() => void saveTheme()}
            />
          ) : (
            <AuthView />
          )}
        </LocalizationProvider>
      </ThemeProvider>
    </CacheProvider>
  );
}
