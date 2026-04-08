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
