import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Opens a patient's photo ID for a PA or admin who can open their record. Opening it is written to the activity
 * log first: if that fails the file is not shown. No signed-in person can read the file straight from storage, so
 * this is the only way in: the link is signed here with server code, after the log, and lasts two minutes.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const notFound = () => new NextResponse(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return notFound();
  const user = await getCurrentUser();
  if (!user || user.isSuspended || !user.roles.some((r) => r === "pa" || r === "admin")) return notFound();

  const supabase = await createClient();
  const logged = await supabase.rpc("log_identity_view", { _patient: id });
  if (logged.error) return notFound();
  const registration = await supabase.from("patient_registrations").select("identity_path").eq("patient_id", id).maybeSingle();
  if (registration.error || !registration.data) return notFound();
  const signed = await createAdminClient().storage.from("identity").createSignedUrl(registration.data.identity_path, 120);
  if (signed.error || !signed.data) return notFound();
  return NextResponse.redirect(signed.data.signedUrl, { headers: { "Cache-Control": "no-store" } });
}
