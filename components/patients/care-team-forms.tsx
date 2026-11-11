"use client";

import { Plus, X } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { addToCareTeam, removeFromCareTeam, type CareTeamFormState } from "@/lib/patients/actions";

const initial: CareTeamFormState = {};

export const RELATIONSHIP_LABELS = {
  primary_doctor: "Primary doctor",
  doctor: "Doctor",
  nurse: "Nurse",
  pa: "PA",
  health_coach: "Health coach",
} as const;

const ROLE_FOR_RELATIONSHIP: Record<keyof typeof RELATIONSHIP_LABELS, string> = {
  primary_doctor: "doctor",
  doctor: "doctor",
  nurse: "nurse",
  pa: "pa",
  health_coach: "health_coach",
};

export function AddToCareTeamDialog({
  patientId,
  patientName,
  staff,
}: {
  patientId: string;
  patientName: string;
  staff: { id: string; name: string; role: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [relationship, setRelationship] = useState<keyof typeof RELATIONSHIP_LABELS>("doctor");
  const [state, action, pending] = useActionState(async (previous: CareTeamFormState, formData: FormData) => {
    const result = await addToCareTeam(previous, formData);
    if (result.saved) setOpen(false);
    return result;
  }, initial);
  const people = staff.filter((person) => person.role === ROLE_FOR_RELATIONSHIP[relationship]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={`Add to ${patientName}'s care team`}>
          <Plus aria-hidden />
          Add
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add to the care team</DialogTitle>
          <DialogDescription>
            {patientName}. Doctors, nurses and health coaches see only the patients whose care team they are on.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="patientId" value={patientId} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`relationship-${patientId}`}>Role for this patient</Label>
            <Select
              id={`relationship-${patientId}`}
              name="relationship"
              value={relationship}
              onChange={(event) => setRelationship(event.target.value as keyof typeof RELATIONSHIP_LABELS)}
            >
              {Object.entries(RELATIONSHIP_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`staff-${patientId}`}>Team member</Label>
            <Select id={`staff-${patientId}`} name="staffId" required defaultValue="">
              <option value="" disabled>
                Choose
              </option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </Select>
          </div>
          <FormMessage state={state} />
          <DialogFooter>
            <Button type="submit" loading={pending}>
              Add to care team
            </Button>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RemoveFromCareTeamButton({ careTeamId, label }: { careTeamId: string; label: string }) {
  const [state, action, pending] = useActionState(removeFromCareTeam, initial);
  return (
    <form action={action} className="inline-flex flex-col">
      <input type="hidden" name="careTeamId" value={careTeamId} />
      <Button type="submit" variant="ghost" size="sm" loading={pending} aria-label={`Remove ${label} from the care team`}>
        <X aria-hidden />
      </Button>
      {state.error ? <FormMessage state={state} /> : null}
    </form>
  );
}
