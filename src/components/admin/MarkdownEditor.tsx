'use client';

import dynamic from 'next/dynamic';
import { useEffect, useId, useMemo, useRef, useState, type ClipboardEvent, type DragEvent, type KeyboardEvent, type ReactNode } from 'react';
import { Bold, Braces, CheckSquare, ChevronDown, Code2, Columns2, Eye, FileText, Heading2, HelpCircle, ImagePlus, Italic, Link2, List, ListOrdered, LoaderCircle, Maximize2, Minimize2, Minus, Paperclip, Quote, Redo2, Save, Search, Strikethrough, Table2, Undo2, UploadCloud, X } from 'lucide-react';
import type { Media } from '@/lib/types';
import { applyMarkdownCommand, continueMarkdownList, indentMarkdown, isSafeEditorUrl, markdownForMedia, type MarkdownCommand, type MarkdownEdit } from '@/lib/markdown-editor';
import { adminApi } from './api';
import styles from './MarkdownEditor.module.css';

const MarkdownPreview = dynamic(() => import('./MarkdownPreview'), { loading: () => <p className="admin-muted">正在准备预览…</p> });
type Props = {
  value: string;
  onChange: (value: string) => void;
  format: 'markdown' | 'mdx';
  onFormatChange: (format: 'markdown' | 'mdx') => void;
  media: Media[];
  disabled?: boolean;
  onSave: () => void;
  onUploadStateChange?: (uploading: boolean) => void;
};
type Mode = 'write' | 'split' | 'preview';
type Dialog = 'link' | 'image' | 'media' | 'help' | null;
type Snapshot = MarkdownEdit;
const acceptedFiles = 'image/jpeg,image/png,image/webp,image/gif,image/avif,audio/mpeg,audio/ogg,audio/wav';
const commands: { command: MarkdownCommand; label: string; shortcut?: string; icon: typeof Bold }[] = [
  { command: 'bold', label: '加粗', shortcut: 'Ctrl / ⌘ B', icon: Bold },
  { command: 'italic', label: '斜体', shortcut: 'Ctrl / ⌘ I', icon: Italic },
  { command: 'strike', label: '删除线', icon: Strikethrough },
  { command: 'heading', label: '标题', shortcut: 'Ctrl / ⌘ H', icon: Heading2 },
  { command: 'quote', label: '引用', shortcut: 'Ctrl / ⌘ Q', icon: Quote },
  { command: 'code', label: '代码块', shortcut: 'Ctrl / ⌘ K', icon: Code2 },
  { command: 'unordered-list', label: '无序列表', shortcut: 'Ctrl / ⌘ U', icon: List },
  { command: 'ordered-list', label: '有序列表', shortcut: 'Ctrl / ⌘ O', icon: ListOrdered },
  { command: 'task-list', label: '任务列表', icon: CheckSquare },
  { command: 'table', label: '表格', icon: Table2 },
  { command: 'rule', label: '分割线', shortcut: 'Ctrl / ⌘ R', icon: Minus },
  { command: 'more', label: '摘要分割线', shortcut: 'Ctrl / ⌘ M', icon: Braces },
];

function Thumbnail({ item }: { item: Media }) {
  const [failed, setFailed] = useState(false);
  return item.mime.startsWith('image/') && !failed
    ? <img src={item.url} alt="" loading="lazy" onError={() => setFailed(true)} />
    : <FileText size={30} aria-hidden="true" />;
}

/** A tracked insertion anchor follows text edits while a file is uploading. */
function moveAnchor(before: string, after: string, anchor: number) {
  let prefix = 0;
  while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) prefix++;
  let suffix = 0;
  while (suffix < before.length - prefix && suffix < after.length - prefix && before[before.length - 1 - suffix] === after[after.length - 1 - suffix]) suffix++;
  if (anchor <= prefix) return anchor;
  if (anchor >= before.length - suffix) return anchor + after.length - before.length;
  return after.length - suffix;
}

