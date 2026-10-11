import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Snackbar from "@mui/material/Snackbar";
import Typography from "@mui/material/Typography";
import AppShell from "./components/AppShell";
import ContactDialog from "./components/dialogs/ContactDialog";
import AppointmentDialog from "./components/dialogs/AppointmentDialog";
import ClientDetailsDialog from "./components/dialogs/ClientDetailsDialog";
import DeleteDialog from "./components/dialogs/DeleteDialog";
import SettingsDialog from "./components/dialogs/SettingsDialog";
import DashboardView from "./views/DashboardView";
import ClientsView from "./views/ClientsView";
import CalendarView from "./views/CalendarView";
import { api, errorText } from "./lib/api";
import {
  weekStart,
  shiftDay,
  meetingDurationPresets,
  meetingLocationOptions,
  meetingEnd,
  defaultMeetingStart,
} from "./lib/calendar";
import { fullName, safeLink } from "./lib/contacts";
import type {
  Appointment,
  Contact,
  ContactDraft,
  AppointmentDraft,
  DeletionTarget,
  Page,
} from "./types";

const blankContact: ContactDraft = {
  first_name: "",
  last_name: "",
  phone_number: "",
  notes: "",
  google_docs_link: "",
};
export default function App({
  themeColor,
  onThemeColorChange,
  themeSaveError,
}: {
  themeColor: string;
  onThemeColorChange: (color: string) => void;
  themeSaveError: boolean;
}) {
  const [page, setPage] = useState<Page>("home");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [anchor, setAnchor] = useState(() => new Date());
  const [calendarRange, setCalendarRange] = useState<[Date, Date] | null>(null);
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
  const [deletion, setDeletion] = useState<DeletionTarget | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [toast, setToast] = useState("");
  const refreshVersion = useRef(0);
  const historyVersion = useRef(0);
  const start = weekStart(anchor);
  const rangeStart = calendarRange?.[0] ?? start;
  const rangeEnd = calendarRange?.[1] ?? shiftDay(start, 7);
  const contactNames = new Map(contacts.map((c) => [c.id, fullName(c)]));
  const contactName = (id: number) => contactNames.get(id) ?? `מטופל #${id}`;
  const guests = (a: Pick<Appointment, "guests">) =>
    a.guests.map(contactName).join(", ") || "ללא מטופלים";

  async function refresh() {
    const version = ++refreshVersion.current;
    setLoading(true);
    setLoadError("");
    try {
      // Include today even when browsing a different calendar week.
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const until = new Date(Math.max(+rangeEnd, +shiftDay(today, 1)));
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
              (+new Date(item.end_time) > +rangeStart &&
                +new Date(item.start_time) < +rangeEnd) ||
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
  }, [rangeStart.getTime(), rangeEnd.getTime()]); // One fetch per visible range.

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
  function editAppointment(a?: Appointment, slot?: Date) {
    setFormError("");
    slot = new Date(slot ?? defaultMeetingStart());
    setAppointmentDraft(
      a
        ? {
            ...a,
            guests: [...a.guests],
            durationMinutes:
              (+new Date(a.end_time) - +new Date(a.start_time)) / 60_000,
          }
        : {
            guests: [],
            location: meetingLocationOptions[0],
            start_time: slot.toISOString(),
            durationMinutes: meetingDurationPresets[0],
            end_time: meetingEnd(slot.toISOString(), meetingDurationPresets[0]),
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
    const { id, guests, location, start_time, durationMinutes } =
      appointmentDraft;
    const begin = new Date(start_time),
      end = new Date(
        meetingEnd(start_time, durationMinutes ?? meetingDurationPresets[0]),
      );
    if (
      !location.trim() ||
      !Number.isFinite(+begin) ||
      !Number.isFinite(+end) ||
      end <= begin
    ) {
      setFormError(
        "יש להזין מיקום, שעת התחלה ומשך פגישה בדקות שלמות וחיוביות.",
      );
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
  return (
    <>
      <AppShell
        page={page}
        onPageChange={setPage}
        onSettings={() => setSettings(true)}
        onCreate={() =>
          page === "clients" ? editContact() : editAppointment()
        }
      >
        {loading && (
          <Box
            role="status"
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              p: 1.5,
              mb: 2,
            }}
          >
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
          <DashboardView
            contacts={contacts}
            appointments={appointments}
            start={start}
            loading={loading}
            guests={guests}
            editAppointment={editAppointment}
            editContact={editContact}
            openDetail={openDetail}
            onShowCalendar={() => {
              setAnchor(new Date());
              setPage("calendar");
            }}
            onShowClients={() => setPage("clients")}
          />
        )}
        {!loadError && page === "clients" && (
          <ClientsView
            contacts={contacts}
            loading={loading}
            search={search}
            setSearch={setSearch}
            editContact={editContact}
            openDetail={openDetail}
          />
        )}
        {!loadError && page === "calendar" && (
          <CalendarView
            anchor={anchor}
            setAnchor={setAnchor}
            onRangeChange={(begin, end) =>
              setCalendarRange((current) =>
                current && +current[0] === +begin && +current[1] === +end
                  ? current
                  : [begin, end],
              )
            }
            appointments={appointments}
            loading={loading}
            guests={guests}
            editAppointment={editAppointment}
          />
        )}
      </AppShell>
      <ContactDialog
        contactDraft={contactDraft}
        setContactDraft={setContactDraft}
        busy={busy}
        formError={formError}
        saveContact={saveContact}
      />
      <AppointmentDialog
        appointmentDraft={appointmentDraft}
        setAppointmentDraft={setAppointmentDraft}
        contacts={contacts}
        busy={busy}
        formError={formError}
        saveAppointment={saveAppointment}
        askDelete={askDelete}
        guests={guests}
      />
      <ClientDetailsDialog
        detail={detail}
        closeDetail={closeDetail}
        history={history}
        historyLoading={historyLoading}
        historyError={historyError}
        openDetail={openDetail}
        guests={guests}
        editAppointment={editAppointment}
        editContact={editContact}
        askDelete={askDelete}
        createAppointment={(contact) => {
          editAppointment();
          setAppointmentDraft((d) => d && { ...d, guests: [contact.id] });
        }}
      />
      <DeleteDialog
        deletion={deletion}
        setDeletion={setDeletion}
        busy={busy}
        formError={formError}
        deleteRecord={deleteRecord}
      />
      <SettingsDialog
        open={settings}
        onClose={() => setSettings(false)}
        themeColor={themeColor}
        onThemeColorChange={onThemeColorChange}
        themeSaveError={themeSaveError}
      />
      <Snackbar
        open={!!toast}
        autoHideDuration={3500}
        onClose={() => setToast("")}
      >
        <Alert severity="success" onClose={() => setToast("")}>
          {toast}
        </Alert>
      </Snackbar>
    </>
  );
}
