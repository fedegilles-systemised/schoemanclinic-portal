"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/session";
import { allowAuthAttempt } from "@/lib/auth/throttle";
import { isDay } from "@/lib/calendar/time";
import { getPortalPatientId } from "@/lib/data/education";
import { getMyStaffId } from "@/lib/data/patient-record";
import { repeatUpdateEmail } from "@/lib/email/templates/app";
import { getSiteUrl, isStripeConfigured } from "@/lib/env";
import { notifyPatient } from "@/lib/notify/patient";
import { MAX_REQUEST_ITEMS, REPEAT_FEE_PENCE } from "@/lib/prescriptions/constants";
import { announceRequest } from "@/lib/prescriptions/notify";
import { createRepeatCheckout } from "@/lib/stripe/client";
import { createClient } from "@/lib/supabase/server";

export type PrescriptionFormState = { error?: string; saved?: string; sentAt?: number };

const GENERIC_FAILURE = "We could not save that. Please try again.";
const TOO_MANY = "Too many attempts at once. Please wait a while and try again.";

/** The database's messages are written for people; anything else becomes a plain failure. */
function friendly(message: string | undefined, fallback = GENERIC_FAILURE): string {
  const known = [
    "Choose between one and ten medicines.",
    "Choose one or two months for each medicine.",
    "Each line must name one medicine.",
    "One of the medicines is not on the current list.",
    "One of the medicines is not on the clinic's list.",
    "Use 200 characters or fewer for a medicine name.",
    "Answer the weight-loss questions.",
    "Describe the side effects.",
    "Say whether a future appointment is booked.",
    "One of the answers is too long.",
    "Only an unpaid request can be withdrawn.",
    "This request was withdrawn.",
    "That change is not allowed from the request's current status.",
    "Say why the request is declined.",
    "Use 2,000 characters or fewer for the note.",
  ];
  return known.find((k) => message?.includes(k)) ?? fallback;
}

const itemSchema = z.union([
  z.object({ medication_id: z.uuid(), supply_months: z.union([z.literal(1), z.literal(2)]) }),
  z.object({ medicine_id: z.uuid(), supply_months: z.union([z.literal(1), z.literal(2)]) }),
  z.object({ other_name: z.string().trim().min(1, "Type the name of each medicine not on the list.").max(200), supply_months: z.union([z.literal(1), z.literal(2)]) }),
]);

const yesNo = z.enum(["yes", "no"]).optional().transform((v) => (v === undefined ? null : v === "yes"));

function field(formData: FormData, name: string): string | undefined {
  const v = formData.get(name);
  return typeof v === "string" && v !== "" ? v : undefined;
}

/** Opens Stripe's payment page for a request, or returns null when online payment is not set up. */
async function paymentPage(requestId: string, feePence: number = REPEAT_FEE_PENCE): Promise<string | null> {
  if (!isStripeConfigured()) return null;
  const siteUrl = getSiteUrl();
  const back = `${siteUrl}/portal/prescriptions/${requestId}`;
  const session = await createRepeatCheckout({
    requestId,
    amountPence: feePence,
    successUrl: `${back}?paid=1`,
    cancelUrl: `${back}?cancelled=1`,
  });
  return session.url;
}

