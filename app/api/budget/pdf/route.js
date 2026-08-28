import PDFDocument from 'pdfkit';
import { calculateBudgetState } from '@/lib/budget-service';

export const dynamic = 'force-dynamic';

const PAGE_MARGIN = 50;
const PAGE_WIDTH = 612; // US Letter
const PAGE_HEIGHT = 792;
const CONTENT_BOTTOM = PAGE_HEIGHT - PAGE_MARGIN;

const BRAND_DARK = '#022c22';
const BRAND = '#047857';
const ACCENT = '#b45309';
const NEUTRAL = '#334155';
const NEUTRAL_LIGHT = '#64748b';
const BORDER = '#e2e8f0';

function formatUGX(num) {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: 'UGX',
    maximumFractionDigits: 0
  }).format(num || 0);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

/**
 * Builds the pledge/contribution report from the live budget state — the
 * same calculateBudgetState() the public page and /api/budget read — so this
 * PDF can never drift from what the page shows. Generated fresh on every
 * request; there is no cached or previously-signed document behind it.
 */
export async function GET() {
  const state = calculateBudgetState();
  const { stats, sections, recentGeneralPledges } = state;

  const doc = new PDFDocument({ size: 'LETTER', margin: PAGE_MARGIN, bufferPages: true });
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));

  const done = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  let y = PAGE_MARGIN;

  function ensureSpace(height) {
    if (y + height > CONTENT_BOTTOM) {
      doc.addPage();
      y = PAGE_MARGIN;
    }
  }

  function heading(text, size = 16, color = BRAND_DARK, gap = 8) {
    ensureSpace(size + gap);
    doc.font('Helvetica-Bold').fontSize(size).fillColor(color).text(text, PAGE_MARGIN, y, { width: PAGE_WIDTH - PAGE_MARGIN * 2 });
    y = doc.y + gap;
  }

  function paragraph(text, size = 9, color = NEUTRAL_LIGHT, gap = 10) {
    ensureSpace(size + gap);
    doc.font('Helvetica').fontSize(size).fillColor(color).text(text, PAGE_MARGIN, y, { width: PAGE_WIDTH - PAGE_MARGIN * 2 });
    y = doc.y + gap;
  }

  function rule(gapBefore = 6, gapAfter = 10) {
    y += gapBefore;
    ensureSpace(1 + gapAfter);
    doc.moveTo(PAGE_MARGIN, y).lineTo(PAGE_WIDTH - PAGE_MARGIN, y).strokeColor(BORDER).lineWidth(1).stroke();
    y += gapAfter;
  }

  // ---------------------------------------------------------------- Header
  doc.font('Helvetica-Bold').fontSize(20).fillColor(BRAND_DARK)
    .text('Kwanjula Contribution & Pledge Report', PAGE_MARGIN, y, { width: PAGE_WIDTH - PAGE_MARGIN * 2 });
  y = doc.y + 4;

  doc.font('Helvetica').fontSize(11).fillColor(NEUTRAL)
    .text('Mr. Edwin Laston & Jamirah Nakayemba - Introduction Ceremony, Friday 27th November 2026', PAGE_MARGIN, y);
  y = doc.y + 4;

  const generatedAt = new Date().toLocaleString('en-GB', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Africa/Kampala'
  });
  doc.font('Helvetica-Oblique').fontSize(8.5).fillColor(NEUTRAL_LIGHT)
    .text(`Generated live from current pledge records on ${generatedAt} (Africa/Kampala). Every download reflects pledges recorded up to the moment it was made.`, PAGE_MARGIN, y, { width: PAGE_WIDTH - PAGE_MARGIN * 2 });
  y = doc.y + 14;

  rule(0, 14);

  // ------------------------------------------------------------- Summary
  heading('Funding Summary', 13, BRAND_DARK, 6);

  const summaryRows = [
    ['Total Ceremony Budget', formatUGX(stats.totalBudget)],
    ['Total Raised & Pledged', formatUGX(stats.totalCoveredAndPledged)],
    ['Remaining Balance', formatUGX(stats.totalRemaining)],
    ['Overall Funded', `${stats.totalPercentage}%`],
    ['Contributors', `${stats.pledgersCount}`],
    ['Pledges Recorded', `${stats.totalPledgesCount}`]
  ];
  const colWidth = (PAGE_WIDTH - PAGE_MARGIN * 2) / 3;
  summaryRows.forEach(([label, value], i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = PAGE_MARGIN + col * colWidth;
    const rowY = y + row * 34;
    doc.font('Helvetica').fontSize(8).fillColor(NEUTRAL_LIGHT).text(label.toUpperCase(), x, rowY, { width: colWidth - 10 });
    doc.font('Helvetica-Bold').fontSize(12).fillColor(BRAND_DARK).text(value, x, rowY + 11, { width: colWidth - 10 });
  });
  y += Math.ceil(summaryRows.length / 3) * 34 + 10;

  rule(0, 14);

  // --------------------------------------------------------- Item sections
  heading('Budget Sections & Items', 13, BRAND_DARK, 10);

  sections.forEach((sec) => {
    ensureSpace(30);
    doc.font('Helvetica-Bold').fontSize(11).fillColor(BRAND_DARK)
      .text(`Section ${sec.code}: ${sec.title}`, PAGE_MARGIN, y, { width: PAGE_WIDTH - PAGE_MARGIN * 2 });
    y = doc.y + 2;
    doc.font('Helvetica').fontSize(8).fillColor(NEUTRAL_LIGHT)
      .text(`Target ${formatUGX(sec.totalCost)}  |  Remaining ${formatUGX(sec.remainingAmount)}  |  ${sec.percentage}% funded`, PAGE_MARGIN, y);
    y = doc.y + 6;

    // Column header
    ensureSpace(16);
    const cols = { name: PAGE_MARGIN, qty: 260, target: 320, remaining: 400, status: 480 };
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(NEUTRAL_LIGHT);
    doc.text('ITEM', cols.name, y, { width: cols.qty - cols.name - 6 });
    doc.text('QTY', cols.qty, y, { width: cols.target - cols.qty - 6 });
    doc.text('TARGET', cols.target, y, { width: cols.remaining - cols.target - 6 });
    doc.text('REMAINING', cols.remaining, y, { width: cols.status - cols.remaining - 6 });
    doc.text('STATUS', cols.status, y, { width: PAGE_WIDTH - PAGE_MARGIN - cols.status });
    y += 11;
    doc.moveTo(PAGE_MARGIN, y).lineTo(PAGE_WIDTH - PAGE_MARGIN, y).strokeColor(BORDER).lineWidth(0.5).stroke();
    y += 4;

    sec.items.forEach((item) => {
      ensureSpace(14);
      const statusLabel = item.isFullyFunded
        ? (item.remarks === 'Covered' ? 'Covered' : '100% Funded')
        : item.pledgedAmount > 0
        ? `${item.percentage}% Supported`
        : 'Needs Support';
      const statusColor = item.isFullyFunded ? BRAND : item.pledgedAmount > 0 ? ACCENT : NEUTRAL_LIGHT;

      doc.font('Helvetica').fontSize(8.5).fillColor(NEUTRAL);
      doc.text(item.name, cols.name, y, { width: cols.qty - cols.name - 6 });
      doc.text(String(item.qty || 1), cols.qty, y, { width: cols.target - cols.qty - 6 });
      doc.text(formatUGX(item.totalCost), cols.target, y, { width: cols.remaining - cols.target - 6 });
      doc.fillColor(item.isFullyFunded ? BRAND : ACCENT).text(formatUGX(item.remainingAmount), cols.remaining, y, { width: cols.status - cols.remaining - 6 });
      doc.fillColor(statusColor).font('Helvetica-Bold').text(statusLabel, cols.status, y, { width: PAGE_WIDTH - PAGE_MARGIN - cols.status });
      y += 13;
    });

    y += 10;
  });

  // ------------------------------------------------------------ Roll of honour
  doc.addPage();
  y = PAGE_MARGIN;
  heading('Contributor Roll of Honour & Blessings', 15, BRAND_DARK, 4);
  paragraph('Thank you to everyone standing with Mr. Edwin Laston & Jamirah Nakayemba.', 9, NEUTRAL_LIGHT, 12);

  const allPledges = [
    ...sections.flatMap((sec) => sec.items.flatMap((item) =>
      (item.recentPledges || []).map((p) => ({ ...p, itemName: item.name })))),
    ...recentGeneralPledges
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  if (allPledges.length === 0) {
    paragraph('No pledges have been recorded yet.', 9, NEUTRAL_LIGHT);
  } else {
    const nameCol = PAGE_MARGIN;
    const itemCol = 230;
    const amountCol = 400;
    const dateCol = 480;

    ensureSpace(16);
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(NEUTRAL_LIGHT);
    doc.text('CONTRIBUTOR', nameCol, y, { width: itemCol - nameCol - 6 });
    doc.text('PLEDGED FOR', itemCol, y, { width: amountCol - itemCol - 6 });
    doc.text('AMOUNT', amountCol, y, { width: dateCol - amountCol - 6 });
    doc.text('DATE', dateCol, y, { width: PAGE_WIDTH - PAGE_MARGIN - dateCol });
    y += 11;
    doc.moveTo(PAGE_MARGIN, y).lineTo(PAGE_WIDTH - PAGE_MARGIN, y).strokeColor(BORDER).lineWidth(0.5).stroke();
    y += 4;

    allPledges.forEach((p) => {
      ensureSpace(14);
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(NEUTRAL).text(p.name, nameCol, y, { width: itemCol - nameCol - 6 });
      doc.font('Helvetica').text(p.itemName, itemCol, y, { width: amountCol - itemCol - 6 });
      doc.fillColor(BRAND).text(p.amount ? formatUGX(p.amount) : 'Generous', amountCol, y, { width: dateCol - amountCol - 6 });
      doc.fillColor(NEUTRAL_LIGHT).text(formatDate(p.date), dateCol, y, { width: PAGE_WIDTH - PAGE_MARGIN - dateCol });
      y += 13;
    });
  }

  // ------------------------------------------------------------ Page numbers
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    doc.font('Helvetica').fontSize(8).fillColor(NEUTRAL_LIGHT)
      .text(`Page ${i + 1} of ${range.count}`, PAGE_MARGIN, PAGE_HEIGHT - 30, {
        width: PAGE_WIDTH - PAGE_MARGIN * 2,
        align: 'center'
      });
  }

  doc.end();
  const buffer = await done;

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="kwanjula-pledge-report-${new Date().toISOString().slice(0, 10)}.pdf"`,
      'Cache-Control': 'no-store'
    }
  });
}
