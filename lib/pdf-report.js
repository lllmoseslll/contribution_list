import 'server-only';

import PDFDocument from 'pdfkit';
import { calculateBudgetState, getPledges } from '@/lib/budget-service';

const PAGE_MARGIN = 50;
const PAGE_WIDTH = 612; // US Letter
const PAGE_HEIGHT = 792;
const CONTENT_BOTTOM = PAGE_HEIGHT - PAGE_MARGIN;

const BRAND_DARK = '#022c22';
const BRAND = '#047857';
const ACCENT = '#15803d'; // accent-700 — a second, warmer green (Tailwind "green", not "emerald")
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
 * Builds the pledge/contribution report PDF and resolves to a Buffer.
 *
 * The budget summary and per-item breakdown (target/pledged/remaining/status)
 * come from calculateBudgetState() either way — that data was never private,
 * it's what /api/budget already serves to anyone.
 *
 * What differs between the two callers is the contributor listing on the
 * final page:
 *
 *   forAdmin: false (public, unauthenticated — app/api/budget/pdf)
 *     Reads the same anonymised recentPledges / recentGeneralPledges the
 *     public page itself reads, so a pledge marked anonymous or hide-amount
 *     stays that way here too.
 *
 *   forAdmin: true (app/api/admin/pdf, behind requireAdmin())
 *     Reads getPledges() directly — the raw, unredacted records — the same
 *     source the admin pledges table and the CSV export already use. Real
 *     name regardless of isAnonymous, real amount regardless of hideAmount,
 *     plus phone and payment status for follow-up. This is why that route
 *     must stay authenticated: this function does no redaction at all when
 *     forAdmin is true, by design.
 */
