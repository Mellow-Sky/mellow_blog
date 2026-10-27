'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { contentFingerprint, editorDraftKey, readEditorDraft, removeEditorDraft, writeEditorDraft, type EditorDraft, type EditorDraftContent } from '@/lib/editor-drafts';

export function useLocalPostDraft(username: string, content: EditorDraftContent, dirty: boolean, baseUpdatedAt: number | null) {
  const key = editorDraftKey(username, content.post.type, content.post.id);
  const [loadedKey, setLoadedKey] = useState('');
  const [recovery, setRecovery] = useState<EditorDraft | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const current = useRef({ key, content, dirty, baseUpdatedAt, ready: false });
  current.current = { key, content, dirty, baseUpdatedAt, ready: loadedKey === key && !recovery };

  useEffect(() => {
    let record: EditorDraft | null = null;
    try { record = readEditorDraft(localStorage, key, content.post.type, content.post.id); }
    catch { setFailed(true); }
    setRecovery(record && contentFingerprint(record.content) !== contentFingerprint(content) ? record : null);
    setSavedAt(null); setLoadedKey(key);
    // Identity changes only when a new article receives its first server id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const persist = useCallback(() => {
    const value = current.current;
    if (!value.ready || !value.dirty) return;
    const timestamp = Date.now();
    let success = false;
    try { success = writeEditorDraft(localStorage, value.key, { version: 1, savedAt: timestamp, baseUpdatedAt: value.baseUpdatedAt, content: value.content }); }
    catch { /* Private browsing and storage quotas must not interrupt writing. */ }
    setFailed(!success);
    if (success) setSavedAt(timestamp);
  }, []);

  useEffect(() => {
    if (loadedKey !== key || recovery) return;
    if (!dirty) { try { removeEditorDraft(localStorage, key); } catch { /* Storage is optional. */ } return; }
    const timer = setTimeout(persist, 1200);
    return () => clearTimeout(timer);
  }, [key, loadedKey, recovery, dirty, content, persist]);

  useEffect(() => {
    const flush = () => persist();
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    return () => { flush(); window.removeEventListener('pagehide', flush); window.removeEventListener('beforeunload', flush); };
  }, [persist]);

  function discardRecovery() {
    try { removeEditorDraft(localStorage, key); } catch { /* Keep the editor usable. */ }
    setRecovery(null); setSavedAt(null);
  }
  function clearSaved(previousKey = key, nextKey = key) {
    current.current.dirty = false;
    try { removeEditorDraft(localStorage, previousKey); if (nextKey !== previousKey) removeEditorDraft(localStorage, nextKey); } catch { /* Server save already succeeded. */ }
    setRecovery(null); setSavedAt(null); setFailed(false);
  }
  return { key, recovery, savedAt, failed, discardRecovery, clearSaved, acceptRecovery: () => setRecovery(null) };
}
