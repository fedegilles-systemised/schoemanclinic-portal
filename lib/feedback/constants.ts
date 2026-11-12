/** Feedback ratings, set by the database from the answer (patient_feedback.rating). */
export type Rating = "green" | "amber" | "red";

export const RATING_LABELS: Record<Rating, string> = {
  green: "Positive",
  amber: "Mixed",
  red: "Needs attention",
};

/** The questions, word for word as the database copies them to the patient's record. */
export const FEEDBACK_QUESTIONS = {
  score: "How likely are you to recommend The Schoeman Clinic to a friend or family member? (0 to 10)",
  wentWell: "What went well?",
  couldImprove: "What could we do better?",
  wantsContact: "Would you like someone from the clinic to contact you?",
  mayQuote: "May we use your comments, without your name, as evidence of patient feedback?",
} as const;

/** Who hears that feedback needs a follow-up, when FEEDBACK_ALERT_TO is not set. */
export const FEEDBACK_ALERT_TO_DEFAULT = "info@theschoemanclinic.com";

export function isRating(value: string | null): value is Rating {
  return value === "green" || value === "amber" || value === "red";
}
