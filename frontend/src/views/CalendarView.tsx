import { useCallback, useMemo } from "react";
import EventCalendarToolbar from "@fullcalendar/mui/monarch/EventCalendarToolbar";
import EventCalendarViews from "@fullcalendar/mui/monarch/EventCalendarViews";
import { useCalendarController } from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import timeGridPlugin from "@fullcalendar/react/timegrid";
import interactionPlugin from "@fullcalendar/react/interaction";
import heLocale from "@fullcalendar/react/locales/he";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import { timezone, time, defaultMeetingStart } from "../lib/calendar";
import type { Appointment } from "../types";
import "@fullcalendar/react/skeleton.css";
import "@fullcalendar/mui/monarch/theme.css";

const calendarPlugins = [dayGridPlugin, timeGridPlugin, interactionPlugin];

export default function CalendarView({
  anchor,
  setAnchor,
  onRangeChange,
  appointments,
  loading,
  guests,
  editAppointment,
}: {
  anchor: Date;
  setAnchor: (date: Date) => void;
  onRangeChange: (start: Date, end: Date) => void;
  appointments: Appointment[];
  loading: boolean;
  guests: (a: Appointment) => string;
  editAppointment: (a?: Appointment, slot?: Date) => void;
}) {
  const controller = useCalendarController();
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down("md"));
  const events = useMemo(
    () =>
      appointments.map((appointment) => ({
        id: String(appointment.id),
        title: guests(appointment),
        start: appointment.start_time,
        end: appointment.end_time,
        allDay: false,
        extendedProps: { appointment },
      })),
    [appointments, guests],
  );
  const createMeeting = useCallback(
    () => editAppointment(undefined, defaultMeetingStart(anchor)),
    [anchor, editAppointment],
  );
  return (
    <Card>
      <CardContent>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", mb: 2 }}
        >
          אזור זמן: {timezone}
        </Typography>
        <EventCalendarToolbar
          controller={controller}
          availableViews={["dayGridMonth", "timeGridWeek", "timeGridDay"]}
          addButton={{ text: "פגישה חדשה", click: createMeeting }}
          sx={{ mb: 2 }}
        />
        <EventCalendarViews
          controller={controller}
          plugins={calendarPlugins}
          key={mobile ? "day" : "week"}
          initialDate={anchor}
          initialView={mobile ? "timeGridDay" : "timeGridWeek"}
          locale={heLocale}
          direction="rtl"
          timeZone="local"
          firstDay={0}
          allDaySlot={false}
          nowIndicator
          height={640}
          scrollTime="08:00:00"
          slotDuration="00:15:00"
          slotHeaderInterval="01:00:00"
          slotHeaderFormat={{
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }}
          eventTimeFormat={{
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }}
          slotEventOverlap={false}
          events={events}
          datesSet={({ start, end, view }) => {
            onRangeChange(start, end);
            if (view.currentStart.toDateString() !== anchor.toDateString())
              setAnchor(view.currentStart);
          }}
          dateClick={({ date, allDay }) =>
            editAppointment(
              undefined,
              allDay ? defaultMeetingStart(date) : date,
            )
          }
          eventClick={({ event }) =>
            editAppointment(event.extendedProps.appointment as Appointment)
          }
          eventContent={({ event }) => {
            const appointment = event.extendedProps.appointment as Appointment;
            return (
              <>
                <Typography
                  component="strong"
                  variant="inherit"
                  noWrap
                  sx={{ display: "block", fontWeight: 700 }}
                >
                  {event.title}
                </Typography>
                <Typography
                  component="span"
                  variant="inherit"
                  dir="ltr"
                  noWrap
                  sx={{ display: "block" }}
                >
                  {time(appointment.start_time)}–{time(appointment.end_time)}
                </Typography>
                <Typography component="span" variant="inherit" noWrap>
                  {appointment.location}
                </Typography>
              </>
            );
          }}
        />
        {!loading && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", mt: 2 }}
          >
            לחצו ביומן כדי לקבוע פגישה או על פגישה כדי לערוך אותה.
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
