"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/session";
import { allowAuthAttempt } from "@/lib/auth/throttle";
import { getPatientForSignatureRx } from "@/lib/data/signaturerx";
import { isSignatureRxSigningEnabled } from "@/lib/env";
import { SRX_FINAL_STATUSES } from "@/lib/signaturerx/constants";
import { createPrescription, getPrescription, SignatureRxError } from "@/lib/signaturerx/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type SignatureRxFormState = { error?: string; saved?: string; sentAt?: number };

const GENERIC_FAILURE = "We could not do that. Nothing was sent. Please try again.";
const TOO_MANY = "Too many attempts at once. Please wait a while and try again.";

const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

/** The address the doctor's request came from, which SignatureRx records with the signature. */
async function prescriberIp(): Promise<string | null> {
  const list = await headers();
  const forwarded = list.get("x-forwarded-for")?.split(",")[0]?.trim();
  const candidate = forwarded || list.get("x-real-ip")?.trim() || "";
  return IPV4.test(candidate) ? candidate : null;
}

const medicineSchema = z.object({
  description: z.string().trim().min(1, "Name every medicine.").max(200, "Use 200 characters or fewer for a medicine."),
  qty: z.string().trim().min(1, "Say how much of each medicine to supply.").max(60, "Use 60 characters or fewer for a quantity."),
  directions: z.string().trim().min(1, "Write the directions for each medicine.").max(500, "Use 500 characters or fewer for directions."),
});

const sendSchema = z.object({
  requestId: z.uuid(),
  action: z.enum(["draft", "issueOnly"], { message: "Choose what to do with it." }),
  medicines: z.array(medicineSchema).min(1, "Add at least one medicine.").max(10, "Send ten medicines or fewer at a time."),
  // Only needed the first time: after that the saved code is used.
  integrationCode: z.string().trim().max(200).optional(),
  // The doctor's six-digit signing PIN. It is read here, passed to SignatureRx and dropped. It is never
  // stored, logged, put in an error or sent back to the browser.
  pin: z.string().regex(/^\d{6}$/, "Type your six-digit signing PIN."),
});

/**
 * A doctor sends an approved repeat request to SignatureRx as a prescription. Only a doctor, only
 * with the form switched on, only for an approved request the doctor may read. SignatureRx holds
 * the prescription and its signature; Clinic Hub keeps its reference and its state.
 */
