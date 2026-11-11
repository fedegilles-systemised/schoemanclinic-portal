"use client";

import { useTransition } from "react";
import { Check, ChevronDown, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { choosePortalPatient } from "@/lib/portal/actions";

export type SwitcherPatient = { id: string; name: string };

/** For a guardian of more than one patient, or a patient who is also a guardian: whose portal to show. */
function PatientSwitcher({ patients, currentId }: { patients: SwitcherPatient[]; currentId: string }) {
  const [pending, startTransition] = useTransition();
  const current = patients.find((p) => p.id === currentId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" loading={pending} aria-label={`Viewing: ${current?.name ?? ""}. Change patient`}>
          <Users aria-hidden className="size-3.5" />
          <span className="hidden phone:inline">{current?.name}</span>
          <ChevronDown aria-hidden className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {patients.map((p) => (
          <DropdownMenuItem key={p.id} onSelect={() => startTransition(() => choosePortalPatient(p.id))}>
            {p.id === currentId ? <Check aria-hidden /> : <span className="size-4" />}
            {p.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { PatientSwitcher };
