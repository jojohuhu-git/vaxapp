// ForecastPDF.jsx — Full Forecast PDF styled to match SchedulePDF format.
/* eslint-disable react/prop-types */
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica', color: '#222' },
  h1:   { fontSize: 18, fontWeight: 700, marginBottom: 4 },
  h2:   { fontSize: 12, fontWeight: 700, marginTop: 14, marginBottom: 6, color: '#1a3a6b' },
  metaRow:   { flexDirection: 'row', marginBottom: 2 },
  metaLabel: { width: 100, color: '#666', fontWeight: 700 },
  metaValue: { flex: 1 },
  divider: { borderBottom: '1pt solid #cccccc', marginVertical: 8 },

  visitHeader: {
    flexDirection: 'row',
    padding: 4, marginTop: 6,
  },
  visitHeaderText: { color: '#ffffff', fontSize: 10, fontWeight: 700 },

  visitBox: {
    border: '1pt solid #d8e1eb', borderTop: 0,
    padding: 6, marginBottom: 4,
  },
  doseRow:   { flexDirection: 'row', paddingVertical: 1.5 },
  doseVk:    { width: 70, fontWeight: 700 },
  doseDose:  { width: 80, color: '#555' },
  doseBrand: { flex: 1, color: '#555' },
  doseDate:  { fontSize: 7.5, color: '#888', fontStyle: 'italic' },

  providerBlock: {
    marginTop: 16, padding: 8, border: '1pt solid #d8e1eb',
    backgroundColor: '#fafbfc',
  },
  providerLabel: { fontSize: 9, color: '#666', marginBottom: 8 },
  providerLine:  { borderBottom: '0.5pt solid #999', height: 16, marginBottom: 4 },

  disclaimer: {
    marginTop: 12, padding: 6, fontSize: 8, color: '#666',
    fontStyle: 'italic', backgroundColor: '#fff3cd', border: '1pt solid #f0c040',
  },
  footer: {
    position: 'absolute', bottom: 24, left: 40, right: 40,
    fontSize: 7, color: '#999', textAlign: 'center',
  },
});

function fmtAm(m) {
  if (m < 12) return `${m} month${m !== 1 ? 's' : ''}`;
  const y = Math.floor(m / 12), mo = m % 12;
  return `${y} year${y !== 1 ? 's' : ''}` + (mo ? ` ${mo} month${mo !== 1 ? 's' : ''}` : '');
}

function fmtRiskList(risks) {
  if (!risks || risks.length === 0) return 'None entered';
  return risks.join(', ');
}

export default function ForecastPDF({ am, dob, risks, rows, generatedAt }) {
  const today = generatedAt || new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const dobFmt = dob
    ? new Date(dob + 'T12:00:00').toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
      })
    : null;

  const visibleRows = rows.filter(r => r.isCurr || r.items.length > 0);

  return (
    <Document title={`PediVax Full Forecast — ${today}`} author="PediVax">
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.h1}>Full Immunization Forecast</Text>
        <Text style={{ fontSize: 9, color: '#888', marginBottom: 8 }}>
          Generated {today} · For clinician review
        </Text>

        <View style={styles.divider} />

        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Patient name:</Text>
          <Text style={styles.metaValue}>_____________________________</Text>
        </View>
        {dobFmt && (
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Date of birth:</Text>
            <Text style={styles.metaValue}>{dobFmt}</Text>
          </View>
        )}
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Current age:</Text>
          <Text style={styles.metaValue}>{fmtAm(am)}</Text>
        </View>
        {risks && risks.length > 0 && (
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Risk factors:</Text>
            <Text style={styles.metaValue}>{fmtRiskList(risks)}</Text>
          </View>
        )}

        <Text style={styles.h2}>Visit-by-visit forecast</Text>

        {visibleRows.map((row, i) => {
          const bgColor = row.isCurr ? '#2e7d32'
            : row.isCatchup ? '#b45309'
            : row.isPast ? '#888'
            : '#1a3a6b';

          const visitLabel = row.isCurr
            ? `▶ ${row.l} — CURRENT VISIT`
            : row.isCatchup ? `${row.l} (catch-up)`
            : row.l;

          return (
            <View key={i} wrap={false}>
              <View style={[styles.visitHeader, { backgroundColor: bgColor }]}>
                <Text style={[styles.visitHeaderText, { flex: 1 }]}>{visitLabel}</Text>
                {row.date
                  ? <Text style={styles.visitHeaderText}>{row.date}</Text>
                  : null}
              </View>
              <View style={styles.visitBox}>
                {row.items.length > 0
                  ? row.items.map((item, j) => {
                      const brandShort = item.brand
                        ? item.brand.split('(')[0].trim()
                        : '(brand to select)';
                      return (
                        <View key={j} style={styles.doseRow}>
                          <Text style={styles.doseVk}>{item.vk}</Text>
                          <Text style={styles.doseDose}>{item.chip}</Text>
                          <Text style={styles.doseBrand}>{brandShort}</Text>
                          {item.date
                            ? <Text style={styles.doseDate}>{item.date}</Text>
                            : null}
                        </View>
                      );
                    })
                  : <Text style={{ fontSize: 9, color: '#888' }}>No vaccines due</Text>}
              </View>
            </View>
          );
        })}

        <View style={styles.providerBlock}>
          <Text style={styles.providerLabel}>Provider / Clinic:</Text>
          <View style={styles.providerLine} />
          <Text style={styles.providerLabel}>Clinician signature / date:</Text>
          <View style={styles.providerLine} />
        </View>

        <View style={styles.disclaimer}>
          <Text>
            {'DISCLAIMER: This schedule is generated by PediVax for clinician review and is NOT medical advice. All dose timing, brand selection, and contraindication review must be verified against current CDC/ACIP guidance and the manufacturer\'s prescribing information before any vaccine is administered. Schedule may change based on availability, intercurrent illness, contraindications, or new clinical findings. PediVax authors and operators assume no responsibility for clinical decisions made on the basis of this output.'}
          </Text>
        </View>

        <Text
          style={styles.footer}
          fixed
          render={({ pageNumber, totalPages }) =>
            `PediVax · Generated ${today} · Page ${pageNumber} of ${totalPages}`
          }
        />
      </Page>
    </Document>
  );
}
