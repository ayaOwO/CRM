import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Close from "@mui/icons-material/Close";
import Edit from "@mui/icons-material/Edit";
import { dayFormat } from "../../lib/calendar";
import { fullName, safeLink } from "../../lib/contacts";
import type { Appointment, Contact, DeletionTarget } from "../../types";
import AppointmentRow from "../../components/AppointmentRow";

export default function ClientDetailsDialog({
  detail,
  closeDetail,
  history,
  historyLoading,
  historyError,
  openDetail,
  guests,
  editAppointment,
  editContact,
  askDelete,
  createAppointment,
}: {
  detail: Contact | null;
  closeDetail: () => void;
  history: Appointment[];
  historyLoading: boolean;
  historyError: string;
  openDetail: (contact: Contact) => void;
  guests: (a: Appointment) => string;
  editAppointment: (a: Appointment) => void;
  editContact: (contact: Contact) => void;
  askDelete: (kind: DeletionTarget["kind"], id: number, label: string) => void;
  createAppointment: (contact: Contact) => void;
}) {
  return (
    <Dialog open={!!detail} onClose={closeDetail} fullWidth maxWidth="sm">
      <DialogTitle>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 2,
          }}
        >
          <Typography variant="h6">{detail && fullName(detail)}</Typography>
          <IconButton aria-label="סגירה" onClick={closeDetail}>
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        {detail && (
          <Stack spacing={2}>
            <Typography color="text.secondary">
              טלפון:{" "}
              <Box component="bdi">{detail.phone_number || "לא הוזן"}</Box>
            </Typography>
            <Typography sx={{ whiteSpace: "pre-wrap" }}>
              {detail.notes || "לא נוספו הערות"}
            </Typography>
            {safeLink(detail.google_docs_link) && (
              <Link
                href={safeLink(detail.google_docs_link)}
                target="_blank"
                rel="noopener noreferrer"
              >
                פתיחת מסמך Google Docs
              </Link>
            )}
            <Divider />
            <Typography variant="h6">פגישות המטופל</Typography>
            {historyLoading && <CircularProgress size={24} />}{" "}
            {historyError && (
              <Alert
                severity="error"
                action={
                  <Button onClick={() => void openDetail(detail)}>
                    נסו שוב
                  </Button>
                }
              >
                {historyError}
              </Alert>
            )}
            {history.map((a) => (
              <Box key={a.id}>
                <Typography variant="caption" color="text.secondary">
                  {dayFormat.format(new Date(a.start_time))}
                </Typography>
                <AppointmentRow
                  appointment={a}
                  label={guests(a)}
                  onEdit={editAppointment}
                />
              </Box>
            ))}
            {!historyLoading && !historyError && !history.length && (
              <Typography color="text.secondary">
                עדיין אין פגישות משויכות
              </Typography>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button
          color="error"
          onClick={() =>
            detail && askDelete("contacts", detail.id, fullName(detail))
          }
        >
          מחיקת מטופל
        </Button>
        <Button
          startIcon={<Edit />}
          onClick={() => detail && editContact(detail)}
        >
          עריכה
        </Button>
        <Button
          variant="contained"
          onClick={() => detail && createAppointment(detail)}
        >
          פגישה חדשה
        </Button>
      </DialogActions>
    </Dialog>
  );
}
