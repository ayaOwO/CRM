import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Typography from "@mui/material/Typography";

export default function SettingsDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>הגדרות</DialogTitle>
      <DialogContent>
        <Alert severity="info" sx={{ mb: 2 }}>
          בקרוב — אפשרויות אלו יתווספו בהמשך
        </Alert>
        <Typography sx={{ mb: 2 }}>העדפות תצוגה ואזור זמן</Typography>
        <Typography sx={{ mb: 2 }}>
          התחברות Google ורשימת משתמשים מאושרים
        </Typography>
        <Typography variant="body2" color="text.secondary">
          הדשבורד זמין כרגע ללא התחברות. בשלב הבא הגישה תאושר בשרת למשתמשים
          ספציפיים בלבד.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>סגירה</Button>
      </DialogActions>
    </Dialog>
  );
}
