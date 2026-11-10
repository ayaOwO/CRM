import type { ReactNode } from "react";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Container from "@mui/material/Container";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Stack from "@mui/material/Stack";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import type { Theme } from "@mui/material/styles";
import Add from "@mui/icons-material/Add";
import EventAvailable from "@mui/icons-material/EventAvailable";
import Chair from "@mui/icons-material/Chair";
import Dashboard from "@mui/icons-material/Dashboard";
import Logout from "@mui/icons-material/Logout";
import Group from "@mui/icons-material/Group";
import PsychologyIcon from "@mui/icons-material/Psychology";
import Settings from "@mui/icons-material/Settings";
import { dayFormat } from "../lib/calendar";
import type { Page } from "../types";
import BackendStatus from "./BackendStatus";

const names: Record<Page, string> = {
  home: "סקירה כללית",
  clients: "מטופלים",
  calendar: "יומן פגישות",
  scheduler: "תיאום פגישות",
};
export default function AppShell({
  username,
  onLogout,
  page,
  onPageChange,
  onSettings,
  onCreate,
  children,
}: {
  username: string;
  onLogout: () => void;
  page: Page;
  onPageChange: (page: Page) => void;
  onSettings: () => void;
  onCreate: () => void;
  children: ReactNode;
}) {
  const now = new Date();
  const desktop = useMediaQuery((theme: Theme) => theme.breakpoints.up("md"));
  const navigation = (
    <List
      component="nav"
      aria-label="ניווט ראשי"
      sx={{ display: { xs: "flex", md: "block" } }}
    >
      {(
        [
          ["home", Dashboard],
          ["clients", Group],
          ["calendar", Chair],
          ["scheduler", EventAvailable],
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
            minHeight: 48,
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
    <Stack direction={{ xs: "column", md: "row" }} sx={{ minHeight: "100dvh" }}>
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
            <PsychologyIcon />
          </Avatar>
          <Box>
            <Typography variant="h5">קליניקה</Typography>
            <Typography variant="caption" color="text.secondary">
              ניהול קליניקה וטיפול
            </Typography>
          </Box>
          {desktop && <BackendStatus />}
        </Stack>
        {navigation}
        <Box sx={{ mt: "auto", pt: 4 }}>
          <Button fullWidth startIcon={<Settings />} onClick={onSettings}>
            הגדרות
          </Button>
          <Divider sx={{ my: 2 }} />
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ overflowWrap: "anywhere" }}
          >
            מחוברים בתור {username}
          </Typography>
          <Button
            fullWidth
            onClick={onLogout}
            startIcon={<Logout />}
            sx={{ mt: 1 }}
          >
            התנתקות
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
          <PsychologyIcon color="primary" sx={{ mr: 1 }} />
          <Typography variant="h5" sx={{ flex: 1 }}>
            קליניקה
          </Typography>
          {!desktop && <BackendStatus />}
          <Tooltip title="הגדרות">
            <IconButton
              aria-label="הגדרות"
              onClick={onSettings}
              sx={{ width: 44, height: 44 }}
            >
              <Settings />
            </IconButton>
          </Tooltip>
          <Tooltip title="התנתקות">
            <IconButton
              onClick={onLogout}
              aria-label={`התנתקות של ${username}`}
              sx={{ width: 44, height: 44 }}
            >
              <Logout />
            </IconButton>
          </Tooltip>
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
            <Typography
              component="h1"
              variant="h4"
              sx={{ fontSize: { xs: 26, md: 34 } }}
            >
              {names[page]}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {dayFormat.format(now)}
            </Typography>
          </Box>
          {page !== "scheduler" && (
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => onCreate()}
            >
              {page === "clients" ? "מטופל חדש" : "פגישה חדשה"}
            </Button>
          )}
        </Stack>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          {page === "home"
            ? "מקום אחד למטופלים, לפגישות וליום העבודה שלך."
            : page === "clients"
              ? "פרטי המטופלים והקשר הטיפולי, תמיד בהישג יד."
              : page === "scheduler"
                ? "סוגי פגישות, זמינות וקישורים לשיתוף."
                : "תכנון השבוע וניהול הפגישות בקליניקה."}
        </Typography>
        {children}
      </Container>
    </Stack>
  );
}
