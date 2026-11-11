"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/profile/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { askQuestion, closeQuestion, replyToQuestion, type QuestionFormState } from "@/lib/questions/actions";

const initial: QuestionFormState = {};

export function AskQuestionForm({ patientId }: { patientId: string }) {
  const [state, action, pending] = useActionState(askQuestion, initial);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="patientId" value={patientId} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="question-subject">Subject</Label>
        <Input id="question-subject" name="subject" maxLength={120} required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="question-body">Your question</Label>
        <Textarea id="question-body" name="body" maxLength={4000} required />
      </div>
      <div className="flex flex-col gap-1.5 sm:max-w-xs">
        <Label htmlFor="question-urgency">How soon you need an answer</Label>
        <Select id="question-urgency" name="urgency" defaultValue="routine">
          <option value="routine">Routine</option>
          <option value="important">Important, within a working day</option>
        </Select>
      </div>
      <FormMessage state={state} />
      <div>
        <Button type="submit" loading={pending}>
          Send question
        </Button>
      </div>
    </form>
  );
}

export function ReplyForm({ questionId, from }: { questionId: string; from: "clinic" | "portal" }) {
  const [state, action, pending] = useActionState(replyToQuestion, initial);
  // A new key after each sent reply clears the box.
  return (
    <form action={action} className="flex flex-col gap-4" key={state.sentAt ?? "reply"}>
      <input type="hidden" name="questionId" value={questionId} />
      <input type="hidden" name="from" value={from} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reply-body">{from === "clinic" ? "Reply to the patient" : "Write back"}</Label>
        <Textarea id="reply-body" name="body" maxLength={4000} required />
      </div>
      <FormMessage state={state} />
      <div>
        <Button type="submit" loading={pending}>
          Send reply
        </Button>
      </div>
    </form>
  );
}

export function CloseQuestionButton({ questionId }: { questionId: string }) {
  const [state, action, pending] = useActionState(closeQuestion, initial);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="questionId" value={questionId} />
      <div>
        <Button type="submit" variant="outline" loading={pending}>
          Close conversation
        </Button>
      </div>
      {state.error ? <FormMessage state={state} /> : null}
    </form>
  );
}
