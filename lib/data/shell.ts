import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

export type ShellNotification = {
  id: string;
  title: string;
  body: string | null;
  readAt: string | null;
  createdAt: string;
};

export const getNotifications = cache(async (userId: string): Promise<ShellNotification[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, title, body, read_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) throw new Error("Could not load notifications.");
  return data.map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    readAt: row.read_at,
    createdAt: row.created_at,
  }));
});

export type ShellLocation = { id: string; name: string };

export const getLocations = cache(async (): Promise<ShellLocation[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("locations").select("id, name").order("name");
  if (error) throw new Error("Could not load locations.");
  return data;
});
