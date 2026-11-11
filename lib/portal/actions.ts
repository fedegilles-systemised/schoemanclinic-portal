"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { PORTAL_PATIENT_COOKIE } from "@/lib/portal/constants";
import { getPortalPatients } from "@/lib/portal/patient";

/** Switches the portal to another patient the person can see, then goes to that patient's home. */
export async function choosePortalPatient(patientId: string): Promise<void> {
  const id = z.uuid().safeParse(patientId);
  const patients = await getPortalPatients();
  if (!id.success || !patients.some((p) => p.id === id.data)) redirect("/portal");
  (await cookies()).set(PORTAL_PATIENT_COOKIE, id.data, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect("/portal");
}
