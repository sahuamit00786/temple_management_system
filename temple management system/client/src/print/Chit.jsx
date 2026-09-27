import { useEffect } from 'react';
import { createPortal } from 'react-dom';

/* ── Label sets ─────────────────────────────────────────── */
const L = {
  EN: {
    billNo: 'Bill No', date: 'Date', counter: 'Counter', time: 'Time',
    cashier: 'Cashier', devotee: 'Devotee', star: 'Star',
    no: 'NO', desc: 'DESCRIPTION', qty: 'QTY', rate: 'RATE', amt: 'AMOUNT',
    total: 'Total Amount (RM)', items: 'Items', totalQty: 'Qty',
    cash: 'Cash Tendered', change: 'Change',
    billType: (m) => !m ? 'BILL' : m === 'CASH' ? 'CASH BILL' : m === 'CARD' ? 'CARD BILL' : m.replace(/_/g,' ') + ' BILL',
  },
  TA: {
    billNo: 'பில் எண்', date: 'தேதி', counter: 'கவுண்டர்', time: 'நேரம்',
    cashier: 'வரவேற்பாளர்', devotee: 'பக்தர்', star: 'நட்சத்திரம்',
    no: 'எண்', desc: 'விளக்கம்', qty: 'அளவு', rate: 'விலை', amt: 'தொகை',
    total: 'மொத்த தொகை (ரூ)', items: 'பொருட்கள்', totalQty: 'மொத்தம்',
    cash: 'செலுத்திய தொகை', change: 'திரும்ப பெறும் தொகை',
    billType: (m) => !m ? 'பில்' : m === 'CASH' ? 'பண பில்' : m === 'CARD' ? 'அட்டை பில்' : 'ஆன்லைன் பில்',
  },
};

const TAMIL_FONT = `'Noto Sans Tamil', 'Latha', 'Vijaya', 'Nirmala UI', Arial, sans-serif`;
const MONO_FONT  = `'Consolas', 'Courier New', Courier, monospace`;

function getFont(lang) { return lang === 'TA' ? TAMIL_FONT : MONO_FONT; }
function getLabels(lang) { return lang === 'TA' ? L.TA : L.EN; }

function itemPrimary(item, lang) {
  if (lang === 'TA') return item.nameTa || item.nameSnapshot;
  return item.nameSnapshot;
}
function itemSub(item, lang) {
  if (lang === 'BOTH' && item.nameTa) return item.nameTa;
  return null;
}

function templeName(settings, lang) {
  if (lang === 'TA') return settings['temple.nameTa'] || settings['temple.name'] || 'TEMPLE';
  return settings['temple.name'] || 'TEMPLE';
}

/* ── Font sizes (×1.4 of original) ────────────────────────
   original → scaled
   8px  → 11px
   9px  → 13px
   9.5px→ 13px
   10px → 14px
   10.5px→15px
   11px → 15px
   13px → 18px
   14px → 20px
─────────────────────────────────────────────────────────── */

/* ── BASE CSS (HTML print) ─────────────────────────────── */
function baseStyle(lang, paperWidth = '80') {
  const font = getFont(lang);
  const mm   = paperWidth === '58' ? 58 : 80;
  const pad  = paperWidth === '58' ? '2mm 3mm' : '2mm 5mm';
  return `
  @page { size: ${mm}mm auto; margin: 0; }
  *, *::before, *::after { box-sizing: border-box; }
  html {
    width: 100%; margin: 0;
  }
  body {
    font-family: ${font};
    font-size: 13px; line-height: 1.5; color: #000; font-weight: 600;
    background: #fff; width: ${mm}mm; margin: 0 auto; padding: ${pad};
    word-wrap: break-word; overflow-x: hidden;
    scrollbar-width: none;
  }
  html::-webkit-scrollbar, body::-webkit-scrollbar { display: none; }
  .sep  { border: none; border-top: 1px dashed #555; margin: 4px 0; width: 100%; }
  .wave { border: none; border-top: 2px solid #000;  margin: 4px 0; width: 100%; }
  .center { text-align: center; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  td    { padding: 1px 1px; vertical-align: top; font-size: 13px; }
  th    { padding: 1px 1px; vertical-align: top; font-size: 12px; font-weight: 700; }
  .col-no   { width: 20px; text-align: center; white-space: nowrap; }
  .col-desc { overflow: hidden; word-break: break-word; }
  .col-qty  { width: 20px; text-align: center; white-space: nowrap; }
  .col-rate { width: 52px; text-align: right; white-space: nowrap; }
  .col-amt  { width: 58px; text-align: right; white-space: nowrap; }
  .two     { display: flex; justify-content: space-between; font-size: 15px; line-height: 1.6; }
  .two-big { display: flex; justify-content: space-between; font-weight: 700; font-size: 20px; line-height: 1.7; }
  .ta-sub  { font-size: 13px; color: #555; margin-top: 1px; }
  @media print { html, body { margin: 0; overflow: visible; } }
`;
}

