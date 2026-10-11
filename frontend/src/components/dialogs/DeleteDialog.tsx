import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Typography from "@mui/material/Typography";
import type { DeletionTarget } from "../../types";

export default function DeleteDialog({
  deletion,
  setDeletion,
  busy,
  formError,
  deleteRecord,
}: {
  deletion: DeletionTarget | null;
  setDeletion: (value: DeletionTarget | null) => void;
  busy: boolean;
  formError: string;
  deleteRecord: () => void;
}) {
  return (
    <Dialog
      open={!!deletion}
      onClose={() => {
        if (!busy) setDeletion(null);
      }}
      fullWidth
      maxWidth="xs"
    >
      <DialogTitle>
        מחיקת {deletion?.kind === "contacts" ? "מטופל" : "פגישה"}
      </DialogTitle>
      <DialogContent>
        {formError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {formError}
          </Alert>
        )}
        <Typography>
          למחוק את {deletion?.label}? לא ניתן לבטל פעולה זו.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button disabled={busy} onClick={() => setDeletion(null)}>
          ביטול
        </Button>
        <Button
          color="error"
          variant="contained"
          disabled={busy}
          onClick={() => void deleteRecord()}
        >
          {busy ? "מוחקים…" : "מחיקה"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
