import { useEffect, useRef } from "react";
import "./CalendarView.css";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import Add from "@mui/icons-material/Add";
import ArrowBack from "@mui/icons-material/ArrowBack";
import ArrowForward from "@mui/icons-material/ArrowForward";
import {
  weekStart,
  shiftDay,
  layoutEvents,
  time,
  dayFormat,
  shortDayFormat,
  isSameDay,
  appointmentsForDay,
  timezone,
} from "../lib/calendar";
import type { Appointment } from "../types";
import AppointmentRow from "../components/AppointmentRow";

export default function CalendarView({
  anchor,
  setAnchor,
  appointments,
  loading,
  guests,
  editAppointment,
}: {
  anchor: Date;
  setAnchor: (date: Date) => void;
  appointments: Appointment[];
  loading: boolean;
  guests: (a: Appointment) => string;
  editAppointment: (a?: Appointment, slot?: Date) => void;
}) {
  const calendarScroll = useRef<HTMLDivElement>(null);
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down("md"));
  const start = weekStart(anchor);
  const now = new Date();
  const activeDays = Array.from({ length: 7 }, (_, i) => shiftDay(start, i));
  useEffect(() => {
    if (calendarScroll.current) calendarScroll.current.scrollTop = 8 * 64;
  }, [mobile, start.getTime()]);
  return (
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
          <Button variant="outlined" onClick={() => setAnchor(new Date())}>
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
            onChange={(e) => setAnchor(shiftDay(start, Number(e.target.value)))}
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
          {appointmentsForDay(appointments, anchor).map((a) => (
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
              slot.setHours(10, 0, 0, 0);
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
                    const minutes = begin.getHours() * 60 + begin.getMinutes();
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
  );
}
