function isReadableUnicode(character: string) {
  return character.codePointAt(0)! > 0x7f && !/[\p{C}\p{Z}]/u.test(character);
}

/** Keep Chinese readable without turning reserved characters into URL syntax. */
export function encodePathSegment(value: string): string {
  return Array.from(value.toWellFormed(), character => isReadableUnicode(character) ? character : encodeURIComponent(character)).join('');
}

/** Decode only non-ASCII UTF-8; leave escapes such as %20, %25 and %2F intact. */
export function toReadableUrl(value: string): string {
  return value.replace(/(?:%[89a-f][\da-f])+/gi, encoded => {
    try { return encodePathSegment(decodeURIComponent(encoded)); }
    catch { return encoded; }
  });
}

export function isCurrentSitePath(pathname: string, href: string): boolean {
  if (!href.startsWith('/') || href.startsWith('//')) return false;
  const origin = 'https://blog.invalid';
  try {
    const target = new URL(href, origin);
    return target.origin === origin && toReadableUrl(new URL(pathname, origin).pathname) === toReadableUrl(target.pathname);
  } catch { return false; }
}
