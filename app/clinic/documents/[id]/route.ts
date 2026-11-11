import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/session";
import { signedDocumentUrl } from "@/lib/data/documents";

/** Opens a patient's document for the team, after writing the view to the activity log. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return new NextResponse("Not found", { status: 404 });
  const user = await getCurrentUser();
  if (!user || user.isSuspended || !user.isStaff) return NextResponse.redirect(new URL("/clinic", request.url), 303);
  const url = await signedDocumentUrl(id, { logAs: "staff" });
  if (!url) return new NextResponse("That document could not be opened.", { status: 404 });
  return NextResponse.redirect(url, 303);
}
