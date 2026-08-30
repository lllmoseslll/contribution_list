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
      // The full PDF is already built in memory, so declaring its exact size
      // is both correct and avoids falling back to chunked transfer-encoding
      // — which this dev server intermittently mishandles for larger bodies,
      // occasionally closing the connection before the body is sent and
      // leaving the browser with a 0-byte file that won't open.
      'Content-Length': String(buffer.length),
      'Content-Disposition': `attachment; filename="kwanjula-committee-pledge-report-${new Date().toISOString().slice(0, 10)}.pdf"`,
      'Cache-Control': 'no-store'
    }
  });
}
