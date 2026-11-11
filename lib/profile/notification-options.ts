import type { Database } from "@/lib/database.types";

type Topic = Database["public"]["Enums"]["notification_topic"];
type Channel = Database["public"]["Enums"]["notification_channel"];

/** The choices the screen offers. WhatsApp joins once GoHighLevel is connected. */
export const NOTIFICATION_TOPICS: readonly Topic[] = ["results", "payments", "appointments", "messages"];
export const BASE_CHANNELS: readonly Channel[] = ["email", "portal"];
export const GHL_CHANNELS: readonly Channel[] = ["email", "whatsapp", "portal"];

/** A choice never saved counts as on, except WhatsApp, which starts off until the person turns it on. */
export function defaultFor(channel: Channel): boolean {
  return channel !== "whatsapp";
}