export async function sendToSignatureRx(_state: SignatureRxFormState, formData: FormData): Promise<SignatureRxFormState> {
  const user = await getCurrentUser();
  if (!user || user.isSuspended || !user.roles.includes("doctor")) return { error: "Only a doctor can send a prescription to SignatureRx." };
  if (!isSignatureRxSigningEnabled()) return { error: "Sending to SignatureRx is switched off." };

  let medicines: unknown;
  try {
    medicines = JSON.parse(String(formData.get("medicines") ?? "[]"));
  } catch {
    return { error: GENERIC_FAILURE };
  }
  const text = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" && value !== "" ? value : undefined;
  };
  const parsed = sendSchema.safeParse({
    requestId: text("requestId"),
    action: text("action"),
    medicines,
    integrationCode: text("integrationCode"),
    pin: text("pin"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_FAILURE };
  const input = parsed.data;
  if (!(await allowAuthAttempt("signaturerx", user.email))) return { error: TOO_MANY };

  // The request, through the doctor's own session: it must be approved and open.
  const supabase = await createClient();
  const request = await supabase
    .from("repeat_requests")
    .select("id, patient_id, status, cancelled_at")
    .eq("id", input.requestId)
    .maybeSingle();
  if (request.error || !request.data) return { error: "That request could not be found." };
  if (request.data.status !== "approved" || request.data.cancelled_at) return { error: "Only an approved request can be sent to SignatureRx." };

  // Only a doctor on this patient's care team, and never for themselves or someone they look after.
  const allowed = await supabase.rpc("can_send_to_signaturerx", { _request: request.data.id });
  if (allowed.error || allowed.data !== true) {
    return { error: "You can only send a prescription for a patient whose care team you are on, and never for yourself." };
  }

  const { patient, missing } = await getPatientForSignatureRx(request.data.patient_id);
  if (!patient) return { error: `The patient's record still needs ${missing.join(", ")}. Ask a PA to add it on their record, then send.` };

  const ip = await prescriberIp();
  if (!ip) return { error: "SignatureRx needs an IPv4 address for the signature, and this connection does not have one. Try from another connection." };

  // The integration code: the one just typed, or the one saved before. A typed one is saved only once
  // SignatureRx has accepted it, so a wrong one is not kept.
  const admin = createAdminClient();
  let code = input.integrationCode;
  if (!code) {
    const stored = await admin.from("signaturerx_prescribers").select("integration_code").eq("user_id", user.id).maybeSingle();
    code = stored.data?.integration_code;
  }
  if (!code) return { error: "Enter your SignatureRx integration code. It is asked for once and then kept." };

  // The send is opened first, so a second send cannot start and one that fails half way is not invisible.
  const opened = await admin.rpc("start_signaturerx_send", { _request: request.data.id, _action: input.action, _by: user.id });
  if (opened.error || !opened.data) {
    if (opened.error?.code === "23505") return { error: "This request has already been sent to SignatureRx, or is being sent. Check SignatureRx before sending again." };
    if (opened.error?.code === "42501") return { error: "You can only send a prescription for a patient whose care team you are on, and never for yourself." };
    return { error: GENERIC_FAILURE };
  }
  const sendId = opened.data;

  let created;
  try {
    created = await createPrescription({
      action: input.action,
      integrationCode: code,
      securePin: input.pin,
      prescriberIp: ip,
      clientRefId: request.data.id,
      patient: {
        firstName: patient.firstName,
        lastName: patient.lastName,
        gender: patient.gender,
        email: patient.email,
        phone: patient.phone,
        birthDay: patient.birthDay,
        birthMonth: patient.birthMonth,
        birthYear: patient.birthYear,
        addressLine1: patient.addressLine1,
        addressLine2: patient.addressLine2,
        city: patient.city,
        postcode: patient.postcode,
        country: patient.country,
        clientRefId: patient.clinicRef,
      },
      medicines: input.medicines,
    });
  } catch (error) {
    // A clear refusal means nothing was created, so the send is closed and another try is allowed.
    // If SignatureRx could not be reached, or sent something unreadable, it may have created the
    // prescription: the send stays open so nobody sends it twice before checking.
    if (error instanceof SignatureRxError && (error.kind === "auth" || error.kind === "invalid") && error.status !== undefined) {
      await admin.rpc("fail_signaturerx_send", { _id: sendId, _reason: error.message });
      return { error: error.message };
    }
    console.error("SignatureRx did not confirm the prescription.");
    return { error: "SignatureRx did not confirm it, so it may or may not have been created. Check SignatureRx before sending again; the request stays marked as being sent." };
  }

  const finished = await admin.rpc("finish_signaturerx_send", {
    _id: sendId,
    _srx_id: created.id,
    _status: created.status ?? "",
    _detailed: created.detailedStatus ?? "",
  });
  if (finished.error) {
    console.error(`SignatureRx prescription ${created.id} was created but not recorded.`);
    return { error: `SignatureRx created prescription ${created.id}, but Clinic Hub could not record it. Do not send it again: check it in SignatureRx.` };
  }
  // Now that SignatureRx has accepted the code, keep it for next time.
  if (input.integrationCode) await supabase.rpc("set_my_signaturerx_code", { _code: input.integrationCode });

  revalidatePath(`/clinic/prescriptions/${request.data.id}`);
  return {
    saved: input.action === "draft" ? `Saved as a draft in SignatureRx (${created.id}).` : `Signed and issued in SignatureRx (${created.id}).`,
    sentAt: Date.now(),
  };
}

/** Asks SignatureRx for the latest state of one prescription that was sent, and keeps it. */
export async function checkSignatureRxStatus(_state: SignatureRxFormState, formData: FormData): Promise<SignatureRxFormState> {
  const user = await getCurrentUser();
  if (!user || user.isSuspended || !user.roles.some((r) => r === "doctor" || r === "pa")) return { error: "Only a doctor or a PA can check this." };
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: GENERIC_FAILURE };
  if (!(await allowAuthAttempt("signaturerx", user.email))) return { error: TOO_MANY };

  // Through the person's own session, so only a prescription they may read can be checked.
  const supabase = await createClient();
  const row = await supabase
    .from("signaturerx_prescriptions")
    .select("id, srx_prescription_id, status, sent_by, repeat_request_id")
    .eq("id", id.data)
    .maybeSingle();
  if (row.error || !row.data) return { error: "That prescription could not be found." };
  if (!row.data.srx_prescription_id) return { error: "SignatureRx has not confirmed this one, so there is nothing to check yet. Look for it in SignatureRx." };
  if (row.data.status && SRX_FINAL_STATUSES.has(row.data.status)) return { saved: "It has reached its final state." };

  // A prescription is asked about with the code of the doctor who sent it, which only the server reads.
  const admin = createAdminClient();
  const stored = await admin.from("signaturerx_prescribers").select("integration_code").eq("user_id", row.data.sent_by).maybeSingle();
  if (!stored.data) return { error: "The doctor who sent it has no integration code saved, so SignatureRx cannot be asked." };

  try {
    const current = await getPrescription(row.data.srx_prescription_id, stored.data.integration_code);
    const refreshed = await admin.rpc("refresh_signaturerx_prescription", {
      _id: row.data.id,
      _status: current.status ?? "",
      _detailed: current.detailedStatus ?? "",
    });
    if (refreshed.error) return { error: GENERIC_FAILURE };
  } catch (error) {
    if (error instanceof SignatureRxError) return { error: error.message };
    return { error: GENERIC_FAILURE };
  }

  revalidatePath(`/clinic/prescriptions/${row.data.repeat_request_id}`);
  return { saved: "Updated from SignatureRx.", sentAt: Date.now() };
}

