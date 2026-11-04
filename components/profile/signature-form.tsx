"use client";

import { useActionState, useState } from "react";

import { FormMessage } from "@/components/profile/form-message";
import { ImageInput } from "@/components/profile/image-input";
import { Button } from "@/components/ui/button";
import { uploadSignature, type ProfileFormState } from "@/lib/profile/actions";

const initial: ProfileFormState = {};

export function SignatureForm({ signatureUrl }: { signatureUrl: string | null }) {
  const [state, action, pending] = useActionState(uploadSignature, initial);
  const [preparing, setPreparing] = useState(false);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex h-32 items-center justify-center border border-surface-border bg-surface-sunken p-3">
        {signatureUrl ? (
          // A short-lived private address, so next/image's optimiser cannot fetch it.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={signatureUrl} alt="Your signature" className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="type-small text-content-muted">No signature yet.</span>
        )}
      </div>
      <ImageInput name="signature" label="Choose a signature image" maxBytes={1024 * 1024} maxSide={1200} onBusyChange={setPreparing} />
      <p className="type-small text-content-muted">
        A dark signature on a plain light background, as JPEG, PNG or WebP. A large image is made smaller for you. Only you can see this file here.
      </p>
      <FormMessage state={state} />
      <div>
        <Button type="submit" loading={pending || preparing}>
          Save signature
        </Button>
      </div>
    </form>
  );
}
