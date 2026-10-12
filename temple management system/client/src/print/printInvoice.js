import { DEFAULT_TEMPLE_NAME } from '../branding.js';
const RM = (n) => `RM ${Number(n || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => new Date(d).toLocaleDateString('en-MY', { day: '2-digit', month: 'long', year: 'numeric' });
const fmtTime = (d) => new Date(d).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', hour12: true });

export function buildInvoiceHtml(booking, settings, eventTypeName) {
  const totalPaid = booking.transactions.reduce((s, t) => s + Number(t.total), 0);
  const balance = Number(booking.hallRate) - totalPaid;
  const d = booking.devotee;
  const s = settings;

  const logoHtml = s['temple.logoUrl']
    ? `<img src="${s['temple.logoUrl']}" class="temple-logo" />`
    : '';

  const paymentRows = booking.transactions.map((t) => `
    <tr>
      <td>${new Date(t.txDate).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
      <td>${t.receiptNo || '—'}</td>
      <td>${(t.paymentMode || '').replace(/_/g, ' ')}</td>
      <td class="text-right">${RM(t.total)}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Invoice ${booking.bookingNo}</title>
<style>
  @page { size: A4; margin: 14mm 18mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; color: #222; background: #fff; }

  /* ── Header: logo+temple LEFT, INVOICE block RIGHT ── */
  .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 14px; border-bottom: 3px solid #5C1A1B; margin-bottom: 20px; }
  .temple-block { display: flex; align-items: flex-start; gap: 14px; }
  .temple-logo { width: 60px; height: 60px; border-radius: 50%; object-fit: cover; border: 2px solid #5C1A1B; flex-shrink: 0; }
  .temple-name { font-size: 14pt; font-weight: 700; color: #5C1A1B; line-height: 1.2; margin-bottom: 2px; }
  .temple-sub  { font-size: 9pt; color: #7a2a2b; margin-bottom: 4px; }
  .temple-info { font-size: 8.5pt; color: #666; line-height: 1.7; }

  .invoice-block { text-align: right; flex-shrink: 0; }
  .invoice-label { font-size: 24pt; font-weight: 800; color: #5C1A1B; letter-spacing: 0.08em; line-height: 1; }
  .invoice-number { font-size: 11pt; font-weight: 700; color: #333; margin: 5px 0 6px; }
  .invoice-meta { font-size: 8.5pt; color: #666; line-height: 1.9; }
  .invoice-meta strong { color: #222; }
  .status-badge { display: inline-block; margin-top: 6px; background: #5C1A1B; color: #fff; font-size: 7.5pt; font-weight: 700; letter-spacing: 0.08em; padding: 3px 10px; border-radius: 3px; }

  /* ── Info grid ── */
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
  .info-box { padding: 12px 14px; border: 1px solid #ddd0b0; border-radius: 4px; }
  .info-box-title { font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #5C1A1B; margin-bottom: 9px; padding-bottom: 6px; border-bottom: 1px solid #e8dcc8; }
  .info-row { display: grid; grid-template-columns: 82px 1fr; gap: 4px; margin-bottom: 4px; font-size: 9pt; line-height: 1.5; }
  .info-label { color: #888; }
  .info-value { color: #111; font-weight: 500; word-break: break-word; }

  /* ── Main service table ── */
  table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
  table.main-table { margin-bottom: 16px; }
  thead th { background: #5C1A1B; color: #fff; padding: 9px 12px; font-size: 9pt; font-weight: 600; text-align: left; }
  thead th.text-right { text-align: right; }
  tbody td { padding: 10px 12px; border-bottom: 1px solid #ede6d8; vertical-align: top; }
  tbody tr.deposit-row td { background: #fdf8f0; color: #666; font-size: 9pt; }
  .text-right { text-align: right; }
  .item-name { font-weight: 700; font-size: 10pt; margin-bottom: 2px; }
  .item-sub { color: #888; font-size: 8.5pt; }
  .detail-label { display: inline-block; min-width: 52px; color: #999; font-size: 8.5pt; }
  .detail-val { font-weight: 600; font-size: 9pt; }

  /* ── Totals ── */
  .totals-wrap { display: flex; justify-content: flex-end; margin-bottom: 22px; }
  .totals { width: 256px; border: 1px solid #ddd0b0; border-radius: 4px; overflow: hidden; }
  .totals-row { display: flex; justify-content: space-between; padding: 8px 14px; font-size: 9.5pt; border-bottom: 1px solid #ede6d8; }
  .totals-row.paid { color: #2a7a50; }
  .totals-row.balance { background: #5C1A1B; color: #fff; font-weight: 700; font-size: 11pt; padding: 10px 14px; border-bottom: none; }

  /* ── Payment history ── */
  .section-title { font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #5C1A1B; margin-bottom: 8px; }
  table.pay-table { margin-bottom: 20px; }
  table.pay-table thead th { background: #f5ede0; color: #5C1A1B; font-size: 8.5pt; }
  table.pay-table tbody td { font-size: 9pt; padding: 7px 12px; }

  /* ── Footer ── */
  .footer { margin-top: 24px; border-top: 1.5px solid #ddd0b0; padding-top: 14px; display: grid; grid-template-columns: 1fr auto; gap: 24px; }
  .footer-terms { font-size: 8.5pt; color: #555; line-height: 1.6; }
  .footer-terms strong { display: block; margin-bottom: 4px; font-size: 9pt; color: #333; }
  .footer-note { margin-top: 6px; font-style: italic; color: #999; font-size: 8pt; }
  .sig-line { border-top: 1px solid #aaa; width: 180px; padding-top: 5px; font-size: 8pt; color: #666; text-align: center; margin-top: 48px; }
  .watermark { font-size: 8pt; color: #c8a035; margin-top: 6px; text-align: center; }
</style>
</head>
<body>

<!-- ══ HEADER ══ -->
<div class="header">
  <div class="temple-block">
    ${logoHtml}
    <div>
      <div class="temple-name">${s['temple.name'] || DEFAULT_TEMPLE_NAME}</div>
      ${s['temple.nameTa'] && s['temple.nameTa'] !== s['temple.name'] ? `<div class="temple-sub">${s['temple.nameTa']}</div>` : ''}
      <div class="temple-info">
        ${s['temple.address'] ? `${s['temple.address']}<br>` : ''}
        ${s['temple.phone'] ? `Tel: ${s['temple.phone']}` : ''}${s['temple.email'] ? ` &nbsp;·&nbsp; ${s['temple.email']}` : ''}
        ${s['temple.regNo'] ? `<br>Reg No: ${s['temple.regNo']}` : ''}
      </div>
    </div>
  </div>
  <div class="invoice-block">
    <div class="invoice-label">INVOICE</div>
    <div class="invoice-number">${booking.bookingNo}</div>
    <div class="invoice-meta">
      Issue Date &nbsp;<strong>${fmtDate(new Date())}</strong><br>
      Booked On &nbsp;<strong>${fmtDate(booking.createdAt)}</strong>
    </div>
    <div><span class="status-badge">${booking.status.replace(/_/g, ' ')}</span></div>
  </div>
</div>

<!-- ══ BILLED TO / BOOKING DETAILS ══ -->
<div class="info-grid">
  <div class="info-box">
    <div class="info-box-title">Billed To</div>
    <div class="info-row"><span class="info-label">Name</span><span class="info-value">${d?.name || '—'}</span></div>
    <div class="info-row"><span class="info-label">Phone</span><span class="info-value">${d?.phone || '—'}</span></div>
    ${d?.altPhone ? `<div class="info-row"><span class="info-label">Alt Phone</span><span class="info-value">${d.altPhone}</span></div>` : ''}
    ${d?.icNumber ? `<div class="info-row"><span class="info-label">IC / Passport</span><span class="info-value">${d.icNumber}</span></div>` : ''}
    ${d?.email ? `<div class="info-row"><span class="info-label">Email</span><span class="info-value">${d.email}</span></div>` : ''}
    ${d?.address ? `<div class="info-row"><span class="info-label">Address</span><span class="info-value">${d.address}</span></div>` : ''}
  </div>
  <div class="info-box">
    <div class="info-box-title">Booking Details</div>
    <div class="info-row"><span class="info-label">Booking No</span><span class="info-value">${booking.bookingNo}</span></div>
    <div class="info-row"><span class="info-label">Event Type</span><span class="info-value">${eventTypeName}</span></div>
    <div class="info-row"><span class="info-label">Event Date</span><span class="info-value">${fmtDate(booking.eventDate)}</span></div>
    <div class="info-row"><span class="info-label">Time</span><span class="info-value">${fmtTime(booking.startTime)} – ${fmtTime(booking.endTime)}</span></div>
    ${booking.notes ? `<div class="info-row"><span class="info-label">Notes</span><span class="info-value">${booking.notes}</span></div>` : ''}
    <div class="info-row"><span class="info-label">Balance Due</span><span class="info-value">${fmtDate(booking.balanceDueAt)}</span></div>
  </div>
</div>

<!-- ══ SERVICE TABLE ══ -->
<table class="main-table">
  <thead>
    <tr>
      <th style="width:28%">Item</th>
      <th style="width:47%">Details</th>
      <th class="text-right" style="width:25%">Amount</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>
        <div class="item-name">Hall Rental</div>
        <div class="item-sub">${eventTypeName}</div>
      </td>
      <td>
        <div><span class="detail-label">Date</span><span class="detail-val">${fmtDate(booking.eventDate)}</span></div>
        <div><span class="detail-label">Time</span><span class="detail-val">${fmtTime(booking.startTime)} – ${fmtTime(booking.endTime)}</span></div>
        <div><span class="detail-label">Ref</span><span class="detail-val">${booking.bookingNo}</span></div>
        ${booking.notes ? `<div style="margin-top:5px;font-size:8.5pt;color:#666;font-style:italic">${booking.notes}</div>` : ''}
      </td>
      <td class="text-right" style="font-weight:600">${RM(booking.hallRate)}</td>
    </tr>
    <tr class="deposit-row">
      <td colspan="2">Deposit Required</td>
      <td class="text-right">${RM(booking.depositDue)}</td>
    </tr>
  </tbody>
</table>

<!-- ══ TOTALS ══ -->
<div class="totals-wrap">
  <div class="totals">
    <div class="totals-row"><span>Hall Rate</span><span>${RM(booking.hallRate)}</span></div>
    <div class="totals-row paid"><span>Amount Paid</span><span>− ${RM(totalPaid)}</span></div>
    <div class="totals-row balance"><span>Balance Due</span><span>${RM(balance > 0 ? balance : 0)}</span></div>
  </div>
</div>

<!-- ══ PAYMENT HISTORY ══ -->
${booking.transactions.length > 0 ? `
<div class="section-title">Payment History</div>
<table class="pay-table">
  <thead>
    <tr>
      <th>Date</th>
      <th>Receipt No</th>
      <th>Mode</th>
      <th class="text-right">Amount</th>
    </tr>
  </thead>
  <tbody>${paymentRows}</tbody>
</table>` : ''}

<!-- ══ FOOTER ══ -->
<div class="footer">
  <div class="footer-terms">
    <strong>Payment Terms</strong>
    Full payment is required on or before the event date.<br>
    This invoice serves as an official receipt upon full payment.
    ${s['receipt.footerText'] ? `<div class="footer-note">${s['receipt.footerText']}</div>` : ''}
  </div>
  <div>
    <div class="sig-line">Authorised Signature &amp; Stamp</div>
    <div class="watermark">${s['temple.name'] || DEFAULT_TEMPLE_NAME}</div>
  </div>
</div>

</body>
</html>`;
}

export function printBookingInvoice(booking, settings, eventTypeName) {
  const html = buildInvoiceHtml(booking, settings, eventTypeName);
  const win = window.open('', '_blank', 'width=900,height=1100');
  win.document.write(html);
  win.document.close();
}
