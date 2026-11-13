import { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Divider from "@mui/material/Divider";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import BookingCaptcha from "../components/BookingCaptcha";
import { errorText } from "../lib/api";
import {
  bookingDate,
  downloadCalendar,
  guestApi,
  type GuestBooking,
  type SchedulerData,
} from "../lib/scheduler";

export default function BookingView({ code }: { code?: string }) {
  const management = !code ? location.hash.slice(1) : undefined;
  const [info, setInfo] = useState<
    (SchedulerData & { captcha_site_key: string }) | null
  >(null);
  const [bookings, setBookings] = useState<GuestBooking[]>([]);
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [chosen, setChosen] = useState("");
  const [moving, setMoving] = useState<GuestBooking | null>(null);
  const [cancelId, setCancelId] = useState<number | null>(null);
  const [details, setDetails] = useState({
    first_name: "",
    last_name: "",
    phone_number: "",
    notes: "",
    website: "",
  });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [privateLink, setPrivateLink] = useState("");
  const [loading, setLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [captcha, setCaptcha] = useState("");
  const [captchaVersion, setCaptchaVersion] = useState(0);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      try {
        if (code) {
          const data = await guestApi<
            SchedulerData & { captcha_site_key: string }
          >(
            `/booking/${encodeURIComponent(code)}`,
            "GET",
            undefined,
            undefined,
            undefined,
            abort.signal,
          );
          setInfo(data);
          setBookings(
            await guestApi<GuestBooking[]>(
              `/guest/appointments?code=${encodeURIComponent(code)}`,
              "GET",
              undefined,
              undefined,
              undefined,
              abort.signal,
            ),
          );
        } else {
          const booking = await guestApi<GuestBooking>(
            "/guest/manage",
            "GET",
            undefined,
            management,
            undefined,
            abort.signal,
          );
          setBookings([booking]);
        }
      } catch (e) {
        if (!abort.signal.aborted) setError(errorText(e));
      } finally {
        if (!abort.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => abort.abort();
  }, [code, management, reload]);
  const timezone = moving?.timezone ?? info?.timezone;
  useEffect(() => {
    setSlots([]);
    setChosen("");
    if (!date || (!code && !moving)) return;
    const abort = new AbortController();
    setSlotsLoading(true);
    const path = moving
      ? `/guest/appointments/${moving.id}/slots`
      : `/booking/${encodeURIComponent(code!)}/slots`;
    guestApi<string[]>(
      `${path}?first=${date}&last=${date}`,
      "GET",
      undefined,
      management,
      undefined,
      abort.signal,
    )
      .then(setSlots)
      .catch((e) => {
        if (!abort.signal.aborted) setError(errorText(e));
      })
      .finally(() => {
        if (!abort.signal.aborted) setSlotsLoading(false);
      });
    return () => abort.abort();
  }, [code, date, moving, management, reload]);
  async function perform(run: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await run();
    } catch (e) {
      setError(errorText(e));
      setReload((v) => v + 1);
    } finally {
      setBusy(false);
    }
  }
  const refresh = async () => {
    setBookings(
      code
        ? await guestApi<GuestBooking[]>(
            `/guest/appointments?code=${encodeURIComponent(code)}`,
          )
        : [
            await guestApi<GuestBooking>(
              "/guest/manage",
              "GET",
              undefined,
              management,
            ),
          ],
    );
  };
  return (
    <Container component="main" maxWidth="sm" sx={{ py: { xs: 3, sm: 6 } }}>
      <Stack spacing={3}>
        <Typography variant="h4" component="h1">
          {info?.title ?? (code ? "תיאום פגישה" : "ניהול הפגישה")}
        </Typography>
        {loading && (
          <Typography role="status">טוענים את פרטי הפגישה…</Typography>
        )}
        {error && (
          <Alert
            severity="error"
            action={
              <Button color="inherit" onClick={() => setReload((v) => v + 1)}>
                רענון
              </Button>
            }
          >
            {error}
          </Alert>
        )}
        {notice && <Alert severity="success">{notice}</Alert>}
        {info && (
          <Stack spacing={1}>
            <Typography>
              {info.duration_minutes} דקות · {info.location}
            </Typography>
            {info.price && <Typography>מחיר: {info.price}</Typography>}
            <Typography sx={{ whiteSpace: "pre-wrap" }}>
              {info.terms}
            </Typography>
            <Typography color="text.secondary">
              {info.allow_cancel ? "ביטול אפשרי" : "ביטול דרך המארגן בלבד"} ·{" "}
              {info.allow_reschedule
                ? "אפשר לשנות מועד"
                : "שינוי דרך המארגן בלבד"}
            </Typography>
            <Typography color="text.secondary">
              שינויים עד {info.cancel_notice_hours} שעות לפני הפגישה.
            </Typography>
          </Stack>
        )}
        {privateLink && (
          <Alert severity="info">
            <Typography>
              שמרו את הקישור הפרטי לניהול הפגישה גם ממכשיר אחר. שתפו אותו רק עם
              מי שרשאי לנהל אותה.
            </Typography>
            <TextField
              label="קישור פרטי לניהול"
              value={privateLink}
              fullWidth
              slotProps={{
                input: { readOnly: true },
                htmlInput: { dir: "ltr" },
              }}
              sx={{ mt: 2 }}
            />
            <Button
              onClick={() =>
                void navigator.clipboard
                  .writeText(privateLink)
                  .catch(() => setError("אפשר לסמן ולהעתיק את הקישור."))
              }
            >
              העתקת הקישור
            </Button>
          </Alert>
        )}
        {bookings.length > 0 && (
          <>
            <Divider />
            <Typography variant="h5" component="h2">
              הפגישות שלי
            </Typography>
            {bookings.map((booking) => {
              const deadlinePassed =
                new Date(booking.start_time).getTime() <=
                Date.now() + booking.cancel_notice_hours * 3600000;
              return (
                <Stack
                  spacing={1}
                  key={booking.id}
                  sx={{ pb: 2, borderBottom: 1, borderColor: "divider" }}
                >
                  <Typography variant="h6">{booking.title}</Typography>
                  <Typography>
                    {bookingDate(booking.start_time, booking.timezone)}
                  </Typography>
                  <Typography color="text.secondary">
                    {booking.location} · {booking.timezone}
                  </Typography>
                  <Stack direction="row" flexWrap="wrap" gap={1}>
                    <Button
                      disabled={
                        busy ||
                        !booking.allow_reschedule ||
                        deadlinePassed ||
                        !booking.scheduler_available
                      }
                      onClick={() => {
                        setMoving(booking);
                        setDate("");
                        setChosen("");
                        setError("");
                      }}
                    >
                      שינוי מועד
                    </Button>
                    <Button
                      color="error"
                      disabled={busy || !booking.allow_cancel || deadlinePassed}
                      onClick={() => setCancelId(booking.id)}
                    >
                      ביטול פגישה
                    </Button>
                    <Button onClick={() => downloadCalendar(booking)}>
                      הוספה ליומן
                    </Button>
                  </Stack>
                  {deadlinePassed && (
                    <Typography color="text.secondary">
                      מועד השינויים עבר. לשינוי או ביטול יש לפנות למארגן.
                    </Typography>
                  )}
                  {cancelId === booking.id && (
                    <Alert severity="warning">
                      לבטל את הפגישה?
                      <Button
                        color="error"
                        disabled={busy}
                        onClick={() =>
                          void perform(async () => {
                            await guestApi(
                              `/guest/appointments/${booking.id}`,
                              "DELETE",
                              {},
                              management,
                            );
                            setBookings((v) =>
                              v.filter((b) => b.id !== booking.id),
                            );
                            setCancelId(null);
                            setMoving(null);
                            setPrivateLink("");
                            setNotice("הפגישה בוטלה.");
                            setReload((v) => (code ? v + 1 : v));
                          })
                        }
                      >
                        אישור ביטול
                      </Button>
                      <Button disabled={busy} onClick={() => setCancelId(null)}>
                        חזרה
                      </Button>
                    </Alert>
                  )}
                </Stack>
              );
            })}
          </>
        )}
        {info && bookings.length > 0 && !moving && (
          <Typography color="text.secondary">
            אפשר לקבוע פגישה עתידית אחת לכל מארגן בדפדפן הזה. לשינוי הפגישה
            הקיימת בחרו שינוי מועד.
          </Typography>
        )}
        {((info && bookings.length === 0) || moving) && (
          <Box
            component="form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!chosen) return;
              void perform(async () => {
                if (moving) {
                  await guestApi(
                    `/guest/appointments/${moving.id}`,
                    "PATCH",
                    { start_time: chosen },
                    management,
                  );
                  setMoving(null);
                  setNotice("מועד הפגישה עודכן.");
                } else {
                  try {
                    const result = await guestApi<
                      GuestBooking & { management_path: string }
                    >(
                      `/booking/${encodeURIComponent(code!)}`,
                      "POST",
                      { ...details, start_time: chosen },
                      undefined,
                      captcha,
                    );
                    setPrivateLink(location.origin + result.management_path);
                    setNotice("הפגישה נקבעה בהצלחה.");
                  } finally {
                    setCaptcha("");
                    setCaptchaVersion((v) => v + 1);
                  }
                }
                setChosen("");
                setDate("");
                await refresh();
              });
            }}
          >
            <Stack spacing={3}>
              <Typography component="h2" variant="h5">
                {moving ? "בחירת מועד חדש" : "בחירת מועד"}
              </Typography>
              <TextField
                required
                label="תאריך"
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setError("");
                }}
                slotProps={{ inputLabel: { shrink: true } }}
                helperText={`השעות מוצגות לפי ${timezone}`}
              />
              {slotsLoading ? (
                <Typography role="status">בודקים שעות פנויות…</Typography>
              ) : date && slots.length === 0 ? (
                <Alert severity="info">
                  אין שעות פנויות בתאריך הזה. נסו תאריך אחר.
                </Alert>
              ) : (
                slots.length > 0 && (
                  <TextField
                    select
                    required
                    label="שעה פנויה"
                    value={chosen}
                    onChange={(e) => setChosen(e.target.value)}
                  >
                    {slots.map((slot) => (
                      <MenuItem key={slot} value={slot}>
                        {bookingDate(slot, timezone!)}
                      </MenuItem>
                    ))}
                  </TextField>
                )
              )}
              {!moving && (
                <>
                  <TextField
                    required
                    label="שם פרטי"
                    autoComplete="given-name"
                    value={details.first_name}
                    onChange={(e) =>
                      setDetails((d) => ({ ...d, first_name: e.target.value }))
                    }
                  />
                  <TextField
                    required
                    label="שם משפחה"
                    autoComplete="family-name"
                    value={details.last_name}
                    onChange={(e) =>
                      setDetails((d) => ({ ...d, last_name: e.target.value }))
                    }
                  />
                  <TextField
                    required
                    type="tel"
                    label="מספר טלפון"
                    autoComplete="tel"
                    slotProps={{ htmlInput: { dir: "ltr" } }}
                    helperText="כולל קידומת מדינה, לדוגמה ‎+972"
                    value={details.phone_number}
                    onChange={(e) =>
                      setDetails((d) => ({
                        ...d,
                        phone_number: e.target.value,
                      }))
                    }
                  />
                  <TextField
                    multiline
                    minRows={2}
                    label="הערה למארגן"
                    value={details.notes}
                    onChange={(e) =>
                      setDetails((d) => ({ ...d, notes: e.target.value }))
                    }
                  />
                  <Box aria-hidden="true" sx={{ display: "none" }}>
                    <input
                      tabIndex={-1}
                      autoComplete="off"
                      name="website"
                      value={details.website}
                      onChange={(e) =>
                        setDetails((d) => ({ ...d, website: e.target.value }))
                      }
                    />
                  </Box>
                  {info?.captcha_site_key && (
                    <BookingCaptcha
                      key={captchaVersion}
                      siteKey={info.captcha_site_key}
                      onToken={setCaptcha}
                    />
                  )}
                </>
              )}
              <Stack direction="row" spacing={2}>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={
                    busy ||
                    !chosen ||
                    (!moving && !!info?.captcha_site_key && !captcha)
                  }
                >
                  {busy
                    ? "שומרים…"
                    : moving
                      ? "אישור המועד החדש"
                      : "אישור הפגישה"}
                </Button>
                {moving && (
                  <Button
                    disabled={busy}
                    onClick={() => {
                      setMoving(null);
                      setDate("");
                    }}
                  >
                    חזרה
                  </Button>
                )}
              </Stack>
            </Stack>
          </Box>
        )}
      </Stack>
    </Container>
  );
}
