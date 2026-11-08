import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import { yellow } from "@mui/material/colors";
import { watchBackendHealth } from "../lib/api";

export default function BackendStatus() {
  const [healthy, setHealthy] = useState(false);

  useEffect(() => watchBackendHealth(setHealthy), []);

  return (
    <Box
      component="span"
      role="status"
      aria-label={healthy ? "Healthy" : "Server will be ready soon"}
      sx={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: "50%",
        flexShrink: 0,
        bgcolor: healthy ? "success.main" : yellow[700],
      }}
    />
  );
}
