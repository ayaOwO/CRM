import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import AppRoot from "./app/AppRoot";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppRoot />
  </StrictMode>,
);
