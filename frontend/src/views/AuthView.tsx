import { useRef, useState, type FormEvent } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Psychology from "@mui/icons-material/Psychology";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import { login, signup } from "../lib/auth";
import { errorText } from "../lib/api";
import { getSessionNotice } from "../lib/session";

export default function AuthView() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const usernameInput = useRef<HTMLInputElement>(null);
  const confirmationInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState(getSessionNotice);
  const [created, setCreated] = useState(false);
  const isSignup = mode === "signup";
  const mismatch = isSignup && !!confirmation && password !== confirmation;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    setError("");
    if (isSignup && password !== confirmation) {
      confirmationInput.current?.focus();
      return;
    }
    submitting.current = true;
    setBusy(true);
    try {
      if (isSignup) {
        await signup(username.trim(), email.trim(), password);
        setCreated(true);
        setMode("login");
        setPassword("");
        setConfirmation("");
        setShowPassword(false);
      } else {
        await login(username.trim(), password);
      }
    } catch (error) {
      setError(errorText(error));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  function switchMode() {
    setMode(isSignup ? "login" : "signup");
    setPassword("");
    setConfirmation("");
    setShowPassword(false);
    setError("");
    setCreated(false);
    usernameInput.current?.focus();
  }

  return (
    <Container
      component="main"
      maxWidth={false}
      sx={{
        minHeight: "100dvh",
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) minmax(0, 1fr)" },
        p: { xs: 0, md: 3 },
        gap: { xs: 0, md: 3 },
        "& ::selection": {
          bgcolor: "primary.main",
          color: "primary.contrastText",
        },
        "& input": { caretColor: "primary.main" },
      }}
    >
      <Stack
        sx={{
          px: { xs: 3, sm: 6, md: 8 },
          py: { xs: 4, md: 6 },
          justifyContent: "space-between",
        }}
      >
        <Stack
          direction="row"
          spacing={1.5}
          alignItems="center"
          sx={{ mb: { xs: 5, md: 7 } }}
        >
          <Psychology color="primary" sx={{ fontSize: 36 }} />
          <Typography variant="h5">קליניקה</Typography>
        </Stack>
        <Box sx={{ width: "100%", maxWidth: 400, mx: "auto", my: "auto" }}>
          <Typography
            component="h1"
            variant="h4"
            sx={{ mb: 1.5, fontSize: { xs: 28, sm: 34 } }}
          >
            {isSignup ? "יצירת חשבון" : "התחברות לקליניקה"}
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 4, lineHeight: 1.7 }}>
            {isSignup
              ? "בחרו פרטי התחברות לחשבון הקליניקה שלכם."
              : "הזינו שם משתמש וסיסמה כדי להמשיך."}
          </Typography>
          <Stack
            component="form"
            onSubmit={submit}
            spacing={2.5}
            aria-label={isSignup ? "הרשמה" : "התחברות"}
            aria-busy={busy}
            sx={{ "& .MuiInputLabel-asterisk": { display: "none" } }}
          >
            {created && (
              <Alert severity="success" role="status">
                החשבון נוצר. התחברו עם הפרטים שבחרתם.
              </Alert>
            )}
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              inputRef={usernameInput}
              id="username"
              name="username"
              label="שם משתמש"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
              fullWidth
              disabled={busy}
              autoComplete="username"
              size="medium"
              helperText={
                isSignup ? "שם המשתמש ישמש להתחברות לחשבון." : undefined
              }
              slotProps={{
                inputLabel: { shrink: true },
                htmlInput: {
                  maxLength: 50,
                  pattern: ".*\\S.*",
                  autoCapitalize: "none",
                  spellCheck: false,
                },
              }}
            />
            {isSignup && (
              <TextField
                id="email"
                name="email"
                label="כתובת דוא״ל"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                autoComplete="email"
                required
                fullWidth
                disabled={busy}
                size="medium"
                slotProps={{
                  inputLabel: { shrink: true },
                  htmlInput: { maxLength: 200, dir: "ltr" },
                }}
              />
            )}
            <TextField
              id="password"
              name="password"
              label="סיסמה"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type={showPassword ? "text" : "password"}
              autoComplete={isSignup ? "new-password" : "current-password"}
              required
              fullWidth
              disabled={busy}
              size="medium"
              slotProps={{
                inputLabel: { shrink: true },
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label={showPassword ? "הסתרת סיסמה" : "הצגת סיסמה"}
                        aria-pressed={showPassword}
                        disabled={busy}
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
            {isSignup && (
              <TextField
                inputRef={confirmationInput}
                id="confirmation"
                name="confirmation"
                label="אימות סיסמה"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                fullWidth
                disabled={busy}
                size="medium"
                error={mismatch}
                helperText={
                  mismatch
                    ? "הסיסמאות אינן תואמות. הזינו שוב את הסיסמה שבחרתם."
                    : undefined
                }
                slotProps={{ inputLabel: { shrink: true } }}
              />
            )}
            <Button
              type="submit"
              variant="contained"
              size="large"
              loading={busy}
              sx={{ minHeight: 50 }}
            >
              {isSignup ? "יצירת חשבון" : "כניסה לקליניקה"}
            </Button>
          </Stack>
          <Stack
            direction="row"
            spacing={0.5}
            alignItems="center"
            justifyContent="center"
            sx={{ mt: 3, flexWrap: "wrap", rowGap: 0.5 }}
          >
            <Typography variant="body2" color="text.secondary">
              {isSignup ? "כבר יש לכם חשבון?" : "עדיין אין לכם חשבון?"}
            </Typography>
            <Button onClick={switchMode} disabled={busy}>
              {isSignup ? "התחברות" : "הרשמה"}
            </Button>
          </Stack>
        </Box>
      </Stack>
      <Stack
        component="aside"
        sx={{
          display: { xs: "none", md: "flex" },
          bgcolor: "primary.main",
          color: "primary.contrastText",
          borderRadius: 3,
          p: { md: 6, lg: 9 },
          justifyContent: "center",
        }}
      >
        <Box sx={{ maxWidth: 460 }}>
          <Typography
            component="h2"
            sx={{
              fontSize: { md: 44, lg: 60 },
              fontWeight: 700,
              lineHeight: 1.15,
              mb: 3,
              textWrap: "balance",
            }}
          >
            פחות ניהול.
            <br />
            יותר מקום לטיפול.
          </Typography>
          <Typography sx={{ fontSize: 18, lineHeight: 1.9, maxWidth: 340 }}>
            המטופלים, הפגישות ויום העבודה שלכם — במקום אחד, בקצב שלכם.
          </Typography>
        </Box>
      </Stack>
    </Container>
  );
}
