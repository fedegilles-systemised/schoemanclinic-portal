import { notFound } from "next/navigation";

import { UiGallery } from "./ui-gallery";

export const metadata = { title: "UI gallery · Clinic Hub" };

/** Hidden dev-only route for visual checks. In production it returns 404. */
export default function DevUiPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <UiGallery />;
}
