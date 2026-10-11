import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import Add from "@mui/icons-material/Add";
import ArrowBack from "@mui/icons-material/ArrowBack";
import ArrowForward from "@mui/icons-material/ArrowForward";
import CalendarMonthOutlined from "@mui/icons-material/CalendarMonthOutlined";
import Close from "@mui/icons-material/Close";
import DashboardOutlined from "@mui/icons-material/DashboardOutlined";
import DeleteOutline from "@mui/icons-material/DeleteOutline";
import EditOutlined from "@mui/icons-material/EditOutlined";
import Google from "@mui/icons-material/Google";
import GroupOutlined from "@mui/icons-material/GroupOutlined";
import SettingsOutlined from "@mui/icons-material/SettingsOutlined";
import SpaOutlined from "@mui/icons-material/SpaOutlined";
import {
  api,
  dateInput,
  fullName,
  layoutEvents,
  safeLink,
  shiftDay,
  weekStart,
} from "./api";
import type { Appointment, Contact } from "./api";

type Page = "home" | "clients" | "calendar";
type ContactDraft = Omit<Contact, "id" | "created_at"> & { id?: number };
type AppointmentDraft = Omit<Appointment, "id"> & { id?: number };
const blankContact: ContactDraft = {
  first_name: "",
  last_name: "",
  phone_number: "",
  notes: "",
  google_docs_link: "",
};
const timeFormat = new Intl.DateTimeFormat("he-IL", {
  hour: "2-digit",
  minute: "2-digit",
});
const dayFormat = new Intl.DateTimeFormat("he-IL", {
  weekday: "long",
  day: "numeric",
  month: "long",
});
const shortDayFormat = new Intl.DateTimeFormat("he-IL", {
  weekday: "short",
  day: "numeric",
  month: "numeric",
});
const time = (s: string) => timeFormat.format(new Date(s));
const isSameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "אירעה שגיאה. נסו שוב.";
const initials = (c: Contact) =>
  `${c.first_name[0] ?? ""}${c.last_name[0] ?? ""}`;

