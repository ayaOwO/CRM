import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";
import Stack from "@mui/material/Stack";
import Slider from "@mui/material/Slider";
import Box from "@mui/material/Box";
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
  const channels = [1, 3, 5].map((offset) =>
    parseInt(themeColor.slice(offset, offset + 2), 16),
  );
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>הגדרות</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography>צבע ערכת הנושא</Typography>
          <Box
            sx={{
              bgcolor: themeColor,
              height: 48,
              borderRadius: 1,
              border: 1,
              borderColor: "divider",
            }}
            aria-label={`צבע נבחר ${themeColor}`}
          />
          {(["אדום", "ירוק", "כחול"] as const).map((label, index) => (
            <Box key={label}>
              <Typography id={`theme-color-${index}`} variant="body2">
                {label}
              </Typography>
              <Slider
                aria-labelledby={`theme-color-${index}`}
                value={channels[index]}
                min={0}
                max={255}
                step={1}
                valueLabelDisplay="auto"
                onChange={(_, value) => {
                  const updated = [...channels];
                  updated[index] = value as number;
                  onThemeColorChange(
                    `#${updated.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`,
                  );
                }}
              />
            </Box>
          ))}
          <TextField
            fullWidth
            label="צבע נבחר"
            value={themeColor}
            helperText="הצבע מתעדכן מיד ונשמר בדפדפן זה."
            slotProps={{ input: { readOnly: true }, htmlInput: { dir: "ltr" } }}
          />
        </Stack>
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
