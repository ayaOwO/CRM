import Timeline from "@mui/lab/Timeline";
import TimelineItem from "@mui/lab/TimelineItem";
import TimelineSeparator from "@mui/lab/TimelineSeparator";
import TimelineDot from "@mui/lab/TimelineDot";
import TimelineConnector from "@mui/lab/TimelineConnector";
import TimelineContent from "@mui/lab/TimelineContent";
import Avatar from "@mui/material/Avatar";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Edit from "@mui/icons-material/Edit";
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
import Chair from "@mui/icons-material/Chair";
import {
  shiftDay,
  appointmentsForDay,
  time,
  daysPerWeek,
} from "../lib/calendar";
import { fullName, initials } from "../lib/contacts";
import type { Appointment, Contact } from "../types";
import EmptyState from "../components/EmptyState";
import { uiConfig } from "../config";

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
  const recentContacts = [...contacts]
    .sort(
      (a, b) =>
        +new Date(b.created_at) - +new Date(a.created_at) || b.id - a.id,
    )
    .slice(0, uiConfig.recentContactLimit);
  return (
    <>
      <Stack direction="row" spacing={1.5} alignItems="baseline" sx={{ mb: 3 }}>
        <Typography color="text.secondary">פגישות השבוע</Typography>
        <Typography
          component="span"
          sx={{
            fontWeight: 700,
            fontSize: 24,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {loading
            ? "—"
            : appointments.filter(
                (a) =>
                  +new Date(a.start_time) >= +start &&
                  +new Date(a.start_time) < +shiftDay(start, daysPerWeek),
              ).length}
        </Typography>
      </Stack>
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
                <Typography component="h2" variant="h6">
                  הפגישות של היום
                </Typography>
                <Button onClick={onShowCalendar}>ליומן</Button>
              </Stack>
              {!!todayAppointments.length && (
                <Timeline sx={{ p: 0, m: 0 }} aria-label="הפגישות של היום">
                  {todayAppointments.map((a, index) => (
                    <TimelineItem
                      key={a.id}
                      sx={{ "&::before": { display: "none" } }}
                    >
                      <TimelineSeparator>
                        <TimelineDot color="primary">
                          <Chair fontSize="small" />
                        </TimelineDot>
                        {index < todayAppointments.length - 1 && (
                          <TimelineConnector />
                        )}
                      </TimelineSeparator>
                      <TimelineContent sx={{ minWidth: 0, py: 0.5, pr: 0 }}>
                        <Button
                          fullWidth
                          onClick={() => editAppointment(a)}
                          sx={{
                            justifyContent: "space-between",
                            gap: 1,
                            textAlign: "start",
                            color: "text.primary",
                            py: 1.5,
                          }}
                        >
                          <Box sx={{ minWidth: 0 }}>
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              component="div"
                              dir="ltr"
                              sx={{
                                textAlign: "start",
                                fontVariantNumeric: "tabular-nums",
                              }}
                            >
                              {time(a.start_time)}–{time(a.end_time)}
                            </Typography>
                            <Typography
                              fontWeight={700}
                              sx={{ overflowWrap: "anywhere" }}
                            >
                              {guests(a)}
                            </Typography>
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{ overflowWrap: "anywhere" }}
                            >
                              {a.location}
                            </Typography>
                          </Box>
                          <Edit fontSize="small" />
                        </Button>
                      </TimelineContent>
                    </TimelineItem>
                  ))}
                </Timeline>
              )}
              {!loading && !todayAppointments.length && (
                <EmptyState
                  Icon={Chair}
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
              <Typography component="h2" variant="h6">
                מטופלים אחרונים
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                חמשת המטופלים שנוספו לאחרונה
              </Typography>
              <List disablePadding>
                {recentContacts.map((c) => (
                  <ListItem key={c.id} disablePadding>
                    <ListItemButton onClick={() => void openDetail(c)} divider>
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
                          primary: {
                            fontWeight: 600,
                            sx: { overflowWrap: "anywhere" },
                          },
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
