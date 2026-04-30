#!/usr/bin/env python3
"""Parse the raw CDSI 4.6 dump into structured rules JSON.

Input:  src/data/cdsi-4.6-raw.json   (output of dump-cdsi-excel.py)
Output: src/data/cdsi-4.6.json       (structured, normalized, audit-ready)

CDSI organizes rules by DISEASE ANTIGEN (Pertussis, Diphtheria, Tetanus,
Pneumococcal, ...). The PediVax app reasons about VACCINE PRODUCTS (DTaP,
Tdap, Td, PCV, PPSV23, ...). DTaP covers Pertussis+Diphtheria+Tetanus, etc.
We export both: source-of-truth disease rules + a vaccineProducts mapping.

Numeric ages and intervals are kept BOTH as raw strings AND parsed to days
using documented conventions (1d, 1w=7d, 1mo=30d, 1y=365d).
"""

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "src" / "data" / "cdsi-4.6-raw.json"
OUT = ROOT / "src" / "data" / "cdsi-4.6.json"

META_SHEETS = {"Antigen Series Overview"}

# Source-of-truth: by disease antigen, no duplication.
DISEASE_FILES = {
    "Pertussis":      "AntigenSupportingData- Pertussis-508.xlsx",
    "Diphtheria":     "AntigenSupportingData- Diphtheria-508.xlsx",
    "Tetanus":        "AntigenSupportingData- Tetanus-508.xlsx",
    "Meningococcal":  "AntigenSupportingData- Meningococcal-508.xlsx",
    "MeningococcalB": "AntigenSupportingData- Meningococcal B-508.xlsx",
    "HepB":           "AntigenSupportingData- HepB-508.xlsx",
    "Polio":          "AntigenSupportingData- Polio-508.xlsx",
    "Hib":            "AntigenSupportingData- Hib-508.xlsx",
    "Pneumococcal":   "AntigenSupportingData- Pneumococcal-508.xlsx",
}

# How PediVax vaccine products map to CDSI disease antigens.
# `seriesFilter`: optional substring filter on series name to scope to a
# specific subset of the antigen's series sheets.
VACCINE_PRODUCTS = {
    "DTaP":    {"covers": ["Pertussis", "Diphtheria", "Tetanus"],
                "ageRange": "6w through 6y (≤83mo)",
                "notes": "Includes Daptacel, Infanrix, Pediarix, Pentacel, Vaxelis (≤6y); Kinrix, Quadracel (4–6y)."},
    "Tdap":    {"covers": ["Pertussis", "Diphtheria", "Tetanus"],
                "ageRange": "≥7y; routine adolescent at 11–12y; pregnancy each gestation",
                "notes": "Adacel, Boostrix."},
    "Td":      {"covers": ["Diphtheria", "Tetanus"],
                "ageRange": "≥7y; decennial booster every 10y after primary Tdap"},
    "MenACWY": {"covers": ["Meningococcal"],
                "ageRange": "Routine 11–12y, booster 16y; high-risk infant series ≥2mo",
                "notes": "Menveo, MenQuadfi, Penbraya (combo with MenB-FHbp), Penmenvy (combo with MenB-4C)."},
    "MenB":    {"covers": ["MeningococcalB"],
                "ageRange": "Shared decision 16–23y; high-risk ≥10y",
                "notes": "Bexsero/Penmenvy (4C), Trumenba/Penbraya (FHbp). Antigen families NOT interchangeable."},
    "HepB":    {"covers": ["HepB"],
                "ageRange": "Birth (within 24h) through 18y catch-up"},
    "IPV":     {"covers": ["Polio"],
                "ageRange": "2mo through 18y catch-up"},
    "Hib":     {"covers": ["Hib"],
                "ageRange": "2mo through 59mo (special cases beyond)"},
    "PCV":     {"covers": ["Pneumococcal"],
                "seriesFilter": "PCV",
                "ageRange": "2mo primary series; ≥2y high-risk; ≥19y adult schedules also included for reference"},
    "PPSV23":  {"covers": ["Pneumococcal"],
                "seriesFilter": "PPSV",
                "ageRange": "≥2y after PCV when PCV15/13 used; high-risk only"},
}

UNIT_DAYS = {"day": 1, "days": 1, "week": 7, "weeks": 7,
             "month": 30, "months": 30, "year": 365, "years": 365}
NA_VALUES = {"n/a", "N/A", "na", "", None}


