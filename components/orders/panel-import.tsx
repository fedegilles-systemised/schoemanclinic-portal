"use client";

import { CircleAlert } from "lucide-react";
import { useActionState, useState, useTransition } from "react";

import { FormMessage } from "@/components/profile/form-message";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney } from "@/lib/format";
import { importPanels, type PanelImportState } from "@/lib/orders/actions";
import { SEX_LABELS } from "@/lib/orders/constants";

const initial: PanelImportState = {};

/**
 * Paste the clinic's panel list from a spreadsheet, or choose a CSV file. It is checked first, shown
 * as a table, and only written when the admin confirms. The server checks the text again.
 */
export function PanelImportForm({ labs }: { labs: { id: string; name: string }[] }) {
  const [text, setText] = useState("");
  const [fileNote, setFileNote] = useState<string | null>(null);
  const [checkedText, setCheckedText] = useState<string | null>(null);
  const [labId, setLabId] = useState(labs.length === 1 ? (labs[0]?.id ?? "") : "");
  const [orderable, setOrderable] = useState(true);
  const [state, dispatch, pending] = useActionState(async (previous: PanelImportState, formData: FormData) => {
    setCheckedText(typeof formData.get("data") === "string" ? (formData.get("data") as string) : null);
    return importPanels(previous, formData);
  }, initial);
  const [, startTransition] = useTransition();

  // The values are sent from state, not from the form: React clears a form after an action, and the
  // lab and the list must survive "Check the list" so that "Import" sends the same thing.
  function submit(mode: "preview" | "import") {
    const formData = new FormData();
    formData.set("mode", mode);
    formData.set("data", text);
    formData.set("labPartnerId", labId);
    if (orderable) formData.set("orderable", "on");
    startTransition(() => dispatch(formData));
  }

  const preview = state.preview;
  const ready = Boolean(preview && preview.errors.length === 0 && preview.rows.length > 0 && checkedText === text);

  return (
    <form onSubmit={(event) => event.preventDefault()} className="flex flex-col gap-4">
      <p className="type-body">
        Paste the list from your spreadsheet, or choose a CSV file. The first row names the columns: <strong>code, name, price</strong> are needed; <strong>fasting, tubes, preparation, sex, orderable, lab</strong> are optional. A code already in the catalogue is updated; nothing is deleted.
      </p>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="import-file">CSV file (optional)</Label>
        <Input
          id="import-file"
          type="file"
          accept=".csv,.tsv,.txt,text/csv,text/plain"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            if (file.size > 200_000) {
              setFileNote("That file is too large (over 200 KB). Split the list into smaller files.");
              return;
            }
            setFileNote(null);
            setText(await file.text());
          }}
        />
        {fileNote ? (
          <Alert variant="danger">
            <CircleAlert aria-hidden />
            <AlertDescription>{fileNote}</AlertDescription>
          </Alert>
        ) : null}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="import-data">The list</Label>
        <Textarea
          id="import-data"
          name="data"
          rows={8}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={"code\tname\tprice\tfasting\ttubes\tsex\nGS5\tFemale Hormone and Metabolic\t295\tyes\t1 purple, 2 gold, 1 grey\tfemale"}
          className="font-mono"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="import-lab">Lab for new panels</Label>
          <Select id="import-lab" name="labPartnerId" value={labId} onChange={(event) => setLabId(event.target.value)} aria-describedby="import-lab-hint">
            <option value="">Choose the lab</option>
            {labs.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
          <p id="import-lab-hint" className="type-small text-content-muted">
            Needed for new panels. A panel already in the catalogue keeps its own lab.
          </p>
        </div>
        <label className="type-body flex items-center gap-2 self-end">
          <input type="checkbox" name="orderable" checked={orderable} onChange={(event) => setOrderable(event.target.checked)} className="size-4 accent-secondary" />
          New panels can be ordered straight away
        </label>
      </div>

      {preview && preview.errors.length === 0 && preview.rows.length > 0 && checkedText !== text ? (
        <Alert variant="info">
          <AlertDescription>The list has changed since it was checked. Check it again before you import.</AlertDescription>
        </Alert>
      ) : null}

      {preview && preview.errors.length > 0 ? (
        <Alert variant="danger">
          <CircleAlert aria-hidden />
          <AlertDescription>
            <ul className="flex list-disc flex-col gap-1 pl-5">
              {preview.errors.map((message, index) => (
                <li key={`${index}-${message}`}>{message}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      {preview && preview.errors.length === 0 && preview.rows.length > 0 && checkedText === text ? (
        <div className="flex flex-col gap-2">
          <p className="type-body">
            {preview.rows.filter((r) => r.change === "new").length} to add, {preview.rows.filter((r) => r.change === "update").length} to update. Check the prices before you import.
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Fasting</TableHead>
                <TableHead>For</TableHead>
                <TableHead>Tubes</TableHead>
                <TableHead>Orderable</TableHead>
                <TableHead>Change</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {preview.rows.map((r) => (
                <TableRow key={r.code}>
                  <TableCell>{r.code}</TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell className="tabular-nums">
                    {formatMoney(r.pricePence)}
                    {r.previousPricePence !== null && r.previousPricePence !== r.pricePence ? (
                      <span className="type-small text-content-muted"> was {formatMoney(r.previousPricePence)}</span>
                    ) : null}
                  </TableCell>
                  <TableCell>{r.fasting ? "Yes" : "No"}</TableCell>
                  <TableCell>{r.sexRestriction ? SEX_LABELS[r.sexRestriction] : "Any patient"}</TableCell>
                  <TableCell>{r.tubes ?? ""}</TableCell>
                  <TableCell>{r.orderable ? "Yes" : "No"}</TableCell>
                  <TableCell>
                    {r.change === "new" ? `New${r.labName ? ` (${r.labName})` : ""}` : "Update"}
                    {r.warning ? <span className="type-small block text-content-muted">{r.warning}</span> : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      <FormMessage state={state} />
      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="outline" loading={pending} onClick={() => submit("preview")}>
          Check the list
        </Button>
        {ready ? (
          <Button type="button" loading={pending} onClick={() => submit("import")}>
            Import {preview?.rows.length} {preview?.rows.length === 1 ? "panel" : "panels"}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
