import type { Metadata } from "next";

import { ProfilePage } from "@/components/profile/profile-page";

export const metadata: Metadata = { title: "Profile · The Schoeman Clinic" };

export default async function PortalProfilePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  return <ProfilePage area="portal" tab={tab} />;
}