def parse_duration(s):
    if s in NA_VALUES: return None
    if isinstance(s, (int, float)): return int(s)
    s = str(s).strip()
    pattern = re.compile(r"(?P<sign>[+-]?\s*)(?P<num>\d+)\s*(?P<unit>day|days|week|weeks|month|months|year|years)\b", re.I)
    matches = list(pattern.finditer(s))
    if not matches: return None
    total = 0
    for i, m in enumerate(matches):
        sign_raw = m.group("sign").replace(" ", "")
        sign = -1 if sign_raw == "-" else 1
        if i == 0 and sign_raw == "": sign = 1
        n = int(m.group("num"))
        u = m.group("unit").lower()
        total += sign * n * UNIT_DAYS[u]
    return total


def cell(row, idx):
    if idx < len(row):
        v = row[idx]
        if v in NA_VALUES: return None
        return v
    return None


def is_section_header(row, header):
    return len(row) >= 2 and row[0] == header and isinstance(row[1], str) and row[1].strip()


def extract_series(rows):
    series = {"seriesName": None, "targetDisease": None, "vaccineGroup": None,
              "administrativeGuidance": None, "seriesType": None,
              "selectPatientSeries": None, "indications": [], "doses": []}
    i = 0
    cur_dose = None
    while i < len(rows):
        r = rows[i]
        if not r: i += 1; continue
        tag = r[0]
        if tag == "Series Name" and len(r) >= 2 and r[1] != "Series Name":
            series["seriesName"] = r[1]
        elif tag == "Target Disease" and len(r) >= 2:
            series["targetDisease"] = cell(r, 1)
        elif tag == "Vaccine Group" and len(r) >= 2:
            series["vaccineGroup"] = cell(r, 1)
        elif tag == "Administrative Guidance" and len(r) >= 2 and r[1] != "Text":
            series["administrativeGuidance"] = cell(r, 1)
        elif tag == "Series Type" and len(r) >= 2 and r[1] != "Type":
            series["seriesType"] = cell(r, 1)
        elif tag == "Select Patient Series" and len(r) >= 9 and r[1] == "Default Series":
            if i + 1 < len(rows):
                dr = rows[i + 1]
                series["selectPatientSeries"] = {
                    "defaultSeries": cell(dr, 1), "productPath": cell(dr, 2),
                    "seriesGroupName": cell(dr, 3), "seriesGroup": cell(dr, 4),
                    "seriesPriority": cell(dr, 5), "seriesPreference": cell(dr, 6),
                    "minAgeToStart": cell(dr, 7), "minAgeToStartDays": parse_duration(cell(dr, 7)),
                    "maxAgeToStart": cell(dr, 8), "maxAgeToStartDays": parse_duration(cell(dr, 8))}
                i += 2; continue
        elif tag == "Indication" and len(r) >= 2 and r[1] == "Observation (Code)":
            j = i + 1
            while j < len(rows) and rows[j] and rows[j][0] == "Indication":
                dr = rows[j]
                if cell(dr, 1) is not None:
                    series["indications"].append({
                        "observationCode": cell(dr, 1), "description": cell(dr, 2),
                        "beginAge": cell(dr, 3), "beginAgeDays": parse_duration(cell(dr, 3)),
                        "endAge": cell(dr, 4), "endAgeDays": parse_duration(cell(dr, 4)),
                        "administrativeGuidance": cell(dr, 5)})
                j += 1
            i = j; continue
        elif tag == "Series Dose":
            cur_dose = {"doseNumber": cell(r, 1), "age": None,
                        "preferableIntervals": [], "allowableIntervals": [],
                        "preferableVaccines": [], "allowableVaccines": [],
                        "inadvertentVaccines": [], "conditionalSkips": [],
                        "recurringDose": None}
            series["doses"].append(cur_dose)
        elif tag == "Age" and is_section_header(r, "Age") and cur_dose is not None:
            if i + 1 < len(rows):
                dr = rows[i + 1]
                cur_dose["age"] = {
                    "absoluteMinAge": cell(dr, 1), "absoluteMinAgeDays": parse_duration(cell(dr, 1)),
                    "minAge": cell(dr, 2), "minAgeDays": parse_duration(cell(dr, 2)),
                    "earliestRecAge": cell(dr, 3), "earliestRecAgeDays": parse_duration(cell(dr, 3)),
                    "latestRecAge": cell(dr, 4), "latestRecAgeDays": parse_duration(cell(dr, 4)),
                    "maxAge": cell(dr, 5), "maxAgeDays": parse_duration(cell(dr, 5))}
                i += 2; continue
        elif tag == "Preferable Interval" and is_section_header(r, "Preferable Interval") and cur_dose is not None:
            j = i + 1
            while j < len(rows) and rows[j] and rows[j][0] == "Preferable Interval":
                dr = rows[j]
                if any(cell(dr, k) is not None for k in (1, 5, 6)):
                    cur_dose["preferableIntervals"].append({
                        "fromImmediatePrev": cell(dr, 1), "fromTargetDose": cell(dr, 2),
                        "fromMostRecentCVX": cell(dr, 3), "fromRelevantObs": cell(dr, 4),
                        "absoluteMinInterval": cell(dr, 5), "absoluteMinIntervalDays": parse_duration(cell(dr, 5)),
                        "minInterval": cell(dr, 6), "minIntervalDays": parse_duration(cell(dr, 6)),
                        "earliestRecInterval": cell(dr, 7), "earliestRecIntervalDays": parse_duration(cell(dr, 7)),
                        "latestRecInterval": cell(dr, 8), "latestRecIntervalDays": parse_duration(cell(dr, 8)),
                        "intervalPriorityFlag": cell(dr, 9)})
                j += 1
            i = j; continue
        elif tag == "Allowable Interval" and is_section_header(r, "Allowable Interval") and cur_dose is not None:
            j = i + 1
            while j < len(rows) and rows[j] and rows[j][0] == "Allowable Interval":
                dr = rows[j]
                if any(cell(dr, k) is not None for k in (1, 3)):
                    cur_dose["allowableIntervals"].append({
                        "fromImmediatePrev": cell(dr, 1), "fromTargetDose": cell(dr, 2),
                        "absoluteMinInterval": cell(dr, 3), "absoluteMinIntervalDays": parse_duration(cell(dr, 3))})
                j += 1
            i = j; continue
        elif tag == "Preferable Vaccine" and is_section_header(r, "Preferable Vaccine") and cur_dose is not None:
            j = i + 1
            while j < len(rows) and rows[j] and rows[j][0] == "Preferable Vaccine":
                dr = rows[j]
                if cell(dr, 1) is not None:
                    cur_dose["preferableVaccines"].append({
                        "cvx": cell(dr, 1), "beginAge": cell(dr, 2), "beginAgeDays": parse_duration(cell(dr, 2)),
                        "endAge": cell(dr, 3), "endAgeDays": parse_duration(cell(dr, 3)),
                        "tradeName": cell(dr, 4), "volumeMl": cell(dr, 5), "forecastVaccineType": cell(dr, 6)})
                j += 1
            i = j; continue
        elif tag == "Allowable Vaccine" and is_section_header(r, "Allowable Vaccine") and cur_dose is not None:
            j = i + 1
            while j < len(rows) and rows[j] and rows[j][0] == "Allowable Vaccine":
                dr = rows[j]
                if cell(dr, 1) is not None:
                    cur_dose["allowableVaccines"].append({
                        "cvx": cell(dr, 1), "beginAge": cell(dr, 2), "beginAgeDays": parse_duration(cell(dr, 2)),
                        "endAge": cell(dr, 3), "endAgeDays": parse_duration(cell(dr, 3))})
                j += 1
            i = j; continue
        elif tag == "Inadvertent Vaccine" and is_section_header(r, "Inadvertent Vaccine") and cur_dose is not None:
            j = i + 1
            while j < len(rows) and rows[j] and rows[j][0] == "Inadvertent Vaccine":
                dr = rows[j]
                if cell(dr, 1) is not None:
                    cur_dose["inadvertentVaccines"].append({"cvx": cell(dr, 1)})
                j += 1
            i = j; continue
        elif tag == "Conditional Skip" and is_section_header(r, "Conditional Skip") and cur_dose is not None:
            header = r
            j = i + 1
            while j < len(rows) and rows[j] and rows[j][0] == "Conditional Skip":
                dr = rows[j]
                if cell(dr, 1) is not None:
                    skip = {header[k]: cell(dr, k) for k in range(1, len(header))}
                    cur_dose["conditionalSkips"].append(skip)
                j += 1
            i = j; continue
        elif tag == "Recurring Dose" and len(r) >= 2 and r[1] != "Recurring Dose (Yes/No)" and cur_dose is not None:
            cur_dose["recurringDose"] = cell(r, 1)
        i += 1
    return series


