import { timingSafeEqual } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { getConsents } from "@/lib/data/consents";
import { getPortalPatientId } from "@/lib/data/education";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptWearableToken, tokenBinding } from "@/lib/wearables/crypto";
import { WEARABLE_STATE_COOKIE, WEARABLE_STATE_PATH } from "@/lib/wearables/oauth";
import { getWearableProvider } from "@/lib/wearables/providers";
import { syncConnection } from "@/lib/wearables/sync";

function sameValue(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * The provider sends the patient back here. The state must match the cookie set when they left, for the
 * same signed-in person, patient and provider, before the code is exchanged. The tokens are encrypted
 * before they are stored and never reach the browser. The first read of their figures happens now.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const back = (outcome: string) => {
    const response = NextResponse.redirect(new URL(`/portal/wearables?${outcome}`, request.url));
    response.cookies.set(WEARABLE_STATE_COOKIE, "", { path: WEARABLE_STATE_PATH, maxAge: 0 });
    return response;
  };
  const provider = getWearableProvider((await params).provider);
  if (!provider) return new NextResponse(null, { status: 404 });

  const user = await getCurrentUser();
  if (!user || user.isSuspended || !user.hasPatientView) return NextResponse.redirect(new URL("/login", request.url));

  const search = request.nextUrl.searchParams;
  const [cookieUser, cookiePatient, cookieProvider, cookieNonce] = (request.cookies.get(WEARABLE_STATE_COOKIE)?.value ?? "").split(".");
  const state = search.get("state") ?? "";
  if (!cookieNonce || cookieUser !== user.id || cookieProvider !== provider.id || !sameValue(state, cookieNonce)) return back("error=expired");
  if (search.get("error")) return back("error=cancelled");
  const code = search.get("code");
  if (!code) return back("error=failed");

  const patient = await getPortalPatientId();
  if (!patient || !patient.canAct || patient.id !== cookiePatient) return back("error=not-allowed");
  if (!(await getConsents(patient.id)).wearables?.granted) return back("error=consent");

  try {
    const tokens = await provider.exchangeCode(code);
    const binding = tokenBinding(patient.id, provider.id);
    const accessEncrypted = encryptWearableToken(tokens.accessToken, binding);
    const refreshEncrypted = encryptWearableToken(tokens.refreshToken, binding);
    const admin = createAdminClient();
    const saved = await admin.rpc("save_wearable_connection", {
      _patient: patient.id,
      _provider: provider.id,
      _by: user.id,
      _access_encrypted: accessEncrypted,
      _refresh_encrypted: refreshEncrypted,
      _expires_at: tokens.expiresAt.toISOString(),
      _scope: tokens.scope,
    });
    if (saved.error || !saved.data) {
      console.error("A wearable connection was not saved.");
      return back("error=failed");
    }
    await syncConnection({
      id: saved.data,
      patient_id: patient.id,
      provider: provider.id,
      access_token_encrypted: accessEncrypted,
      refresh_token_encrypted: refreshEncrypted,
      expires_at: tokens.expiresAt.toISOString(),
      synced_through: null,
    });
    return back(`connected=${provider.id}`);
  } catch (error) {
    // The message names the step, never a token or a code.
    console.error(`A wearable connection failed: ${error instanceof Error ? error.constructor.name : "unknown"}.`);
    return back("error=failed");
  }
}
