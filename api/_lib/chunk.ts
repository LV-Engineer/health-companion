const DEFAULT_SIZE = 1200;
const DEFAULT_OVERLAP = 150;

// Split text into overlapping windows so a sentence cut at a boundary still appears whole in a neighbour.
export function chunkText(text: string, size = DEFAULT_SIZE, overlap = DEFAULT_OVERLAP): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];

  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    chunks.push(clean.slice(start, start + size));
    if (start + size >= clean.length) break;
    start += size - overlap;
  }
  return chunks;
}
