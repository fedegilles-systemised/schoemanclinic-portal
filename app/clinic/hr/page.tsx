import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "HR · The Schoeman Clinic" };

const BRIGHTHR_URL = "https://app.brighthr.com/";

/**
 * The clinic's HR system, BrightHR, for every team member. BrightHR does not allow itself to be shown
 * inside another website (its pages refuse to be framed), so it opens in a new tab and Clinic Hub
 * stays open behind it. Each person signs in to BrightHR with their own BrightHR account.
 */
export default async function HrPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.isSuspended || !user.isStaff) redirect("/clinic");

  return (
    <>
      <PageHeader eyebrow="HR" title="Bright" accent="HR" description="Holidays, absence, rotas, documents and payslips are managed in BrightHR." />
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Open BrightHR</CardTitle>
          <CardDescription>
            BrightHR opens in a new tab, and Clinic Hub stays open here. Sign in with your own BrightHR account; your Clinic Hub sign-in does not carry over.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <a href={BRIGHTHR_URL} target="_blank" rel="noopener noreferrer">
              <ExternalLink aria-hidden />
              Open BrightHR
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
