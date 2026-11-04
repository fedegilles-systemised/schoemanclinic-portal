import type { Metadata } from "next";

import { AuthHeading } from "@/components/auth/form-parts";
import {
  ConfirmAcceptForm,
  CreateAccountForm,
  SignInToAcceptForm,
  SignOutForm,
} from "@/components/invite/accept-forms";
import { getCurrentUser } from "@/lib/auth/session";
import { TEAM_ROLE_LABELS, type TeamRole } from "@/lib/invitations/constants";
import { lookupInvitation, readInviteToken, type InvitationLookup } from "@/lib/invitations/lookup";

export const metadata: Metadata = {
  title: "Your invitation · The Schoeman Clinic",
  // The address holds no token, but a copy of this page should not be kept anywhere.
  robots: { index: false, follow: false },
};

type Valid = Extract<InvitationLookup, { status: "valid" }>;

function describe(info: Valid): { title: string; text: string; action: string } {
  const who = info.inviterName ?? "The clinic";
  if (info.kind === "team") {
    const role = info.role && info.role !== "patient" ? TEAM_ROLE_LABELS[info.role as TeamRole] : "team member";
    return {
      title: "Join the clinic team",
      text: `${who} has invited you to join The Schoeman Clinic team as ${role.toLowerCase()}.`,
      action: `Add ${role.toLowerCase()} access to my account`,
    };
  }
  if (info.kind === "guardian") {
    return {
      title: "See and manage a patient's account",
      text: `${who} has invited you to The Schoeman Clinic's patient portal as a guardian.`,
      action: "Add guardian access to my account",
    };
  }
  return {
    title: "Welcome to your patient portal",
    text: `${who} has invited you to The Schoeman Clinic's patient portal.`,
    action: "Add patient access to my account",
  };
}

const MESSAGES: Record<string, { title: string; text: string }> = {
  none: { title: "Open your invitation link", text: "Use the link in the email you received. It opens this page." },
  not_found: { title: "This link is not valid", text: "Check that you used the latest email, or ask the clinic to send you a new invitation." },
  used: { title: "This invitation has been used", text: "If that was you, sign in. If not, please contact the clinic." },
  cancelled: { title: "This invitation is no longer valid", text: "Please ask the clinic to send you a new one." },
  expired: { title: "This invitation has expired", text: "Invitation links work for a few days. Please ask the clinic to send you a new one." },
};

export default async function AcceptInvitationPage() {
  const info = await lookupInvitation(await readInviteToken());

  if (info.status !== "valid") {
    const message = MESSAGES[info.status] ?? MESSAGES.not_found;
    return (
      <AuthHeading eyebrow="Invitation" title={message.title} description={message.text} />
    );
  }

  const user = await getCurrentUser();
  const copy = describe(info);
  const ask = info.kind === "team" ? null : info.kind;

  // Signed in as someone else: the invitation is for another address.
  if (user && user.email.toLowerCase() !== info.email.toLowerCase()) {
    return (
      <>
        <AuthHeading
          eyebrow="Invitation"
          title={copy.title}
          description={`You are signed in as ${user.email}, but this invitation is for another address. Sign out to continue with the right account.`}
        />
        <SignOutForm />
      </>
    );
  }

  // Signed in with the invited address: one click to say yes.
  if (user) {
    return (
      <>
        <AuthHeading eyebrow="Invitation" title={copy.title} description={`${copy.text} You are signed in as ${user.email}.`} />
        <ConfirmAcceptForm label={copy.action} ask={ask} />
      </>
    );
  }

  return (
    <>
      <AuthHeading
        eyebrow="Invitation"
        title={copy.title}
        description={
          info.accountExists
            ? `${copy.text} You already have an account, so sign in to add this access to it.`
            : `${copy.text} Choose a password to create your account.`
        }
      />
      {info.accountExists ? (
        <SignInToAcceptForm email={info.email} />
      ) : (
        <CreateAccountForm email={info.email} defaultName={info.fullName ?? ""} ask={ask} />
      )}
    </>
  );
}
