import Avatar from "@mui/material/Avatar";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Grid from "@mui/material/Grid";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemAvatar from "@mui/material/ListItemAvatar";
import ListItemText from "@mui/material/ListItemText";
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
      <Grid container spacing={{ xs: 1, md: 2.5 }} sx={{ mb: 3 }}>
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
          <Grid size={4} key={s.label}>
            <Card sx={{ height: "100%" }}>
              <CardContent>
                <Avatar
                  sx={{
                    float: "left",
                    bgcolor: "primary.light",
                    color: "primary.main",
                    display: { xs: "none", md: "flex" },
                  }}
                >
                  {s.icon}
                </Avatar>
                <Typography
                  color="text.secondary"
                  sx={{ fontSize: { xs: 12, md: 16 } }}
                >
                  {s.label}
                </Typography>
                <Typography
                  variant="h3"
                  sx={{ my: 1, fontWeight: 700, fontSize: { xs: 32, md: 48 } }}
                >
                  {loading ? "—" : s.value}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ fontSize: { xs: 12, md: 14 } }}
                >
                  {s.note}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <Card>
            <CardContent>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                spacing={2}
                sx={{ mb: 2.5 }}
              >
                <Typography variant="h6">הפגישות של היום</Typography>
                <Button onClick={onShowCalendar}>ליומן</Button>
              </Stack>
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
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, lg: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6">מטופלים בקליניקה</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                גישה מהירה לפרטי המטופלים
              </Typography>
              <List disablePadding>
                {contacts
                  .slice(-5)
                  .reverse()
                  .map((c) => (
                    <ListItem key={c.id} disablePadding>
                      <ListItemButton
                        onClick={() => void openDetail(c)}
                        divider
                      >
                        <ListItemAvatar>
                          <Avatar
                            sx={{
                              bgcolor: "primary.light",
                              color: "primary.main",
                            }}
                          >
                            {initials(c)}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={fullName(c)}
                          secondary={c.phone_number || "—"}
                          slotProps={{
                            primary: { fontWeight: 600 },
                            secondary: {
                              dir: "ltr",
                              sx: { textAlign: "start" },
                            },
                          }}
                        />
                        <ArrowBack fontSize="small" />
                      </ListItemButton>
                    </ListItem>
                  ))}
              </List>
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
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </>
  );
}
