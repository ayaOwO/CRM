import { Children, isValidElement } from "react";
import type { ComponentProps, ReactElement, ReactNode } from "react";
import EventCalendarViews from "@fullcalendar/mui/monarch/EventCalendarViews";
import type {
  DateClickInfo,
  EventClickInfo,
  DatesSetInfo,
} from "@fullcalendar/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import Slider from "@mui/material/Slider";
import { ThemeProvider } from "@mui/material/styles";
import CalendarView from "../views/CalendarView";
import SettingsDialog from "../components/dialogs/SettingsDialog";
import { createAppTheme, defaultThemeColor } from "../theme";
import App from "../app/App";

const calendarRender = vi.hoisted(() => vi.fn());
vi.mock(
  "@fullcalendar/mui/monarch/EventCalendarViews",
  async (importOriginal) => {
    const { default: Calendar } =
      await importOriginal<
        typeof import("@fullcalendar/mui/monarch/EventCalendarViews")
      >();
    return {
      default: (props: ComponentProps<typeof EventCalendarViews>) => {
        calendarRender(props);
        return <Calendar {...props} />;
      },
    };
  },
);

describe("MUI interface", () => {
  it("renders the app shell and dashboard through the extracted hooks", () => {
    const html = renderToStaticMarkup(
      <ThemeProvider theme={createAppTheme(defaultThemeColor)}>
        <App
          themeColor={defaultThemeColor}
          onThemeColorChange={vi.fn()}
          themeSaveError={false}
        />
      </ThemeProvider>,
    );
    expect(html).toContain("ניווט ראשי");
    expect(html).toContain("טוענים נתונים");
    expect(html).toContain("פגישות בשבוע הנבחר");
    expect(html).toContain("מטופלים בקליניקה");
  });
  it("renders FullCalendar with an appointment, time, location, and Hebrew toolbar", () => {
    const anchor = new Date(2026, 9, 11, 10);
    const setAnchor = vi.fn();
    const onRangeChange = vi.fn();
    const editAppointment = vi.fn();
    const html = renderToStaticMarkup(
      <ThemeProvider theme={createAppTheme(defaultThemeColor)}>
        <CalendarView
          anchor={anchor}
          setAnchor={setAnchor}
          onRangeChange={onRangeChange}
          appointments={[
            {
              id: 1,
              guests: [],
              location: "Office",
              start_time: anchor.toISOString(),
              end_time: new Date(+anchor + 90 * 60_000).toISOString(),
            },
          ]}
          loading={false}
          guests={() => "Ada"}
          editAppointment={editAppointment}
        />
      </ThemeProvider>,
    );
    expect(html).toContain("Ada");
    expect(html).toContain("Office");
    expect(html).toContain("10:00–11:30");
    expect(html).toContain("פגישה חדשה");
    expect(html).toContain("fc-");
    const props = calendarRender.mock.lastCall![0] as ComponentProps<
      typeof EventCalendarViews
    >;
    const monthHtml = renderToStaticMarkup(
      <ThemeProvider theme={createAppTheme(defaultThemeColor)}>
        <EventCalendarViews
          {...props}
          controller={undefined}
          initialView="dayGridMonth"
        />
      </ThemeProvider>,
    );
    expect(monthHtml).toContain("Ada");
    expect(monthHtml).toContain("Office");
    expect(monthHtml).toContain("fc-");
    const slot = new Date(2026, 9, 11, 10, 15);
    props.dateClick?.({ date: slot } as DateClickInfo);
    expect(editAppointment).toHaveBeenLastCalledWith(undefined, slot);
    const events = props.events as {
      extendedProps: { appointment: unknown };
    }[];
    props.eventClick?.({ event: events[0] } as unknown as EventClickInfo);
    expect(editAppointment).toHaveBeenLastCalledWith(
      events[0].extendedProps.appointment,
    );
    props.datesSet?.({
      start: new Date(2026, 9, 11),
      end: new Date(2026, 9, 18),
      view: { currentStart: new Date(2026, 9, 11) },
    } as DatesSetInfo);
    expect(setAnchor).not.toHaveBeenCalled();
    const nextWeek = new Date(2026, 9, 18);
    props.datesSet?.({
      start: nextWeek,
      end: new Date(2026, 9, 25),
      view: { currentStart: nextWeek },
    } as DatesSetInfo);
    expect(setAnchor).toHaveBeenLastCalledWith(nextWeek);
    const monthStart = new Date(2026, 9, 1);
    const gridStart = new Date(2026, 8, 27);
    const gridEnd = new Date(2026, 10, 8);
    props.datesSet?.({
      start: gridStart,
      end: gridEnd,
      view: { currentStart: monthStart },
    } as DatesSetInfo);
    expect(onRangeChange).toHaveBeenLastCalledWith(gridStart, gridEnd);
    expect(setAnchor).toHaveBeenLastCalledWith(monthStart);
    const selectedDay = new Date(2026, 9, 28);
    props.dateClick?.({ date: selectedDay, allDay: true } as DateClickInfo);
    expect(editAppointment).toHaveBeenLastCalledWith(
      undefined,
      new Date(2026, 9, 28, 10),
    );
  });

  it("changes each RGB slider without changing the other color channels", () => {
    const onChange = vi.fn();
    const tree = SettingsDialog({
      open: true,
      onClose: vi.fn(),
      themeColor: "#245c50",
      onThemeColorChange: onChange,
      themeSaveError: false,
    });
    const sliders: ReactElement<{
      onChange: (event: Event, value: number) => void;
    }>[] = [];
    function visit(node: ReactNode) {
      Children.forEach(node, (child) => {
        if (!isValidElement<{ children?: ReactNode }>(child)) return;
        if (child.type === Slider)
          sliders.push(child as (typeof sliders)[number]);
        visit(child.props.children);
      });
    }
    visit(tree);
    expect(sliders).toHaveLength(3);
    for (const [index, expected] of [
      "#ff5c50",
      "#24ff50",
      "#245cff",
    ].entries()) {
      sliders[index].props.onChange(new Event("change"), 255);
      expect(onChange).toHaveBeenLastCalledWith(expected);
    }
    sliders[0].props.onChange(new Event("change"), 0);
    expect(onChange).toHaveBeenLastCalledWith("#005c50");
  });
});
