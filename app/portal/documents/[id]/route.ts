import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { signedDocumentUrl } from "@/lib/data/documents";
import { getPortalPatientId } from "@/lib/data/education";

/** Opens a shared document: a one-minute link to the file, only if the person can read it. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return new NextResponse("Not found", { status: 404 });
  const patient = await getPortalPatientId();
  const url = patient ? await signedDocumentUrl(id, { logAs: "patient", patientId: patient.id }) : null;
  if (!url) return NextResponse.redirect(new URL("/portal/documents?missing=1", request.url), 303);
  return NextResponse.redirect(url, 303);
}
