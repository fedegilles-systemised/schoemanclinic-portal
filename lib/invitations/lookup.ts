import "server-only";

import { cookies } from "next/headers";

import type { AppRole, InvitationKind } from "@/lib/invitations/constants";
import { cleanToken, hashToken } from "@/lib/invitations/token";
import { createAdminClient } from "@/lib/supabase/admin";

/** Where the link's token waits between the email and the accept page. It is not kept in the address. */
export const INVITE_COOKIE = "ch_invite";
export const INVITE_COOKIE_PATH = "/invite";

export type InvitationLookup =
  | { status: "none" }
  | { status: "not_found" | "used" | "cancelled" | "expired" }
  | {
      status: "valid";
      token: string;
      hash: string;
      kind: InvitationKind;
      role: AppRole | null;
      email: string;
      fullName: string | null;
      jobTitle: string | null;
      inviterName: string | null;
      accountExists: boolean;
    };

/** The token from the cookie, or null. */
export async function readInviteToken(): Promise<string | null> {
  return cleanToken((await cookies()).get(INVITE_COOKIE)?.value);
}

/** Reads an invitation without using it up: the database function changes nothing. */
export async function lookupInvitation(token: string | null): Promise<InvitationLookup> {
  if (!token) return { status: "none" };
  const hash = hashToken(token);
  const { data, error } = await createAdminClient().rpc("get_invitation", { _token_hash: hash });
  const row = data?.[0];
  if (error || !row) return { status: "not_found" };
  if (row.status !== "valid") {
    return { status: row.status === "used" || row.status === "cancelled" || row.status === "expired" ? row.status : "not_found" };
  }
  return {
    status: "valid",
    token,
    hash,
    kind: row.kind,
    role: row.role,
    email: row.email,
    fullName: row.full_name,
    jobTitle: row.job_title,
    inviterName: row.inviter_name,
    accountExists: row.account_exists,
  };
}
