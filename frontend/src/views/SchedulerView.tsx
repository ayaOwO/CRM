import { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { api, errorText } from "../lib/api";
import {
  defaultScheduler,
  schedulers,
  type Scheduler,
  type SchedulerData,
  type TimeSpan,
} from "../lib/scheduler";

const days = ["שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת", "ראשון"];
export default function SchedulerView() {
  const [items, setItems] = useState<Scheduler[]>([]);
  const [draft, setDraft] = useState<SchedulerData | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [link, setLink] = useState("");
  const [deleting, setDeleting] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    schedulers()
      .then((v) => {
        if (active) setItems(v);
      })
      .catch((e) => {
        if (active) setError(errorText(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  async function action(run: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await run();
      setItems(await schedulers());
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  function field<K extends keyof SchedulerData>(
    key: K,
    value: SchedulerData[K],
  ) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }
  const intervals = (value: TimeSpan[], onChange: (v: TimeSpan[]) => void) => (
    <Stack spacing={1}>
      {value.map((span, index) => (
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          key={index}
          alignItems={{ xs: "stretch", sm: "center" }}
        >
          <TextField
            required
            label="משעה"
            type="time"
            value={span.start}
            onChange={(e) =>
              onChange(
                value.map((s, i) =>
                  i === index ? { ...s, start: e.target.value } : s,
                ),
              )
            }
            slotProps={{
              inputLabel: { shrink: true },
              htmlInput: { step: 300, dir: "ltr" },
            }}
          />
          <Typography color="text.secondary" sx={{ px: { sm: 0.5 } }}>
            עד
          </Typography>
          <TextField
            required
            label="עד שעה"
            type="time"
            value={span.end}
            onChange={(e) =>
              onChange(
                value.map((s, i) =>
                  i === index ? { ...s, end: e.target.value } : s,
                ),
              )
            }
            slotProps={{
              inputLabel: { shrink: true },
              htmlInput: { step: 300, dir: "ltr" },
            }}
          />
          <Button
            aria-label={`הסרת טווח ${span.start} עד ${span.end}`}
            onClick={() => onChange(value.filter((_, i) => i !== index))}
          >
            הסרה
          </Button>
        </Stack>
      ))}
      <Button
        sx={{ alignSelf: "flex-start" }}
        onClick={() => onChange([...value, { start: "09:00", end: "17:00" }])}
      >
        הוספת טווח שעות
      </Button>
    </Stack>
  );
  return (
    <Stack spacing={3} sx={{ maxWidth: 950 }}>
      {error && <Alert severity="error">{error}</Alert>}
      {link && (
        <Alert severity="success" onClose={() => setLink("")}>
          <Typography>
            הקישור מוכן לשיתוף. שמרו אותו כעת; יצירת קישור חדש מבטלת את הקודם.
          </Typography>
          <TextField
            fullWidth
            label="קישור לתיאום פגישה"
            value={link}
            slotProps={{ input: { readOnly: true }, htmlInput: { dir: "ltr" } }}
            sx={{ mt: 1 }}
          />
          <Button
            onClick={() =>
              void navigator.clipboard
                .writeText(link)
                .catch(() =>
                  setError("העתקה נכשלה. אפשר לסמן ולהעתיק את הקישור."),
                )
            }
          >
            העתקת קישור
          </Button>
          <Button href={link} target="_blank" rel="noreferrer">
            פתיחת עמוד התיאום
          </Button>
        </Alert>
      )}
      {!draft && (
        <>
          <Button
            variant="contained"
            sx={{ alignSelf: "flex-start" }}
            disabled={busy}
            onClick={() => {
              setDraft(defaultScheduler());
              setEditId(null);
            }}
          >
            סוג פגישה חדש
          </Button>
          {loading ? (
            <Typography role="status">טוענים סוגי פגישות…</Typography>
          ) : (
            items.length === 0 && (
              <Typography>
                צרו סוג פגישה והגדירו מתי אפשר להזמין אותה.
              </Typography>
            )
          )}
          {items.map((item) => (
            <Box
              key={item.id}
              sx={{ borderBottom: 1, borderColor: "divider", pb: 3 }}
            >
              <Typography variant="h6">{item.title}</Typography>
              <Typography color="text.secondary">
                {item.duration_minutes} דקות · {item.location} · {item.timezone}
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 1 }}>
                <Button
                  disabled={busy}
                  onClick={() => {
                    const { id, ...data } = item;
                    setEditId(id);
                    setDraft(data);
                  }}
                >
                  עריכה
                </Button>
                <Button
                  disabled={busy}
                  onClick={() =>
                    void action(async () => {
                      const result = await api<{ booking_path: string }>(
                        `/scheduler/${item.id}/link`,
                        "POST",
                        {},
                      );
                      setLink(location.origin + result.booking_path);
                    })
                  }
                >
                  יצירת קישור חדש
                </Button>
                <Button
                  color="error"
                  disabled={busy}
                  onClick={() => setDeleting(item.id)}
                >
                  מחיקה
                </Button>
              </Stack>
              {deleting === item.id && (
                <Alert severity="warning">
                  מחיקת סוג הפגישה תבטל הזמנות חדשות דרך הקישור. פגישות קיימות
                  יישמרו.
                  <Button
                    disabled={busy}
                    color="error"
                    onClick={() =>
                      void action(async () => {
                        await api(`/scheduler/${item.id}`, "DELETE");
                        setDeleting(null);
                      })
                    }
                  >
                    אישור מחיקה
                  </Button>
                  <Button onClick={() => setDeleting(null)}>חזרה</Button>
                </Alert>
              )}
            </Box>
          ))}
        </>
      )}
      {draft && (
        <Box
          component="form"
          onSubmit={(e) => {
            e.preventDefault();
            void action(async () => {
              const saved = await api<Scheduler & { booking_path?: string }>(
                editId ? `/scheduler/${editId}` : "/scheduler",
                editId ? "PATCH" : "POST",
                draft,
              );
              if (saved.booking_path)
                setLink(location.origin + saved.booking_path);
              setDraft(null);
            });
          }}
        >
          <Stack spacing={3}>
            <Typography variant="h5">
              {editId ? "עריכת סוג פגישה" : "סוג פגישה חדש"}
            </Typography>
            <TextField
              required
              label="שם הפגישה"
              value={draft.title}
              onChange={(e) => field("title", e.target.value)}
            />
            <TextField
              required
              label="מיקום"
              value={draft.location}
              onChange={(e) => field("location", e.target.value)}
            />
            <TextField
              required
              slotProps={{ htmlInput: { dir: "ltr" } }}
              label="אזור זמן"
              helperText="לדוגמה Asia/Jerusalem"
              value={draft.timezone}
              onChange={(e) => field("timezone", e.target.value)}
            />
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                gap: 2,
              }}
            >
              {(
                [
                  ["duration_minutes", "משך פגישה בדקות"],
                  ["buffer_minutes", "הפסקה בין פגישות בדקות"],
                  ["slot_minutes", "מרווח בין שעות התחלה בדקות"],
                  ["min_notice_hours", "התראה מראש בשעות"],
                  ["max_advance_days", "כמה ימים מראש אפשר להזמין"],
                  [
                    "cancel_notice_hours",
                    "מועד אחרון לשינוי — שעות לפני הפגישה",
                  ],
                ] as const
              ).map(([key, label]) => (
                <TextField
                  key={key}
                  required
                  type="number"
                  label={label}
                  value={draft[key]}
                  onChange={(e) => field(key, Number(e.target.value))}
                  slotProps={{
                    htmlInput: {
                      min:
                        key === "duration_minutes" || key === "slot_minutes"
                          ? 5
                          : key === "max_advance_days"
                            ? 1
                            : 0,
                    },
                  }}
                />
              ))}
            </Box>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              {(
                [
                  ["window_start", "תחילת חלון הזמנות"],
                  ["window_end", "סוף חלון הזמנות"],
                ] as const
              ).map(([key, label]) => (
                <TextField
                  key={key}
                  fullWidth
                  label={label}
                  type="datetime-local"
                  value={
                    draft[key]
                      ? new Date(
                          new Date(draft[key]!).getTime() -
                            new Date(draft[key]!).getTimezoneOffset() * 60000,
                        )
                          .toISOString()
                          .slice(0, 16)
                      : ""
                  }
                  onChange={(e) =>
                    field(
                      key,
                      e.target.value
                        ? new Date(e.target.value).toISOString()
                        : null,
                    )
                  }
                  helperText="אופציונלי. בוחרים לפי השעון המקומי של המכשיר; הזמנים נשמרים כאותה נקודת זמן."
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              ))}
            </Stack>
            <TextField
              label="מחיר לתצוגה"
              value={draft.price}
              onChange={(e) => field("price", e.target.value)}
            />
            <TextField
              multiline
              minRows={3}
              label="תנאים ומידע נוסף"
              value={draft.terms}
              onChange={(e) => field("terms", e.target.value)}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={draft.allow_cancel}
                  onChange={(e) => field("allow_cancel", e.target.checked)}
                />
              }
              label="אפשרו ביטול פגישות"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={draft.allow_reschedule}
                  onChange={(e) => field("allow_reschedule", e.target.checked)}
                />
              }
              label="אפשרו שינוי מועד"
            />
            <Divider />
            <Typography variant="h6">זמינות שבועית</Typography>
            <Typography color="text.secondary">
              השעות לפי אזור הזמן של סוג הפגישה. יום ללא טווח שעות סגור להזמנות.
            </Typography>
            {days.map((name, day) => (
              <Box key={day}>
                <Typography sx={{ mb: 1 }}>{name}</Typography>
                {intervals(
                  draft.repeat.filter((r) => r.day === day),
                  (value) =>
                    field("repeat", [
                      ...draft.repeat.filter((r) => r.day !== day),
                      ...value.map((v) => ({ ...v, day })),
                    ]),
                )}
              </Box>
            ))}
            <Divider />
            <Typography variant="h6">חריגות לפי תאריך</Typography>
            <Typography color="text.secondary">
              חריגה מחליפה את הזמינות השבועית לתאריך הזה. ללא שעות — היום סגור.
            </Typography>
            {draft.overrides.map((override, index) => (
              <Stack spacing={1} key={index}>
                <TextField
                  required
                  label="תאריך חריגה"
                  type="date"
                  value={override.date}
                  onChange={(e) =>
                    field(
                      "overrides",
                      draft.overrides.map((o, i) =>
                        i === index ? { ...o, date: e.target.value } : o,
                      ),
                    )
                  }
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                {intervals(override.intervals, (value) =>
                  field(
                    "overrides",
                    draft.overrides.map((o, i) =>
                      i === index ? { ...o, intervals: value } : o,
                    ),
                  ),
                )}
                <Button
                  color="error"
                  onClick={() =>
                    field(
                      "overrides",
                      draft.overrides.filter((_, i) => i !== index),
                    )
                  }
                >
                  הסרת חריגה
                </Button>
              </Stack>
            ))}
            <Button
              onClick={() =>
                field("overrides", [
                  ...draft.overrides,
                  { date: "", intervals: [] },
                ])
              }
            >
              הוספת חריגה
            </Button>
            <Stack direction="row" spacing={2}>
              <Button type="submit" variant="contained" disabled={busy}>
                {busy ? "שומרים…" : "שמירה"}
              </Button>
              <Button disabled={busy} onClick={() => setDraft(null)}>
                חזרה
              </Button>
            </Stack>
          </Stack>
        </Box>
      )}
    </Stack>
  );
}
