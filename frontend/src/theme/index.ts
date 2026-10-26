import createCache from "@emotion/cache";
import { prefixer } from "stylis";
import rtlPlugin from "@mui/stylis-plugin-rtl";
import { createTheme, lighten, darken, alpha } from "@mui/material/styles";
import { heIL } from "@mui/material/locale";

export const defaultThemeColor = "#245c50";
export function readThemeColor(settings?: Record<string, unknown>) {
  const color = settings?.themeColor;
  return typeof color === "string" && /^#[\da-f]{6}$/i.test(color)
    ? color
    : defaultThemeColor;
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
        MuiCard: { defaultProps: { variant: "outlined" } },
        MuiCardContent: {
          styleOverrides: {
            root: ({ theme }) => ({
              padding: theme.spacing(3),
              "&:last-child": { paddingBottom: theme.spacing(3) },
              [theme.breakpoints.down("md")]: {
                padding: theme.spacing(2),
                "&:last-child": { paddingBottom: theme.spacing(2) },
              },
            }),
          },
        },
        MuiCssBaseline: {
          styleOverrides: {
            "@media (prefers-reduced-motion: reduce)": {
              "*, *::before, *::after": {
                animation: "none !important",
                transition: "none !important",
                scrollBehavior: "auto !important",
              },
            },
          },
        },
      },
    },
    heIL,
  );
export const rtlCache = createCache({
  key: "rtl",
  stylisPlugins: [prefixer, rtlPlugin],
});