/** A patient, or a guardian who can act, asks for a repeat. The database checks who may ask for whom. */
export async function requestRepeat(_state: PrescriptionFormState, formData: FormData): Promise<PrescriptionFormState> {
  const user = await getCurrentUser();
  if (!user || user.isSuspended || !user.hasPatientView) redirect("/portal");

  let items: unknown;
  try {
    items = JSON.parse(field(formData, "items") ?? "[]");
  } catch {
    return { error: GENERIC_FAILURE };
  }
  const parsed = z
    .object({
      patientId: z.uuid(),
      items: z.array(itemSchema).min(1, "Choose at least one medicine.").max(MAX_REQUEST_ITEMS, "You can request up to ten medicines at a time."),
      hasFutureAppointment: z.enum(["yes", "no"], { message: "Say whether you have an appointment booked." }).transform((v) => v === "yes"),
      wantsAppointment: yesNo,
      stillLosingWeight: yesNo,
      weightLost: z.string().trim().max(200, "Use 200 characters or fewer.").optional(),
      hasSideEffects: yesNo,
      sideEffects: z.string().trim().max(2000, "Use 2,000 characters or fewer.").optional(),
      note: z.string().trim().max(2000, "Use 2,000 characters or fewer.").optional(),
    })
    .safeParse({
      patientId: field(formData, "patientId"),
      items,
      hasFutureAppointment: field(formData, "hasFutureAppointment"),
      wantsAppointment: field(formData, "wantsAppointment"),
      stillLosingWeight: field(formData, "stillLosingWeight"),
      weightLost: field(formData, "weightLost"),
      hasSideEffects: field(formData, "hasSideEffects"),
      sideEffects: field(formData, "sideEffects"),
      note: field(formData, "note"),
    });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_FAILURE };
  if (!(await allowAuthAttempt("repeat-request", user.email))) return { error: TOO_MANY };

  const d = parsed.data;
  const supabase = await createClient();
  // Unanswered questions go to the database as null; the generated types cannot say so.
  const { data: requestId, error } = await supabase.rpc("request_repeat", {
    _patient: d.patientId,
    _items: d.items,
    _has_future_appointment: d.hasFutureAppointment,
    _wants_appointment: d.wantsAppointment as boolean,
    _still_losing_weight: d.stillLosingWeight as boolean,
    _weight_lost_last_month: d.weightLost ?? "",
    _has_side_effects: d.hasSideEffects as boolean,
    _side_effects: d.sideEffects ?? "",
    _note: d.note ?? "",
  });
  if (error || !requestId) return { error: friendly(error?.message) };

  revalidatePath("/portal/prescriptions");
  revalidatePath("/clinic/prescriptions");
  // Without online payment the request is already work for the team, so they are told now.
  if (!isStripeConfigured()) {
    await announceRequest(requestId, { paid: false });
    redirect(`/portal/prescriptions/${requestId}?sent=1`);
  }
  let url: string | null = null;
  try {
    url = await paymentPage(requestId);
  } catch {
    console.error("Stripe payment page not opened.");
    redirect(`/portal/prescriptions/${requestId}?payment=failed`);
  }
  redirect(url ?? `/portal/prescriptions/${requestId}?sent=1`);
}

/** Pay for a request that was left unpaid. */
export async function payRepeat(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user || user.isSuspended || !user.hasPatientView) redirect("/portal");
  const id = z.uuid().safeParse(formData.get("requestId"));
  if (!id.success) redirect("/portal/prescriptions");
  if (!(await allowAuthAttempt("repeat-request", user.email))) redirect(`/portal/prescriptions/${id.data}?payment=busy`);
  // Only for the patient chosen in the portal, by someone who can act for them; and the request must
  // still be open and unpaid.
  const patient = await getPortalPatientId();
  const supabase = await createClient();
  const { data } = await supabase
    .from("repeat_requests")
    .select("id, patient_id, status, paid_at, cancelled_at, fee_pence")
    .eq("id", id.data)
    .maybeSingle();
  if (!patient?.canAct || !data || data.patient_id !== patient.id) redirect("/portal/prescriptions");
  if (data.paid_at || data.cancelled_at || data.status !== "requested") redirect(`/portal/prescriptions/${id.data}`);
  let url: string | null = null;
  try {
    url = await paymentPage(id.data, data.fee_pence);
  } catch {
    console.error("Stripe payment page not opened.");
  }
  redirect(url ?? `/portal/prescriptions/${id.data}?payment=failed`);
}

/** The patient side withdraws a request before paying. */
export async function cancelRepeat(_state: PrescriptionFormState, formData: FormData): Promise<PrescriptionFormState> {
  const user = await getCurrentUser();
  if (!user || user.isSuspended) redirect("/login");
  const id = z.uuid().safeParse(formData.get("requestId"));
  if (!id.success) return { error: GENERIC_FAILURE };
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_repeat_request", { _request: id.data });
  if (error) return { error: friendly(error.message, "You cannot withdraw this request.") };
  revalidatePath("/portal/prescriptions", "layout");
  revalidatePath("/clinic/prescriptions", "layout");
  return { saved: "Request withdrawn." };
}

