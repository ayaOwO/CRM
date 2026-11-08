import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Snackbar from "@mui/material/Snackbar";
import Typography from "@mui/material/Typography";
import AppShell from "../components/AppShell";
import SettingsDialog from "../components/dialogs/SettingsDialog";
import DashboardView from "../views/DashboardView";
import ClientsView from "../views/ClientsView";
import CalendarView from "../views/CalendarView";
import AppDialogs from "./AppDialogs";
import useCrmData from "../hooks/useCrmData";
import useCrmForms from "../hooks/useCrmForms";
import { weekStart, appointmentRange } from "../lib/calendar";
import type { Page } from "../types";
import { uiConfig } from "../config";

export default function App({
  username,
  onLogout,
  themeColor,
  onThemeColorChange,
  themeSaveError,
  themeSaving,
  themeDirty,
  onSaveTheme,
}: {
  username: string;
  onLogout: () => void;
  themeColor: string;
  onThemeColorChange: (color: string) => void;
  themeSaveError: string;
  themeSaving: boolean;
  themeDirty: boolean;
  onSaveTheme: () => void;
}) {
  const [page, setPage] = useState<Page>("home");
  const [anchor, setAnchor] = useState(() => new Date());
  const [calendarRange, setCalendarRange] = useState<[Date, Date] | null>(null);
  const [search, setSearch] = useState("");
  const [settings, setSettings] = useState(false);
  const start = weekStart(anchor);
  const [rangeStart, rangeEnd] = appointmentRange(anchor, calendarRange);
  const data = useCrmData(rangeStart, rangeEnd);
  const forms = useCrmForms(data);
  const {
    contacts,
    appointments,
    loading,
    loadError,
    refresh,
    openDetail,
    guests,
  } = data;
  const { editContact, editAppointment, toast, setToast } = forms;
  return (
    <>
      <AppShell
        username={username}
        onLogout={onLogout}
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
      <AppDialogs data={data} forms={forms} />
      <SettingsDialog
        open={settings}
        onClose={() => setSettings(false)}
        themeColor={themeColor}
        onThemeColorChange={onThemeColorChange}
        themeSaveError={themeSaveError}
        themeSaving={themeSaving}
        themeDirty={themeDirty}
        onSaveTheme={onSaveTheme}
      />
      <Snackbar
        open={!!toast}
        autoHideDuration={uiConfig.toastDurationMs}
        onClose={() => setToast("")}
      >
        <Alert severity="success" onClose={() => setToast("")}>
          {toast}
        </Alert>
      </Snackbar>
    </>
  );
}
