"use client";

import { Bell, CalendarDays, Clock, Lock, Plus, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertBar } from "@/components/ui/alert-bar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardActions,
  CardDescription,
  CardDisplayTitle,
  CardEyebrow,
  CardMeta,
  CardTitle,
} from "@/components/ui/card";
import { DemoBanner } from "@/components/ui/demo-banner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkline } from "@/components/ui/sparkline";
import { StatCard } from "@/components/ui/stat-card";
import { ResultStatusPill, StatusPill } from "@/components/ui/status-pill";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Wordmark } from "@/components/ui/wordmark";

const VARIANTS = ["primary", "secondary", "outline", "outline-bronze", "ghost", "destructive", "link"] as const;
const SWATCHES = [
  "bg-primary", "bg-primary-hover", "bg-secondary", "bg-secondary-border", "bg-accent", "bg-accent-subtle",
  "bg-status-success", "bg-status-success-bg", "bg-status-warning", "bg-status-warning-bg", "bg-status-danger",
  "bg-status-danger-bg", "bg-status-info", "bg-status-info-bg", "bg-content", "bg-content-muted", "bg-surface",
  "bg-surface-raised", "bg-surface-sunken", "bg-surface-selected", "bg-surface-inverse", "bg-surface-border",
  "bg-surface-overlay",
];
const TYPES = [
  "type-hero-title", "type-page-title", "type-section-title", "type-card-display", "type-card-title", "type-body",
  "type-small", "type-table", "type-value", "type-big-number", "type-eyebrow", "type-button-label", "type-pill-label",
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12 flex flex-col gap-4">
      <SectionHeader title={title} />
      {children}
    </section>
  );
}

