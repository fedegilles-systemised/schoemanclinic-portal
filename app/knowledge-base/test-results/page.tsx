import { redirect } from "next/navigation";

import { flowHref } from "@/lib/knowledge-base/flows";

/** The results guide moved under "User flows"; this keeps links already shared working. */
export default function TestResultsPage() {
  redirect(flowHref("results"));
}
