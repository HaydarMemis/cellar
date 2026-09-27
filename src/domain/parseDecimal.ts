/**
 * Parses user-entered decimal text into a number, accepting either a period
 * or a comma as the decimal separator — some locales' number keyboards
 * (Turkish included) insert a comma, which `Number()` alone would silently
 * read as NaN. Returns null for anything unparseable (including empty
 * input) so callers can fall back cleanly instead of persisting NaN.
 */
export function parseDecimal(text: string): number | null {
  const trimmed = text.trim();
  if (!trimmed) return null; // Number('') is 0, not NaN — treat blank input as "not provided", not zero.
  const value = Number(trimmed.replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}
