"use client";

import { ArrowLeftRight, LogOut, User } from "lucide-react";
import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/lib/auth/actions";
import { initials } from "@/lib/format";

function UserMenu({
  name,
  roleLabel,
  avatarUrl,
  profileHref,
  switchTo,
}: {
  name: string;
  roleLabel: string;
  avatarUrl: string | null;
  profileHref: string;
  switchTo?: { href: string; label: string };
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label="Account menu" className="rounded-round">
        <Avatar>
          {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
          <AvatarFallback>{initials(name)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>
          {name}
          <span className="block">{roleLabel}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={profileHref}>
            <User aria-hidden />
            Profile
          </Link>
        </DropdownMenuItem>
        {switchTo ? (
          <DropdownMenuItem asChild>
            <Link href={switchTo.href}>
              <ArrowLeftRight aria-hidden />
              {switchTo.label}
            </Link>
          </DropdownMenuItem>
        ) : null}
        <form action={signOut}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full">
              <LogOut aria-hidden />
              Sign out
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { UserMenu };
