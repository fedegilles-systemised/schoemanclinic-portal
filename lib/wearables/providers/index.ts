import "server-only";

import type { WearableProviderId } from "@/lib/env";
import { oura } from "@/lib/wearables/providers/oura";
import type { WearableProvider } from "@/lib/wearables/providers/types";
import { whoop } from "@/lib/wearables/providers/whoop";

export const WEARABLE_PROVIDER_IDS: readonly WearableProviderId[] = ["oura", "whoop"];

const providers: Record<WearableProviderId, WearableProvider> = { oura, whoop };

/** The provider for a name from a web address or a database row, or null when there is none. */
export function getWearableProvider(id: string): WearableProvider | null {
  return (WEARABLE_PROVIDER_IDS as readonly string[]).includes(id) ? providers[id as WearableProviderId] : null;
}
