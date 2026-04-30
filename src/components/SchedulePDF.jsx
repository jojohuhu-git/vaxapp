// SchedulePDF.jsx — printable PDF artifact for an optimal schedule.
//
// Generated via @react-pdf/renderer. Contains patient info, mode used,
// visit-by-visit table, and a disclaimer footer for clinician review.

import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica', color: '#222' },
  h1:   { fontSize: 18, fontWeight: 700, marginBottom: 4 },
  h2:   { fontSize: 12, fontWeight: 700, marginTop: 14, marginBottom: 6, color: '#1a3a6b' },
  metaRow: { flexDirection: 'row', marginBottom: 2 },
  metaLabel: { width: 100, color: '#666', fontWeight: 700 },
  metaValue: { flex: 1 },
  divider: { borderBottom: '1pt solid #cccccc', marginVertical: 8 },

  visitHeader: {
    flexDirection: 'row',
    backgroundColor: '#1a3a6b', color: '#ffffff',
    padding: 4, marginTop: 6,
  },
  visitHeaderText: { color: '#ffffff', fontSize: 10, fontWeight: 700 },

  visitBox: {
    border: '1pt solid #d8e1eb', borderTop: 0,
    padding: 6, marginBottom: 4,
  },
  doseRow: { flexDirection: 'row', paddingVertical: 1.5 },
  doseVk: { width: 70, fontWeight: 700 },
  doseNum: { width: 50, color: '#555' },
  doseBrand: { flex: 1, color: '#555' },
  doseConstraint: { fontSize: 7.5, color: '#888', fontStyle: 'italic' },

  comboRow: {
    flexDirection: 'row', backgroundColor: '#fff8d8',
    paddingVertical: 3, paddingHorizontal: 4, marginVertical: 1,
  },
  comboName: { width: 90, fontWeight: 700, color: '#856404' },
  comboCovers: { flex: 1, color: '#666', fontSize: 9 },

  riskChip: {
    fontSize: 9, padding: '1 4', backgroundColor: '#fce8e8', color: '#8b1a1a',
    marginRight: 4, borderRadius: 2,
  },

  providerBlock: {
    marginTop: 16, padding: 8, border: '1pt solid #d8e1eb',
    backgroundColor: '#fafbfc',
  },
  providerLabel: { fontSize: 9, color: '#666', marginBottom: 8 },
  providerLine: { borderBottom: '0.5pt solid #999', height: 16, marginBottom: 4 },

  disclaimer: {
    marginTop: 12, padding: 6, fontSize: 8, color: '#666',
    fontStyle: 'italic', backgroundColor: '#fff3cd', border: '1pt solid #f0c040',
  },
  footer: {
    position: 'absolute', bottom: 24, left: 40, right: 40,
    fontSize: 7, color: '#999', textAlign: 'center',
  },
});

const MODE_LABELS = {
  fewestVisits: 'Fewest visits',
  earliestCompletion: 'Earliest completion',
  fewestInjections: 'Fewest injections (combo brands prioritized)',
};

function fmtRiskList(risks) {
  if (!risks || risks.length === 0) return 'None entered';
  return risks.join(', ');
}

function ageAtDateStr(dob, date) {
  if (!dob) return '';
  const ms = new Date(date) - new Date(dob);
  const days = ms / (1000 * 60 * 60 * 24);
  const months = days / 30.4375;
  if (months < 24) return `${Math.round(months)} months`;
  return `${(months / 12).toFixed(1)} years`;
}

function VisitItems({ items }) {
  return (
    <>
      {items.map((it, i) => {
        if (it._combo) {
          return (
            <View key={i} style={styles.comboRow} wrap={false}>
              <Text style={styles.comboName}>{it.comboName}</Text>
              <Text style={styles.comboCovers}>
                covers {it.coveredAntigens.join(' + ')} (
                {it.coveredDoses.map(d => `${d.vk} D${d.doseNum}/${d.totalDoses}`).join(', ')})
              </Text>
            </View>
          );
        }
        const brandShort = it.brand ? it.brand.split('(')[0].trim() : '(brand to select)';
        return (
          <View key={i} style={styles.doseRow} wrap={false}>
            <Text style={styles.doseVk}>{it.vk}</Text>
            <Text style={styles.doseNum}>D{it.doseNum}/{it.totalDoses}</Text>
            <Text style={styles.doseBrand}>{brandShort}</Text>
          </View>
        );
      })}
    </>
  );
}

export default function SchedulePDF({ patient, mode, visits, generatedAt }) {
  const today = generatedAt || new Date().toISOString().slice(0, 10);
  const totalDoses = visits.reduce((s, v) => s + v.items.reduce((s2, it) => s2 + (it._combo ? it.coveredDoses.length : 1), 0), 0);
  const totalInjections = visits.reduce((s, v) => s + v.items.length, 0);
  const lastVisitDate = visits.at(-1)?.date;

  return (
    <Document
      title={`PediVax Schedule — ${patient.name || 'Patient'} (${today})`}
      author="PediVax"
    >
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.h1}>Optimal Vaccine Schedule</Text>
        <Text style={{ fontSize: 9, color: '#888', marginBottom: 8 }}>
          Generated {today} · For clinician review
        </Text>

        <View style={styles.divider} />

        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Patient name:</Text>
          <Text style={styles.metaValue}>{patient.name || '_____________________________'}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Date of birth:</Text>
          <Text style={styles.metaValue}>{patient.dob || '_____________'}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Current age:</Text>
          <Text style={styles.metaValue}>{patient.am} months</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Risk conditions:</Text>
          <Text style={styles.metaValue}>{fmtRiskList(patient.risks)}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Schedule mode:</Text>
          <Text style={styles.metaValue}>{MODE_LABELS[mode] || mode}</Text>
        </View>

        <Text style={styles.h2}>Summary</Text>
        <Text>{visits.length} visits · {totalInjections} injections ({totalDoses} antigen doses) · series complete by {lastVisitDate || 'N/A'}</Text>

        <Text style={styles.h2}>Visit-by-visit plan</Text>
        {visits.map((v, i) => (
          <View key={i} wrap={false}>
            <View style={styles.visitHeader}>
              <Text style={[styles.visitHeaderText, { flex: 1 }]}>Visit {i + 1} — {v.date}</Text>
              <Text style={styles.visitHeaderText}>
                Age: {ageAtDateStr(patient.dob, v.date)} · {v.items.length} injection{v.items.length !== 1 ? 's' : ''}
              </Text>
            </View>
            <View style={styles.visitBox}>
              <VisitItems items={v.items} />
            </View>
          </View>
        ))}

        <View style={styles.providerBlock}>
          <Text style={styles.providerLabel}>Provider / Clinic:</Text>
          <View style={styles.providerLine} />
          <Text style={styles.providerLabel}>Clinician signature / date:</Text>
          <View style={styles.providerLine} />
        </View>

        <View style={styles.disclaimer}>
          <Text>
            DISCLAIMER: This schedule is generated by PediVax for clinician review and is NOT medical advice.
            All dose timing, brand selection, and contraindication review must be verified against current
            CDC/ACIP guidance and the manufacturer's prescribing information before any vaccine is
            administered. Schedule may change based on availability, intercurrent illness, contraindications,
            or new clinical findings. PediVax authors and operators assume no responsibility for clinical
            decisions made on the basis of this output.
          </Text>
        </View>

        <Text style={styles.footer} fixed render={({ pageNumber, totalPages }) => (
          `PediVax · Generated ${today} · Page ${pageNumber} of ${totalPages}`
        )} />
      </Page>
    </Document>
  );
}
