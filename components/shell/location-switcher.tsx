"use client";

import { Check, ChevronDown, MapPin } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ShellLocation } from "@/lib/data/shell";

/** Sets the selected location in the URL, so the page reads it on the server. */
function LocationSwitcher({ locations }: { locations: ShellLocation[] }) {
  const router = useRouter();
  const selectedId = useSearchParams().get("location");
  const selected = locations.find((location) => location.id === selectedId);

  function select(id: string | null) {
    router.push(id ? `/clinic?location=${id}` : "/clinic");
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" aria-label={`Location: ${selected?.name ?? "All locations"}`}>
          <MapPin aria-hidden className="size-3.5" />
          <span className="hidden phone:inline">{selected?.name ?? "All locations"}</span>
          <ChevronDown aria-hidden className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => select(null)}>
          {selected ? <span className="size-4" /> : <Check aria-hidden />}
          All locations
        </DropdownMenuItem>
        {locations.map((location) => (
          <DropdownMenuItem key={location.id} onSelect={() => select(location.id)}>
            {location.id === selectedId ? <Check aria-hidden /> : <span className="size-4" />}
            {location.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { LocationSwitcher };
