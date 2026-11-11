import type { Database } from "@/lib/database.types";

export type QuestionStatus = Database["public"]["Enums"]["question_status"];
export type QuestionUrgency = Database["public"]["Enums"]["question_urgency"];

/** Where a content-free alert goes when a patient asks a question (knowledge base question 20). */
export const QUESTIONS_ALERT_TO_DEFAULT = "info@theschoemanclinic.com";

export const QUESTION_STATUS_LABELS: Record<QuestionStatus, string> = {
  awaiting_reply: "Awaiting the clinic",
  answered: "Answered",
  closed: "Closed",
};

export const QUESTION_URGENCY_LABELS: Record<QuestionUrgency, string> = {
  routine: "Routine",
  important: "Important",
};
