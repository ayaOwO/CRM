import type { ReactNode } from "react";
import "../styles/layout.css";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Add from "@mui/icons-material/Add";
import CalendarMonthOutlined from "@mui/icons-material/CalendarMonthOutlined";
import DashboardOutlined from "@mui/icons-material/DashboardOutlined";
import Google from "@mui/icons-material/Google";
import GroupOutlined from "@mui/icons-material/GroupOutlined";
import SettingsOutlined from "@mui/icons-material/SettingsOutlined";
import SpaOutlined from "@mui/icons-material/SpaOutlined";
import { dayFormat } from "../lib/calendar";
import type { Page } from "../types";

const names: Record<Page, string> = {
  home: "סקירה כללית",
  clients: "מטופלים",
  calendar: "יומן פגישות",
};
export default function AppShell({
  page,
  onPageChange,
  onSettings,
  onCreate,
  children,
}: {
  page: Page;
  onPageChange: (page: Page) => void;
  onSettings: () => void;
  onCreate: () => void;
  children: ReactNode;
}) {
  const now = new Date();
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
              onClick={() => onPageChange(key)}
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
            onClick={onSettings}
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
            onClick={() => onCreate()}
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
        {children}
        <Typography className="footer" variant="caption" color="text.secondary">
          מרחב · ניהול קליניקה · התחברות Google תתווסף בשלב הבא
        </Typography>
      </Box>
    </Box>
  );
}
