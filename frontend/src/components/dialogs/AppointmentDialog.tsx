import type { FormEvent } from "react";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import DeleteOutline from "@mui/icons-material/DeleteOutline";
import { dateInput, timezone } from "../../lib/calendar";
import { fullName } from "../../lib/contacts";
import type {
  Appointment,
  Contact,
  AppointmentDraft,
  DeletionTarget,
} from "../../types";

export default function AppointmentDialog({
  appointmentDraft,
  setAppointmentDraft,
  contacts,
  busy,
  formError,
  saveAppointment,
  askDelete,
  guests,
}: {
  appointmentDraft: AppointmentDraft | null;
  setAppointmentDraft: (draft: AppointmentDraft | null) => void;
  contacts: Contact[];
  busy: boolean;
  formError: string;
  saveAppointment: (event: FormEvent<HTMLFormElement>) => void;
  askDelete: (kind: DeletionTarget["kind"], id: number, label: string) => void;
  guests: (appointment: Pick<Appointment, "guests">) => string;
}) {
  return (
    <Dialog
      open={!!appointmentDraft}
      onClose={() => {
        if (!busy) setAppointmentDraft(null);
      }}
      fullWidth
      maxWidth="sm"
    >
      <Box component="form" onSubmit={saveAppointment}>
        <DialogTitle>
          {appointmentDraft?.id ? "עריכת פגישה" : "פגישה חדשה"}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {formError && <Alert severity="error">{formError}</Alert>}
            {appointmentDraft && (
              <>
                <Autocomplete
                  multiple
                  options={contacts}
                  value={contacts.filter((c) =>
                    appointmentDraft.guests.includes(c.id),
                  )}
                  getOptionLabel={fullName}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                  onChange={(_, value) =>
                    setAppointmentDraft({
                      ...appointmentDraft,
                      guests: value.map((c) => c.id),
                    })
                  }
                  renderInput={(params) => (
                    <TextField {...params} label="מטופלים" />
                  )}
                />
                <TextField
                  required
                  label="מיקום"
                  value={appointmentDraft.location}
                  onChange={(e) =>
                    setAppointmentDraft({
                      ...appointmentDraft,
                      location: e.target.value,
                    })
                  }
                />
                <TextField
                  required
                  type="datetime-local"
                  label="תחילת הפגישה"
                  slotProps={{
                    inputLabel: { shrink: true },
                    htmlInput: { dir: "ltr" },
                  }}
                  value={
                    Number.isFinite(+new Date(appointmentDraft.start_time))
                      ? dateInput(new Date(appointmentDraft.start_time))
                      : ""
                  }
                  onChange={(e) =>
                    setAppointmentDraft({
                      ...appointmentDraft,
                      start_time: e.target.value,
                    })
                  }
                />
                <TextField
                  required
                  type="datetime-local"
                  label="סיום הפגישה"
                  slotProps={{
                    inputLabel: { shrink: true },
                    htmlInput: { dir: "ltr" },
                  }}
                  value={
                    Number.isFinite(+new Date(appointmentDraft.end_time))
                      ? dateInput(new Date(appointmentDraft.end_time))
                      : ""
                  }
                  onChange={(e) =>
                    setAppointmentDraft({
                      ...appointmentDraft,
                      end_time: e.target.value,
                    })
                  }
                />
                <Typography variant="caption" color="text.secondary">
                  השעות לפי <bdi>{timezone}</bdi>. פגישות חופפות מותרות.
                </Typography>
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          {appointmentDraft?.id && (
            <Button
              color="error"
              disabled={busy}
              startIcon={<DeleteOutline />}
              onClick={() => {
                askDelete(
                  "appointments",
                  appointmentDraft.id!,
                  guests(appointmentDraft),
                );
                setAppointmentDraft(null);
              }}
            >
              מחיקה
            </Button>
          )}
          <Button disabled={busy} onClick={() => setAppointmentDraft(null)}>
            ביטול
          </Button>
          <Button disabled={busy} type="submit" variant="contained">
            {busy ? "שומרים…" : "שמירה"}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
