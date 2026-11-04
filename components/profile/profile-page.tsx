import { CircleAlert } from "lucide-react";

import { AvatarForm, DetailsForm } from "@/components/profile/details-form";
import { NotificationsForm } from "@/components/profile/notifications-form";
import { ProfileTabs, type ProfileTab } from "@/components/profile/profile-tabs";
import { ChangeEmailForm, ChangePasswordForm, SignOutOthersForm } from "@/components/profile/security-forms";
import { DefinitionList, ProfileSection } from "@/components/profile/section";
import { SignatureForm } from "@/components/profile/signature-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { ROLE_LABELS } from "@/lib/auth/role-labels";
import { getCurrentUser } from "@/lib/auth/session";
import {
  getAccount,
  getNotificationPreferences,
  getPatientProfile,
  getWorkProfile,
  type LookedAfterView,
  type RecordView,
  type WorkView,
} from "@/lib/data/profile";
import { formatDate } from "@/lib/format";
import { SESSION_LIMITS } from "@/lib/supabase/session-limits";
import { redirect } from "next/navigation";

type Area = "portal" | "clinic";

function hours(seconds: number): string {
  const h = seconds / 3600;
  return h >= 48 ? `${Math.round(h / 24)} days` : h >= 1 ? `${h} ${h === 1 ? "hour" : "hours"}` : `${Math.round(seconds / 60)} minutes`;
}

function sessionRule(isStaff: boolean): string {
  const limits = SESSION_LIMITS[isStaff ? "staff" : "patient"];
  return `After ${hours(limits.totalSeconds)}, or ${hours(limits.idleSeconds)} with no activity`;
}

function RecordTab({ record }: { record: RecordView }) {
  return (
    <ProfileSection
      title="Your record at the clinic"
      description="The details the clinic holds about you."
    >
      <DefinitionList
        items={[
          { label: "Name", value: record.name },
          { label: "Date of birth", value: formatDate(record.dateOfBirth) },
          { label: "Clinic reference", value: record.clinicRef },
          { label: "Contact email", value: record.contactEmail },
          { label: "Contact phone", value: record.contactPhone },
          { label: "Country", value: record.country },
          { label: "Your doctor", value: record.clinician },
        ]}
      />
      <Alert variant="info">
        <CircleAlert aria-hidden />
        <AlertDescription>
          The clinic keeps these details. To change one, contact the clinic. Your sign-in email and phone number are in the Details tab.
        </AlertDescription>
      </Alert>
    </ProfileSection>
  );
}

function LookedAfterTab({ people }: { people: LookedAfterView[] }) {
  return (
    <ProfileSection
      title="People you look after"
      description="The clinic has confirmed you as a guardian for these patients."
    >
      <ul className="flex flex-col border border-surface-border">
        {people.map((person) => (
          <li
            key={person.patientId}
            className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-border px-4 py-3.5 last:border-b-0"
          >
            <div>
              <div className="type-card-title">{person.name}</div>
              {person.relationship ? <div className="type-small text-content-muted">{person.relationship}</div> : null}
            </div>
            <Badge className="opacity-100">{person.canAct ? "View and act" : "View only"}</Badge>
          </li>
        ))}
      </ul>
      <p className="type-small text-content-muted">The clinic decides what a guardian can do. To change it, contact the clinic.</p>
    </ProfileSection>
  );
}

function WorkTab({ work }: { work: WorkView }) {
  return (
    <ProfileSection
      title="Your work profile"
      description="How you appear to the clinic team. An admin manages these details."
    >
      <DefinitionList
        items={[
          { label: "Job title", value: work.jobTitle },
          { label: "Role", value: work.clinicalRole === "pa" ? "PA" : work.clinicalRole.replace("_", " ").replace(/^./, (c) => c.toUpperCase()) },
          ...(work.clinicalRole === "doctor" ? [{ label: "GMC number", value: work.gmcNumber }] : []),
          {
            label: "Locations",
            value: work.locations.length
              ? work.locations.map((place) => (place.isPrimary ? `${place.name} (main)` : place.name)).join(", ")
              : null,
          },
          { label: "Status", value: work.active ? "Active" : "Inactive" },
        ]}
      />
    </ProfileSection>
  );
}

