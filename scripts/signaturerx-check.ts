/**
 * Checks that the clinic's SignatureRx credentials work, without sending anything:
 *   pnpm srx:check
 * It reads SIGNATURERX_CLIENT_ID, SIGNATURERX_CLIENT_SECRET and SIGNATURERX_BASE_URL from .env.local,
 * asks SignatureRx for a token, and says only whether it worked. It never prints the id, the secret
 * or the token. It writes nothing and creates no prescription.
 */
const { SIGNATURERX_CLIENT_ID, SIGNATURERX_CLIENT_SECRET, SIGNATURERX_BASE_URL } = process.env;

const KNOWN = ["https://stage-srx.signaturerx.co.uk", "https://app.signaturerx.co.uk"];

async function main(): Promise<void> {
  if (!SIGNATURERX_CLIENT_ID || !SIGNATURERX_CLIENT_SECRET || !SIGNATURERX_BASE_URL) {
    console.error("Missing SIGNATURERX_CLIENT_ID, SIGNATURERX_CLIENT_SECRET or SIGNATURERX_BASE_URL in .env.local.");
    process.exit(1);
  }
  if (!KNOWN.includes(SIGNATURERX_BASE_URL)) {
    console.error(`SIGNATURERX_BASE_URL must be one of: ${KNOWN.join(" or ")}.`);
    process.exit(1);
  }

  const target = SIGNATURERX_BASE_URL.includes("stage-") ? "staging" : "LIVE";
  console.log(`Asking SignatureRx (${target}) for a token...`);

  let response: Response;
  try {
    response = await fetch(`${SIGNATURERX_BASE_URL}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ client_id: SIGNATURERX_CLIENT_ID, client_secret: SIGNATURERX_CLIENT_SECRET, grant_type: "client_credentials" }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    console.error("Could not reach SignatureRx. Check the connection and the address.");
    process.exit(1);
  }

  if (!response.ok) {
    console.error(`SignatureRx refused the credentials (HTTP ${response.status}). Check the id, the secret and that they are for ${target}.`);
    process.exit(1);
  }

  const body = (await response.json().catch(() => null)) as { access_token?: unknown; expires_in?: unknown } | null;
  if (typeof body?.access_token !== "string" || body.access_token.length === 0) {
    console.error("SignatureRx answered, but not with a token. Nothing else was done.");
    process.exit(1);
  }
  const days = typeof body.expires_in === "number" ? Math.round(body.expires_in / 86_400) : null;
  console.log(`Token received${days ? `, valid for about ${days} days` : ""}. The credentials work for ${target}.`);
}

void main();