export default function App() {
  const [page, setPage] = useState<Page>("home");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [anchor, setAnchor] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [contactDraft, setContactDraft] = useState<ContactDraft | null>(null);
  const [appointmentDraft, setAppointmentDraft] =
    useState<AppointmentDraft | null>(null);
  const [detail, setDetail] = useState<Contact | null>(null);
  const [history, setHistory] = useState<Appointment[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [settings, setSettings] = useState(false);
  const [deletion, setDeletion] = useState<{
    kind: "contacts" | "appointments";
    id: number;
    label: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [toast, setToast] = useState("");
  const refreshVersion = useRef(0);
  const historyVersion = useRef(0);
  const calendarScroll = useRef<HTMLDivElement>(null);
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down("md"));
  const start = weekStart(anchor);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const now = new Date();
  const dayEvents = (day: Date) =>
    layoutEvents(
      appointments,
      new Date(new Date(day).setHours(0, 0, 0, 0)),
    ).map((item) => item.event);
  const todayAppointments = dayEvents(now);
  const activeDays = mobile
    ? [anchor]
    : Array.from({ length: 7 }, (_, i) => shiftDay(start, i));
  const contactNames = new Map(contacts.map((c) => [c.id, fullName(c)]));
  const contactName = (id: number) => contactNames.get(id) ?? `מטופל #${id}`;
  const guests = (a: Appointment) =>
    a.guests.map(contactName).join(", ") || "ללא מטופלים";

  async function refresh() {
    const version = ++refreshVersion.current;
    setLoading(true);
    setLoadError("");
    try {
      // Include today even when browsing a different calendar week.
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const until = new Date(
        Math.max(+shiftDay(start, 7), +shiftDay(today, 1)),
      );
      // ponytail: the API filters by start time, so a lower bound would hide
      // overnight appointments. Add server-side overlap filtering if volume grows.
      const params = new URLSearchParams({ end_time: until.toISOString() });
      const [c, a] = await Promise.all([
        api<Contact[]>("/contacts"),
        api<Appointment[]>(`/appointments?${params}`),
      ]);
      if (version === refreshVersion.current) {
        setContacts(c);
        setAppointments(
          a.filter(
            (item) =>
              (+new Date(item.end_time) > +start &&
                +new Date(item.start_time) < +shiftDay(start, 7)) ||
              (+new Date(item.end_time) > +today &&
                +new Date(item.start_time) < +shiftDay(today, 1)),
          ),
        );
      }
    } catch (e) {
      if (version === refreshVersion.current) setLoadError(errorText(e));
    } finally {
      if (version === refreshVersion.current) setLoading(false);
    }
  }
  useEffect(() => {
    void refresh();
    return () => {
      refreshVersion.current++;
    };
  }, [start.getTime()]); // One fetch per visible week.

  useEffect(() => {
    if (calendarScroll.current) calendarScroll.current.scrollTop = 8 * 64;
  }, [page, mobile, start.getTime(), loadError]);

  async function openDetail(contact: Contact) {
    const version = ++historyVersion.current;
    setDetail(contact);
    setHistory([]);
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const list = await api<Appointment[]>("/appointments");
      if (version === historyVersion.current)
        setHistory(list.filter((a) => a.guests.includes(contact.id)));
    } catch (e) {
      if (version === historyVersion.current) setHistoryError(errorText(e));
    } finally {
      if (version === historyVersion.current) setHistoryLoading(false);
    }
  }
  function closeDetail() {
    historyVersion.current++;
    setDetail(null);
  }
  function editContact(c?: Contact) {
    setFormError("");
    setContactDraft(c ? { ...c } : { ...blankContact });
  }
  function editAppointment(a?: Appointment, slot = new Date()) {
    setFormError("");
    if (!a) {
      slot = new Date(slot);
      slot.setMinutes(0, 0, 0);
    }
    setAppointmentDraft(
      a
        ? { ...a, guests: [...a.guests] }
        : {
            guests: [],
            location: "",
            start_time: slot.toISOString(),
            end_time: new Date(+slot + 60 * 60 * 1000).toISOString(),
          },
    );
  }
  function askDelete(
    kind: "contacts" | "appointments",
    id: number,
    label: string,
  ) {
    setFormError("");
    setDeletion({ kind, id, label });
  }
  async function saveContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!contactDraft || busy) return;
    setBusy(true);
    setFormError("");
    const { id, first_name, last_name, phone_number, notes, google_docs_link } =
      contactDraft;
    const body = {
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      phone_number: phone_number?.trim() || null,
      notes: notes || null,
      google_docs_link: google_docs_link?.trim() || null,
    };
    if (!body.first_name || !body.last_name) {
      setFormError("יש להזין שם פרטי ושם משפחה.");
      setBusy(false);
      return;
    }
    if (body.google_docs_link && !safeLink(body.google_docs_link)) {
      setFormError("יש להזין קישור תקין המתחיל ב־https:// או http://.");
      setBusy(false);
      return;
    }
    try {
      const saved = await api<Contact>(
        id ? `/contacts/${id}` : "/contacts",
        id ? "PUT" : "POST",
        body,
      );
      setContactDraft(null);
      if (detail?.id === saved.id) setDetail(saved);
      setToast("פרטי המטופל נשמרו");
      await refresh();
    } catch (e) {
      setFormError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function saveAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!appointmentDraft || busy) return;
    setBusy(true);
    setFormError("");
    const { id, guests, location, start_time, end_time } = appointmentDraft;
    const begin = new Date(start_time),
      end = new Date(end_time);
    if (
      !location.trim() ||
      !Number.isFinite(+begin) ||
      !Number.isFinite(+end) ||
      end <= begin
    ) {
      setFormError("יש להזין מיקום ושעת סיום מאוחרת משעת ההתחלה.");
      setBusy(false);
      return;
    }
    try {
      await api<Appointment>(
        id ? `/appointments/${id}` : "/appointments",
        id ? "PATCH" : "POST",
        {
          guests,
          location: location.trim(),
          start_time: begin.toISOString(),
          end_time: end.toISOString(),
        },
      );
      setAppointmentDraft(null);
      setToast("הפגישה נשמרה");
      await refresh();
      if (detail) await openDetail(detail);
    } catch (e) {
      setFormError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function deleteRecord() {
    if (!deletion || busy) return;
    setBusy(true);
    setFormError("");
    try {
      await api(`/${deletion.kind}/${deletion.id}`, "DELETE");
      if (deletion.kind === "contacts" && detail?.id === deletion.id)
        closeDetail();
      setDeletion(null);
      setToast("הרשומה נמחקה");
      await refresh();
      if (detail && deletion.kind === "appointments") await openDetail(detail);
    } catch (e) {
      setFormError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  const names: Record<Page, string> = {
    home: "סקירה כללית",
    clients: "מטופלים",
    calendar: "יומן פגישות",
  };
  return (
    <Box className="app-shell">
      <Paper component="aside" className="sidebar">
        <Box className="brand">
          <Avatar sx={{ bgcolor: "primary.main", width: 44, height: 44 }}>
            <SpaOutlined />
          </Avatar>
          <Box>
            <Typography variant="h5">מרחב</Typography>
            <Typography variant="caption" color="text.secondary">
              ניהול קליניקה וטיפול
            </Typography>
          </Box>
        </Box>
        <Typography
          className="nav-caption"
          variant="overline"
          color="text.secondary"
        >
          מרחב העבודה
        </Typography>
        <Box component="nav" aria-label="ניווט ראשי" className="nav-links">
          {(
            [
              ["home", DashboardOutlined],
              ["clients", GroupOutlined],
              ["calendar", CalendarMonthOutlined],
            ] as const
          ).map(([key, Icon]) => (
            <Button
              key={key}
              className={page === key ? "nav-active" : ""}
              startIcon={<Icon />}
              onClick={() => setPage(key)}
              aria-current={page === key ? "page" : undefined}
            >
              {names[key]}
            </Button>
          ))}
        </Box>
        <Box className="sidebar-bottom">
          <Button
            fullWidth
            startIcon={<SettingsOutlined />}
            onClick={() => setSettings(true)}
          >
            הגדרות
          </Button>
          <Divider sx={{ my: 2 }} />
          <Typography variant="caption" color="text.secondary">
            התחברות מאובטחת — בשלב הבא
          </Typography>
          <Button fullWidth disabled startIcon={<Google />} sx={{ mt: 1 }}>
            התחברות עם Google
          </Button>
        </Box>
      </Paper>
      <Box component="main" className="main-content">
        <Box component="header" className="page-header">
          <Box>
            <Typography variant="body2" color="text.secondary">
              {dayFormat.format(now)}
            </Typography>
            <Typography variant="h4" sx={{ mt: 1 }}>
              {names[page]}
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() =>
              page === "clients" ? editContact() : editAppointment()
            }
          >
            {page === "clients" ? "מטופל חדש" : "פגישה חדשה"}
          </Button>
        </Box>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          {page === "home"
            ? "מקום אחד למטופלים, לפגישות וליום העבודה שלך."
            : page === "clients"
              ? "פרטי המטופלים והקשר הטיפולי, תמיד בהישג יד."
              : "תכנון השבוע וניהול הפגישות בקליניקה."}
        </Typography>
        {loading && (
          <Box role="status" className="loading">
            <CircularProgress size={22} />
            <Typography>טוענים נתונים…</Typography>
          </Box>
        )}
        {loadError && (
          <Alert
            severity="error"
            sx={{ mb: 3 }}
            action={
              <Button color="inherit" onClick={() => void refresh()}>
                נסו שוב
              </Button>
            }
          >
            {loadError}
          </Alert>
        )}
        {!loadError && page === "home" && (
          <>
            <Box className="stats-grid">
              {[
                {
                  label: "מטופלים בקליניקה",
                  value: contacts.length,
                  icon: <GroupOutlined />,
                  note: "כל המטופלים במקום אחד",
                },
                {
                  label: "פגישות היום",
                  value: todayAppointments.length,
                  icon: <CalendarMonthOutlined />,
                  note: "זמן לקשר ולמפגש",
                },
                {
                  label: "פגישות בשבוע הנבחר",
                  value: appointments.filter(
                    (a) =>
                      +new Date(a.start_time) >= +start &&
                      +new Date(a.start_time) < +shiftDay(start, 7),
                  ).length,
                  icon: <SpaOutlined />,
                  note: "מבט על השבוע שלך",
                },
              ].map((s) => (
                <Paper className="stat-card" key={s.label}>
                  <Avatar className="stat-icon">{s.icon}</Avatar>
                  <Typography color="text.secondary">{s.label}</Typography>
                  <Typography variant="h3" sx={{ my: 1, fontWeight: 700 }}>
                    {loading ? "—" : s.value}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {s.note}
                  </Typography>
                </Paper>
              ))}
            </Box>
            <Box className="home-grid">
              <Paper className="section-card">
                <Box className="section-heading">
                  <Typography variant="h6">הפגישות של היום</Typography>
                  <Button
                    onClick={() => {
                      setAnchor(new Date());
                      setPage("calendar");
                    }}
                  >
                    ליומן
                  </Button>
                </Box>
                {todayAppointments.map((a) => (
                  <AppointmentRow
                    key={a.id}
                    appointment={a}
                    label={guests(a)}
                    onEdit={editAppointment}
                  />
                ))}
                {!loading && !todayAppointments.length && (
                  <Empty
                    text="אין פגישות היום"
                    action="קביעת פגישה"
                    onClick={() => editAppointment()}
                  />
                )}
              </Paper>
              <Paper className="section-card">
                <Typography variant="h6">מטופלים בקליניקה</Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 2 }}
                >
                  גישה מהירה לפרטי המטופלים
                </Typography>
                {contacts
                  .slice(-5)
                  .reverse()
                  .map((c) => (
                    <Button
                      className="client-shortcut"
                      fullWidth
                      key={c.id}
                      onClick={() => void openDetail(c)}
                    >
                      <Avatar
                        sx={{ bgcolor: "primary.light", color: "primary.main" }}
                      >
                        {initials(c)}
                      </Avatar>
                      <Box sx={{ textAlign: "start", flex: 1 }}>
                        <Typography fontWeight={600}>{fullName(c)}</Typography>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          dir="ltr"
                        >
                          {c.phone_number || "—"}
                        </Typography>
                      </Box>
                      <ArrowBack fontSize="small" />
                    </Button>
                  ))}
                {!loading && !contacts.length && (
                  <Empty
                    text="הקליניקה מתחילה כאן"
                    action="הוספת מטופל"
                    onClick={() => editContact()}
                  />
                )}
                <Button
                  fullWidth
                  sx={{ mt: 2 }}
                  onClick={() => setPage("clients")}
                >
                  לכל המטופלים
                </Button>
              </Paper>
            </Box>
          </>
        )}
        {!loadError && page === "clients" && (
          <Paper className="section-card">
            <Box className="section-heading">
              <Typography variant="h6">
                רשימת מטופלים <Chip size="small" label={contacts.length} />
              </Typography>
              <TextField
                label="חיפוש לפי שם או טלפון"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                type="search"
                sx={{ width: { xs: "100%", sm: 300 } }}
              />
            </Box>
            <Box className="clients-grid">
              {contacts
                .filter((c) =>
                  `${fullName(c)} ${c.phone_number || ""}`
                    .toLocaleLowerCase()
                    .includes(search.trim().toLocaleLowerCase()),
                )
                .map((c) => (
                  <Paper variant="outlined" className="client-card" key={c.id}>
                    <Box className="client-card-header">
                      <Avatar
                        sx={{ bgcolor: "primary.light", color: "primary.main" }}
                      >
                        {initials(c)}
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Typography fontWeight={700}>{fullName(c)}</Typography>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          dir="ltr"
                          sx={{ textAlign: "start" }}
                        >
                          {c.phone_number || "ללא טלפון"}
                        </Typography>
                      </Box>
                      <IconButton
                        aria-label={`עריכת ${fullName(c)}`}
                        onClick={() => editContact(c)}
                      >
                        <EditOutlined fontSize="small" />
                      </IconButton>
                    </Box>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      className="note-preview"
                    >
                      {c.notes || "לא נוספו הערות"}
                    </Typography>
                    <Button fullWidth onClick={() => void openDetail(c)}>
                      פתיחת כרטיס מטופל
                    </Button>
                  </Paper>
                ))}
            </Box>
            {!loading && !contacts.length && (
              <Empty
                text="עדיין אין מטופלים"
                action="הוספת מטופל ראשון"
                onClick={() => editContact()}
              />
            )}{" "}
            {!!contacts.length &&
              !contacts.some((c) =>
                `${fullName(c)} ${c.phone_number || ""}`
                  .toLocaleLowerCase()
                  .includes(search.trim().toLocaleLowerCase()),
              ) && <Empty text="לא נמצאו מטופלים התואמים לחיפוש" />}
          </Paper>
        )}
        {!loadError && page === "calendar" && (
          <Paper className="section-card calendar-card">
            <Box className="section-heading">
              <Box>
                <Typography variant="h6">
                  {shortDayFormat.format(start)} —{" "}
                  {shortDayFormat.format(shiftDay(start, 6))}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  אזור זמן: <bdi>{timezone}</bdi>
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <IconButton
                  aria-label="שבוע קודם"
                  onClick={() => setAnchor(shiftDay(anchor, -7))}
                >
                  <ArrowForward />
                </IconButton>
                <Button
                  variant="outlined"
                  onClick={() => setAnchor(new Date())}
                >
                  היום
                </Button>
                <IconButton
                  aria-label="שבוע הבא"
                  onClick={() => setAnchor(shiftDay(anchor, 7))}
                >
                  <ArrowBack />
                </IconButton>
              </Stack>
            </Box>
            {mobile ? (
              <>
                <TextField
                  select
                  fullWidth
                  label="יום בשבוע"
                  value={anchor.getDay()}
                  onChange={(e) =>
                    setAnchor(shiftDay(start, Number(e.target.value)))
                  }
                  sx={{ mb: 2 }}
                >
                  {Array.from({ length: 7 }, (_, i) => (
                    <MenuItem key={i} value={i}>
                      {dayFormat.format(shiftDay(start, i))}
                    </MenuItem>
                  ))}
                </TextField>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  {dayFormat.format(anchor)}
                </Typography>
                {dayEvents(anchor).map((a) => (
                  <AppointmentRow
                    key={a.id}
                    appointment={a}
                    label={guests(a)}
                    onEdit={editAppointment}
                  />
                ))}
                <Button
                  fullWidth
                  startIcon={<Add />}
                  onClick={() => {
                    const slot = new Date(anchor);
                    slot.setHours(9, 0, 0, 0);
                    editAppointment(undefined, slot);
                  }}
                >
                  פגישה ביום זה
                </Button>
              </>
            ) : (
              <Box className="calendar-scroll" ref={calendarScroll}>
                <Box className="calendar-grid">
                  <Box className="time-heading">שעה</Box>
                  {activeDays.map((d) => (
                    <Box
                      key={d.toISOString()}
                      className={`day-heading ${isSameDay(d, now) ? "today" : ""}`}
                    >
                      {shortDayFormat.format(d)}
                    </Box>
                  ))}
                  <Box className="time-column">
                    {Array.from({ length: 24 }, (_, h) => (
                      <div key={h}>{String(h).padStart(2, "0")}:00</div>
                    ))}
                  </Box>
                  {activeDays.map((d) => (
                    <Box
                      className={`day-column ${isSameDay(d, now) ? "today-column" : ""}`}
                      key={d.toISOString()}
                    >
                      {Array.from({ length: 24 }, (_, h) => (
                        <button
                          className="time-slot"
                          key={h}
                          aria-label={`פגישה חדשה ${shortDayFormat.format(d)} ${h}:00`}
                          onClick={() => {
                            const slot = new Date(d);
                            slot.setHours(h);
                            editAppointment(undefined, slot);
                          }}
                        />
                      ))}
                      {layoutEvents(appointments, d).map(
                        ({ event: a, start: s, end: e, lane, lanes }) => {
                          const begin = new Date(s),
                            end = new Date(e);
                          const minutes =
                            begin.getHours() * 60 + begin.getMinutes();
                          const endMinutes =
                            +end === +shiftDay(d, 1)
                              ? 1440
                              : end.getHours() * 60 + end.getMinutes();
                          return (
                            <button
                              className="calendar-event"
                              key={a.id}
                              onClick={() => editAppointment(a)}
                              style={{
                                top: (minutes / 60) * 64,
                                height: Math.max(
                                  22,
                                  ((endMinutes - minutes) / 60) * 64,
                                ),
                                width: `calc(${100 / lanes}% - 5px)`,
                                insetInlineStart: `calc(${(lane * 100) / lanes}% + 2px)`,
                              }}
                              title={`${guests(a)} · ${time(a.start_time)}–${time(a.end_time)} · ${a.location}`}
                            >
                              <strong>{guests(a)}</strong>
                              <span dir="ltr">
                                {time(a.start_time)}–{time(a.end_time)}
                              </span>
                              <span>{a.location}</span>
                            </button>
                          );
                        },
                      )}
                    </Box>
                  ))}
                </Box>
              </Box>
            )}
            {!loading &&
              !appointments.some(
                (a) =>
                  +new Date(a.start_time) < +shiftDay(start, 7) &&
                  +new Date(a.end_time) > +start,
              ) && (
                <Typography color="text.secondary" sx={{ mt: 2 }}>
                  אין פגישות בשבוע זה. לחצו ביומן כדי לקבוע פגישה.
                </Typography>
              )}
          </Paper>
        )}
        <Typography className="footer" variant="caption" color="text.secondary">
          מרחב · ניהול קליניקה · התחברות Google תתווסף בשלב הבא
        </Typography>
      </Box>
      <Dialog
        open={!!contactDraft}
        onClose={() => {
          if (!busy) setContactDraft(null);
        }}
        fullWidth
        maxWidth="sm"
      >
        <Box component="form" onSubmit={saveContact}>
          <DialogTitle>
            {contactDraft?.id ? "עריכת מטופל" : "מטופל חדש"}
          </DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              {formError && <Alert severity="error">{formError}</Alert>}
              {contactDraft && (
                <>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                    <TextField
                      required
                      fullWidth
                      label="שם פרטי"
                      value={contactDraft.first_name}
                      inputProps={{ maxLength: 255 }}
                      onChange={(e) =>
                        setContactDraft({
                          ...contactDraft,
                          first_name: e.target.value,
                        })
                      }
                    />
                    <TextField
                      required
                      fullWidth
                      label="שם משפחה"
                      value={contactDraft.last_name}
                      inputProps={{ maxLength: 255 }}
                      onChange={(e) =>
                        setContactDraft({
                          ...contactDraft,
                          last_name: e.target.value,
                        })
                      }
                    />
                  </Stack>
                  <TextField
                    label="טלפון"
                    type="tel"
                    value={contactDraft.phone_number || ""}
                    inputProps={{ maxLength: 50, dir: "ltr" }}
                    onChange={(e) =>
                      setContactDraft({
                        ...contactDraft,
                        phone_number: e.target.value,
                      })
                    }
                  />
                  <TextField
                    label="הערות"
                    multiline
                    minRows={4}
                    value={contactDraft.notes || ""}
                    onChange={(e) =>
                      setContactDraft({
                        ...contactDraft,
                        notes: e.target.value,
                      })
                    }
                  />
                  <TextField
                    label="קישור Google Docs"
                    type="url"
                    inputProps={{ dir: "ltr" }}
                    value={contactDraft.google_docs_link || ""}
                    onChange={(e) =>
                      setContactDraft({
                        ...contactDraft,
                        google_docs_link: e.target.value,
                      })
                    }
                  />
                </>
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button disabled={busy} onClick={() => setContactDraft(null)}>
              ביטול
            </Button>
            <Button disabled={busy} type="submit" variant="contained">
              {busy ? "שומרים…" : "שמירה"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
      <Dialog
        open={!!appointmentDraft}
        onClose={() => {
          if (!busy) setAppointmentDraft(null);
        }}
        fullWidth
        maxWidth="sm"
      >
        <Box component="form" onSubmit={saveAppointment}>
          <DialogTitle>
            {appointmentDraft?.id ? "עריכת פגישה" : "פגישה חדשה"}
          </DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              {formError && <Alert severity="error">{formError}</Alert>}
              {appointmentDraft && (
                <>
                  <Autocomplete
                    multiple
                    options={contacts}
                    value={contacts.filter((c) =>
                      appointmentDraft.guests.includes(c.id),
                    )}
                    getOptionLabel={fullName}
                    isOptionEqualToValue={(a, b) => a.id === b.id}
                    onChange={(_, value) =>
                      setAppointmentDraft({
                        ...appointmentDraft,
                        guests: value.map((c) => c.id),
                      })
                    }
                    renderInput={(params) => (
                      <TextField {...params} label="מטופלים" />
                    )}
                  />
                  <TextField
                    required
                    label="מיקום"
                    value={appointmentDraft.location}
                    onChange={(e) =>
                      setAppointmentDraft({
                        ...appointmentDraft,
                        location: e.target.value,
                      })
                    }
                  />
                  <TextField
                    required
                    type="datetime-local"
                    label="תחילת הפגישה"
                    slotProps={{
                      inputLabel: { shrink: true },
                      htmlInput: { dir: "ltr" },
                    }}
                    value={
                      Number.isFinite(+new Date(appointmentDraft.start_time))
                        ? dateInput(new Date(appointmentDraft.start_time))
                        : ""
                    }
                    onChange={(e) =>
                      setAppointmentDraft({
                        ...appointmentDraft,
                        start_time: e.target.value,
                      })
                    }
                  />
                  <TextField
                    required
                    type="datetime-local"
                    label="סיום הפגישה"
                    slotProps={{
                      inputLabel: { shrink: true },
                      htmlInput: { dir: "ltr" },
                    }}
                    value={
                      Number.isFinite(+new Date(appointmentDraft.end_time))
                        ? dateInput(new Date(appointmentDraft.end_time))
                        : ""
                    }
                    onChange={(e) =>
                      setAppointmentDraft({
                        ...appointmentDraft,
                        end_time: e.target.value,
                      })
                    }
                  />
                  <Typography variant="caption" color="text.secondary">
                    השעות לפי <bdi>{timezone}</bdi>. פגישות חופפות מותרות.
                  </Typography>
                </>
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            {appointmentDraft?.id && (
              <Button
                color="error"
                disabled={busy}
                startIcon={<DeleteOutline />}
                onClick={() => {
                  askDelete(
                    "appointments",
                    appointmentDraft.id!,
                    guests(appointmentDraft as Appointment),
                  );
                  setAppointmentDraft(null);
                }}
              >
                מחיקה
              </Button>
            )}
            <Button disabled={busy} onClick={() => setAppointmentDraft(null)}>
              ביטול
            </Button>
            <Button disabled={busy} type="submit" variant="contained">
              {busy ? "שומרים…" : "שמירה"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
      <Dialog open={!!detail} onClose={closeDetail} fullWidth maxWidth="sm">
        <DialogTitle>
          <Box className="section-heading">
            <Typography variant="h6">{detail && fullName(detail)}</Typography>
            <IconButton aria-label="סגירה" onClick={closeDetail}>
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {detail && (
            <Stack spacing={2}>
              <Typography color="text.secondary">
                טלפון: <bdi>{detail.phone_number || "לא הוזן"}</bdi>
              </Typography>
              <Typography sx={{ whiteSpace: "pre-wrap" }}>
                {detail.notes || "לא נוספו הערות"}
              </Typography>
              {safeLink(detail.google_docs_link) && (
                <Link
                  href={safeLink(detail.google_docs_link)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  פתיחת מסמך Google Docs
                </Link>
              )}
              <Divider />
              <Typography variant="h6">פגישות המטופל</Typography>
              {historyLoading && <CircularProgress size={24} />}{" "}
              {historyError && (
                <Alert
                  severity="error"
                  action={
                    <Button onClick={() => void openDetail(detail)}>
                      נסו שוב
                    </Button>
                  }
                >
                  {historyError}
                </Alert>
              )}
              {history.map((a) => (
                <Box key={a.id}>
                  <Typography variant="caption" color="text.secondary">
                    {dayFormat.format(new Date(a.start_time))}
                  </Typography>
                  <AppointmentRow
                    appointment={a}
                    label={guests(a)}
                    onEdit={editAppointment}
                  />
                </Box>
              ))}
              {!historyLoading && !historyError && !history.length && (
                <Typography color="text.secondary">
                  עדיין אין פגישות משויכות
                </Typography>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            color="error"
            onClick={() =>
              detail && askDelete("contacts", detail.id, fullName(detail))
            }
          >
            מחיקת מטופל
          </Button>
          <Button
            startIcon={<EditOutlined />}
            onClick={() => detail && editContact(detail)}
          >
            עריכה
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              editAppointment();
              if (detail)
                setAppointmentDraft((d) => d && { ...d, guests: [detail.id] });
            }}
          >
            פגישה חדשה
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={!!deletion}
        onClose={() => {
          if (!busy) setDeletion(null);
        }}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>
          מחיקת {deletion?.kind === "contacts" ? "מטופל" : "פגישה"}
        </DialogTitle>
        <DialogContent>
          {formError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {formError}
            </Alert>
          )}
          <Typography>
            למחוק את {deletion?.label}? לא ניתן לבטל פעולה זו.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setDeletion(null)}>
            ביטול
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={busy}
            onClick={() => void deleteRecord()}
          >
            {busy ? "מוחקים…" : "מחיקה"}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={settings}
        onClose={() => setSettings(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>הגדרות</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            בקרוב — אפשרויות אלו יתווספו בהמשך
          </Alert>
          <Typography sx={{ mb: 2 }}>העדפות תצוגה ואזור זמן</Typography>
          <Typography sx={{ mb: 2 }}>
            התחברות Google ורשימת משתמשים מאושרים
          </Typography>
          <Typography variant="body2" color="text.secondary">
            הדשבורד זמין כרגע ללא התחברות. בשלב הבא הגישה תאושר בשרת למשתמשים
            ספציפיים בלבד.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettings(false)}>סגירה</Button>
        </DialogActions>
      </Dialog>
      <Snackbar
        open={!!toast}
        autoHideDuration={3500}
        onClose={() => setToast("")}
      >
        <Alert severity="success" onClose={() => setToast("")}>
          {toast}
        </Alert>
      </Snackbar>
    </Box>
  );
}
function Empty({
  text,
  action,
  onClick,
}: {
  text: string;
  action?: string;
  onClick?: () => void;
}) {
  return (
    <Box className="empty-state">
      <SpaOutlined sx={{ fontSize: 36, color: "primary.main", mb: 1 }} />
      <Typography color="text.secondary">{text}</Typography>
      {action && (
        <Button sx={{ mt: 1 }} onClick={onClick}>
          {action}
        </Button>
      )}
    </Box>
  );
}

function AppointmentRow({
  appointment: a,
  label,
  onEdit,
}: {
  appointment: Appointment;
  label: string;
  onEdit: (a: Appointment) => void;
}) {
  return (
    <Button className="appointment-row" fullWidth onClick={() => onEdit(a)}>
      <Box className="appointment-time" dir="ltr">
        {time(a.start_time)}
        <small>{time(a.end_time)}</small>
      </Box>
      <Box sx={{ flex: 1, textAlign: "start" }}>
        <Typography fontWeight={700}>{label}</Typography>
        <Typography variant="body2" color="text.secondary">
          {a.location}
        </Typography>
      </Box>
      <EditOutlined fontSize="small" />
    </Button>
  );
}
