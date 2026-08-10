import { Document, Page, View, Text, StyleSheet, pdf } from '@react-pdf/renderer';

const M = '#5C1A1B';
const BG = '#FDF8F0';
const LB = '#E8D8B0';

const s = StyleSheet.create({
  page: { paddingTop: '12mm', paddingBottom: '16mm', paddingLeft: '12mm', paddingRight: '12mm', fontFamily: 'Helvetica', fontSize: 8, color: '#1c1917', backgroundColor: '#ffffff' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '5mm', paddingBottom: '3mm', borderBottomWidth: 1.5, borderBottomColor: M },
  title: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: M },
  meta: { fontSize: 7, color: '#888888', textAlign: 'right' },
  thead: { flexDirection: 'row', backgroundColor: M, paddingTop: 5, paddingBottom: 5, paddingLeft: 5, paddingRight: 5 },
  trow: { flexDirection: 'row', paddingTop: 4, paddingBottom: 4, paddingLeft: 5, paddingRight: 5, borderBottomWidth: 0.5, borderBottomColor: LB },
  trowAlt: { flexDirection: 'row', paddingTop: 4, paddingBottom: 4, paddingLeft: 5, paddingRight: 5, backgroundColor: BG, borderBottomWidth: 0.5, borderBottomColor: LB },
  thCell: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#ffffff' },
  cell: { fontSize: 7.5, color: '#1c1917' },
  footer: { position: 'absolute', bottom: '8mm', left: '12mm', right: '12mm', flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.5, borderTopColor: LB, paddingTop: '2mm' },
  footerTxt: { fontSize: 6.5, color: '#aaa' },
});

function TablePDF({ title, columns, rows }) {
  const date = new Date().toLocaleString('en-MY', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  return (
    <Document title={title} author="TMADJ Temple POS">
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.title}>{title}</Text>
          <View>
            <Text style={s.meta}>Generated: {date}</Text>
            <Text style={s.meta}>{rows.length} record{rows.length !== 1 ? 's' : ''}</Text>
          </View>
        </View>

        {/* Table header — each col wrapped in View so text is clipped to its flex width */}
        <View style={s.thead}>
          {columns.map((c) => (
            <View key={c.key} style={{ flex: c.flex ?? 1, paddingRight: 6, overflow: 'hidden' }}>
              <Text style={[s.thCell, { textAlign: c.right ? 'right' : 'left' }]}>
                {c.label.toUpperCase()}
              </Text>
            </View>
          ))}
        </View>

        {/* Rows */}
        {rows.map((r, i) => (
          <View key={i} style={i % 2 === 0 ? s.trow : s.trowAlt} wrap={false}>
            {columns.map((c) => (
              <View key={c.key} style={{ flex: c.flex ?? 1, paddingRight: 6, overflow: 'hidden' }}>
                <Text style={[s.cell, { textAlign: c.right ? 'right' : 'left' }]}>
                  {String(c.csv ? c.csv(r) : (r[c.key] ?? ''))}
                </Text>
              </View>
            ))}
          </View>
        ))}

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerTxt}>TMADJ Temple POS · {title}</Text>
          <Text style={s.footerTxt} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function generateTablePdf(title, columns, rows) {
  const blob = await pdf(<TablePDF title={title} columns={columns} rows={rows} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${new Date().toLocaleDateString('en-CA')}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
