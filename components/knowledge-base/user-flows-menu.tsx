"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type UserFlow = { href: string; label: string };

/**
 * The "User flows" tab: a menu of step-by-step guides, one for each thing a person does in Clinic Hub. It
 * looks like the other tabs and is marked as the current one while any of its guides is open.
 */
export function UserFlowsMenu({ flows, activePath }: { flows: readonly UserFlow[]; activePath: string }) {
  const active = flows.some((flow) => flow.href === activePath);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "type-eyebrow inline-flex cursor-pointer items-center gap-2 border-b pb-1",
          active ? "border-content text-content" : "border-transparent text-content-muted hover:text-content",
        )}
      >
        User flows
        <ChevronDown aria-hidden className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center">
        {flows.map((flow) => (
          <DropdownMenuItem key={flow.href} asChild>
            <Link href={flow.href} aria-current={flow.href === activePath ? "page" : undefined}>
              {flow.label}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
