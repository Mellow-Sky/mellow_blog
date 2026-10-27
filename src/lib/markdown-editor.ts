export type MarkdownCommand = 'bold' | 'italic' | 'strike' | 'heading' | 'quote' | 'code' | 'unordered-list' | 'ordered-list' | 'task-list' | 'table' | 'rule' | 'more' | 'link' | 'image';
export interface MarkdownEdit { text: string; start: number; end: number }
type Options = { url?: string; label?: string; language?: string };

function selection(text: string, start: number, end: number) {
  const clamp = (value: number) => Math.max(0, Math.min(text.length, Number.isFinite(value) ? Math.trunc(value) : 0));
  return [Math.min(clamp(start), clamp(end)), Math.max(clamp(start), clamp(end))] as const;
}
function replace(text: string, start: number, end: number, value: string, selectedStart = value.length, selectedEnd = selectedStart): MarkdownEdit {
  return { text: text.slice(0, start) + value + text.slice(end), start: start + selectedStart, end: start + selectedEnd };
}
function lineRange(text: string, start: number, end: number) {
  const from = start === 0 ? 0 : text.lastIndexOf('\n', start - 1) + 1;
  const until = end > start && text[end - 1] === '\n' ? end - 1 : end;
  const newline = text.indexOf('\n', until);
  return [from, newline === -1 ? text.length : newline] as const;
}
function block(text: string, start: number, end: number, value: string, from = value.length, until = from): MarkdownEdit {
  const before = text.slice(0, start), after = text.slice(end);
  const leading = !before || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
  const trailing = after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n';
  return replace(text, start, end, leading + value + trailing, leading.length + from, leading.length + until);
}
function inline(text: string, start: number, end: number, marker: string, placeholder: string): MarkdownEdit {
  const selected = text.slice(start, end);
  const simpleItalic = marker !== '*' || !selected.startsWith('**');
  if (selected.length >= marker.length * 2 && selected.startsWith(marker) && selected.endsWith(marker) && simpleItalic) {
    const unwrapped = selected.slice(marker.length, -marker.length);
    return replace(text, start, end, unwrapped, 0, unwrapped.length);
  }
  const surrounding = text.slice(start - marker.length, start) === marker && text.slice(end, end + marker.length) === marker;
  const italicInsideBold = marker === '*' && (text[start - 2] === '*' || text[end + 1] === '*');
  if (surrounding && !italicInsideBold) return replace(text, start - marker.length, end + marker.length, selected, 0, selected.length);
  const body = selected || placeholder;
  return replace(text, start, end, marker + body + marker, marker.length, marker.length + body.length);
}

