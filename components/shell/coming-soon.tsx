"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Wraps something for a screen that is not built yet. A disabled control cannot show a
 * tooltip or take focus, so this wrapper does both.
 */
function ComingSoon({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} aria-disabled="true" className={className ?? "inline-flex w-fit"}>
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent>Coming soon</TooltipContent>
    </Tooltip>
  );
}

export { ComingSoon };
