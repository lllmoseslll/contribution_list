import { buildPledgeReportPdf } from '@/lib/pdf-report';

export const dynamic = 'force-dynamic';

/**
 * Public, unauthenticated. Built from the same anonymised data the page
 * itself reads, so a pledge marked anonymous or hide-amount stays that way
 * here too. See lib/pdf-report.js for the shared builder this and the
 * admin-only /api/admin/pdf both call.
 */
export async function GET() {
  const buffer = await buildPledgeReportPdf({ forAdmin: false });

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="kwanjula-pledge-report-${new Date().toISOString().slice(0, 10)}.pdf"`,
      'Cache-Control': 'no-store'
    }
  });
}