export function isSafeEditorUrl(value: string, image = false): boolean {
  if (!value || value !== value.trim() || /[\\\u0000-\u001f\u007f]/.test(value)) return false;
  if (value.startsWith('/')) return !value.startsWith('//');
  if (value.startsWith('#')) return !image && value.length > 1;
  if (!image && /^mailto:/i.test(value)) return /^mailto:[^\s@?]+@[^\s@?]+\.[^\s@?]+$/i.test(value);
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !!url.hostname && !url.username && !url.password; }
  catch { return false; }
}
function escapeLabel(value: string) { return value.replace(/[\r\n]+/g, ' ').replace(/[\\`*_[\]<>|]/g, '\\$&'); }
function destination(value: string) { return value.replace(/[\s<>]/gu, character => encodeURIComponent(character)); }

export function markdownForMedia(media: { url: string; name: string; mime: string }): string {
  const image = media.mime.startsWith('image/');
  if (!isSafeEditorUrl(media.url, image)) return '';
  return `${image ? '!' : ''}[${escapeLabel(media.name || (image ? '图片描述' : '附件'))}](<${destination(media.url)}>)`;
}

export function applyMarkdownCommand(text: string, start: number, end: number, command: MarkdownCommand, options: Options = {}): MarkdownEdit {
  [start, end] = selection(text, start, end);
  const selected = text.slice(start, end);
  if (command === 'bold') return inline(text, start, end, '**', '加粗文字');
  if (command === 'italic') return inline(text, start, end, '*', '斜体文字');
  if (command === 'strike') return inline(text, start, end, '~~', '删除文字');
  if (command === 'link' || command === 'image') {
    const image = command === 'image';
    if (options.url && !isSafeEditorUrl(options.url, image)) return { text, start, end };
    const label = escapeLabel(options.label || selected || (image ? '图片描述' : '链接文字'));
    const opening = image ? '![' : '[';
    const value = `${opening}${label}](<${destination(options.url || 'https://')}>)`;
    return replace(text, start, end, value, opening.length, opening.length + label.length);
  }
  if (command === 'code') {
    const body = selected || '请输入代码';
    let fenceLength = 3;
    for (const match of body.matchAll(/`+/g)) fenceLength = Math.max(fenceLength, match[0].length + 1);
    const fence = '`'.repeat(fenceLength);
    const language = (options.language || '').replace(/[^a-zA-Z0-9_+#.-]/g, '').slice(0, 40);
    const opening = `${fence}${language}\n`;
    return block(text, start, end, `${opening}${body}\n${fence}`, opening.length, opening.length + body.length);
  }
  if (command === 'table') {
    const cell = (selected || '内容').replace(/\r?\n/g, ' ').replace(/\|/g, '\\|');
    return block(text, start, end, `| 标题 | 标题 |\n| --- | --- |\n| ${cell} | 内容 |`, 2, 4);
  }
  if (command === 'rule' || command === 'more') return block(text, start, end, command === 'rule' ? '---' : '<!--more-->');

  const [from, until] = lineRange(text, start, end);
  const original = text.slice(from, until);
  const lines = original.split('\n');
  const patterns: Record<string, RegExp> = {
    heading: /^([ \t]*)##[ \t]+/,
    quote: /^([ \t]*)>[ \t]?/,
    'unordered-list': /^([ \t]*)[-+*][ \t]+(?!\[[ xX]\][ \t]+)/,
    'ordered-list': /^([ \t]*)\d+[.)][ \t]+/,
    'task-list': /^([ \t]*)[-+*][ \t]+\[[ xX]\][ \t]+/,
  };
  const pattern = patterns[command];
  const remove = lines.some(line => !!line.trim()) && lines.every(line => !line.trim() || pattern.test(line));
  let firstPrefix = '';
  const value = lines.map((line, index) => {
    if (remove) return line.replace(pattern, '$1');
    const indentation = line.match(/^[ \t]*/)?.[0] || '';
    let body = line.slice(indentation.length);
    if (command === 'heading') body = body.replace(/^#{1,6}[ \t]+/, '');
    if (command.includes('list')) body = body.replace(/^(?:[-+*]|\d+[.)])[ \t]+(?:\[[ xX]\][ \t]+)?/, '');
    const prefix = command === 'heading' ? '## ' : command === 'quote' ? '> ' : command === 'ordered-list' ? `${index + 1}. ` : command === 'task-list' ? '- [ ] ' : '- ';
    if (index === 0) firstPrefix = indentation + prefix;
    return indentation + prefix + (body || (lines.length === 1 ? command === 'heading' ? '标题文字' : command === 'quote' ? '引用文字' : '列表项目' : ''));
  }).join('\n');
  return replace(text, from, until, value, !original.trim() ? firstPrefix.length : 0, value.length);
}

function insideCodeFence(text: string): boolean {
  let open: { marker: string; length: number } | null = null;
  for (const line of text.split('\n')) {
    const match = line.match(/^[ \t]{0,3}(`{3,}|~{3,})/);
    if (!match) continue;
    const marker = match[1][0], length = match[1].length;
    if (!open) open = { marker, length };
    else if (open.marker === marker && length >= open.length && !line.slice(match[0].length).trim()) open = null;
  }
  return !!open;
}

export function continueMarkdownList(text: string, start: number, end: number): MarkdownEdit | null {
  [start, end] = selection(text, start, end);
  if (start !== end || insideCodeFence(text.slice(0, start))) return null;
  const [from, until] = lineRange(text, start, end);
  const line = text.slice(from, until), before = text.slice(from, start);
  const quote = line.match(/^([ \t]*(?:>[ \t]?)+)(.*)$/);
  const quotePrefix = quote?.[1] || '';
  const listLine = quote ? quote[2] : line;
  const list = listLine.match(/^([ \t]*)([-+*]|\d+[.)])[ \t]+(\[[ xX]\][ \t]+)?(.*)$/);
  if (list) {
    const fullPrefix = line.length - list[4].length;
    if (before.length < fullPrefix) return null;
    if (!list[4].trim()) return replace(text, from, until, quotePrefix + list[1]);
    const number = Number.parseInt(list[2], 10);
    const marker = /^\d/.test(list[2]) ? `${Number.isSafeInteger(number) ? number + 1 : 1}${list[2].slice(-1)}` : list[2];
    const prefix = `${quotePrefix}${list[1]}${marker} ${list[3] ? '[ ] ' : ''}`;
    return replace(text, start, end, '\n' + prefix);
  }
  if (quote && before.length >= quote[1].length) {
    if (!quote[2].trim()) return replace(text, from, until, quote[1].replace(/>[ \t]?$/, ''));
    return replace(text, start, end, '\n' + quote[1]);
  }
  return null;
}

export function indentMarkdown(text: string, start: number, end: number, outdent = false): MarkdownEdit {
  [start, end] = selection(text, start, end);
  if (start === end && !outdent) return replace(text, start, end, '  ');
  const [from, until] = lineRange(text, start, end);
  const original = text.slice(from, until);
  const value = original.split('\n').map(line => outdent ? line.replace(/^(?:\t| {1,2})/, '') : '  ' + line).join('\n');
  if (start === end) return replace(text, from, until, value, Math.max(0, start - from - (original.length - value.length)));
  return replace(text, from, until, value, 0, value.length);
}
