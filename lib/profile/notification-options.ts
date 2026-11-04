import type { Database } from "@/lib/database.types";

type Topic = Database["public"]["Enums"]["notification_topic"];
type Channel = Database["public"]["Enums"]["notification_channel"];

/** The choices the screen offers. WhatsApp and SMS join when GoHighLevel is connected. */
export const NOTIFICATION_TOPICS: readonly Topic[] = ["results", "payments", "appointments", "messages"];
export const NOTIFICATION_CHANNELS: readonly Channel[] = ["email", "portal"];
