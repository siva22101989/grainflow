/**
 * One-time loader for the Inter TTF fonts used in our PDFs.
 *
 * jsPDF only ships Helvetica/Times/Courier with WinAnsi encoding, which
 * cannot render the rupee glyph (₹), proper Unicode hyphens, smart
 * arrows, etc. Embedding Inter TTF gives us full Unicode coverage and
 * modern typography in one font family.
 *
 * Fonts are served from /public/fonts/Inter-Regular.ttf and
 * /public/fonts/Inter-Bold.ttf. Fetched once per session, base64-encoded
 * lazily, then attached to the jsPDF document via addFileToVFS + addFont.
 *
 * After ensurePdfFonts(doc) returns, you can call doc.setFont('Inter',
 * 'normal' | 'bold').
 */

let cached: { regular: string; bold: string } | null = null;

async function fetchAsBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
  const buf = await res.arrayBuffer();
  // Convert ArrayBuffer -> base64 without blowing the stack on large files
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return typeof btoa === 'function' ? btoa(binary) : Buffer.from(binary, 'binary').toString('base64');
}

async function getFontsBase64(): Promise<{ regular: string; bold: string }> {
  if (cached) return cached;
  const [regular, bold] = await Promise.all([
    fetchAsBase64('/fonts/Inter-Regular.ttf'),
    fetchAsBase64('/fonts/Inter-Bold.ttf'),
  ]);
  cached = { regular, bold };
  return cached;
}

/**
 * Registers Inter Regular + Bold on the given jsPDF document.
 * After this resolves, the document can use doc.setFont('Inter', 'normal' | 'bold').
 *
 * Throws if the fonts fail to load (offline, 404). Caller should fall back
 * to the built-in Helvetica family in that case.
 */
export async function ensurePdfFonts(doc: any): Promise<void> {
  const { regular, bold } = await getFontsBase64();
  doc.addFileToVFS('Inter-Regular.ttf', regular);
  doc.addFileToVFS('Inter-Bold.ttf', bold);
  doc.addFont('Inter-Regular.ttf', 'Inter', 'normal');
  doc.addFont('Inter-Bold.ttf', 'Inter', 'bold');
}
