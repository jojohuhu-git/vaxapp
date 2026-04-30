// Loads CDSI golden cases for an antigen.
//
// File shape: src/data/cdsi-cases/<antigen>.cases.json
// {
//   "antigen": "DTaP",
//   "cdsiVersion": "4.6",
//   "cases": [
//     {
//       "id": "DTAP-001",
//       "description": "60mo, 4 doses, no risks → no DTaP rec (series complete)",
//       "patient": { "ageMonths": 60, "dosesGiven": {"DTaP": 4}, "riskConditions": [] },
//       "expect": {
//         "rec": { "vk": "DTaP", "absent": true }
//       }
//     }
//   ]
// }
//
// Each case is run by the corresponding antigen test file. The audit script
// (Part 3 of the plan) appends new cases here when CDSI rule violations are
// detected.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CASES_DIR = resolve(__dirname, '../../../data/cdsi-cases');

export function loadCases(antigen) {
  const file = resolve(CASES_DIR, `${antigen.toLowerCase()}.cases.json`);
  if (!existsSync(file)) return [];
  const raw = JSON.parse(readFileSync(file, 'utf8'));
  return raw.cases || [];
}
