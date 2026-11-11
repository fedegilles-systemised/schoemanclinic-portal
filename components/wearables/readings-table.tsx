import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Reading } from "@/lib/data/education";
import { formatDate } from "@/lib/format";
import { WEARABLE_METRICS } from "@/lib/wearables/metrics";

/** Readings, newest first. The action column is for the person who can remove a reading they entered. */
export function ReadingsTable({ readings, action }: { readings: Reading[]; action?: (reading: Reading) => React.ReactNode }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Reading</TableHead>
          <TableHead>Value</TableHead>
          <TableHead>Device</TableHead>
          {action ? (
            <TableHead>
              <span className="sr-only">Action</span>
            </TableHead>
          ) : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {readings.map((reading) => (
          <TableRow key={reading.id}>
            <TableCell className="tabular-nums">{formatDate(reading.measuredOn)}</TableCell>
            <TableCell>{WEARABLE_METRICS[reading.metric].label}</TableCell>
            <TableCell className="tabular-nums">
              {reading.value} {WEARABLE_METRICS[reading.metric].unit}
            </TableCell>
            <TableCell className="text-content-muted">{reading.device ?? "-"}</TableCell>
            {action ? <TableCell>{action(reading)}</TableCell> : null}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
