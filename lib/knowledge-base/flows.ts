/**
 * The step-by-step guides under the knowledge base's "User flows" menu. Each one is a Markdown file in
 * content/flows/<slug>.md with three parts: what it does, how it works and how to try it. Add a line here and the
 * file, and the guide appears in the menu and can be returned to after signing in.
 *
 * This file holds data only, so the sign-in check can import it without reading any files.
 */
export type FlowGuide = {
  slug: string;
  /** The line in the menu. */
  label: string;
  /** The page title, with the accented part last. */
  titleBefore: string;
  titleAccent: string;
  intro: string;
};

export const FLOW_GUIDES: readonly FlowGuide[] = [
  {
    slug: "accounts",
    label: "Invitations and sign-in",
    titleBefore: "Invitations and ",
    titleAccent: "sign-in",
    intro: "How a person is invited, how they sign in and how they look after their own account.",
  },
  {
    slug: "registration",
    label: "Registering a new patient",
    titleBefore: "Registering a new ",
    titleAccent: "patient",
    intro: "The clinic's registration form, recreated from Semble: what a new patient completes and what the team checks.",
  },
  {
    slug: "booking",
    label: "Booking and the diary",
    titleBefore: "Booking and the ",
    titleAccent: "diary",
    intro: "How patients and the team book, how new patients book online, and how the diary, no-shows and the 48-hour rule work.",
  },
  {
    slug: "bloods",
    label: "Ordering and paying for bloods",
    titleBefore: "Ordering and paying for ",
    titleAccent: "bloods",
    intro: "From the order to the barcode: how a blood test is ordered, paid, chased, taken and refunded.",
  },
  {
    slug: "results",
    label: "Results: enter, review, release",
    titleBefore: "Results: enter, review, ",
    titleAccent: "release",
    intro: "Enter a lab report, review and release it, and see what the patient sees. Each step says what you should find.",
  },
  {
    slug: "lab-pdfs",
    label: "Lab PDFs and the import queue",
    titleBefore: "Lab PDFs and the ",
    titleAccent: "import queue",
    intro: "How a lab's PDF reaches the right patient, and how a PA turns it into a report.",
  },
  {
    slug: "prescriptions",
    label: "Repeat prescriptions",
    titleBefore: "Repeat ",
    titleAccent: "prescriptions",
    intro: "How a patient asks for a repeat, pays the fee, and how the team answers and prescribes.",
  },
  {
    slug: "record",
    label: "The patient record and notes",
    titleBefore: "The patient record and ",
    titleAccent: "notes",
    intro: "What the team keeps on a patient: notes, allergies, diagnoses, medicines, documents, guardians and safeguarding.",
  },
  {
    slug: "questions",
    label: "Ask the clinic",
    titleBefore: "Ask the ",
    titleAccent: "clinic",
    intro: "How a patient writes to the clinic from the portal, and how the team replies.",
  },
  {
    slug: "feedback",
    label: "Feedback after an appointment",
    titleBefore: "Feedback after an ",
    titleAccent: "appointment",
    intro: "How the survey is sent, rated and followed up, and what the CQC download holds.",
  },
  {
    slug: "recordings",
    label: "Recording a call",
    titleBefore: "Recording a ",
    titleAccent: "call",
    intro: "How a clinician records a call and how the transcript reaches the record as a draft note.",
  },
  {
    slug: "wearables",
    label: "Wearables",
    titleBefore: "",
    titleAccent: "Wearables",
    intro: "How a patient connects Oura or WHOOP, and what the team sees.",
  },
  {
    slug: "education",
    label: "Education",
    titleBefore: "",
    titleAccent: "Education",
    intro: "How the clinic builds courses and how patients take them.",
  },
  {
    slug: "admin",
    label: "Running the clinic",
    titleBefore: "Running the ",
    titleAccent: "clinic",
    intro: "What admins keep up to date: the team, panels and fees, booking settings, sign-offs and the activity log.",
  },
] as const;

export const flowHref = (slug: string): string => `/knowledge-base/flows/${slug}`;

export function findFlow(slug: string): FlowGuide | undefined {
  return FLOW_GUIDES.find((flow) => flow.slug === slug);
}
