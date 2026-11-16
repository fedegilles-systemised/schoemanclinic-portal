import "server-only";

import { LAB_RETENTION_DAYS } from "@/lib/labs/constants";
import { createAdminClient } from "@/lib/supabase/admin";

export type LabRetentionResult = { removed: number; cleared: number; failed: number };

/**
 * Keeps lab files for LAB_RETENTION_DAYS. A file left unmatched or turned away that long has its PDF
 * removed from storage and the lab's name, email and date of birth cleared. The database is told only
 * after the PDF is gone, so a failed removal is simply tried again tomorrow. Where values have been
 * entered, the lab's details are cleared at once. Nothing from a file is written to the log.
 */
export async function purgeLabFiles(): Promise<LabRetentionResult> {
  const admin = createAdminClient();
  const due = await admin.rpc("stale_lab_files", { _days: LAB_RETENTION_DAYS });
  if (due.error) throw new Error("Could not list the lab files that are due.");

  const gone: string[] = [];
  let failed = 0;
  for (const file of due.data ?? []) {
    const removed = await admin.storage.from("documents").remove([file.storage_path]);
    if (removed.error) failed += 1;
    else gone.push(file.import_id);
  }

  let removed = 0;
  if (gone.length > 0) {
    const finished = await admin.rpc("finish_lab_purge", { _import_ids: gone, _days: LAB_RETENTION_DAYS });
    if (finished.error) throw new Error("Could not record the removed lab files.");
    removed = finished.data ?? 0;
  }

  const cleared = await admin.rpc("clear_entered_lab_details");
  if (cleared.error) throw new Error("Could not clear the lab details.");
  return { removed, cleared: cleared.data ?? 0, failed };
}
