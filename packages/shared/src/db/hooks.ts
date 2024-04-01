import React, { useState, useEffect } from "react";
import * as queries from "./queries";
import { Contact } from "./types";

export const useContact = (id: string) => {
  const [contact, setContact] = useState<Contact | null>(null);
  useEffect(() => {
    if (!id.startsWith("~")) {
      console.warn(
        "malformed contact id passed to useContact:",
        id,
        "should start with a ~"
      );
    }
  }, [id]);
  useEffect(() => {
    queries.getContact(id).then((c) => setContact(c ?? null));
  }, []);
  return contact;
};

export const useAllUnreadsCounts = () => {
  const [counts, setCounts] = useState<{
    channels: number;
    dms: number;
    total: number;
  } | null>(null);
  useEffect(() => {
    queries.getAllUnreadsCounts().then((c) => setCounts(c ?? null));
  }, []);
  return counts;
};
