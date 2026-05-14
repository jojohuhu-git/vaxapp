// ShotListPDF.jsx — Today's shot list / administration record PDF
/* eslint-disable react/prop-types */
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { VAX_META } from '../data/vaccineData';

const s = StyleSheet.create({
  page:       { padding: '18mm 16mm', fontFamily: 'Helvetica', fontSize: 9, color: '#222' },
  logo:       { fontSize: 7, color: '#888', marginBottom: 2 },
  h1:         { fontSize: 17, fontWeight: 700, color: '#1a3a6b', marginBottom: 2 },
  h1sub:      { fontSize: 9, color: '#555', marginBottom: 10 },

  patBlock:   { border: '1pt solid #c8d8eb', borderRadius: 3, padding: '6 10', marginBottom: 10, backgroundColor: '#f5f8fc' },
  patGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 0 },
  patField:   { width: '33%', marginBottom: 7, paddingRight: 8 },
  patFieldW:  { width: '66%', marginBottom: 7, paddingRight: 8 },
  patLabel:   { fontSize: 7, color: '#888', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 },
  patLine:    { borderBottom: '0.75pt solid #999', paddingBottom: 2, fontSize: 9, color: '#222', minHeight: 12 },

  tblWrap:    { border: '1pt solid #c8d8eb', borderRadius: 3, overflow: 'hidden', marginBottom: 10 },
  tblHead:    { flexDirection: 'row', backgroundColor: '#1a3a6b', padding: '4 6' },
  tblHCell:   { color: '#fff', fontSize: 7.5, fontWeight: 700 },
  tblRow:     { flexDirection: 'row', padding: '5 6', borderTop: '0.5pt solid #e8eef5', alignItems: 'flex-start' },
  tblRowAlt:  { backgroundColor: '#f7f9fc' },
  tblCell:    { fontSize: 8.5, color: '#222', lineHeight: 1.3 },
  tblSub:     { fontSize: 7, color: '#777', marginTop: 1 },
  statusBadge: { fontSize: 6.5, padding: '1 4', borderRadius: 2, marginTop: 2 },

  notesBox:   { border: '1pt solid #e8d4a0', borderRadius: 3, backgroundColor: '#fffbf0', padding: '6 10', marginBottom: 10 },
  notesTitle: { fontSize: 8, fontWeight: 700, color: '#7a5000', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 },
  noteRow:    { flexDirection: 'row', marginBottom: 4, gap: 4 },
  noteBullet: { fontSize: 8, color: '#7a5000', width: 8, marginTop: 0.5 },
  noteText:   { flex: 1, fontSize: 8, color: '#4a3000', lineHeight: 1.4 },
  noteVax:    { fontWeight: 700 },

  provBlock:  { border: '1pt solid #d0d8e4', borderRadius: 3, padding: '8 10', backgroundColor: '#fafbfc', marginBottom: 10 },
  provTitle:  { fontSize: 7.5, fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  provGrid:   { flexDirection: 'row', gap: 0 },
  provField:  { flex: 1, marginRight: 12 },
  provLabel:  { fontSize: 7, color: '#888', marginBottom: 2 },
  provLine:   { borderBottom: '0.75pt solid #aaa', height: 14 },

  returnBox:  { border: '1pt solid #b0d8b0', borderRadius: 3, backgroundColor: '#f4fbf4', padding: '6 10', marginBottom: 10 },
  returnTitle: { fontSize: 7.5, fontWeight: 700, color: '#2e7d32', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 },
  returnRow:  { flexDirection: 'row', gap: 0, alignItems: 'center' },
  returnLabel: { fontSize: 8, color: '#4a6a4a', width: 90 },
  returnLine: { flex: 1, borderBottom: '0.75pt solid #aaa', height: 14 },

  disc:       { fontSize: 7, color: '#999', fontStyle: 'italic', lineHeight: 1.4, borderTop: '0.5pt solid #ddd', paddingTop: 6, marginTop: 4 },
  footer:     { position: 'absolute', bottom: 18, left: 40, right: 40, fontSize: 7, color: '#bbb', textAlign: 'center' },

  // Column widths
  cCheck:  { width: 20 },
  cVax:    { width: 115 },
  cDose:   { width: 65 },
  cBrand:  { flex: 1, minWidth: 90 },
  cLot:    { width: 75 },
  cRoute:  { width: 55 },
  cInit:   { width: 35 },
});

