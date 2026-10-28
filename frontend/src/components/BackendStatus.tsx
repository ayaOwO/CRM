import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { yellow } from "@mui/material/colors";
import { backendHealthy } from "../lib/api";

const healthPollIntervalMs = 15_000;
const healthTimeoutMs = 5_000;

export default function BackendStatus() {
  const [healthy, setHealthy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function check() {
      const result = await backendHealthy(
        AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(healthTimeoutMs),
        ]),
      );
      if (controller.signal.aborted) return;
      setHealthy(result);
      timer = setTimeout(check, healthPollIntervalMs);
    }
    void check();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, []);

  return (
    <Stack
      direction="row"
      spacing={1}
      alignItems="center"
      role="status"
      dir="ltr"
    >
      <Box
        component="span"
        aria-hidden="true"
        sx={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          flexShrink: 0,
          bgcolor: healthy ? "success.main" : yellow[700],
        }}
      />
      <Typography variant="caption" color="text.secondary">
        {healthy ? "Healthy" : "Server will be ready soon"}
      </Typography>
    </Stack>
  );
}
