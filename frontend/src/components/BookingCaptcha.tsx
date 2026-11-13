import { useEffect, useRef, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";

type Turnstile = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}
export default function BookingCaptcha({
  siteKey,
  onToken,
}: {
  siteKey: string;
  onToken: (token: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let widget: string | undefined;
    let active = true;
    const fail = () => {
      if (active) {
        setLoading(false);
        setError(
          "לא ניתן להשלים את האימות. בדקו את החיבור או את חוסם התוכן ונסו שוב.",
        );
        onToken("");
      }
    };
    const timeout = setTimeout(fail, 15000);
    const render = () => {
      if (!active || !container.current || !window.turnstile || widget) return;
      try {
        widget = window.turnstile.render(container.current, {
          sitekey: siteKey,
          language: "he",
          size: "flexible",
          callback: (token: string) => {
            if (active) {
              clearTimeout(timeout);
              setLoading(false);
              setError("");
              onToken(token);
            }
          },
          "expired-callback": () => {
            if (active) {
              onToken("");
              setError("תוקף האימות פג. בצעו אימות חדש לפני אישור הפגישה.");
            }
          },
          "error-callback": fail,
        });
        clearTimeout(timeout);
        setLoading(false);
      } catch {
        fail();
      }
    };
    let script = document.querySelector<HTMLScriptElement>(
      "script[data-booking-captcha]",
    );
    if (attempt && script && !window.turnstile) {
      script.remove();
      script = null;
    }
    if (!script) {
      script = document.createElement("script");
      script.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.dataset.bookingCaptcha = "true";
      document.head.appendChild(script);
    }
    script.addEventListener("load", render);
    script.addEventListener("error", fail);
    render();
    return () => {
      active = false;
      clearTimeout(timeout);
      script.removeEventListener("load", render);
      script.removeEventListener("error", fail);
      if (widget) window.turnstile?.remove(widget);
    };
  }, [siteKey, onToken, attempt]);
  return (
    <Box sx={{ minHeight: 65 }}>
      {loading && (
        <Typography role="status">טוענים אימות לפני הזמנה…</Typography>
      )}
      {error && (
        <Alert
          severity="error"
          action={
            <Button
              color="inherit"
              onClick={() => {
                setError("");
                setLoading(true);
                onToken("");
                setAttempt((v) => v + 1);
              }}
            >
              ניסיון נוסף
            </Button>
          }
        >
          {error}
        </Alert>
      )}
      <Box ref={container} />
    </Box>
  );
}
