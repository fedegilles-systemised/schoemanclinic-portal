import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AddHoursForm, AddTypeForm, RemoveHoursButton, TypeActiveButton, TypeOnlineButton, WEEKDAYS } from "@/components/booking/settings-forms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentUser } from "@/lib/auth/session";
import { getMyStaffId } from "@/lib/data/patient-record";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Booking · The Schoeman Clinic" };

/** What patients can book, and when each clinician can be booked. */
export default async function BookingSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.isSuspended || !user.isStaff) redirect("/clinic");
  const supabase = await createClient();
  const [types, hours, directory, locations, myStaffId] = await Promise.all([
    supabase.from("appointment_types").select("id, name, duration_min, location_kind, bookable_by_patients, bookable_online, active").order("name"),
    supabase.from("clinician_availability").select("id, staff_id, weekday, start_time, end_time, location_id").eq("active", true).order("weekday").order("start_time"),
    supabase.rpc("get_staff_directory"),
    supabase.from("locations").select("id, name").order("name"),
    getMyStaffId(user.id),
  ]);
  if (types.error || hours.error || directory.error || locations.error) throw new Error("Could not load the booking settings.");
  const managesAll = user.roles.some((role) => role === "admin" || role === "pa");
  const clinicians = directory.data
    .filter((d) => d.clinical_role === "doctor" || d.clinical_role === "nurse" || d.clinical_role === "health_coach")
    .filter((d) => managesAll || d.staff_id === myStaffId)
    .map((d) => ({ id: d.staff_id, name: d.full_name }));
  const names = new Map(directory.data.map((d) => [d.staff_id, d.full_name]));
  const places = new Map(locations.data.map((l) => [l.id, l.name]));

  return (
    <>
      <PageHeader eyebrow="Booking" title="Booking " accent="settings" description="Appointment types, and the weekly hours in which each clinician can be booked (London time)." />

      <section aria-labelledby="types" className="mb-12 flex flex-col gap-4">
        <SectionHeader id="types" title="Appointment " accent="types" />
        {types.data.length === 0 ? (
          <EmptyState>No appointment types yet.</EmptyState>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Appointment</TableHead>
                <TableHead>Length</TableHead>
                <TableHead>Where</TableHead>
                <TableHead>Who can book</TableHead>
                {user.isAdmin ? (
                  <TableHead>
                    <span className="sr-only">Action</span>
                  </TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {types.data.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    {t.name}
                    {t.active ? null : <span className="type-small text-content-muted"> · not offered</span>}
                  </TableCell>
                  <TableCell className="tabular-nums">{t.duration_min} min</TableCell>
                  <TableCell>{t.location_kind === "video" ? "Video" : "In clinic"}</TableCell>
                  <TableCell>
                    {t.bookable_by_patients ? "Patients and staff" : "Staff only"}
                    {t.bookable_online ? <span className="type-small block text-content-muted">New patients online too</span> : null}
                  </TableCell>
                  {user.isAdmin ? (
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1">
                        <TypeOnlineButton id={t.id} online={t.bookable_online} name={t.name} />
                        <TypeActiveButton id={t.id} active={t.active} name={t.name} />
                      </div>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {user.isAdmin ? (
          <Card>
            <CardHeader>
              <CardTitle>New appointment type</CardTitle>
            </CardHeader>
            <CardContent>
              <AddTypeForm />
            </CardContent>
          </Card>
        ) : null}
      </section>

      <section aria-labelledby="hours" className="flex flex-col gap-4">
        <SectionHeader id="hours" title="Clinician " accent="hours" />
        {hours.data.length === 0 ? (
          <EmptyState>No hours set yet. Patients see free times only inside these hours.</EmptyState>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Clinician</TableHead>
                <TableHead>Day</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>
                  <span className="sr-only">Action</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {hours.data.map((h) => (
                <TableRow key={h.id}>
                  <TableCell>{names.get(h.staff_id) ?? "A former team member"}</TableCell>
                  <TableCell>{WEEKDAYS[h.weekday - 1]}</TableCell>
                  <TableCell className="tabular-nums">
                    {h.start_time.slice(0, 5)} to {h.end_time.slice(0, 5)}
                  </TableCell>
                  <TableCell className="text-content-muted">{h.location_id ? (places.get(h.location_id) ?? "-") : "Any"}</TableCell>
                  <TableCell>
                    {managesAll || h.staff_id === myStaffId ? (
                      <RemoveHoursButton id={h.id} label={`${names.get(h.staff_id) ?? ""} ${WEEKDAYS[h.weekday - 1]} hours`} />
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {clinicians.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Add hours</CardTitle>
            </CardHeader>
            <CardContent>
              <AddHoursForm clinicians={clinicians} locations={locations.data} />
            </CardContent>
          </Card>
        ) : null}
      </section>
    </>
  );
}
