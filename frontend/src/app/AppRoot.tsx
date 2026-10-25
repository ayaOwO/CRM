import { useMemo, useState, useSyncExternalStore } from "react";
import { CacheProvider } from "@emotion/react";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { heIL } from "@mui/x-date-pickers/locales";
import "dayjs/locale/he";
import {
  createAppTheme,
  readThemeColor,
  saveThemeColor,
  rtlCache,
} from "../theme";
import App from "./App";
import AuthView from "../views/AuthView";
import { getSession, subscribeSession, setSession } from "../lib/session";

export default function AppRoot() {
  const session = useSyncExternalStore(
    subscribeSession,
    getSession,
    () => null,
  );
  const [themeColor, setThemeColor] = useState(readThemeColor);
  const [themeSaveError, setThemeSaveError] = useState(false);
  const theme = useMemo(() => createAppTheme(themeColor), [themeColor]);
  const changeThemeColor = (color: string) => {
    setThemeColor(color);
    setThemeSaveError(!saveThemeColor(color));
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
          {session ? (
            <App
              key={session.token}
              username={session.username}
              onLogout={() => setSession(null)}
              themeColor={themeColor}
              onThemeColorChange={changeThemeColor}
              themeSaveError={themeSaveError}
            />
          ) : (
            <AuthView />
          )}
        </LocalizationProvider>
      </ThemeProvider>
    </CacheProvider>
  );
}
