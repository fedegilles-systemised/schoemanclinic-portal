"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useActionState, useState } from "react";

import { FormMessage } from "@/components/profile/form-message";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  addEvent,
  changeEvent,
  disconnectCalendar,
  removeEvent,
  type CalendarFormState,
} from "@/lib/calendar/actions";

const initial: CalendarFormState = {};

export type EventDraft = {
  id?: string;
  title: string;
  day: string;
  startTime: string;
  endTime: string;
  location: string;
  description: string;
  /** One occurrence of a repeating event. */
  repeating?: boolean;
};

function EventFields({ draft }: { draft: EventDraft }) {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="event-title">Title</Label>
        <Input id="event-title" name="title" defaultValue={draft.title} maxLength={200} required />
        <p className="type-small text-content-muted">
          This is saved in your Google Calendar. Use a patient&apos;s clinic reference rather than their full name.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="event-day">Date</Label>
          <Input id="event-day" name="day" type="date" defaultValue={draft.day} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="event-start">Starts</Label>
          <Input id="event-start" name="startTime" type="time" defaultValue={draft.startTime} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="event-end">Ends</Label>
          <Input id="event-end" name="endTime" type="time" defaultValue={draft.endTime} required />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="event-location">Place (optional)</Label>
        <Input id="event-location" name="location" defaultValue={draft.location} maxLength={300} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="event-description">Notes (optional)</Label>
        <Textarea id="event-description" name="description" defaultValue={draft.description} maxLength={4000} />
      </div>
    </>
  );
}

/** Adds an event, or changes one when the draft has an id. Times are London time. */
export function EventDialog({ draft }: { draft: EventDraft }) {
  const editing = Boolean(draft.id);
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(async (previous: CalendarFormState, formData: FormData) => {
    const result = await (editing ? changeEvent : addEvent)(previous, formData);
    if (result.saved) setOpen(false);
    return result;
  }, initial);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {editing ? (
          <Button variant="ghost" size="sm" aria-label={`Edit ${draft.title}`}>
            <Pencil aria-hidden />
            Edit
          </Button>
        ) : (
          <Button>
            <Plus aria-hidden />
            Add event
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit this event" : "Add an event"}</DialogTitle>
          <DialogDescription>
            Times are London time. The change appears in your Google Calendar straight away.
            {draft.repeating ? " This is one occurrence of a repeating event: only this occurrence changes." : null}
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-4">
          {draft.id ? <input type="hidden" name="eventId" value={draft.id} /> : null}
          <EventFields draft={draft} />
          <FormMessage state={state} />
          <DialogFooter>
            <Button type="submit" loading={pending}>
              {editing ? "Save changes" : "Add event"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteEventDialog({ id, title }: { id: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(async (previous: CalendarFormState, formData: FormData) => {
    const result = await removeEvent(previous, formData);
    if (result.saved) setOpen(false);
    return result;
  }, initial);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={`Delete ${title}`}>
          <Trash2 aria-hidden />
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this event?</DialogTitle>
          <DialogDescription>
            {title} is removed from your Google Calendar. If others were invited, Google may tell them.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="eventId" value={id} />
          <FormMessage state={state} />
          <DialogFooter>
            <Button type="submit" variant="destructive" loading={pending}>
              Delete event
            </Button>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Keep it
              </Button>
            </DialogClose>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DisconnectForm() {
  const [state, action, pending] = useActionState(() => disconnectCalendar(), initial);
  return (
    <form action={action} className="flex flex-col gap-3">
      <FormMessage state={state} />
      <div>
        <Button type="submit" variant="outline" size="sm" loading={pending}>
          Disconnect
        </Button>
      </div>
    </form>
  );
}
