import type { Metadata } from "next";

import { ReadingForm, RemoveReadingButton } from "@/components/wearables/reading-forms";
import { ReadingsTable } from "@/components/wearables/readings-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUser } from "@/lib/auth/session";
import { todayInLondon } from "@/lib/calendar/time";
import { getPortalPatientId, getReadings } from "@/lib/data/education";

export const metadata: Metadata = { title: "Wearables · The Schoeman Clinic" };

/** Readings typed in from a wearable, until the devices connect directly. Your clinic team sees them too. */
export default async function WearablesPage() {
  const [patient, user] = await Promise.all([getPortalPatientId(), getCurrentUser()]);
  if (!patient) return <EmptyState>Your record is not ready yet.</EmptyState>;
  const readings = await getReadings(patient.id);

  return (
    <>
      <PageHeader
        eyebrow="Wearables"
        title="Your "
        accent="wearables"
        description="Add readings from your Oura, Whoop, Garmin or other device. Your clinic team sees them on your record."
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
