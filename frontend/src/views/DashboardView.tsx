import "./DashboardView.css";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import ArrowBack from "@mui/icons-material/ArrowBack";
import CalendarMonthOutlined from "@mui/icons-material/CalendarMonthOutlined";
import GroupOutlined from "@mui/icons-material/GroupOutlined";
import SpaOutlined from "@mui/icons-material/SpaOutlined";
import { shiftDay, appointmentsForDay } from "../lib/calendar";
import { fullName, initials } from "../lib/contacts";
import type { Appointment, Contact } from "../types";
import AppointmentRow from "../components/AppointmentRow";
import EmptyState from "../components/EmptyState";

export default function DashboardView({
  contacts,
  appointments,
  start,
  loading,
  guests,
  editAppointment,
  editContact,
  openDetail,
  onShowCalendar,
  onShowClients,
}: {
  contacts: Contact[];
  appointments: Appointment[];
  start: Date;
  loading: boolean;
  guests: (a: Appointment) => string;
  editAppointment: (a?: Appointment) => void;
  editContact: () => void;
  openDetail: (contact: Contact) => void;
  onShowCalendar: () => void;
  onShowClients: () => void;
}) {
  const todayAppointments = appointmentsForDay(appointments, new Date());
  return (
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
            <Button onClick={onShowCalendar}>ליומן</Button>
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
            <EmptyState
              text="אין פגישות היום"
              action="קביעת פגישה"
              onClick={() => editAppointment()}
            />
          )}
        </Paper>
        <Paper className="section-card">
          <Typography variant="h6">מטופלים בקליניקה</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
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
                  <Typography variant="body2" color="text.secondary" dir="ltr">
                    {c.phone_number || "—"}
                  </Typography>
                </Box>
                <ArrowBack fontSize="small" />
              </Button>
            ))}
          {!loading && !contacts.length && (
            <EmptyState
              text="הקליניקה מתחילה כאן"
              action="הוספת מטופל"
              onClick={() => editContact()}
            />
          )}
          <Button fullWidth sx={{ mt: 2 }} onClick={onShowClients}>
            לכל המטופלים
          </Button>
        </Paper>
      </Box>
    </>
  );
}