def extract_contraindications(rows):
    out = []
    if not rows: return out
    header_idx = None
    for idx, r in enumerate(rows):
        if r and r[0] == "Antigen Contraindication" and len(r) >= 2 and isinstance(r[1], str) and "Code" in str(r[1]):
            header_idx = idx; break
    if header_idx is None: return out
    header = rows[header_idx]
    for r in rows[header_idx + 1:]:
        if not r or r[0] != "Antigen Contraindication": continue
        if cell(r, 1) is None: continue
        entry = {header[k]: cell(r, k) for k in range(1, len(header))}
        out.append(entry)
    return out


def extract_immunity(rows):
    out = []
    for r in rows:
        if not r: continue
        if r[0] in ("Clinical History Immunity", "Birth Date Immunity"):
            if len(r) >= 2 and r[1] not in ("Immunity Guideline", "Immunity Birth Date"):
                if any(cell(r, k) is not None for k in range(1, len(r))):
                    out.append({"type": r[0], "values": [cell(r, k) for k in range(1, len(r))]})
    return out


def main():
    raw = json.loads(RAW.read_text())

    # Build a workbook→{antigen: payload} index. Since some workbooks are
    # listed under multiple antigens in raw, we just need any one copy.
    workbook_lookup = {}
    for ant, payload in raw["antigens"].items():
        for fname, wb in payload["workbooks"].items():
            workbook_lookup.setdefault(fname, wb)

    out = {
        "version": "4.6",
        "extractedAt": "2026-04-27",
        "scope": {
            "vaccineProducts": list(VACCINE_PRODUCTS.keys()),
            "diseaseAntigens": list(DISEASE_FILES.keys()),
            "ageRange": "birth–18y primary; ≥19y series included where present (audit can filter)",
        },
        "conventions": {
            "ageUnits": "Durations: 1d, 1w=7d, 1mo=30d, 1y=365d (CDSI standard).",
            "graceWindow": "'- 4 days' in source = the 4-day grace period applied to absolute minimums.",
            "naSentinel": "'n/a' in source → null in JSON.",
            "structure": "Source-of-truth rules live under `diseaseAntigens` (CDSI's organization). The `vaccineProducts` map shows which disease antigens each PediVax vaccine product covers.",
        },
        "vaccineProducts": VACCINE_PRODUCTS,
        "diseaseAntigens": {},
        "extractionWarnings": [],
    }

    for disease, fname in DISEASE_FILES.items():
        wb = workbook_lookup.get(fname)
        if wb is None:
            out["extractionWarnings"].append({
                "disease": disease, "field": "sourceFile",
                "issue": "missing", "details": fname})
            continue
        d_entry = {
            "sourceFile": fname,
            "series": [],
            "contraindications": [],
            "immunity": [],
        }
        for sheet_name, rows in wb.items():
            if sheet_name in META_SHEETS: continue
            if sheet_name == "Contraindications":
                d_entry["contraindications"].extend(extract_contraindications(rows))
                continue
            if sheet_name == "Immunity":
                d_entry["immunity"].extend(extract_immunity(rows))
                continue
            if not rows or not rows[0] or rows[0][0] != "Series Name":
                continue
            series = extract_series(rows)
            series["sourceSheet"] = sheet_name
            d_entry["series"].append(series)
        out["diseaseAntigens"][disease] = d_entry

    # Schedule supporting data — preserve CVX maps for downstream resolution
    out["scheduleSupportingData"] = raw.get("scheduleSupportingData", {})

    OUT.write_text(json.dumps(out, indent=2, default=str))
    size_kb = OUT.stat().st_size / 1024
    print(f"Wrote {OUT} ({size_kb:.0f} KB)")
    print(f"Disease antigens: {len(out['diseaseAntigens'])}")
    for d, payload in out["diseaseAntigens"].items():
        n_series = len(payload["series"])
        n_doses = sum(len(s["doses"]) for s in payload["series"])
        n_contra = len(payload["contraindications"])
        print(f"  {d:18s} {n_series:3d} series, {n_doses:4d} doses, {n_contra:2d} contraindications")
    print(f"Vaccine products mapped: {len(out['vaccineProducts'])}")
    print(f"Extraction warnings: {len(out['extractionWarnings'])}")


if __name__ == "__main__":
    main()
