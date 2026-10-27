/** Remove editor summary markers from MDX without changing fenced code examples. */
export function withoutSummaryMarkers(source: string): string {
  let fence: { marker: string; length: number } | null = null;
  return source.split('\n').map(line => {
    const match = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (fence) {
      if (match && match[1][0] === fence.marker && match[1].length >= fence.length && !match[2].trim()) fence = null;
      return line;
    }
    if (match && !(match[1][0] === '`' && match[2].includes('`'))) {
      fence = { marker: match[1][0], length: match[1].length };
      return line;
    }
    return /^ {0,3}<!--more-->[ \t\r]*$/.test(line) ? '' : line;
  }).join('\n');
}
