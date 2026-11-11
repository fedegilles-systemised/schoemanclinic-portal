import type { Metadata } from "next";

import { AskQuestionForm } from "@/components/questions/forms";
import { QuestionsTable } from "@/components/questions/question-parts";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { getPortalPatientId } from "@/lib/data/education";
import { listQuestions } from "@/lib/data/questions";

export const metadata: Metadata = { title: "Ask the clinic · The Schoeman Clinic" };

/** Questions to the clinic team, and their replies. Not for emergencies. */
export default async function AskTheClinicPage() {
  const patient = await getPortalPatientId();
  if (!patient) return <EmptyState>Your record is not ready yet.</EmptyState>;
  const questions = await listQuestions({ patientId: patient.id });

  return (
    <>
      <PageHeader
        eyebrow="Ask the clinic"
        title="Ask the "
        accent="clinic"
        description="Send the clinic team a question about your care. Their reply appears here, and we will tell you when it arrives."
      />
      <div className="mb-8">
        <Alert variant="warning">
          <AlertDescription>
            This is not for emergencies. If you are unwell and need help now, call 999 or go to your nearest A&amp;E. For urgent advice, call NHS 111.
          </AlertDescription>
        </Alert>
      </div>
      {patient.canAct ? (
        <Card className="mb-12">
          <CardHeader>
            <CardTitle>New question</CardTitle>
            <CardDescription>Only the clinic team can read it.</CardDescription>
          </CardHeader>
          <CardContent>
            <AskQuestionForm patientId={patient.id} />
          </CardContent>
        </Card>
      ) : null}
      <section aria-labelledby="your-questions" className="flex flex-col gap-4">
        <SectionHeader id="your-questions" title="Your " accent="questions" />
        {questions.length === 0 ? <EmptyState>No questions yet.</EmptyState> : <QuestionsTable rows={questions} base="/portal/questions" showPatient={false} />}
      </section>
    </>
  );
}
