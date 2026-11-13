import { useState } from "react";
import type { FormEvent } from "react";
import { api, errorText } from "../lib/api";
import {
  meetingDurationPresets,
  meetingLocationOptions,
  meetingEnd,
  defaultMeetingStart,
  millisecondsPerMinute,
} from "../lib/calendar";
import { safeLink } from "../lib/contacts";
import type {
  Appointment,
  Contact,
  ContactDraft,
  AppointmentDraft,
  DeletionTarget,
} from "../types";
import type useCrmData from "./useCrmData";

const blankContact: ContactDraft = {
  first_name: "",
  last_name: "",
  phone_number: "",
  notes: "",
  google_docs_link: "",
};
export default function useCrmForms({
  refresh,
  refreshHistory,
  setDetail,
}: ReturnType<typeof useCrmData>) {
  const [contactDraft, setContactDraft] = useState<ContactDraft | null>(null);
  const [appointmentDraft, setAppointmentDraft] =
    useState<AppointmentDraft | null>(null);
  const [deletion, setDeletion] = useState<DeletionTarget | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [toast, setToast] = useState("");
  function editContact(c?: Contact) {
    setFormError("");
    setContactDraft(c ? { ...c } : { ...blankContact });
  }
  function editAppointment(a?: Appointment, slot?: Date) {
    setFormError("");
    slot = new Date(slot ?? defaultMeetingStart());
    setAppointmentDraft(
      a
        ? {
            ...a,
            guests: [...a.guests],
            durationMinutes:
              (+new Date(a.end_time) - +new Date(a.start_time)) /
              millisecondsPerMinute,
          }
        : {
            guests: [],
            location: meetingLocationOptions[0],
            start_time: slot.toISOString(),
            durationMinutes: meetingDurationPresets[0],
            end_time: meetingEnd(slot.toISOString(), meetingDurationPresets[0]),
          },
    );
  }
  function askDelete(
    kind: "contacts" | "appointments",
    id: number,
    label: string,
  ) {
    setFormError("");
    setDeletion({ kind, id, label });
  }
  async function saveContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!contactDraft || busy) return;
    setBusy(true);
    setFormError("");
    const { id, first_name, last_name, phone_number, notes, google_docs_link } =
      contactDraft;
    const body = {
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      phone_number: phone_number?.trim() || null,
      notes: notes || null,
      google_docs_link: google_docs_link?.trim() || null,
    };
    if (!body.first_name || !body.last_name) {
      setFormError("יש להזין שם פרטי ושם משפחה.");
      setBusy(false);
      return;
    }
    if (body.google_docs_link && !safeLink(body.google_docs_link)) {
      setFormError("יש להזין קישור תקין המתחיל ב־https:// או http://.");
      setBusy(false);
      return;
    }
    try {
      const saved = await api<Contact>(
        id ? `/contacts/${id}` : "/contacts",
        id ? "PUT" : "POST",
        body,
      );
      setContactDraft(null);
      setDetail((current) => (current?.id === saved.id ? saved : current));
      setToast("פרטי המטופל נשמרו");
      await refresh();
    } catch (e) {
      setFormError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function saveAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!appointmentDraft || busy) return;
    setBusy(true);
    setFormError("");
    const { id, guests, location, start_time, durationMinutes, notes } =
      appointmentDraft;
    const begin = new Date(start_time),
      end = new Date(
        meetingEnd(start_time, durationMinutes ?? meetingDurationPresets[0]),
      );
    if (
      !location.trim() ||
      !Number.isFinite(+begin) ||
      !Number.isFinite(+end) ||
      end <= begin
    ) {
      setFormError(
        "יש להזין מיקום, שעת התחלה ומשך פגישה בדקות שלמות וחיוביות.",
      );
      setBusy(false);
      return;
    }
    try {
      await api<Appointment>(
        id ? `/appointments/${id}` : "/appointments",
        id ? "PATCH" : "POST",
        {
          guests,
          notes: notes || null,
          location: location.trim(),
          start_time: begin.toISOString(),
          end_time: end.toISOString(),
        },
      );
      setAppointmentDraft(null);
      setToast("הפגישה נשמרה");
      await refresh();
      refreshHistory();
    } catch (e) {
      setFormError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function deleteRecord() {
    if (!deletion || busy) return;
    setBusy(true);
    setFormError("");
    try {
      await api(`/${deletion.kind}/${deletion.id}`, "DELETE");
      if (deletion.kind === "contacts")
        setDetail((current) => (current?.id === deletion.id ? null : current));
      setDeletion(null);
      setToast("הרשומה נמחקה");
      await refresh();
      if (deletion.kind === "appointments") refreshHistory();
    } catch (e) {
      setFormError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  function createAppointment(contact: Contact) {
    editAppointment();
    setAppointmentDraft((draft) => draft && { ...draft, guests: [contact.id] });
  }
  return {
    contactDraft,
    setContactDraft,
    appointmentDraft,
    setAppointmentDraft,
    deletion,
    setDeletion,
    busy,
    formError,
    toast,
    setToast,
    editContact,
    editAppointment,
    createAppointment,
    askDelete,
    saveContact,
    saveAppointment,
    deleteRecord,
  };
}