/** The profile screen. Which tabs appear depends on the area and on the person's roles. */
export async function ProfilePage({ area, tab }: { area: Area; tab?: string }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [account, preferences] = await Promise.all([getAccount(user), getNotificationPreferences(user.id)]);

  const tabs: ProfileTab[] = [
    {
      id: "details",
      label: "Details",
      content: (
        <>
          <ProfileSection title="Photo" description="Shown beside your name in the top bar.">
            <AvatarForm name={account.fullName} avatarUrl={account.avatarUrl} hasPhoto={account.hasAvatar} />
          </ProfileSection>
          <ProfileSection title="Your details">
            <DetailsForm fullName={account.fullName} phone={account.phone} email={account.email} />
          </ProfileSection>
          <ProfileSection title="Your roles" description="Roles are set by the clinic.">
            <div className="flex flex-wrap gap-2">
              {user.roles.map((role) => (
                <Badge key={role} className="opacity-100">
                  {ROLE_LABELS[role]}
                </Badge>
              ))}
              {area === "portal" && !user.roles.includes("patient") ? <Badge className="opacity-100">Guardian</Badge> : null}
            </div>
          </ProfileSection>
        </>
      ),
    },
  ];

  if (area === "portal") {
    const { record, lookedAfter } = await getPatientProfile();
    if (record) tabs.push({ id: "record", label: "Your record", content: <RecordTab record={record} /> });
    if (lookedAfter.length > 0) {
      tabs.push({ id: "guardianship", label: "People you look after", content: <LookedAfterTab people={lookedAfter} /> });
    }
  } else {
    const work = await getWorkProfile(user.id);
    if (work) {
      tabs.push({ id: "work", label: "Work profile", content: <WorkTab work={work} /> });
      if (user.roles.includes("doctor")) {
        tabs.push({
          id: "signature",
          label: "Signature",
          content: (
            <ProfileSection title="Your signature" description="Used on letters you sign. It is private to you.">
              <SignatureForm signatureUrl={work.signatureUrl} />
            </ProfileSection>
          ),
        });
      }
    }
  }

  tabs.push(
    {
      id: "notifications",
      label: "Notifications",
      content: (
        <ProfileSection
          title="How you hear from us"
          description="Choose what we tell you about, and where. The clinic's messaging system follows these choices."
        >
          <NotificationsForm values={preferences} />
        </ProfileSection>
      ),
    },
    {
      id: "security",
      label: "Security",
      content: (
        <>
          <ProfileSection title="Change your password" description="You will be asked for your current password.">
            <ChangePasswordForm />
          </ProfileSection>
          <ProfileSection title="Change your sign-in email" description="We send a link to confirm the new address.">
            <ChangeEmailForm email={account.email} />
          </ProfileSection>
          <ProfileSection title="Other devices" description="If you used a shared computer, or lost a device, sign out everywhere else.">
            <SignOutOthersForm />
          </ProfileSection>
          <ProfileSection title="How long you stay signed in">
            <DefinitionList items={[{ label: "You are signed out", value: sessionRule(user.isStaff) }]} />
            <p className="type-small text-content-muted">A second step at sign-in, with a code from an app, is planned.</p>
          </ProfileSection>
        </>
      ),
    },
  );

  const defaultTab = tabs.some((item) => item.id === tab) ? (tab as string) : "details";

  return (
    <>
      <PageHeader eyebrow="Account" title="Your " accent="profile" description="Your details, how you hear from us, and how you sign in." />
      <ProfileTabs tabs={tabs} defaultTab={defaultTab} />
    </>
  );
}
