import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";

import { ReplyForm } from "@/components/questions/forms";
import { Conversation, QuestionStatusPill } from "@/components/questions/question-parts";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getPortalPatientId } from "@/lib/data/education";
import { getQuestionThread } from "@/lib/data/questions";

export const metadata: Metadata = { title: "Ask the clinic · The Schoeman Clinic" };

export default async function PortalQuestionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sent?: string }>;
}) {
  const { id } = await params;
  const { sent } = await searchParams;
  if (!z.uuid().safeParse(id).success) notFound();
  const [patient, thread] = await Promise.all([getPortalPatientId(), getQuestionThread(id)]);
  // A team member who is also a patient reads only their own questions here.
  if (!patient || !thread || thread.patientId !== patient.id) notFound();

  return (
    <>
      <Link href="/portal/questions" className="type-small mb-4 inline-flex items-center gap-1.5 text-content-muted no-underline">
        <ArrowLeft className="size-4" aria-hidden />
        All questions
      </Link>
      <PageHeader eyebrow="Ask the clinic" title={thread.subject}>
        <QuestionStatusPill status={thread.status} />
      </PageHeader>
      {sent ? (
        <div className="mb-6">
          <Alert variant="success">
            <AlertDescription>Question sent. The reply will appear on this page.</AlertDescription>
          </Alert>
        </div>
      ) : null}
      <div className="mb-8">
        <Conversation messages={thread.messages} viewer="portal" />
      </div>
      {thread.status === "closed" ? (
        <p className="type-body text-content-muted">This conversation is closed. To ask something else, start a new question.</p>
      ) : patient.canAct ? (
        <Card>
          <CardContent>
            <ReplyForm questionId={thread.id} from="portal" />
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
