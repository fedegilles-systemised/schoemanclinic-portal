"use client";

import { TriangleAlert } from "lucide-react";

import { AlertBar } from "@/components/ui/alert-bar";
import { Button } from "@/components/ui/button";

export default function ErrorBoundary({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <AlertBar
      tone="danger"
      icon={TriangleAlert}
      lead="This page did not load."
      action={
        <Button variant="outline" size="sm" onClick={reset}>
          Try again
        </Button>
      }
    >
      Nothing has been changed. If it keeps happening, contact the clinic.
    </AlertBar>
  );
}