function fmtAm(m) {
  if (m < 12) return `${m} month${m !== 1 ? 's' : ''}`;
  const y = Math.floor(m / 12), mo = m % 12;
  return `${y} year${y !== 1 ? 's' : ''}` + (mo ? ` ${mo}m` : '');
}

function statusLabel(st) {
  if (st === 'due') return 'Routine';
  if (st === 'catchup') return 'Catch-up';
  if (st === 'risk-based') return 'Risk-based';
  if (st === 'recommended') return 'Shared decision';
  return st;
}

function statusColors(st) {
  if (st === 'due') return { bg: '#e6f7ef', fg: '#1a6b46' };
  if (st === 'catchup') return { bg: '#fdf5e6', fg: '#7a4e0d' };
  if (st === 'risk-based') return { bg: '#f5eef8', fg: '#4a235a' };
  if (st === 'recommended') return { bg: '#eaf3fb', fg: '#1a3a6b' };
  return { bg: '#f5f5f5', fg: '#555' };
}

const ROUTE = {
  HepB: 'IM', RSV: 'IM', RV: 'PO', DTaP: 'IM', Hib: 'IM', PCV: 'IM',
  PPSV23: 'IM/SC', IPV: 'SC/IM', Flu: 'IM', MMR: 'SC', VAR: 'SC',
  HepA: 'IM', Tdap: 'IM', HPV: 'IM', MenACWY: 'IM', MenB: 'IM', COVID: 'IM',
};

/**
 * @param {object} props
 * @param {number} props.am - patient age in months
 * @param {string} [props.dob] - ISO date
 * @param {object[]} props.recs - genRecs output for current visit
 * @param {object} props.fcBrands - selected brands { "visitM_vk": brand }
 * @param {string[]} props.risks
 */
