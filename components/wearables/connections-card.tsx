import Link from "next/link";
import { CircleCheck, Clock, TriangleAlert } from "lucide-react";

import { ConsentChoice } from "@/components/consents/consent-form";
import { DisconnectButton } from "@/components/wearables/connection-forms";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { CONSENTS } from "@/lib/consents/constants";
import type { WearableConnection } from "@/lib/data/education";
import { formatDate, formatTime } from "@/lib/format";

const PROVIDERS = [
  { id: "oura", label: "Oura" },
  { id: "whoop", label: "WHOOP" },
] as const;

const ERRORS: Record<string, string> = {
  consent: "Agree to connecting your wearables first.",
  "not-set-up": "That wearable is not set up yet. Please ask the clinic.",
  "not-allowed": "Only you, or a guardian who can act for you, can connect a wearable.",
  cancelled: "The connection was cancelled. Nothing was changed.",
  expired: "That took too long, or came from another browser. Please try again.",
  failed: "We could not connect that wearable. Please try again.",
};

/** Linking Oura or WHOOP: consent first, then a button for each, and the state of those already linked. */
export function ConnectionsCard({
  patientId,
  canAct,
  consented,
  connections,
  configured,
  connectedNow,
  error,
}: {
  patientId: string;
  canAct: boolean;
  consented: boolean;
  connections: WearableConnection[];
  configured: Record<"oura" | "whoop", boolean>;
  connectedNow?: string;
  error?: string;
}) {
  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>Connect a wearable</CardTitle>
        <CardDescription>Link your Oura or WHOOP account and your daily figures arrive on their own, once a day.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {error && ERRORS[error] ? (
          <Alert variant="danger">
            <TriangleAlert aria-hidden />
            <AlertDescription>{ERRORS[error]}</AlertDescription>
          </Alert>
        ) : null}
        {connectedNow === "oura" || connectedNow === "whoop" ? (
          <Alert variant="success">
            <CircleCheck aria-hidden />
            <AlertDescription>Connected. Your latest figures are on this page.</AlertDescription>
          </Alert>
        ) : null}

        {!consented ? (
          <div className="flex flex-col gap-3">
            <p className="type-body">{CONSENTS.wearables.description}</p>
            {canAct ? <ConsentChoice patientId={patientId} type="wearables" granted={false} /> : <p className="type-small text-content-muted">Only you, or a guardian who can act for you, can agree to this.</p>}
          </div>
        ) : (
          <ul className="flex flex-col gap-4">
            {PROVIDERS.map((p) => {
              const linked = connections.find((c) => c.provider === p.id);
              return (
                <li key={p.id} className="flex flex-col gap-2 border border-surface-border p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="type-body">{p.label}</span>
                    {linked ? (
                      linked.needsReconnect ? (
                        <StatusPill tone="warning" icon={TriangleAlert} label="Connect again" />
                      ) : (
                        <StatusPill tone="success" icon={CircleCheck} label="Connected" />
                      )
                    ) : (
                      <StatusPill tone="neutral" icon={Clock} label="Not connected" />
                    )}
                  </div>
                  {linked ? (
                    <p className="type-small text-content-muted">
                      {linked.lastSyncedAt ? `Last read ${formatDate(linked.lastSyncedAt)} at ${formatTime(linked.lastSyncedAt)}.` : "Not read yet. The first read happens today."}
                    </p>
                  ) : null}
                  {canAct ? (
                    <div className="flex flex-wrap items-start gap-3">
                      {!linked || linked.needsReconnect ? (
                        configured[p.id] ? (
                          <Button asChild size="sm">
                            <Link href={`/api/wearables/${p.id}/connect`} prefetch={false}>
                              {linked ? `Connect ${p.label} again` : `Connect ${p.label}`}
                            </Link>
                          </Button>
                        ) : (
                          <p className="type-small text-content-muted">Not available yet.</p>
                        )
                      ) : null}
                      {linked ? <DisconnectButton patientId={patientId} provider={p.id} label={p.label} /> : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        {consented && canAct ? (
          <div className="flex flex-col gap-2 border-t border-surface-border pt-4">
            <p className="type-small text-content-muted">Changed your mind? Withdrawing your consent disconnects every wearable.</p>
            <ConsentChoice patientId={patientId} type="wearables" granted />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
