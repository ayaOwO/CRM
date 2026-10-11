import "./ClientsView.css";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import EditOutlined from "@mui/icons-material/EditOutlined";
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
    <Paper className="section-card">
      <Box className="section-heading">
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
      </Box>
      <Box className="clients-grid">
        {visibleContacts.map((c) => (
          <Paper variant="outlined" className="client-card" key={c.id}>
            <Box className="client-card-header">
              <Avatar sx={{ bgcolor: "primary.light", color: "primary.main" }}>
                {initials(c)}
              </Avatar>
              <Box sx={{ flex: 1 }}>
                <Typography fontWeight={700}>{fullName(c)}</Typography>
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
                <EditOutlined fontSize="small" />
              </IconButton>
            </Box>
            <Typography
              variant="body2"
              color="text.secondary"
              className="note-preview"
            >
              {c.notes || "לא נוספו הערות"}
            </Typography>
            <Button fullWidth onClick={() => void openDetail(c)}>
              פתיחת כרטיס מטופל
            </Button>
          </Paper>
        ))}
      </Box>
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
    </Paper>
  );
}
