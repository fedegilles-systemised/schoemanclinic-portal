import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";

import { CloseQuestionButton, ReplyForm } from "@/components/questions/forms";
import { Conversation, QuestionStatusPill } from "@/components/questions/question-parts";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUser } from "@/lib/auth/session";
import { getQuestionThread } from "@/lib/data/questions";

export const metadata: Metadata = { title: "Question · The Schoeman Clinic" };

export default async function ClinicQuestionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.isSuspended || !user.isStaff) redirect("/clinic");
  const thread = await getQuestionThread(id);
  if (!thread) notFound();

  return (
    <>
      <Link href="/clinic/questions" className="type-small mb-4 inline-flex items-center gap-1.5 text-content-muted no-underline">
        <ArrowLeft className="size-4" aria-hidden />
        All questions
      </Link>
      <PageHeader
        eyebrow={thread.urgency === "important" ? "Important question" : "Question"}
        title={thread.subject}
        description={`From ${thread.patientName} (${thread.clinicRef}).`}
      >
        <QuestionStatusPill status={thread.status} />
      </PageHeader>
      <Link href={`/clinic/patients/${thread.patientId}`} className="type-button-label mb-6 inline-block text-content no-underline">
        Open their record
      </Link>
      <div className="mb-8">
        <Conversation messages={thread.messages} viewer="clinic" />
      </div>
      {thread.status === "closed" ? (
        <p className="type-body text-content-muted">This conversation is closed.</p>
      ) : (
        <div className="flex flex-col gap-6">
          <Card>
            <CardContent>
              <ReplyForm questionId={thread.id} from="clinic" />
            </CardContent>
          </Card>
          <CloseQuestionButton questionId={thread.id} />
        </div>
      )}
    </>
  );
}
