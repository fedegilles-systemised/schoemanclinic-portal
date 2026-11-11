import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { QuestionsTable } from "@/components/questions/question-parts";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUser } from "@/lib/auth/session";
import { listQuestions } from "@/lib/data/questions";

export const metadata: Metadata = { title: "Questions · The Schoeman Clinic" };

/** Questions from the patients the signed-in person can open. Open ones first; closed on request. */
export default async function ClinicQuestionsPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.isSuspended || !user.isStaff) redirect("/clinic");
  const { show } = await searchParams;
  const all = show === "all";
  const questions = (await listQuestions({ open: !all })).sort((a, b) => {
    // Waiting for the clinic first, important before routine, then oldest first.
    const rank = (q: (typeof questions)[number]) => (q.status === "awaiting_reply" ? 0 : 1) * 2 + (q.urgency === "important" ? 0 : 1);
    return rank(a) - rank(b) || a.createdAt.localeCompare(b.createdAt);
  });

  return (
    <>
      <PageHeader eyebrow="Patients" title="Patient " accent="questions" description="Questions sent from the portal by the patients you look after.">
        <Link href={all ? "/clinic/questions" : "/clinic/questions?show=all"} className="type-button-label text-content no-underline">
          {all ? "Open only" : "Include closed"}
        </Link>
      </PageHeader>
      {questions.length === 0 ? <EmptyState>No questions waiting.</EmptyState> : <QuestionsTable rows={questions} base="/clinic/questions" showPatient />}
    </>
  );
}
