"use client";

import { useActionState, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/auth/form-parts";
import { FormMessage } from "@/components/profile/form-message";
import { ImageInput } from "@/components/profile/image-input";
import { initials } from "@/lib/format";
import { removeAvatar, updateDetails, uploadAvatar, type ProfileFormState } from "@/lib/profile/actions";

const initial: ProfileFormState = {};

export function AvatarForm({ name, avatarUrl, hasPhoto }: { name: string; avatarUrl: string | null; hasPhoto: boolean }) {
  const [uploadState, uploadAction, uploading] = useActionState(uploadAvatar, initial);
  const [removeState, removeAction, removing] = useActionState(removeAvatar, initial);
  const [preparing, setPreparing] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-5">
        <Avatar className="size-20">
          {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
          <AvatarFallback>{initials(name)}</AvatarFallback>
        </Avatar>
        <form action={uploadAction} className="flex flex-col items-start gap-3">
          <ImageInput name="avatar" label="Choose a photo" maxBytes={2 * 1024 * 1024} maxSide={1024} onBusyChange={setPreparing} />
          <Button type="submit" variant="outline" size="sm" loading={uploading || preparing}>
            Upload photo
          </Button>
        </form>
      </div>
      <p className="type-small text-content-muted">JPEG, PNG or WebP. A large photo is made smaller for you. Your team can see it.</p>
      <FormMessage state={uploadState.error || uploadState.saved ? uploadState : removeState} />
      {hasPhoto ? (
        <form action={removeAction}>
          <Button type="submit" variant="ghost" loading={removing}>
            Remove photo
          </Button>
        </form>
      ) : null}
    </div>
  );
}

export function DetailsForm({ fullName, phone, email }: { fullName: string; phone: string | null; email: string }) {
  const [state, action, pending] = useActionState(updateDetails, initial);

  return (
    <form action={action} className="flex flex-col gap-4">
      <Field id="fullName" label="Full name">
        <Input id="fullName" name="fullName" defaultValue={fullName} autoComplete="name" maxLength={120} required />
      </Field>
      <Field id="phone" label="Phone">
        <Input id="phone" name="phone" type="tel" defaultValue={phone ?? ""} autoComplete="tel" maxLength={30} />
      </Field>
      <Field id="email" label="Sign-in email">
        <Input id="email" value={email} readOnly disabled />
      </Field>
      <p className="type-small text-content-muted">To change your sign-in email, use the Security tab.</p>
      <FormMessage state={state} />
      <Button type="submit" loading={pending}>
        Save changes
      </Button>
    </form>
  );
}
