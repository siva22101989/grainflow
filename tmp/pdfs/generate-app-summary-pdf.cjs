const fs = require('fs');
const path = require('path');
const { jsPDF } = require('jspdf');

const outPath = path.resolve('output/pdf/app-summary-one-page.pdf');
const doc = new jsPDF({ unit: 'pt', format: 'letter' });

const pageWidth = doc.internal.pageSize.getWidth();
const pageHeight = doc.internal.pageSize.getHeight();
const margin = 42;
const contentWidth = pageWidth - margin * 2;
let y = margin;

function heading(text) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(text, margin, y);
  y += 16;
}

function body(text, indent = 0, size = 10.5, leading = 13) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(size);
  const lines = doc.splitTextToSize(text, contentWidth - indent);
  doc.text(lines, margin + indent, y);
  y += lines.length * leading;
}

function bullet(text, size = 10.5, leading = 12.5) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(size);
  const wrapped = doc.splitTextToSize(text, contentWidth - 16);
  doc.text('•', margin + 2, y);
  doc.text(wrapped, margin + 14, y);
  y += wrapped.length * leading;
}

function gap(h = 7) { y += h; }

// Title
heading('Grain Flow App Summary');
body('Evidence source: README.md, docs/ARCHITECTURE.md, package.json, src/utils/supabase/middleware.ts, supabase/functions/*');
gap(4);

heading('What It Is');
body('Grain Flow is a multi-tenant warehouse management web app for agricultural storage operations. It digitizes stock, customer, billing, payment, and subscription workflows using a Next.js + Supabase stack.');
gap(3);

heading('Who It Is For');
bullet('Primary persona: warehouse owners/admins and operations staff managing grain storage, inflow/outflow, rent billing, and collections.');
gap(2);

heading('What It Does');
bullet('Tracks inflow, outflow, storage records, lot occupancy, and customer history.');
bullet('Calculates storage rent and tracks rent vs hamali (labor) payments.');
bullet('Provides dashboard metrics and operational reporting views.');
bullet('Supports role-based access and multi-warehouse membership/workflow.');
bullet('Offers customer/portal-style access patterns and profile-linked data views.');
bullet('Runs subscription lifecycle flows (renewal links, expiry checks, notifications).');
gap(2);

heading('How It Works (Repo-Evidenced Architecture)');
bullet('Frontend: Next.js App Router (`src/app`) with Server Components and client UI components (`src/components`).');
bullet('Auth + data: Supabase SSR clients (`src/utils/supabase/server.ts`, `client.ts`) and route middleware guard (`middleware.ts`) control access.');
bullet('Business logic: server actions and query modules in `src/lib/actions`, `src/lib`, and `src/lib/queries`.');
bullet('Database: Supabase PostgreSQL with migrations/RLS policies in `supabase/migrations` and docs in `docs/DATABASE.md`.');
bullet('Background services: Supabase Edge Functions and cron SQL (`supabase/functions/*`, `supabase/cron_setup.sql`) process subscription expiry/renewal tasks.');
bullet('Observability: Sentry Next.js configs (`sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`).');
bullet('Message broker / event bus layer: Not found in repo.');
gap(2);

heading('How To Run (Minimal)');
bullet('Prereqs: Node.js 18+ and a Supabase project.');
bullet('Install deps: run `npm install` in repo root.');
bullet('Create `.env.local` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.');
bullet('Start dev server: `npm run dev` (package script runs on port 9002).');

// Hard guard for one page: add warning if overflow would occur.
if (y > pageHeight - margin) {
  throw new Error(`Content overflowed one page at y=${y}, page limit=${pageHeight - margin}`);
}

fs.writeFileSync(outPath, Buffer.from(doc.output('arraybuffer')));
console.log(outPath);
console.log(`y_end=${y.toFixed(2)} page_limit=${(pageHeight - margin).toFixed(2)}`);
