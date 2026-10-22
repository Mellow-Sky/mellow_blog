import type { Post } from './types';

const htmlTags = new Set('a abbr address article aside audio b bdi bdo blockquote br button caption cite code col colgroup data dd del details dfn dialog div dl dt em fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 header hgroup hr i iframe img input ins kbd label legend li main mark menu nav noscript ol optgroup option p picture pre progress q rp rt ruby s samp script section select small source span strong style sub summary sup table tbody td template textarea tfoot th thead time title tr track u ul var video wbr'.split(' '));
const inlineHtmlTags = new Set('a abbr b bdi bdo cite code data del dfn em i ins kbd mark q rp rt ruby s samp small span strong sub sup time u var'.split(' '));
const normalizeReference = (value: string) => value.replace(/\\([\[\]\\])/g, '$1').trim().replace(/\s+/g, ' ').toLowerCase();

function withoutFencedCode(value: string) {
  let fence: { marker: string; size: number } | undefined;
  return value.split('\n').filter(line => {
    if (fence) {
      const close = line.match(/^ {0,3}(`+|~+)\s*$/);
      if (close && close[1][0] === fence.marker && close[1].length >= fence.size) fence = undefined;
      return false;
    }
    const open = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (open && !(open[1][0] === '`' && open[2].includes('`'))) {
      fence = { marker: open[1][0], size: open[1].length };
      return false;
    }
    return true;
  }).join('\n');
}

function bracketEnd(value: string, start: number) {
  let depth = 1;
  for (let index = start + 1; index < value.length; index++) {
    if (value[index] === '\\') { index++; continue; }
    if (value[index] === '[') depth++;
    else if (value[index] === ']' && --depth === 0) return index;
  }
  return -1;
}

function destinationEnd(value: string, start: number) {
  let depth = 1, quote = '', angle = false;
  for (let index = start + 1; index < value.length; index++) {
    const char = value[index];
    if (char === '\\') { index++; continue; }
    if (quote) { if (char === quote) quote = ''; continue; }
    if (angle) { if (char === '>') angle = false; continue; }
    if (char === '<') { angle = true; continue; }
    if ((char === '"' || char === "'") && /\s/.test(value[index - 1])) { quote = char; continue; }
    if (char === '(') depth++;
    else if (char === ')' && --depth === 0) return index;
  }
  return -1;
}

function tagEnd(value: string, start: number) {
  let quote = '';
  for (let index = start + 1; index < value.length; index++) {
    const char = value[index];
    if (quote) { if (char === quote) quote = ''; }
    else if (char === '"' || char === "'") quote = char;
    else if (char === '>') return index;
  }
  return -1;
}

function inlineText(value: string, references: Set<string>, protect: (value: string) => string): string {
  let result = '';
  for (let index = 0; index < value.length; index++) {
    if (value[index] === '\\' && /[!"#$%&'()*+,\-./:;<=>?@[\]\\^_`{|}~]/.test(value[index + 1] || '')) {
      result += protect(value[++index]);
      continue;
    }
    if (value[index] === '`') {
      const run = value.slice(index).match(/^`+/)![0];
      let end = index + run.length;
      while ((end = value.indexOf(run, end)) !== -1) {
        if (value[end - 1] !== '`' && value[end + run.length] !== '`') break;
        end += run.length;
      }
      if (end !== -1) {
        let code = value.slice(index + run.length, end).replace(/\n/g, ' ');
        if (/^ .+ $/.test(code) && /\S/.test(code)) code = code.slice(1, -1);
        result += protect(code);
        index = end + run.length - 1;
        continue;
      }
    }
    if (value.startsWith('<!--', index)) {
      const end = value.indexOf('-->', index + 4);
      index = end === -1 ? value.length : end + 2;
      result += ' ';
      continue;
    }
    if (value[index] === '<') {
      const tag = value.slice(index).match(/^<\/?([A-Za-z][\w:.-]*)(?=[\s/>])/);
      if (tag && (htmlTags.has(tag[1].toLowerCase()) || /^[A-Z]/.test(tag[1]))) {
        const end = tagEnd(value, index);
        if (end !== -1) {
          if (!value.startsWith('</', index) && /^(script|style|template)$/i.test(tag[1])) {
            const close = new RegExp(`</${tag[1]}\\s*>`, 'i').exec(value.slice(end + 1));
            index = close ? end + 1 + close.index + close[0].length - 1 : value.length;
          } else index = end;
          if (!inlineHtmlTags.has(tag[1].toLowerCase())) result += ' ';
          continue;
        }
      }
      const autoLink = value.slice(index).match(/^<(https?:\/\/[^\s<>]+|[^\s<>@]+@[^\s<>@]+)>/);
      if (autoLink) { result += autoLink[1]; index += autoLink[0].length - 1; continue; }
    }
    const image = value[index] === '!' && value[index + 1] === '[';
    const start = image ? index + 1 : index;
    if (value[start] === '[') {
      const close = bracketEnd(value, start);
      if (close !== -1) {
        const label = value.slice(start + 1, close);
        let end = -1;
        if (value[close + 1] === '(') end = destinationEnd(value, close + 1);
        else if (value[close + 1] === '[') {
          const referenceEnd = bracketEnd(value, close + 1);
          const reference = value.slice(close + 2, referenceEnd) || label;
          if (referenceEnd !== -1 && references.has(normalizeReference(reference))) end = referenceEnd;
        } else if (references.has(normalizeReference(label))) end = close;
        if (end !== -1) {
          result += image ? ' ' : inlineText(label, references, protect);
          index = end;
          continue;
        }
      }
    }
    result += value[index];
  }
  return result;
}

/** Plain reading text for previews; image descriptions and destinations are omitted together. */
export function cleanExcerpt(value: string) {
  let source = withoutFencedCode(value.replace(/\r\n?/g, '\n'));
  const references = new Set<string>();
  source = source.replace(/^ {0,3}\[([^\]\n]+)\]:[ \t]*(?:<[^>\n]+>|\S+)(?:[ \t]+(?:"[^"\n]*"|'[^'\n]*'|\([^\n]*\)))?[ \t]*$/gm, (_, label: string) => {
    references.add(normalizeReference(label));
    return '';
  });
  // Keep literal inline code and escaped punctuation out of formatting cleanup.
  let marker = '\uE000';
  while (source.includes(marker)) marker += '\uE000';
  const literals: string[] = [];
  const protect = (text: string) => `${marker}${literals.push(text) - 1}\uE001`;
  source = inlineText(source, references, protect)
    .replace(/^ {0,3}#{1,6}[ \t]+(.*)$/gm, (_, heading: string) => heading.replace(/[ \t]+#+[ \t]*$/, ''))
    .replace(/^ {0,3}>[ \t]?/gm, '')
    .replace(/^ {0,3}(?:[-+*]|\d+[.)])[ \t]+/gm, '')
    .replace(/^ {0,3}(?:(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,}|=+|\|?[ \t]*:?-{3,}:?(?:[ \t]*\|[ \t]*:?-{3,}:?)*[ \t]*\|?)[ \t]*$/gm, ' ')
    .replace(/(\*\*|__|~~)(?=\S)([\s\S]*?\S)\1/g, '$2')
    .replace(/(?<![\p{L}\p{N}])([*_])(?=\S)([^\n]*?\S)\1(?![\p{L}\p{N}])/gu, '$2')
    .replace(/&(?:amp|lt|gt|quot|apos|nbsp|#\d+|#x[\da-f]+);/gi, entity => {
      const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
      const code = entity.slice(1, -1).toLowerCase();
      if (named[code]) return named[code];
      const number = code[1] === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1));
      return number > 0 && number <= 0x10ffff ? String.fromCodePoint(number) : entity;
    });
  source = source.replace(new RegExp(`${marker}(\\d+)\uE001`, 'g'), (_, index: string) => literals[Number(index)]);
  return source.replace(/\s+/g, ' ').trim();
}

// Match the migration script exactly, including its 180 Unicode-character limit.
// This recognizes generated previews without guessing from filenames or editing stored text.
function legacyGeneratedExcerpt(content: string) {
  const text = content.replace(/```[\s\S]*?```/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]*>|[#>*_`~]/g, ' ')
    .replace(/\s+/g, ' ').trim();
  return Array.from(text).slice(0, 180).join('');
}

/** Respect authored summaries and regenerate only an exact match for an old automatic preview. */
export function postExcerpt(post: Pick<Post, 'excerpt' | 'content'>) {
  const automatic = post.excerpt && post.excerpt === legacyGeneratedExcerpt(post.content);
  return cleanExcerpt(automatic || !post.excerpt.trim() ? post.content : post.excerpt);
}
