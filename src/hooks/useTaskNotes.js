import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export function useTaskNotes(taskId, showToast) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchNotes = useCallback(async () => {
    if (!taskId) {
      setNotes([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('task_notes')
        .select('*')
        .eq('task_id', taskId)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      setNotes(data ?? []);
    } catch (err) {
      console.error(err);
      showToast?.('تعذّر تحميل المسودات', 'ph-x-circle', 'error');
    } finally {
      setLoading(false);
    }
  }, [taskId, showToast]);

  useEffect(() => {
    fetchNotes();
    if (!taskId) return;
    const channel = supabase
      .channel(`task-notes-${taskId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_notes', filter: `task_id=eq.${taskId}` },
        () => fetchNotes()
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [taskId, fetchNotes]);

  const createNote = useCallback(
    async (title = 'مسودة بدون عنوان') => {
      const { data, error } = await supabase
        .from('task_notes')
        .insert({ task_id: taskId, title, content_md: '' })
        .select()
        .single();
      if (error) {
        console.error(error);
        showToast?.('تعذّر إنشاء المسودة', 'ph-x-circle', 'error');
        return null;
      }
      showToast?.('أُنشئت مسودة جديدة', 'ph-file-plus');
      return data;
    },
    [taskId, showToast]
  );

  const updateNote = useCallback(
    async (id, patch) => {
      const { error } = await supabase
        .from('task_notes')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) {
        console.error(error);
        showToast?.('تعذّر حفظ المسودة', 'ph-x-circle', 'error');
        return false;
      }
      return true;
    },
    [showToast]
  );

  const deleteNote = useCallback(
    async (id) => {
      const { error } = await supabase.from('task_notes').delete().eq('id', id);
      if (error) {
        showToast?.('تعذّر حذف المسودة', 'ph-x-circle', 'error');
        return;
      }
      showToast?.('تم حذف المسودة', 'ph-trash');
    },
    [showToast]
  );

  return { notes, loading, createNote, updateNote, deleteNote, refetch: fetchNotes };
}
