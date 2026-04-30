#!/usr/bin/env python3
"""Spot-check the parsed CDSI JSON against known clinical facts."""
import json
from pathlib import Path

J = json.loads(Path("src/data/cdsi-4.6.json").read_text())
DA = J["diseaseAntigens"]

def find_series(disease, name_substring):
    for s in DA[disease]["series"]:
        if name_substring.lower() in (s["seriesName"] or "").lower() or name_substring.lower() in (s["sourceSheet"] or "").lower():
            return s
    return None

def find_vaccine(disease, series_name_substring, cvx_substring):
    s = find_series(disease, series_name_substring)
    if not s: return None
    for d in s["doses"]:
        for v in d["preferableVaccines"] + d["allowableVaccines"]:
            if cvx_substring.lower() in (v["cvx"] or "").lower():
                return (s["seriesName"], d["doseNumber"], v)
    return None

checks = []

# 1. Pertussis Standard dose 1 min = 42 days
s = find_series("Pertussis", "Standard")
d1 = s["doses"][0]
checks.append(("Pertussis Standard D1 minAge=42d", d1["age"]["minAgeDays"] == 42, d1["age"]["minAgeDays"]))

# 2. Pertussis dose vaccines: DTaP CVX (20) end age = 7 years
hit = find_vaccine("Pertussis", "Standard", "DTaP (20)")
checks.append(("Pertussis DTaP(20) endAge=7y/2555d", hit and hit[2]["endAgeDays"] == 7*365, hit[2] if hit else None))

# 3. HepB dose 1 min = 0 days
s = find_series("HepB", "3-dose")
d1 = s["doses"][0]
checks.append(("HepB 3-dose D1 minAge=0d", d1["age"]["minAgeDays"] == 0, d1["age"]["minAgeDays"]))

# 4. Meningococcal — find any series with min age to start at 11y (132 mo = 4015 d)
men = DA["Meningococcal"]["series"]
ages = [s["selectPatientSeries"]["minAgeToStartDays"] if s.get("selectPatientSeries") else None for s in men]
checks.append(("Meningococcal series include start ≥11y", any(a and a >= 11*365 for a in ages), ages))

# 5. MeningococcalB — at least one series starts at ≥10y
mb = DA["MeningococcalB"]["series"]
mb_ages = [s["selectPatientSeries"]["minAgeToStartDays"] if s.get("selectPatientSeries") else None for s in mb]
checks.append(("MeningococcalB series include start ≥10y", any(a and a >= 10*365 for a in mb_ages), mb_ages))

# 6. Pneumococcal 4-dose series exists with 4 doses, dose 1 min = 6 weeks (42d)
pcv4 = find_series("Pneumococcal", "4-dose")
checks.append(("Pneumococcal 4-dose has 4 doses", pcv4 and len(pcv4["doses"]) == 4, len(pcv4["doses"]) if pcv4 else None))
checks.append(("Pneumococcal 4-dose D1 minAge=42d", pcv4 and pcv4["doses"][0]["age"]["minAgeDays"] == 42, pcv4["doses"][0]["age"]["minAgeDays"] if pcv4 else None))

# 7. Pertussis — find Pentacel CVX = "DTaP-Hib-IPV (120)" or "DTaP-IPV-Hib-HepB (146)" — these have endAge = 5 years
pent = find_vaccine("Pertussis", "Standard", "DTaP-Hib-IPV (120)")
checks.append(("Pentacel(CVX 120) endAge=5y/1825d", pent and pent[2]["endAgeDays"] == 5*365, pent[2] if pent else None))

# 8. Polio dose count in Standard
pol = find_series("Polio", "Standard") or find_series("Polio", "4-dose")
if pol is None:
    # Look at first series
    pol = DA["Polio"]["series"][0]
checks.append(("Polio first series exists", pol is not None, pol["seriesName"] if pol else None))

# 9. Diphtheria & Tetanus have at least one Standard series each
checks.append(("Diphtheria Standard series", find_series("Diphtheria", "Standard") is not None, None))
checks.append(("Tetanus Standard series",    find_series("Tetanus", "Standard") is not None, None))

# Print results
print("=" * 70)
print("CDSI 4.6 PARSED-JSON SANITY CHECKS")
print("=" * 70)
passed = failed = 0
for label, ok, detail in checks:
    mark = "✓" if ok else "✗"
    print(f"  {mark} {label}")
    if not ok:
        print(f"     got: {detail}")
        failed += 1
    else:
        passed += 1
print(f"\n{passed}/{passed+failed} passed")
