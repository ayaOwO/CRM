import { useEffect, useRef } from "react";
import "./CalendarView.css";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
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
            אזור זמן: <Box component="bdi">{timezone}</Box>
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
                <Typography
                  key={h}
                  component="div"
                  sx={{ height: 64, pt: "5px", fontSize: "inherit" }}
                >
                  {String(h).padStart(2, "0")}:00
                </Typography>
              ))}
            </Box>
            {activeDays.map((d) => (
              <Box
                className={`day-column ${isSameDay(d, now) ? "today-column" : ""}`}
                key={d.toISOString()}
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <ButtonBase
                    sx={{
                      display: "block",
                      width: "100%",
                      height: 64,
                      borderBottom: 1,
                      borderColor: "divider",
                      "&:hover, &.Mui-focusVisible": {
                        bgcolor: "action.hover",
                      },
                    }}
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
                      <ButtonBase
                        key={a.id}
                        onClick={() => editAppointment(a)}
                        sx={{
                          position: "absolute",
                          display: "block",
                          border: 1,
                          borderColor: "primary.light",
                          borderInlineStart: "3px solid",
                          borderInlineStartColor: "primary.main",
                          borderRadius: "6px",
                          bgcolor: "primary.light",
                          color: "primary.dark",
                          textAlign: "start",
                          p: 0.5,
                          overflow: "hidden",
                          fontSize: 11,
                          zIndex: 1,
                          "&.Mui-focusVisible": {
                            outline: "2px solid",
                            outlineColor: "primary.main",
                            zIndex: 2,
                          },
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
                        <Typography
                          component="strong"
                          variant="inherit"
                          noWrap
                          sx={{ display: "block", fontWeight: 700 }}
                        >
                          {guests(a)}
                        </Typography>
                        <Typography
                          component="span"
                          variant="inherit"
                          noWrap
                          dir="ltr"
                          sx={{ display: "block" }}
                        >
                          {time(a.start_time)}–{time(a.end_time)}
                        </Typography>
                        <Typography
                          component="span"
                          variant="inherit"
                          noWrap
                          sx={{ display: "block" }}
                        >
                          {a.location}
                        </Typography>
                      </ButtonBase>
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
