import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";
import { defaultThemeColor } from "../../theme";
import Typography from "@mui/material/Typography";

export default function SettingsDialog({
  open,
  onClose,
  themeColor,
  onThemeColorChange,
  themeSaveError,
}: {
  open: boolean;
  onClose: () => void;
  themeColor: string;
  onThemeColorChange: (color: string) => void;
  themeSaveError: boolean;
}) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>הגדרות</DialogTitle>
      <DialogContent>
        <TextField
          fullWidth
          type="color"
          label="צבע ערכת הנושא"
          value={themeColor}
          onChange={(event) => onThemeColorChange(event.target.value)}
          helperText="הצבע מתעדכן מיד ונשמר בדפדפן זה."
          slotProps={{
            inputLabel: { shrink: true },
            htmlInput: { sx: { height: 40, cursor: "pointer" } },
          }}
          sx={{ mt: 1 }}
        />
        <Button
          onClick={() => onThemeColorChange(defaultThemeColor)}
          sx={{ mb: 2 }}
        >
          שחזור צבע ברירת המחדל
        </Button>
        {themeSaveError && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            הצבע עודכן, אך לא ניתן לשמור אותו בדפדפן זה.
          </Alert>
        )}
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
