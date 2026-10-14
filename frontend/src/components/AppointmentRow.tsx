import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Edit from "@mui/icons-material/Edit";
import { time } from "../lib/calendar";
import type { Appointment } from "../types";

export default function AppointmentRow({
  appointment: a,
  label,
  onEdit,
}: {
  appointment: Appointment;
  label: string;
  onEdit: (a: Appointment) => void;
}) {
  return (
    <Button
      fullWidth
      onClick={() => onEdit(a)}
      sx={{
        gap: 1.75,
        py: 1.75,
        px: 1,
        borderBottom: 1,
        borderColor: "divider",
        borderRadius: 0,
        color: "text.primary",
      }}
    >
      <Box sx={{ width: 62, fontWeight: 700, flexShrink: 0 }} dir="ltr">
        {time(a.start_time)}
        <Typography
          component="small"
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", fontWeight: 400 }}
        >
          {time(a.end_time)}
        </Typography>
      </Box>
      <Box sx={{ flex: 1, textAlign: "start" }}>
        <Typography fontWeight={700}>{label}</Typography>
        <Typography variant="body2" color="text.secondary">
          {a.location}
        </Typography>
      </Box>
      <Edit fontSize="small" />
    </Button>
  );
}
