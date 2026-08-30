import { getPledges } from '@/lib/budget-service';
import { requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  // Authenticated from the request header, not from a query parameter. A
  // credential in a URL lands in browser history, server access logs and any
  // proxy in between, so the client fetches this and saves the blob rather
  // than following a credential-bearing link.
  const denied = requireAdmin(req);
  if (denied) return denied;

  const pledges = await getPledges();
  const headers = ['Pledge ID', 'Date', 'Contributor Name', 'Phone', 'Email', 'Item Name', 'Section', 'Amount (UGX)', 'Payment Method', 'Status', 'Message'];

  const rows = pledges.map(p => [
    `"${p.id}"`,
    `"${p.date}"`,
    `"${(p.name || '').replace(/"/g, '""')}"`,
    `"${(p.phone || '').replace(/"/g, '""')}"`,
    `"${(p.email || '').replace(/"/g, '""')}"`,
    `"${(p.itemName || '').replace(/"/g, '""')}"`,
    `"${(p.sectionTitle || '').replace(/"/g, '""')}"`,
    p.amount,
    `"${(p.paymentMethod || '').replace(/"/g, '""')}"`,
    `"${p.status || 'pledged'}"`,
    `"${(p.message || '').replace(/"/g, '""')}"`
  ]);

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const buffer = Buffer.from(csv, 'utf8');

  return new Response(buffer, {
    headers: {
      'Content-Type': 'text/csv',
      // See app/api/admin/pdf/route.js for why this is set explicitly.
      'Content-Length': String(buffer.length),
      'Content-Disposition': `attachment; filename="kwanjula-pledges-${new Date().toISOString().slice(0, 10)}.csv"`
    }
  });
}
