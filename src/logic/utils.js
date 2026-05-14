// ╔══════════════════════════════════════════════════════════════╗
// ║  UTILS — pure date/formatting helpers                       ║
// ╚══════════════════════════════════════════════════════════════╝

/** Days between two ISO date strings. Returns null if either is falsy. */
export const dBetween = (d1, d2) => {
  if (!d1 || !d2) return null;
  return Math.round((new Date(d2) - new Date(d1)) / 86400000);
};

/** Add n days to an ISO date string. Returns "" if d is falsy. */
export const addD = (d, n) => {
  if (!d) return "";
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r.toISOString().slice(0, 10);
};

/** Validate that s is a valid ISO date (YYYY-MM-DD). */
export const isD = s => !!(s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s)));

/** Format an ISO date string for display (e.g. "Jan 5, 2025"). */
export const fmtD = s => {
  if (!isD(s)) return s || "\u2014";
  return new Date(s + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

/** Format ISO date (YYYY-MM-DD) to MM/DD/YYYY for display in text input. */
export function fmtDateInput(iso) {
  if (!isD(iso)) return iso || "";
  const [y, m, d] = iso.split("-");
  return `${m}/${d}/${y}`;
}

/**
 * Compute the effective ISO date for a dose so doses can be sorted
 * chronologically regardless of input order. Returns "" if no date can be
 * derived (mode "unknown", empty date, age mode without dob, etc.).
 */
export function doseEffectiveDate(dose, dob) {
  if (!dose) return "";
  if (dose.mode === "date" && isD(dose.date)) return dose.date;
  if (dose.mode === "age" && dose.ageDays != null && isD(dob)) {
    return addD(dob, dose.ageDays);
  }
  return "";
}

/**
 * Return a chronologically sorted view of a dose array without mutating the
 * source. Each entry carries its `originalIndex` so callers can still dispatch
 * UPDATE_DOSE / REMOVE_DOSE against the correct underlying array slot
 * (preserves combo-vaccine cascade behavior which is index-based across vk's).
 * Doses with no derivable date (unknown mode, missing date) sort to the end
 * in original insertion order.
 */
export function sortDosesByDate(doses, dob) {
  return (doses || [])
    .map((dose, originalIndex) => ({ dose, originalIndex }))
    .sort((a, b) => {
      const da = doseEffectiveDate(a.dose, dob);
      const db = doseEffectiveDate(b.dose, dob);
      if (!da && !db) return a.originalIndex - b.originalIndex;
      if (!da) return 1;
      if (!db) return -1;
      return da.localeCompare(db);
    });
}

/** Parse user-entered date string (flexible: MM/DD/YYYY, M/D/YYYY, YYYY-MM-DD) to ISO YYYY-MM-DD. */
export function parseDateInput(s) {
  if (!s) return "";
  s = s.trim();
  // Already ISO format
  if (/^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s))) return s;
  // MM/DD/YYYY or M/D/YYYY
  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (slash) {
    const [, m, d, y] = slash;
    const iso = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    return isNaN(new Date(iso)) ? "" : iso;
  }
  // MM-DD-YYYY
  const dash = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(s);
  if (dash) {
    const [, m, d, y] = dash;
    const iso = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    return isNaN(new Date(iso)) ? "" : iso;
  }
  return "";
}
