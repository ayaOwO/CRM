import createCache from "@emotion/cache";
import { prefixer } from "stylis";
import rtlPlugin from "@mui/stylis-plugin-rtl";
import { createTheme, lighten, darken, alpha } from "@mui/material/styles";
import { heIL } from "@mui/material/locale";

export const defaultThemeColor = "#245c50";
export const themeColorStorageKey = "crm.themeColor";

export function readThemeColor() {
  try {
    const color = localStorage.getItem(themeColorStorageKey);
    return color && /^#[\da-f]{6}$/i.test(color) ? color : defaultThemeColor;
  } catch {
    return defaultThemeColor;
  }
}

export function saveThemeColor(color: string) {
  try {
    localStorage.setItem(themeColorStorageKey, color);
    return true;
  } catch {
    return false;
  }
}

export const createAppTheme = (color: string) =>
  createTheme(
    {
      direction: "rtl",
      cssVariables: true,
      palette: {
        contrastThreshold: 4.5,
        primary: {
          main: color,
          light: lighten(color, 0.9),
          dark: darken(color, 0.2),
        },
        secondary: { main: "#b77746" },
        divider: lighten(color, 0.88),
        text: { primary: "#253a31", secondary: "#626e67" },
        action: { hover: alpha(color, 0.08), selected: alpha(color, 0.12) },
        background: { default: lighten(color, 0.97), paper: "#ffffff" },
      },
      typography: {
        fontFamily: "Arial, sans-serif",
        h4: { fontWeight: 700 },
        h5: { fontWeight: 700 },
        button: { fontWeight: 600 },
      },
      shape: { borderRadius: 14 },
      components: {
        MuiButton: { defaultProps: { disableElevation: true } },
        MuiPaper: { defaultProps: { elevation: 0 } },
        MuiTextField: { defaultProps: { size: "small" } },
      },
    },
    heIL,
  );
export const rtlCache = createCache({
  key: "rtl",
  stylisPlugins: [prefixer, rtlPlugin],
});