export default function ShotListPDF({ am, dob, recs, fcBrands }) {
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const dobFmt = dob
    ? new Date(dob + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  const catchupNotes = recs.filter(r => r.status !== 'due' && r.note);

  return (
    <Document title={`PediVax Shot List — ${today}`} author="PediVax">
      <Page size="LETTER" style={s.page}>
        <Text style={s.logo}>PediVax — Clinical Immunization Planner</Text>
        <Text style={s.h1}>{"Today's Immunization Record"}</Text>
        <Text style={s.h1sub}>Visit Date: {today}</Text>

        {/* Patient info */}
        <View style={s.patBlock}>
          <View style={s.patGrid}>
            <View style={s.patFieldW}>
              <Text style={s.patLabel}>Patient Name</Text>
              <Text style={s.patLine}> </Text>
            </View>
            <View style={s.patField}>
              <Text style={s.patLabel}>MRN / Chart #</Text>
              <Text style={s.patLine}> </Text>
            </View>
            <View style={s.patField}>
              <Text style={s.patLabel}>Date of Birth</Text>
              <Text style={s.patLine}>{dobFmt}</Text>
            </View>
            <View style={s.patField}>
              <Text style={s.patLabel}>Age at Visit</Text>
              <Text style={s.patLine}>{fmtAm(am)}</Text>
            </View>
            <View style={s.patField}>
              <Text style={s.patLabel}>Insurance / VFC Eligibility</Text>
              <Text style={s.patLine}> </Text>
            </View>
          </View>
        </View>

        {/* Vaccine administration table */}
        <View style={s.tblWrap}>
          <View style={s.tblHead}>
            <Text style={[s.tblHCell, s.cCheck]}> </Text>
            <Text style={[s.tblHCell, s.cVax]}>Vaccine</Text>
            <Text style={[s.tblHCell, s.cDose]}>Dose</Text>
            <Text style={[s.tblHCell, s.cBrand]}>Brand / Product</Text>
            <Text style={[s.tblHCell, s.cLot]}>Lot # / Exp</Text>
            <Text style={[s.tblHCell, s.cRoute]}>Route / Site</Text>
            <Text style={[s.tblHCell, s.cInit]}>Init.</Text>
          </View>

          {recs.map((rec, i) => {
            const fcKey = `${am}_${rec.vk}`;
            const brand = fcBrands?.[fcKey] || '';
            const brandShort = brand ? brand.split(' (')[0] : '';
            const colors = statusColors(rec.status);
            const isAnnual = rec.vk === 'Flu' || rec.vk === 'COVID';
            const doseStr = isAnnual ? 'Annual' : rec.dose;

            return (
              <View key={rec.vk} style={[s.tblRow, i % 2 === 1 && s.tblRowAlt]}>
                <View style={[s.cCheck, { justifyContent: 'center' }]}>
                  <View style={{ width: 10, height: 10, border: '1pt solid #999', borderRadius: 2 }} />
                </View>
                <View style={s.cVax}>
                  <Text style={[s.tblCell, { fontWeight: 700 }]}>
                    {VAX_META[rec.vk]?.n || rec.vk}
                  </Text>
                  <Text style={[s.statusBadge, { backgroundColor: colors.bg, color: colors.fg }]}>
                    {statusLabel(rec.status)}
                  </Text>
                </View>
                <Text style={[s.tblCell, s.cDose]}>{doseStr}</Text>
                <View style={s.cBrand}>
                  {brandShort ? (
                    <Text style={[s.tblCell, { fontStyle: 'italic' }]}>{brandShort}</Text>
                  ) : (
                    <View style={{ borderBottom: '0.5pt solid #bbb', height: 12 }} />
                  )}
                </View>
                <View style={s.cLot}>
                  <View style={{ borderBottom: '0.5pt solid #bbb', height: 12, marginBottom: 3 }} />
                  <View style={{ borderBottom: '0.5pt solid #bbb', height: 12 }} />
                </View>
                <Text style={[s.tblCell, s.cRoute]}>{ROUTE[rec.vk] || 'IM'}</Text>
                <View style={[s.cInit]}>
                  <View style={{ borderBottom: '0.5pt solid #bbb', height: 14 }} />
                </View>
              </View>
            );
          })}
        </View>

        {/* Clinical notes for non-routine vaccines */}
        {catchupNotes.length > 0 && (
          <View style={s.notesBox}>
            <Text style={s.notesTitle}>Clinical Notes</Text>
            {catchupNotes.map(rec => (
              <View key={rec.vk} style={s.noteRow}>
                <Text style={s.noteBullet}>•</Text>
                <Text style={s.noteText}>
                  <Text style={s.noteVax}>{VAX_META[rec.vk]?.n || rec.vk} ({statusLabel(rec.status)}): </Text>
                  {rec.note}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Return visit */}
        <View style={s.returnBox}>
          <Text style={s.returnTitle}>Next Scheduled Visit</Text>
          <View style={[s.returnRow, { marginBottom: 5 }]}>
            <Text style={s.returnLabel}>Return date:</Text>
            <View style={s.returnLine} />
          </View>
          <View style={s.returnRow}>
            <Text style={s.returnLabel}>Vaccines due next:</Text>
            <View style={s.returnLine} />
          </View>
        </View>

        {/* Provider */}
        <View style={s.provBlock}>
          <Text style={s.provTitle}>Provider / Administering Clinician</Text>
          <View style={s.provGrid}>
            <View style={s.provField}>
              <Text style={s.provLabel}>Provider Name (print)</Text>
              <View style={s.provLine} />
            </View>
            <View style={s.provField}>
              <Text style={s.provLabel}>Signature</Text>
              <View style={s.provLine} />
            </View>
            <View style={[s.provField, { marginTop: 8 }]}>
              <Text style={s.provLabel}>NPI / License #</Text>
              <View style={s.provLine} />
            </View>
            <View style={[s.provField, { marginTop: 8 }]}>
              <Text style={s.provLabel}>Date</Text>
              <View style={s.provLine} />
            </View>
          </View>
        </View>

        <Text style={s.disc}>
          FOR CLINICAL USE ONLY — This document is generated by PediVax using ACIP/CDC recommendations.
          Always verify against the current CDC immunization schedule before administration.
          Clinician is responsible for confirming vaccine eligibility, contraindications, and VIS distribution.
        </Text>

        <Text style={s.footer}>
          PediVax · immunize.org / cdc.gov · {today}
        </Text>
      </Page>
    </Document>
  );
}
