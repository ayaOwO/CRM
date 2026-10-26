import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardActions from "@mui/material/CardActions";
import Stack from "@mui/material/Stack";
import Grid from "@mui/material/Grid";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Edit from "@mui/icons-material/Edit";
import { fullName, matchesContactName, initials } from "../lib/contacts";
import type { Contact } from "../types";
import EmptyState from "../components/EmptyState";

export default function ClientsView({
  contacts,
  loading,
  search,
  setSearch,
  editContact,
  openDetail,
}: {
  contacts: Contact[];
  loading: boolean;
  search: string;
  setSearch: (search: string) => void;
  editContact: (contact?: Contact) => void;
  openDetail: (contact: Contact) => void;
}) {
  const visibleContacts = contacts.filter((contact) =>
    matchesContactName(contact, search),
  );
  return (
    <Box>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", sm: "center" }}
        spacing={2}
        sx={{ mb: 2.5 }}
      >
        <Typography variant="h6">
          רשימת מטופלים <Chip size="small" label={contacts.length} />
        </Typography>
        <TextField
          label="חיפוש לפי שם"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          type="search"
          sx={{ width: { xs: "100%", sm: 300 } }}
        />
      </Stack>
      <Grid container spacing={2}>
        {visibleContacts.map((c) => (
          <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={c.id}>
            <Card sx={{ height: "100%" }}>
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={1.5}>
                  <Avatar
                    sx={{ bgcolor: "primary.light", color: "primary.main" }}
                  >
                    {initials(c)}
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      fontWeight={700}
                      sx={{ overflowWrap: "anywhere" }}
                    >
                      {fullName(c)}
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      dir="ltr"
                      sx={{ textAlign: "start" }}
                    >
                      {c.phone_number || "ללא טלפון"}
                    </Typography>
                  </Box>
                  <IconButton
                    aria-label={`עריכת ${fullName(c)}`}
                    onClick={() => editContact(c)}
                  >
                    <Edit fontSize="small" />
                  </IconButton>
                </Stack>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    my: 2,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                    whiteSpace: "pre-wrap",
                    minHeight: 40,
                  }}
                >
                  {c.notes || "לא נוספו הערות"}
                </Typography>
              </CardContent>
              <CardActions>
                <Button fullWidth onClick={() => void openDetail(c)}>
                  פתיחת כרטיס מטופל
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
      {!loading && !contacts.length && (
        <EmptyState
          text="עדיין אין מטופלים"
          action="הוספת מטופל ראשון"
          onClick={() => editContact()}
        />
      )}
      {!!contacts.length && !visibleContacts.length && (
        <EmptyState text="לא נמצאו מטופלים התואמים לחיפוש" />
      )}
    </Box>
  );
}
