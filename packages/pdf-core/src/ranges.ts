/** Page-range parsing. All user-facing page numbers are 1-based; returned indices are 0-based. */

const normalise = (value: string) => value.replace(/[\u2012-\u2015\u2212]/g, "-");

/** Parse selections such as "1-3,5,8-9" into unique, ascending, zero-based indices. */
export function parsePageRanges(input: string, pageCount: number): number[] {
  if (!Number.isInteger(pageCount) || pageCount < 1) throw new Error("The PDF has no pages.");
  const value = normalise(input).trim();
  if (!value) throw new Error("Enter page numbers, for example 1-3,5.");

  const selected = new Set<number>();
  for (const token of value.split(",").map((part) => part.trim()).filter(Boolean)) {
    const match = token.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) throw new Error(`Invalid page range: "${token}". Use a format such as 1-3,5.`);
    const start = Number(match[1]);
    const end = Number(match[2] ?? match[1]);
    if (start < 1 || end < start || end > pageCount) {
      throw new Error(`Page range "${token}" is outside this document (1-${pageCount}).`);
    }
    for (let page = start; page <= end; page++) selected.add(page - 1);
  }
  return [...selected].sort((a, b) => a - b);
}

/** Like parsePageRanges, but an empty value or "all" selects every page. */
export function resolvePages(input: string, pageCount: number): number[] {
  const value = input.trim().toLowerCase();
  if (!value || value === "all") return Array.from({ length: pageCount }, (_, index) => index);
  return parsePageRanges(input, pageCount);
}

/**
 * Split "1-2;3-5;6" into output groups. Semicolons or new lines separate output files;
 * commas inside a group pick pages within that file ("1,3;2,4-5"). A comma-only
 * value such as "1-2,3-5" is still treated as one group per token for backwards compatibility.
 */
export function parseSplitGroups(input: string): string[] {
  const value = normalise(input).trim();
  const separator = /[;\n]/.test(value) ? /[;\n]/ : /,/;
  return value.split(separator).map((part) => part.trim()).filter(Boolean);
}