export async function buildPledgeReportPdf({ forAdmin = false } = {}) {
  const state = await calculateBudgetState();
  const { stats, sections } = state;

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

  /**
   * A single-line, column-safe text cell. Table cells below all share a fixed
   * row height, but plain doc.text() wraps onto a second line for anything
   * longer than its column width instead of clipping — a long item or
   * contributor name would then overlap the row underneath, reading as if it
   * had bled into a neighbouring column. Constraining height to one line and
   * enabling PDFKit's ellipsis option truncates the line ("…") instead of
   * wrapping it, so every cell stays inside its own column and row no matter
   * how long the underlying name or label is.
   */
  function fitText(text, x, y, width, options = {}) {
    doc.text(String(text ?? ''), x, y, {
      ...options,
      width,
      height: doc.currentLineHeight() + 1,
      ellipsis: true
    });
  }

  // ---------------------------------------------------------------- Header
  doc.font('Helvetica-Bold').fontSize(20).fillColor(BRAND_DARK)
    .text(
      forAdmin ? 'Kwanjula Pledge Report - Committee Copy' : 'Kwanjula Contribution & Pledge Report',
      PAGE_MARGIN, y, { width: PAGE_WIDTH - PAGE_MARGIN * 2 }
    );
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
  y = doc.y + (forAdmin ? 6 : 14);

  if (forAdmin) {
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(ACCENT)
      .text('Committee copy - contains contributor names, phone numbers and pledge amounts that are kept private on the public page and public PDF. Do not share this file outside the committee.', PAGE_MARGIN, y, { width: PAGE_WIDTH - PAGE_MARGIN * 2 });
    y = doc.y + 14;
  }

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
    doc.font('Helvetica').fontSize(8).fillColor(NEUTRAL_LIGHT);
    fitText(label.toUpperCase(), x, rowY, colWidth - 10);
    doc.font('Helvetica-Bold').fontSize(12).fillColor(BRAND_DARK);
    fitText(value, x, rowY + 11, colWidth - 10);
  });
  y += Math.ceil(summaryRows.length / 3) * 34 + 10;

  rule(0, 14);

  // ------------------------------------------------------- Remaining Balance
  heading('Remaining Balance', 13, BRAND_DARK, 8);

  const boxW = PAGE_WIDTH - PAGE_MARGIN * 2;
  const boxH = 62;
  ensureSpace(boxH + 10);
  const boxX = PAGE_MARGIN;
  const boxY = y;
  const halfW = boxW / 2;

  doc.lineWidth(1).rect(boxX, boxY, boxW, boxH).fillAndStroke('#f0fdf4', '#bbf7d0');

  doc.font('Helvetica-Bold').fontSize(8).fillColor(ACCENT);
  fitText('STILL NEEDED', boxX + 16, boxY + 10, halfW - 32);
  doc.font('Helvetica-Bold').fontSize(22).fillColor(BRAND_DARK);
  fitText(formatUGX(stats.totalRemaining), boxX + 16, boxY + 22, halfW - 16);

  doc.font('Helvetica-Bold').fontSize(8).fillColor(BRAND);
  fitText('RAISED SO FAR', boxX + halfW, boxY + 10, halfW - 16, { align: 'right' });
  doc.font('Helvetica-Bold').fontSize(22).fillColor(BRAND);
  fitText(`${stats.totalPercentage}%`, boxX + halfW, boxY + 22, halfW - 16, { align: 'right' });

  const barX = boxX + 16;
  const barY = boxY + boxH - 14;
  const barW = boxW - 32;
  doc.roundedRect(barX, barY, barW, 5, 2.5).fillColor('#e2e8f0').fill();
  const filledW = Math.max(6, Math.min(barW, barW * (stats.totalPercentage / 100)));
  doc.roundedRect(barX, barY, filledW, 5, 2.5).fillColor(BRAND).fill();

  y = boxY + boxH + 10;

  paragraph(
    `Of the total ${formatUGX(stats.totalBudget)} ceremony budget, ${formatUGX(stats.totalCoveredAndPledged)} has been raised and pledged so far. The figure above is what still needs to be covered.`,
    8.5, NEUTRAL_LIGHT, 10
  );

  // Per-section remaining breakdown
  ensureSpace(16);
  const secCols = { name: PAGE_MARGIN, target: 300, remaining: 400, pct: 500 };
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(NEUTRAL_LIGHT);
  fitText('SECTION', secCols.name, y, secCols.target - secCols.name - 6);
  fitText('TARGET', secCols.target, y, secCols.remaining - secCols.target - 6);
  fitText('REMAINING', secCols.remaining, y, secCols.pct - secCols.remaining - 6);
  fitText('% FUNDED', secCols.pct, y, PAGE_WIDTH - PAGE_MARGIN - secCols.pct);
  y += 11;
  doc.moveTo(PAGE_MARGIN, y).lineTo(PAGE_WIDTH - PAGE_MARGIN, y).strokeColor(BORDER).lineWidth(0.5).stroke();
  y += 4;

  sections.forEach((sec) => {
    ensureSpace(14);
    doc.font('Helvetica').fontSize(8.5).fillColor(NEUTRAL);
    fitText(`${sec.code}: ${sec.title}`, secCols.name, y, secCols.target - secCols.name - 6);
    doc.fillColor(NEUTRAL);
    fitText(formatUGX(sec.totalCost), secCols.target, y, secCols.remaining - secCols.target - 6);
    doc.fillColor(sec.remainingAmount > 0 ? ACCENT : BRAND);
    fitText(formatUGX(sec.remainingAmount), secCols.remaining, y, secCols.pct - secCols.remaining - 6);
    doc.fillColor(NEUTRAL_LIGHT);
    fitText(`${sec.percentage}%`, secCols.pct, y, PAGE_WIDTH - PAGE_MARGIN - secCols.pct);
    y += 13;
  });

  y += 10;
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
    const cols = { name: PAGE_MARGIN, qty: 225, pledged: 280, target: 348, remaining: 416, status: 484 };
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(NEUTRAL_LIGHT);
    fitText('ITEM', cols.name, y, cols.qty - cols.name - 6);
    fitText('QTY', cols.qty, y, cols.pledged - cols.qty - 6);
    fitText('PLEDGED', cols.pledged, y, cols.target - cols.pledged - 6);
    fitText('TARGET', cols.target, y, cols.remaining - cols.target - 6);
    fitText('REMAINING', cols.remaining, y, cols.status - cols.remaining - 6);
    fitText('STATUS', cols.status, y, PAGE_WIDTH - PAGE_MARGIN - cols.status);
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
      fitText(item.name, cols.name, y, cols.qty - cols.name - 6);
      fitText(String(item.qty || 1), cols.qty, y, cols.pledged - cols.qty - 6);
      doc.fillColor(item.pledgedAmount > 0 ? BRAND : NEUTRAL_LIGHT);
      fitText(formatUGX(item.pledgedAmount), cols.pledged, y, cols.target - cols.pledged - 6);
      doc.fillColor(NEUTRAL);
      fitText(formatUGX(item.totalCost), cols.target, y, cols.remaining - cols.target - 6);
      doc.fillColor(item.isFullyFunded ? BRAND : ACCENT);
      fitText(formatUGX(item.remainingAmount), cols.remaining, y, cols.status - cols.remaining - 6);
      doc.fillColor(statusColor).font('Helvetica-Bold');
      fitText(statusLabel, cols.status, y, PAGE_WIDTH - PAGE_MARGIN - cols.status);
      y += 13;
    });

    y += 10;
  });

  // ------------------------------------------------------------ Contributors
  doc.addPage();
  y = PAGE_MARGIN;

  if (forAdmin) {
    heading('Committee Contributor Ledger', 15, BRAND_DARK, 4);
    paragraph('Every pledge on record, including anonymous and hidden-amount pledges. For committee follow-up only.', 9, NEUTRAL_LIGHT, 12);

    const rawPledges = (await getPledges())
      .filter((p) => p.status !== 'cancelled')
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    if (rawPledges.length === 0) {
      paragraph('No pledges have been recorded yet.', 9, NEUTRAL_LIGHT);
    } else {
      const cols = { name: PAGE_MARGIN, phone: 185, item: 255, amount: 362, status: 437, date: 487 };

      ensureSpace(16);
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(NEUTRAL_LIGHT);
      fitText('CONTRIBUTOR', cols.name, y, cols.phone - cols.name - 6);
      fitText('PHONE', cols.phone, y, cols.item - cols.phone - 6);
      fitText('PLEDGED FOR', cols.item, y, cols.amount - cols.item - 6);
      fitText('AMOUNT', cols.amount, y, cols.status - cols.amount - 6);
      fitText('STATUS', cols.status, y, cols.date - cols.status - 6);
      fitText('DATE', cols.date, y, PAGE_WIDTH - PAGE_MARGIN - cols.date);
      y += 11;
      doc.moveTo(PAGE_MARGIN, y).lineTo(PAGE_WIDTH - PAGE_MARGIN, y).strokeColor(BORDER).lineWidth(0.5).stroke();
      y += 4;

      rawPledges.forEach((p) => {
        ensureSpace(14);
        const isPaid = p.status === 'paid';
        doc.font('Helvetica-Bold').fontSize(8).fillColor(NEUTRAL);
        fitText(p.name || '(no name)', cols.name, y, cols.phone - cols.name - 6);
        doc.font('Helvetica').fillColor(NEUTRAL_LIGHT);
        fitText(p.phone || '-', cols.phone, y, cols.item - cols.phone - 6);
        doc.fillColor(NEUTRAL);
        fitText(p.itemName || 'General Contribution', cols.item, y, cols.amount - cols.item - 6);
        doc.fillColor(BRAND);
        fitText(formatUGX(p.amount), cols.amount, y, cols.status - cols.amount - 6);
        doc.fillColor(isPaid ? BRAND : ACCENT).font('Helvetica-Bold');
        fitText(isPaid ? 'Paid' : 'Pledged', cols.status, y, cols.date - cols.status - 6);
        doc.font('Helvetica').fillColor(NEUTRAL_LIGHT);
        fitText(formatDate(p.date), cols.date, y, PAGE_WIDTH - PAGE_MARGIN - cols.date);
        y += 13;
      });
    }
  } else {
    heading('Contributor Roll of Honour & Blessings', 15, BRAND_DARK, 4);
    paragraph('Thank you to everyone standing with Mr. Edwin Laston & Jamirah Nakayemba.', 9, NEUTRAL_LIGHT, 12);

    const allPledges = [
      ...sections.flatMap((sec) => sec.items.flatMap((item) =>
        (item.recentPledges || []).map((p) => ({ ...p, itemName: item.name })))),
      ...state.recentGeneralPledges
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    if (allPledges.length === 0) {
      paragraph('No pledges have been recorded yet.', 9, NEUTRAL_LIGHT);
    } else {
      const nameCol = PAGE_MARGIN;
      const itemCol = 220;
      const amountCol = 390;
      const dateCol = 470;

      ensureSpace(16);
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(NEUTRAL_LIGHT);
      fitText('CONTRIBUTOR', nameCol, y, itemCol - nameCol - 6);
      fitText('PLEDGED FOR', itemCol, y, amountCol - itemCol - 6);
      fitText('AMOUNT', amountCol, y, dateCol - amountCol - 6);
      fitText('DATE', dateCol, y, PAGE_WIDTH - PAGE_MARGIN - dateCol);
      y += 11;
      doc.moveTo(PAGE_MARGIN, y).lineTo(PAGE_WIDTH - PAGE_MARGIN, y).strokeColor(BORDER).lineWidth(0.5).stroke();
      y += 4;

      allPledges.forEach((p) => {
        ensureSpace(14);
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(NEUTRAL);
        fitText(p.name, nameCol, y, itemCol - nameCol - 6);
        doc.font('Helvetica');
        fitText(p.itemName, itemCol, y, amountCol - itemCol - 6);
        doc.fillColor(BRAND);
        fitText(p.amount ? formatUGX(p.amount) : 'Generous', amountCol, y, dateCol - amountCol - 6);
        doc.fillColor(NEUTRAL_LIGHT);
        fitText(formatDate(p.date), dateCol, y, PAGE_WIDTH - PAGE_MARGIN - dateCol);
        y += 13;
      });
    }
  }

  // ------------------------------------------------------------ Page numbers
  //
  // Writing at PAGE_HEIGHT - 30 sits below the document's own bottom margin
  // (created with margin: PAGE_MARGIN on every side), and PDFKit treats text
  // placed beyond a page's margins as overflow — it silently inserts a *new*
  // page to hold it, even when switchToPage() has pointed at an existing one.
  // Zeroing the bottom margin first tells PDFKit there is nothing left to
  // protect below this text, so it draws directly onto the page already
  // selected instead of manufacturing another one.
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    const bottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.font('Helvetica').fontSize(8).fillColor(NEUTRAL_LIGHT)
      .text(`Page ${i + 1} of ${range.count}`, PAGE_MARGIN, PAGE_HEIGHT - 30, {
        width: PAGE_WIDTH - PAGE_MARGIN * 2,
        align: 'center'
      });
    doc.page.margins.bottom = bottomMargin;
  }

  doc.end();
  return done;
}
