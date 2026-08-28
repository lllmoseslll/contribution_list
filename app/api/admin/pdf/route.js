import { requireAdmin } from '@/lib/admin-auth';
import { buildPledgeReportPdf } from '@/lib/pdf-report';

export const dynamic = 'force-dynamic';

/**
 * Admin-only. Same report as the public /api/budget/pdf, but the final page
 * lists every pledge's real name, phone and amount straight from
 * getPledges() — no anonymisation, unlike the public copy. That is exactly
 * why this route is guarded: it exists so the committee can follow up with a
 * contributor by phone, which the public page and public PDF must never make
 * possible for a pledge marked anonymous or hide-amount.
 */
export async function GET(req) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const buffer = await buildPledgeReportPdf({ forAdmin: true });

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="kwanjula-committee-pledge-report-${new Date().toISOString().slice(0, 10)}.pdf"`,
      'Cache-Control': 'no-store'
    }
  });
}
