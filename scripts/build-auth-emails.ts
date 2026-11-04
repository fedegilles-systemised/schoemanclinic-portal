/** Builds the sign-in service's email templates into supabase/templates/. */
import { writeFileSync } from "node:fs";
import path from "node:path";

import { authTemplates } from "@/lib/email/templates/auth";

const folder = path.join(process.cwd(), "supabase", "templates");

for (const [name, template] of Object.entries(authTemplates)) {
  writeFileSync(path.join(folder, template.file), template.html());
  console.log(`${template.file.padEnd(40)} ${name}: "${template.subject}"`);
}
