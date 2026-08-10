import { Document, Page, View, Text, Image, StyleSheet, pdf, Font } from '@react-pdf/renderer';

Font.register({
  family: 'NotoSansTamil',
  src: 'https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSansTamil/NotoSansTamil-Regular.ttf',
});

const M = '#5C1A1B';   // maroon
const G = '#C8A035';   // gold
const LB = '#EDE6D8';  // light border
const BD = '#DDD0B0';  // border
const BG = '#FDF8F0';  // light bg
const GR = '#2A7A50';  // green (paid)

const s = StyleSheet.create({
  page: { paddingTop: '14mm', paddingBottom: '22mm', paddingLeft: '18mm', paddingRight: '18mm', fontFamily: 'Helvetica', fontSize: 10, color: '#222222', backgroundColor: '#ffffff' },

  // ── Header ──
  hdr: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '10mm', borderBottomWidth: 2, borderBottomColor: M, marginBottom: '6mm' },
  logo: { width: 56, height: 56, borderRadius: 28, marginRight: 10 },
  tBlock: { flexDirection: 'row', alignItems: 'flex-start' },
  tName: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: M, marginBottom: 2 },
  tSub: { fontSize: 9, color: M, marginBottom: 3 },
  tSubTa: { fontSize: 9, fontFamily: 'NotoSansTamil', color: M, marginBottom: 3 },
  tInfo: { fontSize: 8, color: '#666666', lineHeight: 1.7 },
  iBlock: { alignItems: 'flex-end' },
  iLabel: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: M, letterSpacing: 3, marginBottom: 4 },
  iNum: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#333333', marginBottom: 5 },
  iMetaRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 2 },
  iMetaLbl: { fontSize: 8.5, color: '#888888', marginRight: 4 },
  iMetaVal: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: '#222222' },
  badge: { backgroundColor: M, borderRadius: 3, paddingTop: 3, paddingBottom: 3, paddingLeft: 8, paddingRight: 8, marginTop: 5, alignSelf: 'flex-end' },
  badgeTxt: { color: '#ffffff', fontSize: 7.5, fontFamily: 'Helvetica-Bold' },

  // ── Info grid ──
  grid: { flexDirection: 'row', marginBottom: '6mm' },
  box: { flex: 1, padding: 11, borderWidth: 1, borderColor: BD, borderRadius: 3 },
  boxL: { marginRight: 8 },
  boxTitle: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: M, marginBottom: 8, paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: BD },
  row: { flexDirection: 'row', marginBottom: 4 },
  lbl: { width: 60, fontSize: 8.5, color: '#888888' },
  val: { flex: 1, fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: '#111111' },

  // ── Table ──
  tHead: { flexDirection: 'row', backgroundColor: M, paddingTop: 7, paddingBottom: 7, paddingLeft: 10, paddingRight: 10 },
  tHCell: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: '#ffffff' },
  tRow: { flexDirection: 'row', paddingTop: 9, paddingBottom: 9, paddingLeft: 10, paddingRight: 10, borderBottomWidth: 1, borderBottomColor: LB },
  tRowAlt: { flexDirection: 'row', paddingTop: 8, paddingBottom: 8, paddingLeft: 10, paddingRight: 10, backgroundColor: BG, borderBottomWidth: 2, borderBottomColor: M },
  c1: { width: '28%' },
  c2: { width: '47%' },
  c3: { width: '25%', alignItems: 'flex-end' },
  iName: { fontSize: 10, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  iSub: { fontSize: 8, color: '#888888' },
  dRow: { flexDirection: 'row', marginBottom: 3 },
  dLbl: { fontSize: 8, color: '#999999', width: 46 },
  dVal: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#222222' },

  // ── Totals ──
  totWrap: { alignItems: 'flex-end', marginBottom: '6mm', marginTop: '2mm' },
  totBox: { width: '55mm', borderWidth: 1, borderColor: BD, borderRadius: 3 },
  totRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 7, paddingBottom: 7, paddingLeft: 12, paddingRight: 12, fontSize: 9, borderBottomWidth: 1, borderBottomColor: LB },
  totPaid: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 7, paddingBottom: 7, paddingLeft: 12, paddingRight: 12, fontSize: 9, color: GR, borderBottomWidth: 1, borderBottomColor: LB },
  totBal: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, paddingBottom: 10, paddingLeft: 12, paddingRight: 12, backgroundColor: M, borderRadius: 3 },
  totBalTxt: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#ffffff' },

  // ── Payment history ──
  secTitle: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: M, marginBottom: '2mm', marginTop: '1mm' },
  pHead: { flexDirection: 'row', backgroundColor: '#F5EDE0', paddingTop: 6, paddingBottom: 6, paddingLeft: 10, paddingRight: 10 },
  pHCell: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: M },
  pRow: { flexDirection: 'row', paddingTop: 7, paddingBottom: 7, paddingLeft: 10, paddingRight: 10, borderBottomWidth: 1, borderBottomColor: LB, fontSize: 9 },

  // ── Footer ──
  footer: { position: 'absolute', bottom: '12mm', left: '18mm', right: '18mm', borderTopWidth: 1.5, borderTopColor: BD, paddingTop: '4mm', flexDirection: 'row', justifyContent: 'space-between' },
  ftTerms: { flex: 1, fontSize: 8, color: '#555555', lineHeight: 1.6 },
  ftTitle: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: '#333333', marginBottom: 3 },
  sigLine: { borderTopWidth: 1, borderTopColor: '#aaaaaa', paddingTop: 4, fontSize: 7.5, color: '#666666', textAlign: 'center', marginTop: 44, width: 150 },
  wm: { fontSize: 7.5, color: G, textAlign: 'center', marginTop: 4 },
});

