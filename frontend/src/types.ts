export interface Contact {
  id: number;
  first_name: string;
  last_name: string;
  phone_number: string | null;
  notes: string | null;
  google_docs_link: string | null;
  created_at: string;
}
export interface Appointment {
  notes?: string | null;
  id: number;
  guests: number[];
  location: string;
  start_time: string;
  end_time: string;
}

export type Page = "home" | "clients" | "calendar" | "scheduler";
export type ContactDraft = Omit<Contact, "id" | "created_at"> & { id?: number };
export type AppointmentDraft = Omit<Appointment, "id"> & {
  id?: number;
  durationMinutes?: number;
};
export interface DeletionTarget {
  kind: "contacts" | "appointments";
  id: number;
  label: string;
}
