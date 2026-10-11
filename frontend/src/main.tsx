import React from "react";
import { createRoot } from "react-dom/client";
import { CacheProvider } from "@emotion/react";
import createCache from "@emotion/cache";
import { prefixer } from "stylis";
import rtlPlugin from "@mui/stylis-plugin-rtl";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { heIL } from "@mui/material/locale";
import App from "./App";
import "./style.css";
const theme = createTheme(
  {
    direction: "rtl",
    cssVariables: true,
    palette: {
      primary: { main: "#245c50", light: "#e4ede8", dark: "#214e3e" },
      secondary: { main: "#b77746" },
      divider: "#e5e9e2",
      text: { primary: "#253a31", secondary: "#626e67" },
      action: { hover: "#e8f0ea", selected: "#e8f0ea" },
      background: { default: "#f5f6f2", paper: "#ffffff" },
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
const rtlCache = createCache({
  key: "rtl",
  stylisPlugins: [prefixer, rtlPlugin],
});

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <CacheProvider value={rtlCache}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <App />
      </ThemeProvider>
    </CacheProvider>
  </React.StrictMode>,
);
