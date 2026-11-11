"use client";

import * as React from "react";
import { flushSync } from "react-dom";

import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type ConfirmButtonProps = Omit<React.ComponentProps<typeof Button>, "type" | "onClick"> & {
  /** The question, such as "Sign this note?". */
  confirmTitle: string;
  /** What happens, in one or two sentences. */
  confirmText: string;
  /** The label on the button that goes ahead. Defaults to the trigger's own label. */
  confirmLabel?: string;
  /** Submits with this action instead of the form's own, like a submit button's formAction. */
  formAction?: React.ComponentProps<"button">["formAction"];
  /** The style of the button that goes ahead. Destructive for anything removed or withdrawn. */
  confirmVariant?: "primary" | "destructive";
};

/**
 * A submit button that asks first, in the clinic's own dialog rather than the browser's. It sits
 * inside a form; going ahead submits that form through a hidden button, so formAction still works.
 */
function ConfirmButton({ confirmTitle, confirmText, confirmLabel, confirmVariant, formAction, children, variant, ...props }: ConfirmButtonProps) {
  const [open, setOpen] = React.useState(false);
  // Disabled until confirmed, so pressing Enter in the form can never submit through it unasked.
  const [armed, setArmed] = React.useState(false);
  const submitter = React.useRef<HTMLButtonElement>(null);

  return (
    <>
      <button ref={submitter} type="submit" formAction={formAction} hidden disabled={!armed} tabIndex={-1} aria-hidden />
      <Button type="button" variant={variant} {...props} onClick={() => setOpen(true)}>
        {children}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmTitle}</DialogTitle>
            <DialogDescription>{confirmText}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant={confirmVariant ?? (variant === "destructive" ? "destructive" : "primary")}
              onClick={() => {
                setOpen(false);
                flushSync(() => setArmed(true));
                const button = submitter.current;
                button?.form?.requestSubmit(button);
                setArmed(false);
              }}
            >
              {confirmLabel ?? children}
            </Button>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Go back
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export { ConfirmButton };
