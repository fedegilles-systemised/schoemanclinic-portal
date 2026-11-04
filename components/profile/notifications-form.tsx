"use client";

import { useActionState, useState } from "react";

import { FormMessage } from "@/components/profile/form-message";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { saveNotificationPreferences, type ProfileFormState } from "@/lib/profile/actions";

const initial: ProfileFormState = {};

const TOPICS = [
  { id: "results", label: "Results", help: "When a result is ready in your portal" },
  { id: "payments", label: "Payments", help: "Receipts and payment reminders" },
  { id: "appointments", label: "Appointments", help: "Reminders and changes" },
  { id: "messages", label: "Messages", help: "Replies from the clinic" },
] as const;

const CHANNELS = [
  { id: "email", label: "Email" },
  { id: "portal", label: "Portal" },
] as const;

export function NotificationsForm({ values }: { values: Record<string, boolean> }) {
  const [state, action, pending] = useActionState(saveNotificationPreferences, initial);
  // Held here, not in the switches: a form reset after saving would put uncontrolled switches
  // back to how they were when the page first loaded.
  const [checked, setChecked] = useState(values);

  return (
    <form action={action} className="flex flex-col gap-6">
      <div className="border border-surface-border">
        <div className="grid grid-cols-[minmax(0,1fr)_72px_72px] items-center gap-3 border-b border-surface-border bg-surface-sunken px-4 py-2.5">
          <span className="type-eyebrow text-content-muted">Topic</span>
          {CHANNELS.map((channel) => (
            <span key={channel.id} className="type-eyebrow text-center text-content-muted">
              {channel.label}
            </span>
          ))}
        </div>
        {TOPICS.map((topic) => (
          <div
            key={topic.id}
            className="grid grid-cols-[minmax(0,1fr)_72px_72px] items-center gap-3 border-b border-surface-border px-4 py-3.5 last:border-b-0"
          >
            <div>
              <div className="type-card-title">{topic.label}</div>
              <div className="type-small text-content-muted">{topic.help}</div>
            </div>
            {CHANNELS.map((channel) => (
              <div key={channel.id} className="flex justify-center">
                <Switch
                  checked={checked[`${topic.id}.${channel.id}`] ?? true}
                  onCheckedChange={(value) => setChecked((current) => ({ ...current, [`${topic.id}.${channel.id}`]: value }))}
                  aria-label={`${topic.label} by ${channel.label.toLowerCase()}`}
                />
                {(checked[`${topic.id}.${channel.id}`] ?? true) ? (
                  <input type="hidden" name={`${topic.id}.${channel.id}`} value="on" />
                ) : null}
              </div>
            ))}
          </div>
        ))}
      </div>
      <p className="type-small text-content-muted">
        Emails about your sign-in, such as a password reset or a change of password, are always sent.
      </p>
      <FormMessage state={state} />
      <div>
        <Button type="submit" loading={pending}>
          Save choices
        </Button>
      </div>
    </form>
  );
}
