import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUser } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "New booking · Clinic Hub" };

/** A new booking from the diary: find the patient, then choose the type, clinician and time. */
export default async function DiaryBookPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.isSuspended || !user.isStaff) redirect("/clinic");
  const q = ((await searchParams).q ?? "").trim().slice(0, 80);

  let results: { id: string; first_name: string; last_name: string; clinic_ref: string; date_of_birth: string }[] = [];
  if (q.length >= 2 && q.replace(/[^\p{L}\p{N}]/gu, "").length >= 2) {
    // Row-level security returns only patients the person can open. The search words are escaped
    // to letters, numbers, spaces, apostrophes and hyphens, so they cannot change the filter.
    const term = q.replace(/[^\p{L}\p{N}\s'-]/gu, " ").replace(/\s+/g, " ").trim();
    const supabase = await createClient();
    const { data } = await supabase
      .from("patient_profiles")
      .select("id, first_name, last_name, clinic_ref, date_of_birth")
      .is("archived_at", null)
      .or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,clinic_ref.ilike.%${term}%`)
      .order("last_name")
      .limit(25);
    results = data ?? [];
  }

  return (
    <>
      <Link href="/clinic/diary" className="type-small mb-4 inline-flex items-center gap-1.5 text-content-muted no-underline">
        <ArrowLeft className="size-4" aria-hidden />
        Diary
      </Link>
      <PageHeader eyebrow="Diary" title="New " accent="booking" description="Find the patient, then choose the appointment, the clinician and a free time." />
      <form method="get" className="mb-6 flex max-w-xl flex-wrap items-end gap-3">
        <div className="flex min-w-64 flex-1 flex-col gap-1.5">
          <Label htmlFor="q">Patient name or clinic reference</Label>
          <Input id="q" name="q" defaultValue={q} minLength={2} maxLength={80} required />
        </div>
        <Button type="submit" variant="outline">
          <Search aria-hidden />
          Find
        </Button>
      </form>
      {q.length >= 2 ? (
        results.length === 0 ? (
          <EmptyState>No patients you can open match that. A new patient needs a record first: invite them from Team and settings.</EmptyState>
        ) : (
          <ul className="flex max-w-xl flex-col divide-y divide-surface-border border border-surface-border">
            {results.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
                <span>
                  {p.first_name} {p.last_name}
                  <span className="type-small text-content-muted">
                    {" "}
                    · {p.clinic_ref} · born {formatDate(p.date_of_birth)}
                  </span>
                </span>
                <Button variant="secondary" size="sm" asChild>
                  <Link href={`/clinic/patients/${p.id}/book`}>Book</Link>
                </Button>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </>
  );
}
