import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const LEGACY_KEY = 'mahd_standalone_notes_v1';
const MIGRATION_DONE_KEY = 'mahd_standalone_notes_migrated_v1';

async function migrateLegacyNotesIfNeeded(showToast) {
  if (localStorage.getItem(MIGRATION_DONE_KEY)) return;
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    const legacyNotes = raw ? JSON.parse(raw) : [];
    if (Array.isArray(legacyNotes) && legacyNotes.length > 0) {
      const rows = legacyNotes.map((note) => ({
        task_id: null,
        title: note.title || 'مسودة بدون عنوان',
        content_md: note.content_md || '',
        note_type: 'note',
        labels: [],
        is_pinned: false,
        checklist: [],
        board_stage: 'capture',
        created_at: note.created_at || new Date().toISOString(),
        updated_at: note.updated_at || new Date().toISOString(),
      }));
      const { error } = await supabase.from('task_notes').insert(rows);
      if (error) {
        console.error('legacy notes migration failed:', error);
        return;
      }
      showToast?.(`تم نقل ${rows.length} ملاحظة قديمة إلى المفكرة المتزامنة`, 'ph-cloud-arrow-up');
    }
    localStorage.setItem(MIGRATION_DONE_KEY, '1');
    if (raw) {
      localStorage.setItem(`${LEGACY_KEY}_backup`, raw);
      localStorage.removeItem(LEGACY_KEY);
    }
  } catch (error) {
    console.error('legacy notes migration error:', error);
  }
}

export function useStandaloneNotes(showToast) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchNotes = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('task_notes')
        .select('*')
        .is('task_id', null)
        .order('is_pinned', { ascending: false })
        .order('updated_at', { ascending: false });
      if (error) throw error;
      setNotes(data ?? []);
    } catch (error) {
      console.error(error);
      showToast?.('تعذّر تحميل المفكرة', 'ph-x-circle', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    (async () => {
      await migrateLegacyNotesIfNeeded(showToast);
      await fetchNotes();
    })();
    const channel = supabase
      .channel('standalone-notes-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_notes', filter: 'task_id=is.null' }, () => fetchNotes())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [fetchNotes, showToast]);

  const createNote = useCallback(async (title = 'مسودة بدون عنوان', options = {}) => {
    const row = {
      task_id: null,
      title,
      content_md: '',
      note_type: options.noteType || 'note',
      labels: options.labels || [],
      is_pinned: Boolean(options.isPinned),
      checklist: options.checklist || [],
      board_stage: options.boardStage || 'capture',
    };
    const { data, error } = await supabase.from('task_notes').insert(row).select().single();
    if (error) {
      console.error(error);
      showToast?.('تعذّر إنشاء الملاحظة', 'ph-x-circle', 'error');
      return null;
    }
    setNotes((current) => [data, ...current.filter((note) => note.id !== data.id)]);
    showToast?.('أُنشئت ملاحظة جديدة', 'ph-file-plus');
    return data;
  }, [showToast]);

  const updateNote = useCallback(async (id, patch) => {
    const updatedAt = new Date().toISOString();
    const { error } = await supabase.from('task_notes').update({ ...patch, updated_at: updatedAt }).eq('id', id);
    if (error) {
      console.error(error);
      showToast?.('تعذّر حفظ الملاحظة', 'ph-x-circle', 'error');
      return false;
    }
    setNotes((current) => current.map((note) => note.id === id ? { ...note, ...patch, updated_at: updatedAt } : note));
    return true;
  }, [showToast]);

  const deleteNote = useCallback(async (id) => {
    const { error } = await supabase.from('task_notes').delete().eq('id', id);
    if (error) {
      showToast?.('تعذّر حذف الملاحظة', 'ph-x-circle', 'error');
      return false;
    }
    setNotes((current) => current.filter((note) => note.id !== id));
    showToast?.('تم حذف الملاحظة', 'ph-trash');
    return true;
  }, [showToast]);

  return { notes, loading, createNote, updateNote, deleteNote };
}
