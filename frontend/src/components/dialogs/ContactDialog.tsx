import type { FormEvent } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import type { ContactDraft } from "../../types";
import { contactFieldLimits } from "../../lib/contacts";

export default function ContactDialog({
  contactDraft,
  setContactDraft,
  busy,
  formError,
  saveContact,
}: {
  contactDraft: ContactDraft | null;
  setContactDraft: (draft: ContactDraft | null) => void;
  busy: boolean;
  formError: string;
  saveContact: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Dialog
      open={!!contactDraft}
      onClose={() => {
        if (!busy) setContactDraft(null);
      }}
      fullWidth
      maxWidth="sm"
    >
      <Box component="form" onSubmit={saveContact}>
        <DialogTitle>
          {contactDraft?.id ? "עריכת מטופל" : "מטופל חדש"}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {formError && <Alert severity="error">{formError}</Alert>}
            {contactDraft && (
              <>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <TextField
                    required
                    fullWidth
                    label="שם פרטי"
                    value={contactDraft.first_name}
                    inputProps={{ maxLength: contactFieldLimits.name }}
                    onChange={(e) =>
                      setContactDraft({
                        ...contactDraft,
                        first_name: e.target.value,
                      })
                    }
                  />
                  <TextField
                    required
                    fullWidth
                    label="שם משפחה"
                    value={contactDraft.last_name}
                    inputProps={{ maxLength: contactFieldLimits.name }}
                    onChange={(e) =>
                      setContactDraft({
                        ...contactDraft,
                        last_name: e.target.value,
                      })
                    }
                  />
                </Stack>
                <TextField
                  label="טלפון"
                  type="tel"
                  value={contactDraft.phone_number || ""}
                  inputProps={{
                    maxLength: contactFieldLimits.phone,
                    dir: "ltr",
                  }}
                  onChange={(e) =>
                    setContactDraft({
                      ...contactDraft,
                      phone_number: e.target.value,
                    })
                  }
                />
                <TextField
                  label="הערות"
                  multiline
                  minRows={4}
                  value={contactDraft.notes || ""}
                  onChange={(e) =>
                    setContactDraft({
                      ...contactDraft,
                      notes: e.target.value,
                    })
                  }
                />
                <TextField
                  label="קישור Google Docs"
                  type="url"
                  inputProps={{ dir: "ltr" }}
                  value={contactDraft.google_docs_link || ""}
                  onChange={(e) =>
                    setContactDraft({
                      ...contactDraft,
                      google_docs_link: e.target.value,
                    })
                  }
                />
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setContactDraft(null)}>
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
