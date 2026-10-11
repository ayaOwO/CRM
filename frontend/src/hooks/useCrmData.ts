import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, errorText } from "../lib/api";
import { shiftDay } from "../lib/calendar";
import { fullName } from "../lib/contacts";
import type { Appointment, Contact } from "../types";

export default function useCrmData(rangeStart: Date, rangeEnd: Date) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [detail, setDetail] = useState<Contact | null>(null);
  const [history, setHistory] = useState<Appointment[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [historyRevision, setHistoryRevision] = useState(0);
  const refreshVersion = useRef(0);
  const startTime = +rangeStart;
  const endTime = +rangeEnd;
  const detailId = detail?.id;

  const refresh = useCallback(async () => {
    const version = ++refreshVersion.current;
    setLoading(true);
    setLoadError("");
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = shiftDay(today, 1);
      const until = new Date(Math.max(endTime, +tomorrow));
      // ponytail: start-time filtering needs an unbounded lower range for
      // overnight meetings. Add server-side overlap queries if volume grows.
      const params = new URLSearchParams({ end_time: until.toISOString() });
      const [c, a] = await Promise.all([
        api<Contact[]>("/contacts"),
        api<Appointment[]>(`/appointments?${params}`),
      ]);
      if (version === refreshVersion.current) {
        setContacts(c);
        setAppointments(
          a.filter(
            (item) =>
              (+new Date(item.end_time) > startTime &&
                +new Date(item.start_time) < endTime) ||
              (+new Date(item.end_time) > +today &&
                +new Date(item.start_time) < +tomorrow),
          ),
        );
      }
    } catch (error) {
      if (version === refreshVersion.current) setLoadError(errorText(error));
    } finally {
      if (version === refreshVersion.current) setLoading(false);
    }
  }, [startTime, endTime]);

  useEffect(() => {
    void refresh();
    return () => {
      refreshVersion.current++;
    };
  }, [refresh]);

  useEffect(() => {
    if (detailId === undefined) return;
    let active = true;
    setHistory([]);
    setHistoryLoading(true);
    setHistoryError("");
    async function loadHistory() {
      try {
        const list = await api<Appointment[]>("/appointments");
        if (active)
          setHistory(list.filter((a) => a.guests.includes(detailId!)));
      } catch (error) {
        if (active) setHistoryError(errorText(error));
      } finally {
        if (active) setHistoryLoading(false);
      }
    }
    void loadHistory();
    return () => {
      active = false;
    };
  }, [detailId, historyRevision]);

  function refreshHistory() {
    setHistoryRevision((revision) => revision + 1);
  }
  function openDetail(contact: Contact) {
    setDetail(contact);
    setHistory([]);
    setHistoryLoading(true);
    setHistoryError("");
    refreshHistory();
  }
  function closeDetail() {
    setDetail(null);
  }

  const contactNames = useMemo(
    () => new Map(contacts.map((contact) => [contact.id, fullName(contact)])),
    [contacts],
  );
  const guests = useCallback(
    (appointment: Pick<Appointment, "guests">) =>
      appointment.guests
        .map((id) => contactNames.get(id) ?? `מטופל #${id}`)
        .join(", ") || "ללא מטופלים",
    [contactNames],
  );

  return {
    contacts,
    appointments,
    loading,
    loadError,
    refresh,
    detail,
    setDetail,
    openDetail,
    closeDetail,
    history,
    historyLoading,
    historyError,
    refreshHistory,
    guests,
  };
}
