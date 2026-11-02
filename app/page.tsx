import { redirect } from "next/navigation";

import { getCurrentUser, homePathFor } from "@/lib/auth/session";

/** There are no public pages: everyone goes to their area or to sign-in. */
export default async function RootPage() {
  const user = await getCurrentUser();
  const home = user ? homePathFor(user) : null;
  redirect(home ?? "/login");
}
