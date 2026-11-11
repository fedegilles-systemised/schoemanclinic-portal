import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { londonParts } from "@/lib/calendar/time";
import type { AppointmentRow } from "@/lib/data/appointments";
import { formatDayDate } from "@/lib/format";

const STATUS: Record<string, string> = { booked: "Booked", confirmed: "Confirmed", cancelled: "Cancelled", completed: "Completed", no_show: "Missed" };

export function AppointmentsTable({ rows, action }: { rows: AppointmentRow[]; action?: (row: AppointmentRow) => React.ReactNode }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>When</TableHead>
          <TableHead>Appointment</TableHead>
          <TableHead>With</TableHead>
          <TableHead>Where</TableHead>
          <TableHead>Status</TableHead>
          {action ? (
            <TableHead>
              <span className="sr-only">Action</span>
            </TableHead>
          ) : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="tabular-nums">
              {formatDayDate(row.startsAt)}, {londonParts(row.startsAt).time}
            </TableCell>
            <TableCell>
              {row.type} <span className="type-small text-content-muted">({row.durationMin} min)</span>
            </TableCell>
            <TableCell>{row.clinicianName ?? "-"}</TableCell>
            <TableCell className="text-content-muted">{row.locationName ?? "-"}</TableCell>
            <TableCell>{STATUS[row.status] ?? row.status}</TableCell>
            {action ? <TableCell>{action(row)}</TableCell> : null}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