/** A doctor or PA moves a request on; the patient is told, without the note. */
export async function decideRepeat(_state: PrescriptionFormState, formData: FormData): Promise<PrescriptionFormState> {
  const user = await getCurrentUser();
  if (!user || user.isSuspended || !user.roles.some((r) => r === "doctor" || r === "pa")) redirect("/clinic");
  const parsed = z
    .object({
      requestId: z.uuid(),
      status: z.enum(["approved", "declined", "sent_to_pharmacy"]),
      note: z.string().trim().max(2000, "Use 2,000 characters or fewer for the note.").optional(),
    })
    .safeParse({ requestId: formData.get("requestId"), status: formData.get("status"), note: field(formData, "note") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_FAILURE };
  if (!(await allowAuthAttempt("repeat-request", user.email))) return { error: TOO_MANY };

  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_repeat_request", {
    _request: parsed.data.requestId,
    _status: parsed.data.status,
    _note: parsed.data.note ?? "",
  });
  if (error) return { error: friendly(error.message, "You cannot change this request.") };

  let saved = "Saved.";
  const request = await supabase
    .from("repeat_requests")
    .select("patient_id, patient:patient_profiles!repeat_requests_patient_id_fkey(first_name)")
    .eq("id", parsed.data.requestId)
    .maybeSingle();
  if (request.data) {
    const siteUrl = getSiteUrl();
    const link = `/portal/prescriptions/${parsed.data.requestId}`;
    const titles = { approved: "Repeat request approved", sent_to_pharmacy: "Repeat sent to the pharmacy", declined: "Update on your repeat request" } as const;
    const delivery = await notifyPatient(request.data.patient_id, {
      topic: "messages",
      notice: { title: titles[parsed.data.status], body: "Open your request to see where it stands.", link },
      email: repeatUpdateEmail({ siteUrl, firstName: request.data.patient?.first_name, portalUrl: `${siteUrl}${link}`, status: parsed.data.status }),
      whatsapp: `Hello ${request.data.patient?.first_name ?? ""}, there is an update on your repeat prescription request. Please sign in to your portal to see it.`,
    });
    if (delivery.email === "suspended") saved = "Saved. The patient's account is not active, so they were not told.";
    else if (delivery.email !== "sent" && delivery.whatsapp !== "sent") saved = "Saved. The patient could not be told by email or WhatsApp, so please let them know.";
    else saved = "Saved, and the patient has been told.";
  }
  revalidatePath("/clinic/prescriptions", "layout");
  revalidatePath("/portal/prescriptions", "layout");
  return { saved, sentAt: Date.now() };
}

// Medicines on a patient's record ---------------------------------------------------------------

