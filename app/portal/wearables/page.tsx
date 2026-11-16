import type { Metadata } from "next";

import { ConnectionsCard } from "@/components/wearables/connections-card";
import { ReadingForm, RemoveReadingButton } from "@/components/wearables/reading-forms";
import { ReadingsTable } from "@/components/wearables/readings-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUser } from "@/lib/auth/session";
import { todayInLondon } from "@/lib/calendar/time";
import { getConsents } from "@/lib/data/consents";
import { getPortalPatientId, getReadings, getWearableConnections } from "@/lib/data/education";
import { getWearableProviderEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Wearables · The Schoeman Clinic" };

/** Readings from a connected wearable, and any typed in by hand. Your clinic team sees them too. */
export default async function WearablesPage({ searchParams }: { searchParams: Promise<{ connected?: string; error?: string }> }) {
  const [patient, user, query] = await Promise.all([getPortalPatientId(), getCurrentUser(), searchParams]);
  if (!patient) return <EmptyState>Your record is not ready yet.</EmptyState>;
  const [readings, connections, consents] = await Promise.all([getReadings(patient.id), getWearableConnections(patient.id), getConsents(patient.id)]);
  const configured = { oura: getWearableProviderEnv("oura") !== null, whoop: getWearableProviderEnv("whoop") !== null };

  return (
    <>
      <PageHeader
        eyebrow="Wearables"
        title="Your "
        accent="wearables"
        description="Connect your Oura or WHOOP account, or add readings from another device by hand. Your clinic team sees them on your record."
      />
      <ConnectionsCard
        patientId={patient.id}
        canAct={patient.canAct}
        consented={Boolean(consents.wearables?.granted)}
        connections={connections}
        configured={configured}
        connectedNow={query.connected}
        error={query.error}
      />
      {patient.canAct ? (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Add a reading</CardTitle>
            <CardDescription>Use the figure your device app shows for that day.</CardDescription>
          </CardHeader>
          <CardContent>
            <ReadingForm patientId={patient.id} today={todayInLondon()} />
          </CardContent>
        </Card>
      ) : null}
      {readings.length === 0 ? (
        <EmptyState>No readings yet.</EmptyState>
      ) : (
        <ReadingsTable
          readings={readings}
          action={(reading) => (reading.enteredBy === user?.id ? <RemoveReadingButton readingId={reading.id} /> : null)}
        />
      )}
    </>
  );
}