export function UiGallery() {
  return (
    <div>
      <DemoBanner />
      <main className="mx-auto max-w-content px-5 py-10 shell:px-10">
        <PageHeader eyebrow="Development only" title="UI " accent="gallery" description="Every component and variant, for visual checks." />
        <Wordmark />

        <Section title="Colour">
          <div className="grid grid-cols-2 gap-2 phone:grid-cols-4 shell:grid-cols-6">
            {SWATCHES.map((c) => (
              <div key={c} className="type-small">
                <div className={`${c} h-12 border border-surface-border`} />
                {c.replace("bg-", "")}
              </div>
            ))}
          </div>
        </Section>

        <Section title="Type">
          {TYPES.map((t) => (
            <p key={t} className={t}>{t.replace("type-", "")} · 43 mmol/mol</p>
          ))}
        </Section>

        <Section title="Button">
          {(["default", "sm"] as const).map((size) => (
            <div key={size} className="flex flex-wrap items-center gap-2">
              {VARIANTS.map((v) => <Button key={v} variant={v} size={size}>{v}</Button>)}
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2">
            <Button loading>Saving</Button>
            <Button disabled>Disabled</Button>
            <Button variant="secondary"><Plus aria-hidden />With icon</Button>
            <Button size="icon" aria-label="Notifications"><Bell aria-hidden /></Button>
          </div>
        </Section>

        <Section title="Forms">
          <div className="grid max-w-md gap-4">
            <div className="flex flex-col gap-1.5"><Label htmlFor="g-email">Email address</Label><Input id="g-email" placeholder="you@example.test" /></div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="g-bad">Invalid field</Label>
              <Input id="g-bad" aria-invalid defaultValue="not an email" aria-describedby="g-bad-msg" />
              <p id="g-bad-msg" className="type-small text-status-danger">Enter an email address, like you@example.test.</p>
            </div>
            <div className="flex flex-col gap-1.5"><Label htmlFor="g-text">Note</Label><Textarea id="g-text" /></div>
            <div className="flex items-center gap-2.5"><Switch id="g-switch" defaultChecked /><Label htmlFor="g-switch">Research consent</Label></div>
          </div>
        </Section>

        <Section title="Status">
          <div className="flex flex-wrap gap-2">
            <ResultStatusPill status="in_range" />
            <ResultStatusPill status="borderline" />
            <ResultStatusPill status="out_of_range" />
            <StatusPill tone="info" icon={Clock} label="Results in" />
            <StatusPill tone="dark" icon={Lock} label="Released" />
            <StatusPill tone="neutral" icon={CalendarDays} label="Follow-up" />
            <Badge>5</Badge><Badge variant="neutral">Neutral</Badge><Badge variant="outline">Outline</Badge>
          </div>
          <AlertBar tone="warning" icon={Clock} lead="Bloods due by 4 Nov 2026." action={<Button size="sm" variant="outline">Pay and get barcode</Button>}>Results need to reach us two weeks before your appointment.</AlertBar>
          <AlertBar tone="danger" icon={TriangleAlert} lead="Allergy.">Penicillin.</AlertBar>
          <AlertBar tone="info" icon={Lock} lead="Chaperone.">Visible to clinicians only</AlertBar>
          <Alert variant="danger"><TriangleAlert aria-hidden /><div><AlertTitle>Sign-in failed</AlertTitle><AlertDescription>Check your email and password.</AlertDescription></div></Alert>
        </Section>

        <Section title="Cards">
          <div className="grid gap-6 shell:grid-cols-3">
            <Card>
              <CardEyebrow>Next appointment</CardEyebrow>
              <CardTitle>Follow-up consultation</CardTitle>
              <CardMeta><span><CalendarDays aria-hidden />18 Nov 2026, 10:30</span></CardMeta>
              <CardDescription>With Dr Gina Schoeman · 30 minutes</CardDescription>
              <CardActions><Button size="sm" variant="outline">View details</Button></CardActions>
            </Card>
            <Card><CardEyebrow>Order</CardEyebrow><CardDisplayTitle>Female Hormone &amp; Metabolic Panel</CardDisplayTitle></Card>
            <StatCard label="Results to review" value={5} urgent context="4 with out-of-range values"><Sparkline values={[46, 44, 43]} tone="danger" /></StatCard>
          </div>
          <EmptyState>New results will appear here.</EmptyState>
          <div className="flex flex-col gap-2"><Skeleton className="h-6 w-1/2" /><Skeleton className="h-24" /></div>
        </Section>

        <Section title="Table">
          <Table>
            <TableHeader><TableRow><TableHead>Marker</TableHead><TableHead className="text-right">Latest</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              <TableRow><TableCell>HbA1c</TableCell><TableCell className="type-value text-right text-status-danger">43 mmol/mol</TableCell><TableCell><ResultStatusPill status="out_of_range" /></TableCell></TableRow>
              <TableRow><TableCell>Ferritin</TableCell><TableCell className="type-value text-right">42 µg/L</TableCell><TableCell><ResultStatusPill status="in_range" /></TableCell></TableRow>
            </TableBody>
          </Table>
        </Section>

        <Section title="Navigation and overlays">
          <Tabs defaultValue="a">
            <TabsList><TabsTrigger value="a">Overview</TabsTrigger><TabsTrigger value="b">Results (3)</TabsTrigger></TabsList>
            <TabsContent value="a">Overview panel</TabsContent>
            <TabsContent value="b">Results panel</TabsContent>
          </Tabs>
          <div className="flex flex-wrap items-center gap-2">
            <Dialog>
              <DialogTrigger asChild><Button variant="outline">Open dialog</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Cancel <em className="text-secondary italic">appointment</em></DialogTitle><DialogDescription>Cancellations within 48 hours may be charged in full.</DialogDescription></DialogHeader>
                <DialogFooter><Button variant="destructive">Cancel appointment</Button></DialogFooter>
              </DialogContent>
            </Dialog>
            <Sheet>
              <SheetTrigger asChild><Button variant="outline">Open sheet</Button></SheetTrigger>
              <SheetContent><SheetHeader><SheetTitle>HbA1c</SheetTitle><SheetDescription>Your average blood sugar over the last two to three months.</SheetDescription></SheetHeader></SheetContent>
            </Sheet>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="outline">Open menu</Button></DropdownMenuTrigger>
              <DropdownMenuContent><DropdownMenuLabel>Account</DropdownMenuLabel><DropdownMenuItem>Profile</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem>Sign out</DropdownMenuItem></DropdownMenuContent>
            </DropdownMenu>
            <Tooltip><TooltipTrigger asChild><Button variant="ghost">Hover me</Button></TooltipTrigger><TooltipContent>Coming soon</TooltipContent></Tooltip>
            <Button variant="outline" onClick={() => toast.success("Released to Amira Haddad.")}>Show toast</Button>
            <Avatar><AvatarFallback>GS</AvatarFallback></Avatar>
          </div>
          <Separator />
        </Section>
      </main>
    </div>
  );
}