export default function MarkdownEditor({ value, onChange, format, onFormatChange, media, disabled = false, onSave, onUploadStateChange }: Props) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const firstTool = useRef<HTMLButtonElement>(null);
  const dialogElement = useRef<HTMLDialogElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const selection = useRef({ start: 0, end: 0 });
  const valueRef = useRef(value);
  const history = useRef<{ past: Snapshot[]; future: Snapshot[] }>({ past: [], future: [] });
  const lastTyping = useRef({ at: 0, kind: '' });
  const uploadAnchor = useRef<number | null>(null);
  const uploadLock = useRef(false);
  const mounted = useRef(true);
  const callbacks = useRef({ onChange, onUploadStateChange });
  callbacks.current = { onChange, onUploadStateChange };
  const [historyVersion, setHistoryVersion] = useState(0);
  const [mode, setMode] = useState<Mode>('write');
  const [fullscreen, setFullscreen] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [dialogError, setDialogError] = useState('');
  const [uploading, setUploading] = useState('');
  const [uploaded, setUploaded] = useState<Media[]>([]);
  const [dragging, setDragging] = useState(false);
  const titleId = useId();
  const editorId = useId();
  const hintId = useId();
  const imagesOnly = dialog === 'image';
  const allMedia = useMemo(() => [...uploaded.filter(item => !media.some(existing => existing.id === item.id)), ...media], [uploaded, media]);
  const filteredMedia = allMedia.filter(item => (!imagesOnly || item.mime.startsWith('image/')) && `${item.name} ${item.mime}`.toLowerCase().includes(query.toLowerCase()));
  const canUndo = history.current.past.length > 0;
  const canRedo = history.current.future.length > 0;
  void historyVersion;

  useEffect(() => {
    if (value !== valueRef.current) {
      valueRef.current = value;
      history.current = { past: [], future: [] };
      selection.current = { start: 0, end: 0 };
      if (uploadAnchor.current !== null) uploadAnchor.current = Math.min(uploadAnchor.current, value.length);
      setHistoryVersion(version => version + 1);
    }
  }, [value]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; callbacks.current.onUploadStateChange?.(false); };
  }, []);
  useEffect(() => {
    if (!fullscreen) return;
    const previous = document.body.style.overflow;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = 'hidden';
    (textarea.current || container.current)?.focus({ preventScroll: true });
    return () => { document.body.style.overflow = previous; previousFocus?.focus({ preventScroll: true }); };
  }, [fullscreen]);
  useEffect(() => {
    const element = dialogElement.current;
    if (dialog && element && !element.open) element.showModal();
  }, [dialog]);

  function captureSelection() {
    if (textarea.current) selection.current = { start: textarea.current.selectionStart, end: textarea.current.selectionEnd };
    return selection.current;
  }
  function focusSelection(start = selection.current.start, end = selection.current.end) {
    selection.current = { start, end };
    requestAnimationFrame(() => {
      const element = textarea.current;
      if (!element || !mounted.current) return;
      element.focus({ preventScroll: true });
      element.setSelectionRange(start, end);
    });
  }
  function snapshot(): Snapshot { return { text: valueRef.current, ...selection.current }; }
  function change(edit: MarkdownEdit, typingKind = '') {
    if (disabled) return;
    if (edit.text === valueRef.current) { focusSelection(edit.start, edit.end); return; }
    const before = snapshot();
    const grouped = typingKind && typingKind === lastTyping.current.kind && Date.now() - lastTyping.current.at < 700;
    if (!grouped) history.current.past = [...history.current.past, before].slice(-60);
    history.current.future = [];
    lastTyping.current = { at: Date.now(), kind: typingKind };
    if (uploadAnchor.current !== null) uploadAnchor.current = moveAnchor(valueRef.current, edit.text, uploadAnchor.current);
    valueRef.current = edit.text;
    selection.current = { start: edit.start, end: edit.end };
    callbacks.current.onChange(edit.text);
    setHistoryVersion(version => version + 1);
    if (!typingKind) focusSelection(edit.start, edit.end);
  }
  function travel(direction: 'undo' | 'redo') {
    if (disabled) return;
    captureSelection();
    const source = direction === 'undo' ? history.current.past : history.current.future;
    const destination = direction === 'undo' ? history.current.future : history.current.past;
    const previous = source.pop();
    if (!previous) return;
    destination.push(snapshot());
    if (uploadAnchor.current !== null) uploadAnchor.current = moveAnchor(valueRef.current, previous.text, uploadAnchor.current);
    valueRef.current = previous.text;
    lastTyping.current = { at: 0, kind: '' };
    callbacks.current.onChange(previous.text);
    setHistoryVersion(version => version + 1);
    focusSelection(previous.start, previous.end);
  }
  function command(commandName: MarkdownCommand, options?: { url?: string; label?: string; language?: string }) {
    if (disabled) return;
    setMode(current => current === 'preview' ? 'write' : current);
    const range = selection.current;
    change(applyMarkdownCommand(valueRef.current, range.start, range.end, commandName, options));
  }
  function openDialog(next: Exclude<Dialog, null>) {
    captureSelection(); setDialogError(''); setQuery(''); setUrl('');
    setDescription(valueRef.current.slice(selection.current.start, selection.current.end));
    setDialog(next);
  }
  function closeDialog() {
    dialogElement.current?.close(); setDialog(null); setDialogError('');
    if (mode !== 'preview') focusSelection();
  }
  function insertUrl() {
    const image = dialog === 'image';
    const address = url.trim();
    if (!isSafeEditorUrl(address, image)) { setDialogError(image ? '请填写 HTTP(S) 图片地址或本站图片路径。' : '请填写 HTTP(S) 地址、本站路径、锚点或邮件地址。'); return; }
    command(image ? 'image' : 'link', { url: address, label: description.trim() || (image ? '图片描述' : '链接文字') });
    closeDialog();
  }
  function insertMedia(item: Media) {
    try {
      const markdown = markdownForMedia(item);
      if (!markdown) throw new Error('Unsupported media URL');
      const { start, end } = selection.current;
      change({ text: valueRef.current.slice(0, start) + markdown + valueRef.current.slice(end), start: start + markdown.length, end: start + markdown.length });
      setMode(current => current === 'preview' ? 'write' : current);
      closeDialog();
    } catch { setDialogError('此媒体地址无法插入，请选择其他文件。'); }
  }

  async function uploadFiles(files: File[]) {
    if (!files.length || disabled || uploadLock.current) return;
    captureSelection();
    uploadAnchor.current = selection.current.end;
    uploadLock.current = true;
    callbacks.current.onUploadStateChange?.(true);
    setError('');
    if (dialog) closeDialog();
    const failures: string[] = [];
    try {
      for (let index = 0; index < files.length; index++) {
        const file = files[index];
        if (!mounted.current) return;
        setUploading(`正在上传 ${index + 1}/${files.length}：${file.name}`);
        if (file.size > 20 * 1024 * 1024) { failures.push(`${file.name} 超过 20 MB`); continue; }
        try {
          const form = new FormData(); form.append('file', file);
          const result = await adminApi<{ media: Media }>('/api/admin/media', 'POST', form);
          if (!mounted.current) return;
          setUploaded(current => [result.media, ...current]);
          const markdown = markdownForMedia(result.media);
          if (!markdown) throw new Error('文件地址无法安全插入');
          const position = Math.min(uploadAnchor.current ?? valueRef.current.length, valueRef.current.length);
          const before = valueRef.current.slice(0, position), after = valueRef.current.slice(position);
          const inserted = `${before && !before.endsWith('\n\n') ? '\n\n' : ''}${markdown}\n\n`;
          // Uploaded files append at the tracked insertion point, leaving any
          // text typed during the network request intact.
          change({ text: before + inserted + after, start: position + inserted.length, end: position + inserted.length });
          uploadAnchor.current = position + inserted.length;
          setMode(current => current === 'preview' ? 'write' : current);
        } catch (reason) { failures.push(`${file.name}：${reason instanceof Error ? reason.message : '上传失败'}`); }
      }
    } finally {
      uploadLock.current = false; uploadAnchor.current = null;
      if (mounted.current) { setUploading(''); setError(failures.join('；')); callbacks.current.onUploadStateChange?.(false); }
    }
  }

  function paste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(event.clipboardData.items).filter(item => item.kind === 'file' && item.type.startsWith('image/')).map(item => item.getAsFile()).filter((file): file is File => Boolean(file));
    if (files.length) { event.preventDefault(); void uploadFiles(files); }
  }
  function drop(event: DragEvent<HTMLTextAreaElement>) {
    setDragging(false);
    if (!event.dataTransfer.files.length) return;
    event.preventDefault(); void uploadFiles(Array.from(event.dataTransfer.files));
  }
  function keydown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing || disabled) return;
    captureSelection();
    const key = event.key.toLowerCase();
    if (event.ctrlKey || event.metaKey) {
      const shortcut: Partial<Record<string, MarkdownCommand>> = { b: 'bold', i: 'italic', k: 'code', q: 'quote', u: 'unordered-list', o: 'ordered-list', h: 'heading', r: 'rule', m: 'more' };
      if (key === 'z' || key === 'y') { event.preventDefault(); event.stopPropagation(); travel(key === 'y' || event.shiftKey ? 'redo' : 'undo'); }
      else if (key === 'l') { event.preventDefault(); event.stopPropagation(); openDialog('link'); }
      else if (key === 'g') { event.preventDefault(); event.stopPropagation(); openDialog('image'); }
      else if (key === 'j') { event.preventDefault(); event.stopPropagation(); setFullscreen(current => !current); }
      else if (shortcut[key]) { event.preventDefault(); event.stopPropagation(); command(shortcut[key]!); }
      return;
    }
    if (event.key === 'Tab') { event.preventDefault(); change(indentMarkdown(valueRef.current, selection.current.start, selection.current.end, event.shiftKey)); }
    if (event.key === 'Enter' && !event.shiftKey) {
      const edit = continueMarkdownList(valueRef.current, selection.current.start, selection.current.end);
      if (edit) { event.preventDefault(); change(edit); }
    }
    if (event.key === 'Escape' && !fullscreen) { event.preventDefault(); firstTool.current?.focus(); }
  }
  function synchronizeScroll(source: HTMLElement, target: HTMLElement | null) {
    if (mode !== 'split' || !target) return;
    const distance = source.scrollHeight - source.clientHeight;
    target.scrollTop = distance > 0 ? source.scrollTop / distance * (target.scrollHeight - target.clientHeight) : 0;
  }
  const preview = useRef<HTMLDivElement>(null);
  const shortcutHint = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';
  function tool(label: string, icon: ReactNode, action: () => void, shortcut?: string, blocked = false, first = false) {
    return <button ref={first ? firstTool : undefined} type="button" className={styles.tool} aria-label={label} title={shortcut ? `${label} (${shortcut})` : label} disabled={disabled || blocked} onMouseDown={event => event.preventDefault()} onClick={action}>{icon}</button>;
  }

  return <div ref={container} tabIndex={-1} role={fullscreen ? 'dialog' : undefined} aria-modal={fullscreen || undefined} aria-label={fullscreen ? '全屏写作编辑器' : undefined} className={`${styles.editor} ${fullscreen ? styles.fullscreen : ''}`} onKeyDown={event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's' && !dialog) { event.preventDefault(); event.stopPropagation(); if (!disabled && !uploadLock.current) onSave(); }
    if (event.key === 'Escape' && fullscreen && !dialog) { event.preventDefault(); setFullscreen(false); }
    if (event.key === 'Tab' && fullscreen && !dialog && !event.defaultPrevented) {
      const controls = Array.from(container.current?.querySelectorAll<HTMLElement>('button:not(:disabled), select:not(:disabled), textarea:not(:disabled), input:not(:disabled), a[href]') || []).filter(element => element.getClientRects().length > 0);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  }}>
    <div className={styles.topbar}>
      <div className={styles.modes} role="group" aria-label="编辑器视图">
        {([{ value: 'write', label: '编辑', icon: FileText }, { value: 'split', label: '分栏预览', icon: Columns2 }, { value: 'preview', label: '预览', icon: Eye }] as const).map(item => <button type="button" key={item.value} aria-pressed={mode === item.value} onClick={() => setMode(item.value)}><item.icon size={15} aria-hidden="true" />{item.label}</button>)}
      </div>
      <div className={styles.viewActions}><label className={styles.format}><span className="admin-sr-only">内容格式</span><select aria-label="内容格式" value={format} disabled={disabled} onChange={event => onFormatChange(event.target.value as 'markdown' | 'mdx')}><option value="markdown">Markdown</option><option value="mdx">MDX</option></select><ChevronDown size={13} aria-hidden="true" /></label>{tool('快捷键与语法帮助', <HelpCircle size={17} />, () => openDialog('help'))}{tool(fullscreen ? '退出全屏' : '全屏写作', fullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />, () => setFullscreen(current => !current), 'Ctrl / ⌘ J')}{fullscreen && <button type="button" className={styles.save} disabled={disabled || Boolean(uploading)} onClick={onSave}><Save size={15} />保存</button>}</div>
    </div>
    {mode !== 'preview' && <div className={styles.toolbar} role="toolbar" aria-label="Markdown 格式工具" onKeyDown={event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowLeft' ? -1 : 1) + buttons.length) % buttons.length;
      event.preventDefault(); event.stopPropagation(); buttons[next]?.focus();
    }}>
      {commands.slice(0, 6).map(({ command: name, label, shortcut, icon: Icon }, index) => <span className={styles.toolWrap} key={name}>{tool(label, <Icon size={17} />, () => command(name), shortcut, false, index === 0)}</span>)}
      <span className={styles.divider} aria-hidden="true" />
      {tool('插入链接', <Link2 size={17} />, () => openDialog('link'), 'Ctrl / ⌘ L')}
      {tool('插入图片', <ImagePlus size={17} />, () => openDialog('image'), 'Ctrl / ⌘ G')}
      {tool('插入附件', <Paperclip size={17} />, () => openDialog('media'))}
      <span className={styles.divider} aria-hidden="true" />
      {commands.slice(6).map(({ command: name, label, shortcut, icon: Icon }) => <span className={styles.toolWrap} key={name}>{tool(label, <Icon size={17} />, () => command(name), shortcut)}</span>)}
      <span className={styles.divider} aria-hidden="true" />
      {tool('撤销', <Undo2 size={17} />, () => travel('undo'), 'Ctrl / ⌘ Z', !canUndo)}
      {tool('重做', <Redo2 size={17} />, () => travel('redo'), 'Ctrl / ⌘ Shift Z', !canRedo)}
    </div>}
    {error && <div className={styles.error} role="alert"><span>{error}</span><button type="button" aria-label="关闭上传错误" onClick={() => setError('')}><X size={15} /></button></div>}
    {uploading && <div className={styles.uploadStatus} role="status"><LoaderCircle size={16} className="admin-spin" />{uploading}</div>}
    <div className={`${styles.panes} ${mode === 'split' ? styles.split : ''} ${dragging ? styles.dragging : ''}`}>
      {mode !== 'preview' && <div className={styles.writePane}><label className="admin-sr-only" htmlFor={editorId}>文章正文</label><textarea ref={textarea} id={editorId} value={value} aria-describedby={hintId} placeholder="在这里开始写作，支持 Markdown；可粘贴或拖入图片。" spellCheck={false} disabled={disabled} onChange={event => {
        const element = event.currentTarget;
        const inputType = (event.nativeEvent as InputEvent).inputType || 'typing';
        change({ text: element.value, start: element.selectionStart, end: element.selectionEnd }, inputType);
      }} onSelect={() => captureSelection()} onClick={() => { captureSelection(); lastTyping.current.kind = ''; }} onBlur={() => captureSelection()} onKeyDown={keydown} onPaste={paste} onDragOver={event => { if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); setDragging(true); } }} onDragLeave={() => setDragging(false)} onDrop={drop} onScroll={event => synchronizeScroll(event.currentTarget, preview.current)} />{dragging && <div className={styles.dropHint}><UploadCloud size={24} />松开上传并插入正文</div>}</div>}
      {mode !== 'write' && <div ref={preview} className={styles.preview} aria-label="正文预览"><MarkdownPreview content={value} /></div>}
    </div>
    <div className={styles.footer}><span>{Array.from(value).length.toLocaleString('zh-CN')} 字符<span className={styles.footerDot}>·</span>{value.split('\n').length} 行</span><span id={hintId}>{format === 'mdx' ? '安全预览：仅渲染 Markdown，不执行 JSX' : `粘贴 / 拖入图片 · ${shortcutHint} S 保存 · Tab 缩进`}</span></div>
    {dialog && <dialog ref={dialogElement} className={styles.dialog} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); closeDialog(); }} onClose={() => setDialog(null)} onClick={event => { if (event.target === event.currentTarget) { const bounds = event.currentTarget.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeDialog(); } }} onKeyDown={event => {
      event.stopPropagation();
      if (event.key === 'Enter' && event.target instanceof HTMLInputElement) { event.preventDefault(); if ((dialog === 'link' || dialog === 'image') && event.target.dataset.urlInput) insertUrl(); }
    }}>
      <div className={styles.dialogHeading}><h2 id={titleId}>{dialog === 'help' ? 'Markdown 写作帮助' : dialog === 'link' ? '插入链接' : dialog === 'image' ? '插入图片' : '插入附件'}</h2><button type="button" className={styles.tool} aria-label="关闭插入窗口" onClick={closeDialog}><X size={19} /></button></div>
      <input ref={fileInput} className={styles.fileInput} type="file" multiple accept={imagesOnly ? acceptedFiles.split(',').filter(type => type.startsWith('image/')).join(',') : acceptedFiles} disabled={disabled || Boolean(uploading)} aria-label="上传正文附件" onChange={event => { const files = Array.from(event.currentTarget.files || []); event.currentTarget.value = ''; void uploadFiles(files); }} />
      {dialog === 'help' ? <div className={styles.help}><p>选中文字再点击工具栏即可设置格式，也可直接输入 Markdown。</p><dl><dt>加粗 / 斜体</dt><dd><code>**加粗**</code> / <code>*斜体*</code><span>Ctrl / ⌘ B、I</span></dd><dt>标题 / 引用</dt><dd><code>## 标题</code> / <code>&gt; 引用</code><span>Ctrl / ⌘ H、Q</span></dd><dt>链接 / 图片</dt><dd><code>[说明](地址)</code> / <code>![描述](地址)</code><span>Ctrl / ⌘ L、G</span></dd><dt>代码 / 列表</dt><dd>代码块、有序列表、无序列表<span>Ctrl / ⌘ K、O、U</span></dd><dt>编辑与保存</dt><dd>撤销 / 重做：Ctrl / ⌘ Z、Shift Z<br />保存：Ctrl / ⌘ S；全屏：Ctrl / ⌘ J<br />Tab 缩进，Shift Tab 取消缩进；Esc 退出全屏或移到工具栏。</dd><dt>段落与摘要</dt><dd>空一行开始新段落；摘要分割线为 <code>&lt;!--more--&gt;</code>，不会显示在正文中。</dd></dl><p>在正文中粘贴截图或拖入图片即可上传；附件窗口可直接插入媒体库文件。预览不会执行 HTML、JSX 或脚本。</p></div> : <>
        {(dialog === 'image' || dialog === 'media') && <div className={styles.mediaSection}><div className={styles.mediaHeading}><h3>媒体库</h3><button type="button" className={styles.upload} disabled={disabled || Boolean(uploading)} onClick={() => fileInput.current?.click()}><UploadCloud size={16} />上传并插入</button></div><label className={styles.search}><Search size={16} /><span className="admin-sr-only">搜索正文媒体</span><input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索文件名…" /></label>{filteredMedia.length ? <div className={styles.mediaGrid}>{filteredMedia.map(item => <button type="button" key={`${item.id}:${item.url}`} className={styles.mediaItem} title={item.name} aria-label={`插入 ${item.name}`} disabled={disabled} onClick={() => insertMedia(item)}><span className={styles.mediaPicture}><Thumbnail item={item} /></span><span className={styles.mediaName}>{item.name}</span></button>)}</div> : <p className={styles.empty}>{query ? '没有找到相符的文件。' : imagesOnly ? '媒体库暂无图片，可上传或填写图片地址。' : '媒体库暂无附件，可先上传。'}</p>}<p className={styles.note}>支持 JPG、PNG、GIF、WebP、AVIF 和 MP3、OGG、WAV，每个文件不超过 20 MB。</p></div>}
        {(dialog === 'link' || dialog === 'image') && <div className={styles.urlFields}><h3>{dialog === 'image' ? '使用图片地址' : '链接信息'}</h3><label>{dialog === 'image' ? '图片描述' : '链接文字'}<input value={description} maxLength={500} onChange={event => setDescription(event.target.value)} placeholder={dialog === 'image' ? '简短描述画面' : '读者看到的文字'} autoFocus={dialog === 'link'} /></label><label>{dialog === 'image' ? '图片地址' : '链接地址'}<input data-url-input value={url} maxLength={2048} onChange={event => { setUrl(event.target.value); setDialogError(''); }} placeholder={dialog === 'image' ? 'https://… 或 /uploads/…' : 'https://…、/pages/… 或 #标题'} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); insertUrl(); } }} /></label><div className={styles.dialogActions}><button type="button" className="admin-button admin-button-secondary" onClick={closeDialog}>取消</button><button type="button" className="admin-button" onClick={insertUrl}>插入{dialog === 'image' ? '图片' : '链接'}</button></div></div>}
        {dialogError && <p className={styles.dialogError} role="alert">{dialogError}</p>}
      </>}
    </dialog>}
  </div>;
}
