/**
 * Next.js 16.4 encodes dynamic Page params, while generateMetadata receives
 * the original values. Decode only Page params, once, before database lookup.
 * Repeated decoding would change a literal slug such as "notes%20today".
 */
export function decodePageSlug(value: string): string {
  try { return decodeURIComponent(value); }
  catch { return value; }
}
