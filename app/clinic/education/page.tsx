import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { CreateCourseForm } from "@/components/education/forms";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentUser } from "@/lib/auth/session";
import { listCourses } from "@/lib/data/education";

export const metadata: Metadata = { title: "Education · The Schoeman Clinic" };

/** The education library. Admins build courses; every team member can read them and assign them from a patient's record. */
export default async function EducationPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.isSuspended || !user.isStaff) redirect("/clinic");
  const courses = await listCourses();

  return (
    <>
      <PageHeader
        eyebrow="Education"
        title="Education "
        accent="library"
        description="Courses made of sections and modules. A published course shows on a patient's portal once it is added from their record."
      />
      {user.isAdmin ? (
        <Card className="mb-8 max-w-2xl">
          <CardHeader>
            <CardTitle>New course</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateCourseForm />
          </CardContent>
        </Card>
      ) : null}
      {courses.length === 0 ? (
        <EmptyState>No courses yet. {user.isAdmin ? "Create the first one above." : "An admin adds them."}</EmptyState>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Course</TableHead>
              <TableHead>Modules</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {courses.map((course) => (
              <TableRow key={course.id}>
                <TableCell>
                  <Link href={`/clinic/education/${course.id}`} className="text-content underline underline-offset-2">
                    {course.title}
                  </Link>
                  {course.description ? <div className="type-small text-content-muted">{course.description}</div> : null}
                </TableCell>
                <TableCell className="tabular-nums">{course.moduleCount}</TableCell>
                <TableCell>
                  <Badge variant={course.published ? "outline" : "neutral"}>{course.published ? "Published" : "Draft"}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}
