import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getPublicEnv, getSupabaseServerEnv } from "@/lib/env";

/**
 * The service-role client. It bypasses row-level security, so it is only for
 * server code that has already checked who is asking: invitations, role grants,
 * result release, import confirmation, and writes from Stripe, labs and syncs.
 * Never use it to read data for a screen, and never import it from a Client
 * Component.
 */
export function createAdminClient() {
  return createClient(
    getPublicEnv().NEXT_PUBLIC_SUPABASE_URL,
    getSupabaseServerEnv().SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