const RM = (n) => `RM ${Number(n || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtD = (d) => new Date(d).toLocaleDateString('en-MY', { day: '2-digit', month: 'long', year: 'numeric' });
const fmtT = (d) => new Date(d).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', hour12: true });

function InvoicePDF({ booking, settings, eventTypeName }) {
  const cfg = settings;
  const totalPaid = booking.transactions.reduce((sum, t) => sum + Number(t.total), 0);
  const balance = Math.max(0, Number(booking.hallRate) - totalPaid);
  const d = booking.devotee;
  const templeName = cfg['temple.name'] || 'TMADJ Temple';
  const templeNameTa = cfg['temple.nameTa'];
  const showTa = templeNameTa && templeNameTa !== templeName;

  const rawLogo = cfg['temple.logoUrl'];
  const logoSrc = rawLogo
    ? (rawLogo.startsWith('http') ? rawLogo : `${window.location.origin}${rawLogo}`)
    : null;

  return (
    <Document title={`Invoice ${booking.bookingNo}`} author={templeName}>
      <Page size="A4" style={s.page}>

        {/* ── HEADER ── */}
        <View style={s.hdr}>
          <View style={s.tBlock}>
            {logoSrc && <Image src={logoSrc} style={s.logo} />}
            <View>
              <Text style={s.tName}>{templeName}</Text>
              {showTa && <Text style={s.tSubTa}>{templeNameTa}</Text>}
              {cfg['temple.address'] && <Text style={s.tInfo}>{cfg['temple.address']}</Text>}
              <Text style={s.tInfo}>
                {cfg['temple.phone'] ? `Tel: ${cfg['temple.phone']}` : ''}
                {cfg['temple.email'] ? `   ·   ${cfg['temple.email']}` : ''}
              </Text>
              {cfg['temple.regNo'] && <Text style={s.tInfo}>Reg No: {cfg['temple.regNo']}</Text>}
            </View>
          </View>
          <View style={s.iBlock}>
            <Text style={s.iLabel}>INVOICE</Text>
            <Text style={s.iNum}>{booking.bookingNo}</Text>
            <View style={s.iMetaRow}><Text style={s.iMetaLbl}>Issue Date</Text><Text style={s.iMetaVal}>{fmtD(new Date())}</Text></View>
            <View style={s.iMetaRow}><Text style={s.iMetaLbl}>Booked On</Text><Text style={s.iMetaVal}>{fmtD(booking.createdAt)}</Text></View>
            <View style={s.badge}><Text style={s.badgeTxt}>{booking.status.replace(/_/g, ' ')}</Text></View>
          </View>
        </View>

        {/* ── BILLED TO / BOOKING DETAILS ── */}
        <View style={s.grid}>
          <View style={[s.box, s.boxL]}>
            <Text style={s.boxTitle}>BILLED TO</Text>
            {d?.name     && <View style={s.row}><Text style={s.lbl}>Name</Text><Text style={s.val}>{d.name}</Text></View>}
            {d?.phone    && <View style={s.row}><Text style={s.lbl}>Phone</Text><Text style={s.val}>{d.phone}</Text></View>}
            {d?.altPhone && <View style={s.row}><Text style={s.lbl}>Alt Phone</Text><Text style={s.val}>{d.altPhone}</Text></View>}
            {d?.icNumber && <View style={s.row}><Text style={s.lbl}>IC / ID</Text><Text style={s.val}>{d.icNumber}</Text></View>}
            {d?.email    && <View style={s.row}><Text style={s.lbl}>Email</Text><Text style={s.val}>{d.email}</Text></View>}
            {d?.address  && <View style={s.row}><Text style={s.lbl}>Address</Text><Text style={s.val}>{d.address}</Text></View>}
          </View>
          <View style={s.box}>
            <Text style={s.boxTitle}>BOOKING DETAILS</Text>
            <View style={s.row}><Text style={s.lbl}>Booking No</Text><Text style={s.val}>{booking.bookingNo}</Text></View>
            <View style={s.row}><Text style={s.lbl}>Event Type</Text><Text style={s.val}>{eventTypeName}</Text></View>
            <View style={s.row}><Text style={s.lbl}>Event Date</Text><Text style={s.val}>{fmtD(booking.eventDate)}</Text></View>
            <View style={s.row}><Text style={s.lbl}>Time</Text><Text style={s.val}>{fmtT(booking.startTime)} – {fmtT(booking.endTime)}</Text></View>
            {booking.notes && <View style={s.row}><Text style={s.lbl}>Notes</Text><Text style={s.val}>{booking.notes}</Text></View>}
            <View style={s.row}><Text style={s.lbl}>Balance Due</Text><Text style={s.val}>{fmtD(booking.balanceDueAt)}</Text></View>
          </View>
        </View>

        {/* ── SERVICE TABLE ── */}
        <View style={s.tHead}>
          <Text style={[s.tHCell, s.c1]}>Item</Text>
          <Text style={[s.tHCell, s.c2]}>Details</Text>
          <Text style={[s.tHCell, { width: '25%', textAlign: 'right' }]}>Amount</Text>
        </View>
        <View style={s.tRow}>
          <View style={s.c1}>
            <Text style={s.iName}>Hall Rental</Text>
            <Text style={s.iSub}>{eventTypeName}</Text>
          </View>
          <View style={s.c2}>
            <View style={s.dRow}><Text style={s.dLbl}>Date</Text><Text style={s.dVal}>{fmtD(booking.eventDate)}</Text></View>
            <View style={s.dRow}><Text style={s.dLbl}>Time</Text><Text style={s.dVal}>{fmtT(booking.startTime)} – {fmtT(booking.endTime)}</Text></View>
            <View style={s.dRow}><Text style={s.dLbl}>Ref</Text><Text style={s.dVal}>{booking.bookingNo}</Text></View>
            {booking.notes && <Text style={{ fontSize: 8, color: '#666666', marginTop: 4 }}>{booking.notes}</Text>}
          </View>
          <View style={s.c3}>
            <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold' }}>{RM(booking.hallRate)}</Text>
          </View>
        </View>
        <View style={s.tRowAlt}>
          <Text style={[{ fontSize: 9, color: '#555555' }, s.c1]}>Deposit Required</Text>
          <View style={s.c2} />
          <View style={s.c3}><Text style={{ fontSize: 9, color: '#555555' }}>{RM(booking.depositDue)}</Text></View>
        </View>

        {/* ── TOTALS ── */}
        <View style={s.totWrap}>
          <View style={s.totBox}>
            <View style={s.totRow}><Text>Hall Rate</Text><Text>{RM(booking.hallRate)}</Text></View>
            <View style={s.totPaid}><Text>Amount Paid</Text><Text>− {RM(totalPaid)}</Text></View>
            <View style={s.totBal}>
              <Text style={s.totBalTxt}>Balance Due</Text>
              <Text style={s.totBalTxt}>{RM(balance)}</Text>
            </View>
          </View>
        </View>

        {/* ── PAYMENT HISTORY ── */}
        {booking.transactions.length > 0 && (
          <View>
            <Text style={s.secTitle}>PAYMENT HISTORY</Text>
            <View style={s.pHead}>
              <Text style={[s.pHCell, { width: '25%' }]}>Date</Text>
              <Text style={[s.pHCell, { width: '30%' }]}>Receipt No</Text>
              <Text style={[s.pHCell, { width: '25%' }]}>Mode</Text>
              <Text style={[s.pHCell, { width: '20%', textAlign: 'right' }]}>Amount</Text>
            </View>
            {booking.transactions.map((t, i) => (
              <View key={i} style={s.pRow}>
                <Text style={{ width: '25%' }}>{new Date(t.txDate).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })}</Text>
                <Text style={{ width: '30%' }}>{t.receiptNo || '—'}</Text>
                <Text style={{ width: '25%' }}>{(t.paymentMode || '').replace(/_/g, ' ')}</Text>
                <Text style={{ width: '20%', textAlign: 'right' }}>{RM(t.total)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── FOOTER ── */}
        <View style={s.footer}>
          <View style={s.ftTerms}>
            <Text style={s.ftTitle}>Payment Terms</Text>
            <Text>Full payment is required on or before the event date.</Text>
            <Text>This invoice serves as an official receipt upon full settlement.</Text>
            {cfg['receipt.footerText'] && <Text style={{ marginTop: 5, color: '#888888', fontSize: 7.5 }}>{cfg['receipt.footerText']}</Text>}
          </View>
          <View>
            <Text style={s.sigLine}>Authorised Signature &amp; Stamp</Text>
            <Text style={s.wm}>{templeName}</Text>
          </View>
        </View>

      </Page>
    </Document>
  );
}

export async function generateInvoicePdf(booking, settings, eventTypeName) {
  const blob = await pdf(
    <InvoicePDF booking={booking} settings={settings} eventTypeName={eventTypeName} />
  ).toBlob();
  return URL.createObjectURL(blob);
}

const ms = StyleSheet.create({
  page: { paddingTop: '14mm', paddingBottom: '22mm', paddingLeft: '18mm', paddingRight: '18mm', fontFamily: 'Helvetica', fontSize: 10, color: '#222222', backgroundColor: '#ffffff' },
  hdr: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '8mm', borderBottomWidth: 2, borderBottomColor: M, marginBottom: '8mm' },
  logo: { width: 52, height: 52, borderRadius: 26, marginRight: 10 },
  tBlock: { flexDirection: 'row', alignItems: 'center' },
  tName: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: M, marginBottom: 2 },
  tSub: { fontSize: 9, color: M },
  iLabel: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: M, letterSpacing: 2, marginBottom: 3 },
  iDate: { fontSize: 8.5, color: '#888888' },
  badge: { marginTop: '4mm', backgroundColor: BG, borderWidth: 1, borderColor: BD, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  badgeText: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: M, textTransform: 'uppercase', letterSpacing: 1 },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: LB, paddingVertical: '2.5mm' },
  lbl: { width: '42%', fontSize: 9, color: '#888888' },
  val: { flex: 1, fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#222222' },
  amtVal: { flex: 1, fontSize: 13, fontFamily: 'Helvetica-Bold', color: M },
  footer: { position: 'absolute', bottom: '10mm', left: '18mm', right: '18mm', borderTopWidth: 1, borderTopColor: LB, paddingTop: '3mm', flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 8, color: '#aaaaaa' },
});

function MembershipReceiptPDF({ devotee, settings }) {
  const templeName = settings?.['temple.name'] || 'Temple';
  const logo = settings?.['temple.logo'];
  const fmtD = (d) => d ? new Date(d).toLocaleDateString('en-MY', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';
  const isExpired = devotee.membershipEndDate && new Date(devotee.membershipEndDate) < new Date();

  return (
    <Document>
      <Page size="A4" style={ms.page}>
        {/* Header */}
        <View style={ms.hdr}>
          <View style={ms.tBlock}>
            {logo && <Image src={logo} style={ms.logo} />}
            <View>
              <Text style={ms.tName}>{templeName}</Text>
              <Text style={ms.tSub}>Membership Receipt</Text>
            </View>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={ms.iLabel}>MEMBER</Text>
            <Text style={ms.iDate}>Printed: {fmtD(new Date().toISOString())}</Text>
          </View>
        </View>

        {/* Status badge */}
        <View style={ms.badge}>
          <Text style={[ms.badgeText, { color: isExpired ? '#991b1b' : '#2A7A50' }]}>
            {isExpired ? 'EXPIRED' : 'ACTIVE MEMBER'}
          </Text>
        </View>

        {/* Details table */}
        <View style={{ marginTop: '6mm' }}>
          {[
            ['Full Name',        devotee.name],
            ['IC / Passport',    devotee.icNumber || '—'],
            ['Contact',          devotee.phone || '—'],
            ['Membership Plan',  devotee.membershipTypeLabel || '—'],
            ['Paid Via',         devotee.membershipPaidVia || '—'],
            ['Valid From',       fmtD(devotee.membershipStartDate)],
            ['Valid Until',      fmtD(devotee.membershipEndDate)],
          ].map(([label, value]) => (
            <View key={label} style={ms.row}>
              <Text style={ms.lbl}>{label}</Text>
              <Text style={ms.val}>{value}</Text>
            </View>
          ))}
          <View style={ms.row}>
            <Text style={ms.lbl}>Amount Paid</Text>
            <Text style={ms.amtVal}>RM {Number(devotee.membershipPrice || 0).toFixed(2)}</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={ms.footer} fixed>
          <Text style={ms.footerText}>{templeName}</Text>
          <Text style={ms.footerText}>This is a computer-generated receipt.</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function generateMembershipPdf(devotee, settings) {
  const blob = await pdf(
    <MembershipReceiptPDF devotee={devotee} settings={settings} />
  ).toBlob();
  return URL.createObjectURL(blob);
}
