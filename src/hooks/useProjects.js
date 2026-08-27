import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { normalizeTaskContext } from '../utils/taskMeta';

const TABLE = 'projects';

function fromRow(row) {
  return {
    id: row.id,
    context: normalizeTaskContext(row.context),
    name: row.name || 'مشروع بدون اسم',
    description: row.description || '',
    status: row.status || 'active',
    dueDate: row.due_date || '',
    color: row.color || '#159a76',
    archived: Boolean(row.archived),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function useProjects(showToast) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('archived', false)
      .order('created_at', { ascending: true });
    if (error) {
      console.error(error);
      showToast?.('تعذّر تحميل المشاريع', 'ph-warning', 'error');
    } else {
      setProjects((data || []).map(fromRow));
    }
    setLoading(false);
  }, [showToast]);

  useEffect(() => {
    fetchProjects();
    const channel = supabase
      .channel('projects-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, fetchProjects)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [fetchProjects]);

  const addProject = useCallback(async ({ name, description = '', context = 'work', dueDate = '', color = '#159a76' }) => {
    const payload = {
      name: name.trim(),
      description: description.trim(),
      context: normalizeTaskContext(context),
      due_date: dueDate || null,
      color,
      status: 'active',
      archived: false,
    };
    const { data, error } = await supabase.from(TABLE).insert(payload).select().single();
    if (error) {
      console.error(error);
      showToast?.('تعذّر إنشاء المشروع', 'ph-warning', 'error');
      return null;
    }
    const created = fromRow(data);
    setProjects((prev) => [...prev, created]);
    showToast?.(`أُنشئ مشروع «${created.name}»`, 'ph-folder-plus');
    return created;
  }, [showToast]);

  const updateProject = useCallback(async (id, patch) => {
    const payload = {};
    if (patch.name !== undefined) payload.name = patch.name.trim();
    if (patch.description !== undefined) payload.description = patch.description.trim();
    if (patch.context !== undefined) payload.context = normalizeTaskContext(patch.context);
    if (patch.dueDate !== undefined) payload.due_date = patch.dueDate || null;
    if (patch.color !== undefined) payload.color = patch.color;
    if (patch.status !== undefined) payload.status = patch.status;
    payload.updated_at = new Date().toISOString();

    const { data, error } = await supabase.from(TABLE).update(payload).eq('id', id).select().single();
    if (error) {
      console.error(error);
      showToast?.('تعذّر تحديث المشروع', 'ph-warning', 'error');
      return null;
    }
    const updated = fromRow(data);
    setProjects((prev) => prev.map((project) => (project.id === id ? updated : project)));
    return updated;
  }, [showToast]);

  const archiveProject = useCallback(async (id) => {
    const { error } = await supabase
      .from(TABLE)
      .update({ archived: true, status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      console.error(error);
      showToast?.('تعذّرت أرشفة المشروع', 'ph-warning', 'error');
      return false;
    }
    setProjects((prev) => prev.filter((project) => project.id !== id));
    showToast?.('أُرشف المشروع', 'ph-archive');
    return true;
  }, [showToast]);

  return { projects, loading, addProject, updateProject, archiveProject, refetch: fetchProjects };
}