const resolveSchema = z.object({
  id: z.uuid(),
  requestId: z.uuid(),
  mode: z.enum(["confirm", "close"]),
  value: z.string().trim().min(1, "Fill in the box above the button.").max(200, "Use 200 characters or fewer."),
});

/**
 * Settles a send that SignatureRx never confirmed, after someone has looked in SignatureRx: record the
 * id of a prescription that was created, or close one that was not, so it can be sent again. The
 * database decides who may, an admin or a doctor on the patient's care team, and audits both.
 */
export async function resolveSignatureRxSend(_state: SignatureRxFormState, formData: FormData): Promise<SignatureRxFormState> {
  const user = await getCurrentUser();
  if (!user || user.isSuspended || !user.roles.some((r) => r === "doctor" || r === "admin")) return { error: "Only an admin or a doctor can settle this." };
  const parsed = resolveSchema.safeParse({
    id: formData.get("id"),
    requestId: formData.get("requestId"),
    mode: formData.get("mode"),
    value: formData.get("value"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_FAILURE };
  if (!(await allowAuthAttempt("signaturerx", user.email))) return { error: TOO_MANY };

  const supabase = await createClient();
  const { error } =
    parsed.data.mode === "confirm"
      ? await supabase.rpc("confirm_signaturerx_send", { _id: parsed.data.id, _srx_id: parsed.data.value })
      : await supabase.rpc("close_signaturerx_send", { _id: parsed.data.id, _reason: parsed.data.value });
  if (error) {
    if (error.code === "42501") return { error: "Only an admin, or a doctor on this patient's care team, can settle this." };
    if (error.code === "23505") return { error: "That SignatureRx id is already recorded for another request." };
    if (error.code === "22023") {
      return { error: error.message.includes("minutes old") ? "This send is only minutes old. Wait a few minutes for SignatureRx to answer, then look for it there." : "That send is no longer waiting for a check, or the box is empty." };
    }
    return { error: GENERIC_FAILURE };
  }
  revalidatePath(`/clinic/prescriptions/${parsed.data.requestId}`);
  return {
    saved: parsed.data.mode === "confirm" ? "Recorded. Use Check SignatureRx to bring in its state." : "Closed. The request can be sent again.",
    sentAt: Date.now(),
  };
}
