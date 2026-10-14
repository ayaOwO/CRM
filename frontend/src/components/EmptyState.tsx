import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Spa from "@mui/icons-material/Spa";

export default function EmptyState({
  text,
  Icon = Spa,
  action,
  onClick,
}: {
  text: string;
  Icon?: typeof Spa;
  action?: string;
  onClick?: () => void;
}) {
  return (
    <Box sx={{ textAlign: "center", py: 5, px: 2 }}>
      <Icon sx={{ fontSize: 36, color: "primary.main", mb: 1 }} />
      <Typography color="text.secondary">{text}</Typography>
      {action && (
        <Button sx={{ mt: 1 }} onClick={onClick}>
          {action}
        </Button>
      )}
    </Box>
  );
}
