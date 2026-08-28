import { getSettings, getPledges } from '@/lib/budget-service';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const pin = searchParams.get('pin');
  const settings = getSettings();

  if (pin !== (settings.adminPin || 'edwin2026')) {
    return new Response('Unauthorized', { status: 401 });
  }

  const pledges = getPledges();
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

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="kwanjula-pledges-${new Date().toISOString().slice(0, 10)}.csv"`
    }
  });
}
