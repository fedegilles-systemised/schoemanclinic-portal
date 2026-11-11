import type { Metadata } from "next";
import { FileText } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listDocuments } from "@/lib/data/documents";
import { getPortalPatientId } from "@/lib/data/education";
import { DOCUMENT_KIND_LABELS } from "@/lib/documents/constants";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Letters and documents · The Schoeman Clinic" };

/** Letters and documents the clinic has shared. Each opens through a one-minute link. */
export default async function DocumentsPage({ searchParams }: { searchParams: Promise<{ missing?: string }> }) {
  const { missing } = await searchParams;
  const patient = await getPortalPatientId();
  if (!patient) return <EmptyState>Your record is not ready yet.</EmptyState>;
  const documents = await listDocuments(patient.id, { sharedOnly: true });

  return (
    <>
      <PageHeader
        eyebrow="Letters and documents"
        title="Letters and "
        accent="documents"
        description="Letters, referrals and reports the clinic has shared with you."
      />
      {missing ? (
        <div className="mb-6">
          <Alert variant="warning">
            <AlertDescription>That document is no longer available. Please contact the clinic if you need it.</AlertDescription>
          </Alert>
        </div>
      ) : null}
      {documents.length === 0 ? (
        <EmptyState>Nothing shared yet.</EmptyState>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Document</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead>Shared</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.map((d) => (
              <TableRow key={d.id}>
                <TableCell>
                  <a href={`/portal/documents/${d.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-content">
                    <FileText className="size-4" aria-hidden />
                    {d.title}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </TableCell>
                <TableCell>{DOCUMENT_KIND_LABELS[d.kind]}</TableCell>
                <TableCell>{formatDate(d.sharedAt ?? d.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}