const SEP  = { border: 'none', borderTop: '1px dashed #555', margin: '5px 0', width: '100%' };
const WAVE = { border: 'none', borderTop: '2px solid #000',  margin: '5px 0', width: '100%' };

/* ── HTML string (window.print + All Orders preview) ──── */
export function buildChitHtml(chit, settings) {
  const lang       = settings['receipt.language'] || 'EN';
  const paperWidth = settings['receipt.paperWidth'] === '58' ? '58' : '80';
  const lbl      = getLabels(lang);
  const total    = Number(chit.total);
  const tendered = Number(chit.tendered ?? total);
  const change   = tendered - total;
  const totalQty = chit.items.reduce((s, i) => s + i.qty, 0);
  const txDate   = new Date(chit.txDate);
  const date     = txDate.toLocaleDateString('en-GB');
  const time     = txDate.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();
  const billNo   = chit.receiptNo || chit.localChitNo || '-';
  const counter  = chit.deviceId || 'POS';
  const cashier  = chit.createdByName || chit.createdBy?.name || chit.createdByRole || chit.createdBy?.role?.name || settings['temple.cashierLabel'] || (lang === 'TA' ? 'வரவேற்பாளர்' : 'CASHIER');

  const logoHtml = settings['temple.logoUrl']
    ? `<img src="${settings['temple.logoUrl']}" style="width:26mm;height:26mm;object-fit:contain;display:block;margin:0 auto 2mm;filter:grayscale(1);">`
    : '';

  const tName = templeName(settings, lang);
  const tNameSub = (lang === 'BOTH' && settings['temple.nameTa'])
    ? `<div style="font-size:15px;font-family:${TAMIL_FONT};font-weight:600;">${settings['temple.nameTa']}</div>`
    : '';

  const itemRows = chit.items.map((item, idx) => {
    const primary = itemPrimary(item, lang);
    const sub     = itemSub(item, lang);
    return `<tr>
      <td class="col-no">${idx + 1}</td>
      <td class="col-desc">${primary}${sub ? `<div class="ta-sub">${sub}</div>` : ''}</td>
      <td class="col-qty">${item.qty}</td>
      <td class="col-rate">${Number(item.priceSnapshot).toFixed(2)}</td>
      <td class="col-amt">${(Number(item.priceSnapshot) * item.qty).toFixed(2)}</td>
    </tr>`;
  }).join('');

  const cashRows = chit.paymentMode === 'CASH' && tendered > 0
    ? `<div class="two"><span>${lbl.cash}</span><span>RM ${tendered.toFixed(2)}</span></div>
       <div class="two"><span>${lbl.change}</span><span>RM ${change.toFixed(2)}</span></div>`
    : '';

  const tamilFontImport = (lang === 'TA' || lang === 'BOTH')
    ? `<link rel="preconnect" href="https://fonts.googleapis.com">
       <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Tamil:wght@400;600&display=swap" rel="stylesheet">`
    : '';

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
${tamilFontImport}
<style>${baseStyle(lang, paperWidth)}</style></head><body>

<div class="center">
  ${logoHtml}
  <div style="font-size:18px;font-weight:700;letter-spacing:0.03em;margin-bottom:1px">${tName}</div>
  ${tNameSub}
  ${settings['temple.address'] ? `<div style="font-size:13px;font-weight:600;line-height:1.4">${settings['temple.address']}</div>` : ''}
  ${settings['temple.phone'] ? `<div style="font-size:13px;font-weight:600">Tel: ${settings['temple.phone']}</div>` : ''}
  ${settings['temple.pin'] ? `<div style="font-size:13px">PIN: ${settings['temple.pin']}</div>` : ''}
</div>

<hr class="sep">

<div class="two"><span>${lbl.billNo} : ${billNo}</span><span>${lbl.date} : ${date}</span></div>
<div class="two"><span>${lbl.counter} : ${counter}</span><span>${lbl.time} : ${time}</span></div>
<div class="two"><span>${lbl.cashier} : ${cashier}</span><span>${lbl.billType(chit.paymentMode)}</span></div>
${chit.devoteeName ? `<div class="two"><span>${lbl.devotee} : ${chit.devoteeName}</span></div>` : ''}
${chit.starNatchathiram ? `<div class="two"><span>${lbl.star} : ${chit.starNatchathiram}</span></div>` : ''}

<hr class="sep">

<table><thead><tr>
  <th class="col-no">${lbl.no}</th>
  <th class="col-desc" style="text-align:left">${lbl.desc}</th>
  <th class="col-qty">${lbl.qty}</th>
  <th class="col-rate">${lbl.rate}</th>
  <th class="col-amt">${lbl.amt}</th>
</tr></thead></table>

<hr class="sep">

<table><tbody>${itemRows}</tbody></table>

<hr class="sep">

<div class="two-big"><span>${lbl.total}</span><span>${total.toFixed(2)}</span></div>
<div class="two" style="margin-top:1px"><span>${lbl.items} : ${chit.items.length}</span><span>${lbl.totalQty} : ${totalQty}</span></div>
${cashRows}

<hr class="wave">

<div class="center" style="font-size:13px;padding:1mm 0">${settings['receipt.footerText'] || (lang === 'TA' ? 'நன்றி ! மீண்டும் வருக !' : 'Thank You ! Visit Again !')}</div>

<div style="height:6mm"></div>
</body></html>`;
}

/* ── React preview (print portal + live POS preview) ──── */
export function ChitContent({ chit, settings }) {
  const lang     = settings['receipt.language'] || 'EN';
  const lbl      = getLabels(lang);
  const font     = getFont(lang);
  const total    = Number(chit.total);
  const tendered = Number(chit.tendered ?? total);
  const change   = tendered - total;
  const totalQty = chit.items.reduce((s, i) => s + i.qty, 0);
  const txDate   = new Date(chit.txDate);
  const date     = txDate.toLocaleDateString('en-GB');
  const time     = txDate.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();
  const billNo   = chit.receiptNo || chit.localChitNo || '-';
  const counter  = chit.deviceId || 'POS';
  const cashier  = chit.createdByName || chit.createdBy?.name || chit.createdByRole || chit.createdBy?.role?.name || settings['temple.cashierLabel'] || (lang === 'TA' ? 'வரவேற்பாளர்' : 'CASHIER');

  const wrap   = { fontFamily: font, fontSize: '14px', lineHeight: 1.5, color: '#000', fontWeight: 600, width: '100%', padding: '3mm', boxSizing: 'border-box', wordWrap: 'break-word', overflowX: 'hidden' };
  const two    = { display: 'flex', justifyContent: 'space-between', fontSize: '13px', lineHeight: 1.6 };
  const twoBig = { display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '18px', lineHeight: 1.7 };
  const ctr    = { textAlign: 'center' };
  const tbl    = { width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' };
  const thBase = { padding: '1px 2px', verticalAlign: 'top', fontSize: '11px', fontWeight: 700 };
  const tdBase = { padding: '1px 2px', verticalAlign: 'top', fontSize: '12px' };
  const colNo  = { width: '20px', textAlign: 'center', whiteSpace: 'nowrap' };
  const colQty = { width: '20px', textAlign: 'center', whiteSpace: 'nowrap' };
  const colRate= { width: '50px', textAlign: 'right',  whiteSpace: 'nowrap' };
  const colAmt = { width: '56px', textAlign: 'right',  whiteSpace: 'nowrap' };
  const colDesc= { overflow: 'hidden', wordBreak: 'break-word' };

  const tName    = templeName(settings, lang);
  const tNameSub = (lang === 'BOTH' && settings['temple.nameTa']) ? settings['temple.nameTa'] : null;

  return (
    <div style={wrap}>
      {/* HEADER */}
      <div style={ctr}>
        {settings['temple.logoUrl'] && (
          <img src={settings['temple.logoUrl']} alt=""
            style={{ width: '26mm', height: '26mm', objectFit: 'contain', display: 'block', margin: '0 auto 2mm', filter: 'grayscale(1)' }} />
        )}
        <div style={{ fontWeight: 700, fontSize: '18px', letterSpacing: '0.03em', marginBottom: '1px' }}>
          {tName}
        </div>
        {tNameSub && (
          <div style={{ fontSize: '15px', fontFamily: TAMIL_FONT, fontWeight: 600, marginBottom: '1px' }}>
            {tNameSub}
          </div>
        )}
        {settings['temple.address'] && (
          <div style={{ fontSize: '13px', fontWeight: 600, lineHeight: 1.4 }}>{settings['temple.address']}</div>
        )}
        {settings['temple.phone'] && (
          <div style={{ fontSize: '13px', fontWeight: 600 }}>Tel: {settings['temple.phone']}</div>
        )}
        {settings['temple.pin'] && (
          <div style={{ fontSize: '13px' }}>PIN: {settings['temple.pin']}</div>
        )}
      </div>

      <hr style={SEP} />

      {/* BILL INFO */}
      <div style={two}><span>{lbl.billNo} : {billNo}</span><span>{lbl.date} : {date}</span></div>
      <div style={two}><span>{lbl.counter} : {counter}</span><span>{lbl.time} : {time}</span></div>
      <div style={two}><span>{lbl.cashier} : {cashier}</span><span>{lbl.billType(chit.paymentMode)}</span></div>
      {chit.devoteeName && <div style={two}><span>{lbl.devotee} : {chit.devoteeName}</span></div>}
      {chit.starNatchathiram && <div style={two}><span>{lbl.star} : {chit.starNatchathiram}</span></div>}

      <hr style={SEP} />

      {/* COLUMN HEADERS */}
      <table style={tbl}>
        <thead>
          <tr>
            <th style={{ ...thBase, ...colNo }}>{lbl.no}</th>
            <th style={{ ...thBase, ...colDesc, textAlign: 'left' }}>{lbl.desc}</th>
            <th style={{ ...thBase, ...colQty }}>{lbl.qty}</th>
            <th style={{ ...thBase, ...colRate }}>{lbl.rate}</th>
            <th style={{ ...thBase, ...colAmt }}>{lbl.amt}</th>
          </tr>
        </thead>
      </table>

      <hr style={SEP} />

      {/* ITEMS */}
      <table style={tbl}>
        <tbody>
          {chit.items.map((item, idx) => {
            const primary = itemPrimary(item, lang);
            const sub     = itemSub(item, lang);
            return (
              <tr key={idx}>
                <td style={{ ...tdBase, ...colNo }}>{idx + 1}</td>
                <td style={{ ...tdBase, ...colDesc }}>
                  {primary}
                  {sub && <div style={{ fontSize: '11px', color: '#555', marginTop: '1px' }}>{sub}</div>}
                </td>
                <td style={{ ...tdBase, ...colQty }}>{item.qty}</td>
                <td style={{ ...tdBase, ...colRate }}>{Number(item.priceSnapshot).toFixed(2)}</td>
                <td style={{ ...tdBase, ...colAmt }}>{(Number(item.priceSnapshot) * item.qty).toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <hr style={SEP} />

      {/* TOTALS */}
      <div style={twoBig}>
        <span>{lbl.total}</span><span>{total.toFixed(2)}</span>
      </div>
      <div style={{ ...two, marginTop: '1px' }}>
        <span>{lbl.items} : {chit.items.length}</span>
        <span>{lbl.totalQty} : {totalQty}</span>
      </div>
      {chit.paymentMode === 'CASH' && tendered > 0 && (
        <>
          <div style={two}><span>{lbl.cash}</span><span>RM {tendered.toFixed(2)}</span></div>
          <div style={two}><span>{lbl.change}</span><span>RM {change.toFixed(2)}</span></div>
        </>
      )}

      <hr style={WAVE} />

      <div style={{ ...ctr, fontSize: '13px', padding: '1mm 0' }}>
        {settings['receipt.footerText'] || (lang === 'TA' ? 'நன்றி ! மீண்டும் வருக !' : 'Thank You ! Visit Again !')}
      </div>
      <div style={{ height: '6mm' }} />
    </div>
  );
}

export default function Chit({ chit, settings }) {
  const paperWidth = settings?.['receipt.paperWidth'] === '58' ? '58' : '80';

  useEffect(() => {
    document.documentElement.style.setProperty('--chit-page-width', paperWidth === '58' ? '58mm' : '80mm');
    document.documentElement.style.setProperty('--chit-content-width', paperWidth === '58' ? '54mm' : '76mm');
  }, [paperWidth]);

  const portal = document.getElementById('chit-portal');
  if (!chit || !portal) return null;
  return createPortal(<ChitContent chit={chit} settings={settings} />, portal);
}
