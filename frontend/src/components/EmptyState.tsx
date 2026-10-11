import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import SpaOutlined from "@mui/icons-material/SpaOutlined";

export default function EmptyState({
  text,
  action,
  onClick,
}: {
  text: string;
  action?: string;
  onClick?: () => void;
}) {
  return (
    <Box className="empty-state">
      <SpaOutlined sx={{ fontSize: 36, color: "primary.main", mb: 1 }} />
      <Typography color="text.secondary">{text}</Typography>
      {action && (
        <Button sx={{ mt: 1 }} onClick={onClick}>
          {action}
        </Button>
      )}
    </Box>
  );
}
