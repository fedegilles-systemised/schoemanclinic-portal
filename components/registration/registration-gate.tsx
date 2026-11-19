import { RegistrationForm } from "@/components/registration/registration-form";
import { PageHeader } from "@/components/ui/page-header";
import type { MyRegistration } from "@/lib/data/registration";

/**
 * What a new patient sees in place of the portal until they have completed the registration form. The rest of the
 * portal is not reachable while it is shown.
 */
export function RegistrationGate({ me }: { me: MyRegistration }) {
  return (
    <>
      <PageHeader
        eyebrow="Welcome"
        title="Your registration "
        accent="form"
        description="Sharing a little about yourself now means that, from your very first appointment, our full attention can be on you and what matters most to your health. It takes about ten minutes, and you only do it once."
      />
      <RegistrationForm me={me} />
    </>
  );
}
