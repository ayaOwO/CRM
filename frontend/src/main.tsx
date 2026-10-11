import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
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
} from "./theme";
import App from "./App";

function Root() {
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
          <App
            themeColor={themeColor}
            onThemeColorChange={changeThemeColor}
            themeSaveError={themeSaveError}
          />
        </LocalizationProvider>
      </ThemeProvider>
    </CacheProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
