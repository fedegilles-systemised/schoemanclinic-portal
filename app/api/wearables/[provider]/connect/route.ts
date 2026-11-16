import { randomBytes } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { getConsents } from "@/lib/data/consents";
import { getPortalPatientId } from "@/lib/data/education";
import { getWearableProviderEnv, type WearableProviderId } from "@/lib/env";
import { getWearableProvider } from "@/lib/wearables/providers";
import { WEARABLE_STATE_COOKIE, WEARABLE_STATE_PATH } from "@/lib/wearables/oauth";

/**
 * Sends a patient, or a guardian who can act for them, to Oura or WHOOP to allow access to their daily
 * figures. A link, not a form, so the page's form-action policy does not block the hop. The patient must
 * have agreed to wearables first. The state ties the callback to this person, this patient and this browser.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const back = (outcome: string) => NextResponse.redirect(new URL(`/portal/wearables?${outcome}`, request.url));
  const provider = getWearableProvider((await params).provider);
  if (!provider) return new NextResponse(null, { status: 404 });

  const user = await getCurrentUser();
  if (!user || user.isSuspended || !user.hasPatientView) return NextResponse.redirect(new URL("/login", request.url));
  const patient = await getPortalPatientId();
  if (!patient || !patient.canAct) return back("error=not-allowed");
  if (!getWearableProviderEnv(provider.id as WearableProviderId)) return back("error=not-set-up");
  const consents = await getConsents(patient.id);
  if (!consents.wearables?.granted) return back("error=consent");

  const nonce = randomBytes(32).toString("base64url");
  const response = NextResponse.redirect(provider.authorisationUrl(nonce));
  response.cookies.set(WEARABLE_STATE_COOKIE, `${user.id}.${patient.id}.${provider.id}.${nonce}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // Lax: the provider's redirect back is a top-level GET, which still carries it.
    sameSite: "lax",
    path: WEARABLE_STATE_PATH,
    maxAge: 10 * 60,
  });
  return response;
}
