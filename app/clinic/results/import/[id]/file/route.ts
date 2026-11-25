import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/**
 * Opens the PDF of a file waiting in the import queue, so a PA or doctor can read it before choosing who it
 * belongs to. The link is signed through the person's own session, never the service role: the policies on
 * result imports, documents and storage decide who gets one (a file nobody has matched yet is for PAs and
 * admins only). It lasts one minute.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const notFound = () => new NextResponse(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return notFound();
  const user = await getCurrentUser();
  if (!user || user.isSuspended || !user.roles.some((role) => role === "pa" || role === "admin" || role === "doctor" || role === "nurse")) return notFound();

  const supabase = await createClient();
  const found = await supabase.from("result_imports").select("document:documents(storage_path)").eq("id", id).maybeSingle();
  const path = found.data?.document?.storage_path;
  if (found.error || !path) return notFound();
  const signed = await supabase.storage.from("documents").createSignedUrl(path, 60);
  if (signed.error || !signed.data) return notFound();
  return NextResponse.redirect(signed.data.signedUrl, { headers: { "Cache-Control": "no-store" } });
}
