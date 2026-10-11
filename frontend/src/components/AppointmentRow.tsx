import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import EditOutlined from "@mui/icons-material/EditOutlined";
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
    <Button className="appointment-row" fullWidth onClick={() => onEdit(a)}>
      <Box className="appointment-time" dir="ltr">
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
      <EditOutlined fontSize="small" />
    </Button>
  );
}
