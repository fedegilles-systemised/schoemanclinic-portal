"use client";

import { Check, CircleAlert, Info, Loader2, TriangleAlert } from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

/** Toasts confirm success in the past tense. Sign-in errors never use them. */
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="light"
      position="bottom-center"
      icons={{
        success: <Check className="size-4" aria-hidden />,
        info: <Info className="size-4" aria-hidden />,
        warning: <TriangleAlert className="size-4" aria-hidden />,
        error: <CircleAlert className="size-4" aria-hidden />,
        loading: <Loader2 className="size-4 animate-spin" aria-hidden />,
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "type-table flex w-full items-center gap-2.5 rounded-none bg-surface-inverse px-4.5 py-3 text-content-inverse",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
