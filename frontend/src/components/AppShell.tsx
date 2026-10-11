import type { ReactNode } from "react";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
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
  const navigation = (
    <List
      component="nav"
      aria-label="ניווט ראשי"
      sx={{ display: { xs: "flex", md: "block" } }}
    >
      {(
        [
          ["home", DashboardOutlined],
          ["clients", GroupOutlined],
          ["calendar", CalendarMonthOutlined],
        ] as const
      ).map(([key, Icon]) => (
        <ListItemButton
          key={key}
          selected={page === key}
          onClick={() => onPageChange(key)}
          aria-current={page === key ? "page" : undefined}
          sx={{
            borderRadius: 1,
            flex: { xs: 1, md: "initial" },
            px: { xs: 1, md: 2 },
            mb: { md: 1 },
          }}
        >
          <ListItemIcon sx={{ minWidth: { xs: 28, md: 40 }, color: "inherit" }}>
            <Icon />
          </ListItemIcon>
          <ListItemText
            primary={names[key]}
            slotProps={{ primary: { fontSize: { xs: 12, md: 14 } } }}
          />
        </ListItemButton>
      ))}
    </List>
  );
  return (
    <Stack direction={{ xs: "column", md: "row" }} sx={{ minHeight: "100vh" }}>
      <Drawer
        variant="permanent"
        anchor="left"
        sx={{
          display: { xs: "none", md: "block" },
          width: 244,
          flexShrink: 0,
          "& .MuiDrawer-paper": { width: 244, px: 2.5, py: 4, borderRadius: 0 },
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 5 }}>
          <Avatar sx={{ bgcolor: "primary.main", width: 44, height: 44 }}>
            <SpaOutlined />
          </Avatar>
          <Box>
            <Typography variant="h5">מרחב</Typography>
            <Typography variant="caption" color="text.secondary">
              ניהול קליניקה וטיפול
            </Typography>
          </Box>
        </Stack>
        <Typography sx={{ px: 1.5 }} variant="overline" color="text.secondary">
          מרחב העבודה
        </Typography>
        {navigation}
        <Box sx={{ mt: "auto", pt: 4 }}>
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
      </Drawer>
      <AppBar
        position="static"
        color="inherit"
        elevation={0}
        sx={{
          display: { xs: "block", md: "none" },
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <Toolbar>
          <SpaOutlined color="primary" sx={{ mr: 1 }} />
          <Typography variant="h5" sx={{ flex: 1 }}>
            מרחב
          </Typography>
          <Button startIcon={<SettingsOutlined />} onClick={onSettings}>
            הגדרות
          </Button>
        </Toolbar>
        {navigation}
      </AppBar>
      <Container
        component="main"
        maxWidth={false}
        sx={{ flex: 1, minWidth: 0, maxWidth: 1600, p: { xs: 2, md: 4 } }}
      >
        <Stack
          component="header"
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          spacing={2}
          sx={{ mb: 1, flexWrap: "wrap" }}
        >
          <Box>
            <Typography variant="body2" color="text.secondary">
              {dayFormat.format(now)}
            </Typography>
            <Typography
              variant="h4"
              sx={{ mt: 1, fontSize: { xs: 26, md: 34 } }}
            >
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
        </Stack>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          {page === "home"
            ? "מקום אחד למטופלים, לפגישות וליום העבודה שלך."
            : page === "clients"
              ? "פרטי המטופלים והקשר הטיפולי, תמיד בהישג יד."
              : "תכנון השבוע וניהול הפגישות בקליניקה."}
        </Typography>
        {children}
        <Typography
          sx={{ display: "block", textAlign: "center", mt: 4.5 }}
          variant="caption"
          color="text.secondary"
        >
          מרחב · ניהול קליניקה · התחברות Google תתווסף בשלב הבא
        </Typography>
      </Container>
    </Stack>
  );
}