async function requireDoctor(): Promise<string> {
  const user = await getCurrentUser();
  if (!user || user.isSuspended || !user.roles.includes("doctor")) redirect("/clinic");
  const staffId = await getMyStaffId(user.id);
  if (!staffId) redirect("/clinic");
  return staffId;
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use ${max} characters or fewer.`)
    .optional()
    .transform((v) => v || null);

/** A doctor adds a medicine or supplement, with how long the supply lasts. */
export async function addMedication(_state: PrescriptionFormState, formData: FormData): Promise<PrescriptionFormState> {
  const staffId = await requireDoctor();
  const parsed = z
    .object({
      patientId: z.uuid(),
      name: z.string().trim().min(1, "Add the medicine's name.").max(200, "Use 200 characters or fewer for the name."),
      dose: optionalText(120),
      instructions: optionalText(500),
      kind: z.enum(["prescription", "supplement"]),
      pharmacy: optionalText(200),
      startDate: z.string().refine(isDay, "Choose the date the supply starts."),
      supplyDays: z.coerce.number().int().min(1, "Supply must be at least one day.").max(730, "Supply can be up to two years."),
    })
    .safeParse({
      patientId: formData.get("patientId"),
      name: formData.get("name"),
      dose: field(formData, "dose"),
      instructions: field(formData, "instructions"),
      kind: formData.get("kind"),
      pharmacy: field(formData, "pharmacy"),
      startDate: formData.get("startDate"),
      supplyDays: formData.get("supplyDays"),
    });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_FAILURE };
  const d = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("medications").insert({
    patient_id: d.patientId,
    name: d.name,
    dose: d.dose,
    instructions: d.instructions,
    kind: d.kind,
    pharmacy: d.pharmacy,
    start_date: d.startDate,
    supply_days: d.supplyDays,
    prescriber_id: d.kind === "prescription" ? staffId : null,
  });
  if (error) return { error: "You cannot add medicines to this patient's record." };
  revalidatePath(`/clinic/patients/${d.patientId}`);
  return { saved: "Medicine added.", sentAt: Date.now() };
}

/** A doctor renews a supply (new start date and length) or pauses, stops or restarts a medicine. */
export async function changeMedication(_state: PrescriptionFormState, formData: FormData): Promise<PrescriptionFormState> {
  await requireDoctor();
  const parsed = z
    .object({
      patientId: z.uuid(),
      medicationId: z.uuid(),
      status: z.enum(["active", "paused", "stopped"]),
      startDate: z.string().refine(isDay, "Choose the date the supply starts."),
      supplyDays: z.coerce.number().int().min(1, "Supply must be at least one day.").max(730, "Supply can be up to two years."),
    })
    .safeParse({
      patientId: formData.get("patientId"),
      medicationId: formData.get("medicationId"),
      status: formData.get("status"),
      startDate: formData.get("startDate"),
      supplyDays: formData.get("supplyDays"),
    });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_FAILURE };
  const d = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("medications")
    .update({ status: d.status, start_date: d.startDate, supply_days: d.supplyDays })
    .eq("id", d.medicationId)
    .eq("patient_id", d.patientId)
    .select("id");
  if (error || !data || data.length === 0) return { error: "You cannot change this medicine." };
  revalidatePath(`/clinic/patients/${d.patientId}`);
  return { saved: "Medicine updated.", sentAt: Date.now() };
}

// The clinic's medicine list ----------------------------------------------------------------------

async function requireListKeeper(): Promise<void> {
  const user = await getCurrentUser();
  if (!user || user.isSuspended || !user.roles.some((r) => r === "admin" || r === "doctor")) redirect("/clinic");
}

export async function addListMedicine(_state: PrescriptionFormState, formData: FormData): Promise<PrescriptionFormState> {
  await requireListKeeper();
  const parsed = z
    .object({
      name: z.string().trim().min(1, "Add the medicine's name.").max(120, "Use 120 characters or fewer."),
      weightLoss: z.boolean(),
    })
    .safeParse({ name: formData.get("name"), weightLoss: formData.get("weightLoss") === "on" });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_FAILURE };
  const supabase = await createClient();
  const { error } = await supabase.from("prescribable_medicines").insert({ name: parsed.data.name, weight_loss: parsed.data.weightLoss });
  if (error) return { error: error.code === "23505" ? "That medicine is already on the list." : GENERIC_FAILURE };
  revalidatePath("/clinic/prescriptions/medicines");
  return { saved: "Added to the list.", sentAt: Date.now() };
}

/** Takes a medicine off the list (patients stop seeing it), or puts it back. */
export async function setListMedicineArchived(_state: PrescriptionFormState, formData: FormData): Promise<PrescriptionFormState> {
  await requireListKeeper();
  const parsed = z
    .object({ medicineId: z.uuid(), archived: z.enum(["true", "false"]) })
    .safeParse({ medicineId: formData.get("medicineId"), archived: formData.get("archived") });
  if (!parsed.success) return { error: GENERIC_FAILURE };
  const supabase = await createClient();
  const { error } = await supabase
    .from("prescribable_medicines")
    .update({ archived_at: parsed.data.archived === "true" ? new Date().toISOString() : null })
    .eq("id", parsed.data.medicineId);
  if (error) return { error: error.code === "23505" ? "A medicine with that name is already on the list." : GENERIC_FAILURE };
  revalidatePath("/clinic/prescriptions/medicines");
  return { saved: parsed.data.archived === "true" ? "Taken off the list." : "Back on the list." };
}
