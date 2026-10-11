import type useCrmData from "../hooks/useCrmData";
import type useCrmForms from "../hooks/useCrmForms";
import ContactDialog from "../components/dialogs/ContactDialog";
import AppointmentDialog from "../components/dialogs/AppointmentDialog";
import ClientDetailsDialog from "../components/dialogs/ClientDetailsDialog";
import DeleteDialog from "../components/dialogs/DeleteDialog";

export default function AppDialogs({
  data,
  forms,
}: {
  data: ReturnType<typeof useCrmData>;
  forms: ReturnType<typeof useCrmForms>;
}) {
  const {
    contacts,
    detail,
    closeDetail,
    history,
    historyLoading,
    historyError,
    openDetail,
    guests,
  } = data;
  const {
    contactDraft,
    setContactDraft,
    appointmentDraft,
    setAppointmentDraft,
    deletion,
    setDeletion,
    busy,
    formError,
    saveContact,
    saveAppointment,
    deleteRecord,
    editContact,
    editAppointment,
    createAppointment,
    askDelete,
  } = forms;
  return (
    <>
      <ContactDialog
        contactDraft={contactDraft}
        setContactDraft={setContactDraft}
        busy={busy}
        formError={formError}
        saveContact={saveContact}
      />
      <AppointmentDialog
        appointmentDraft={appointmentDraft}
        setAppointmentDraft={setAppointmentDraft}
        contacts={contacts}
        busy={busy}
        formError={formError}
        saveAppointment={saveAppointment}
        askDelete={askDelete}
        guests={guests}
      />
      <ClientDetailsDialog
        detail={detail}
        closeDetail={closeDetail}
        history={history}
        historyLoading={historyLoading}
        historyError={historyError}
        openDetail={openDetail}
        guests={guests}
        editAppointment={editAppointment}
        editContact={editContact}
        askDelete={askDelete}
        createAppointment={createAppointment}
      />
      <DeleteDialog
        deletion={deletion}
        setDeletion={setDeletion}
        busy={busy}
        formError={formError}
        deleteRecord={deleteRecord}
      />
    </>
  );
}
