import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { normalizeSubtasks } from '../utils/subtasks';
import { normalizeTaskContext } from '../utils/taskMeta';
import { normalizeTaskStatus } from '../utils/taskStatus';
import { appendScheduleLog, SCHEDULE_REASONS } from '../utils/scheduleLog';
import { toLocalISO, startOfToday } from '../utils/dateUtils';

const TABLE = 'tasks';

function fromRow(row) {
  const status = normalizeTaskStatus(row.status || (row.completed ? 'completed' : 'not_started'));
  return {
    id: row.id,
    title: row.title,
    quadrant: row.quadrant,
    context: normalizeTaskContext(row.context),
    projectId: row.project_id ?? null,
    subtasks: normalizeSubtasks(row.subtasks),
    completed: status === 'completed' || Boolean(row.completed),
    status,
    archived: Boolean(row.archived),
    archivedAt: row.archived_at ?? null,
    notes: row.notes ?? '',
    dueDate: row.due_date ?? '',
    duration: row.duration ?? 1,
    sortOrder: row.sort_order ?? 0,
    timeSpentSeconds: row.time_spent_seconds ?? 0,
    recurrence: row.recurrence ?? null,
    recurrenceDays: row.recurrence_days ?? [],
    deliverable: row.deliverable ?? '',
    deliverableUrl: row.deliverable_url ?? '',
    occurrenceLog: row.occurrence_log ?? {},
    externalSource: row.external_source ?? null,
    externalId: row.external_id ?? null,
    externalUrl: row.external_url ?? null,
    externalMeta: row.external_meta ?? null,
    lastSyncedAt: row.last_synced_at ?? null,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

export function useTasks(showToast) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(true);
  const [initialError, setInitialError] = useState(false);

  const fetchTasks = useCallback(async (isInitial = false) => {
    if (isInitial) {
      setLoading(true);
      setInitialError(false);
    }

    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) throw error;

      setConnected(true);
      setTasks((data ?? []).map(fromRow));
    } catch (err) {
      console.error(err);
      setConnected(false);
      if (isInitial) setInitialError(true);
      showToast?.('تعذّر الاتصال بقاعدة البيانات', 'ph-x-circle', 'error');
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchTasks(true);

    const channel = supabase
      .channel('tasks-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: TABLE }, (payload) => {
        const newTask = fromRow(payload.new);
        setTasks((prev) => {
          if (prev.some((t) => t.id === newTask.id)) return prev;
          const withoutTemp = prev.filter((t) => !String(t.id).startsWith('temp-'));
          return [newTask, ...withoutTemp];
        });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: TABLE }, (payload) => {
        const updated = fromRow(payload.new);
        setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: TABLE }, (payload) => {
        const deletedId = payload.old.id;
        setTasks((prev) => prev.filter((t) => t.id !== deletedId));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTasks]);

  const addTask = useCallback(
    async (title, quadrant, dueDate, notes, duration = 1, extra = {}) => {
      const tempId = `temp-${Date.now()}`;
      const recurrence = extra.recurrence || null;
      const recurrenceDays = extra.recurrenceDays || [];
      const context = normalizeTaskContext(extra.context);
      const subtasks = normalizeSubtasks(extra.subtasks);
      let status = normalizeTaskStatus(extra.status || 'not_started');
      const completed = status === 'completed';
      const archived = status === 'cancelled';
      const archivedAt = archived ? new Date().toISOString() : null;
      const optimisticTask = {
        id: tempId,
        title,
        quadrant,
        context,
        projectId: extra.projectId || null,
        subtasks,
        deliverable: extra.deliverable || '',
        deliverableUrl: extra.deliverableUrl || '',
        occurrenceLog: extra.occurrenceLog || {},
        status,
        completed,
        archived,
        archivedAt,
        notes: notes || '',
        dueDate: dueDate || '',
        duration: duration || 1,
        sortOrder: 0,
        recurrence,
        recurrenceDays,
        externalSource: null,
        externalId: null,
        externalUrl: null,
        externalMeta: null,
        createdAt: new Date().toISOString(),
        completedAt: completed ? new Date().toISOString() : null,
      };

      setTasks((prev) => [optimisticTask, ...prev]);

      const payload = {
        title,
        quadrant,
        context,
        subtasks,
        status,
        completed,
        completed_at: completed ? new Date().toISOString() : null,
        due_date: dueDate || null,
        notes: notes || '',
        duration: duration || 1,
        sort_order: 0,
        recurrence,
        recurrence_days: recurrence === 'weekly' ? recurrenceDays : null,
        project_id: extra.projectId || null,
        deliverable: extra.deliverable || '',
        deliverable_url: extra.deliverableUrl || null,
        occurrence_log: extra.occurrenceLog || {},
        archived,
        archived_at: archivedAt,
      };

      const { data, error } = await supabase.from(TABLE).insert(payload).select().single();

      if (error) {
        console.error(error);
        setTasks((prev) => prev.filter((t) => t.id !== tempId));
        showToast?.('تعذّرت إضافة المهمة', 'ph-x-circle', 'error');
        return;
      }

      setTasks((prev) => prev.map((t) => (t.id === tempId ? fromRow(data) : t)));
      showToast?.(`أُضيفت "${title}"`, 'ph-plus-circle');
    },
    [showToast]
  );

  const updateTask = useCallback(
    async (id, title, quadrant, dueDate, notes, duration, extra = {}) => {
      const previous = tasks.find((t) => t.id === id);
      if (!previous) return;

      const recurrence = extra.recurrence !== undefined ? extra.recurrence : previous.recurrence;
      const recurrenceDays =
        extra.recurrenceDays !== undefined ? extra.recurrenceDays : previous.recurrenceDays;
      const context = normalizeTaskContext(
        extra.context !== undefined ? extra.context : previous.context
      );
      const subtasks =
        extra.subtasks !== undefined
          ? normalizeSubtasks(extra.subtasks)
          : normalizeSubtasks(previous.subtasks);
      const status = normalizeTaskStatus(
        extra.status !== undefined ? extra.status : previous.status || 'not_started'
      );
      const completed = status === 'completed';
      const completedAt = completed ? previous.completedAt || new Date().toISOString() : null;
      const shouldArchive = status === 'cancelled';
      const archived = shouldArchive ? true : previous.archived;
      const archivedAt = shouldArchive
        ? previous.archivedAt || new Date().toISOString()
        : previous.archivedAt;

      let externalMeta = previous.externalMeta;
      if (
        (dueDate || '') !== (previous.dueDate || '') &&
        extra.skipScheduleLog !== true
      ) {
        externalMeta = appendScheduleLog(previous.externalMeta, {
          reason: SCHEDULE_REASONS.reschedule,
          from: previous.dueDate || null,
          to: dueDate || null,
        });
      }

      setTasks((prev) =>
        prev.map((t) =>
          t.id === id
            ? {
                ...t,
                title,
                quadrant,
                context,
                projectId: extra.projectId !== undefined ? extra.projectId : previous.projectId || null,
                subtasks,
                deliverable: extra.deliverable !== undefined ? extra.deliverable : previous.deliverable || '',
                deliverableUrl: extra.deliverableUrl !== undefined ? extra.deliverableUrl : previous.deliverableUrl || '',
                occurrenceLog: extra.occurrenceLog !== undefined ? extra.occurrenceLog : previous.occurrenceLog || {},
                status,
                completed,
                completedAt,
                archived,
                archivedAt,
                dueDate: dueDate || '',
                notes: notes || '',
                duration: duration || 1,
                recurrence,
                recurrenceDays: recurrenceDays || [],
                externalMeta,
              }
            : t
        )
      );

      const patch = {
        title,
        quadrant,
        context,
        subtasks,
        status,
        completed,
        completed_at: completedAt,
        due_date: dueDate || null,
        notes: notes || '',
        duration: duration || 1,
        recurrence: recurrence || null,
        recurrence_days: recurrence === 'weekly' ? recurrenceDays : null,
        project_id: extra.projectId !== undefined ? extra.projectId : previous.projectId || null,
        deliverable: extra.deliverable !== undefined ? extra.deliverable : previous.deliverable || '',
        deliverable_url: extra.deliverableUrl !== undefined ? extra.deliverableUrl || null : previous.deliverableUrl || null,
        occurrence_log: extra.occurrenceLog !== undefined ? extra.occurrenceLog : previous.occurrenceLog || {},
        external_meta: externalMeta,
      };
      if (shouldArchive) {
        patch.archived = true;
        patch.archived_at = archivedAt;
      }

      const { error } = await supabase.from(TABLE).update(patch).eq('id', id);

      if (error) {
        console.error(error);
        setTasks((prev) => prev.map((t) => (t.id === id ? previous : t)));
        showToast?.('تعذّر تعديل المهمة', 'ph-x-circle', 'error');
        return;
      }

      if (shouldArchive) {
        showToast?.(`أُلغيت وأُرشفت "${title}"`, 'ph-x-circle');
      } else {
        showToast?.(`تم تعديل "${title}"`, 'ph-pencil-simple');
      }
    },
    [tasks, showToast]
  );

  const archiveTask = useCallback(
    async (id) => {
      const task = tasks.find((t) => t.id === id);
      if (!task || task.archived) return;

      const archivedAt = new Date().toISOString();
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, archived: true, archivedAt } : t))
      );

      const { error } = await supabase
        .from(TABLE)
        .update({ archived: true, archived_at: archivedAt })
        .eq('id', id);

      if (error) {
        console.error(error);
        setTasks((prev) => prev.map((t) => (t.id === id ? task : t)));
        showToast?.('تعذّرت أرشفة المهمة', 'ph-x-circle', 'error');
        return;
      }

      showToast?.(`أُرشفت "${task.title}"`, 'ph-archive');
    },
    [tasks, showToast]
  );

  const deleteTask = archiveTask;

  const archiveTasksInContext = useCallback(
    async (context) => {
      const ctx = normalizeTaskContext(context);
      const archivedAt = new Date().toISOString();

      const { error } = await supabase
        .from(TABLE)
        .update({ archived: true, archived_at: archivedAt })
        .eq('context', ctx)
        .eq('archived', false);

      if (error) {
        console.error(error);
        showToast?.('تعذّرت أرشفة مهام المساحة', 'ph-x-circle', 'error');
        return false;
      }

      setTasks((prev) =>
        prev.map((t) =>
          normalizeTaskContext(t.context) === ctx && !t.archived
            ? { ...t, archived: true, archivedAt }
            : t
        )
      );
      return true;
    },
    [showToast]
  );

  const restoreTask = useCallback(
    async (id) => {
      const task = tasks.find((t) => t.id === id);
      if (!task || !task.archived) return;

      const nextStatus =
        task.status === 'cancelled' ? 'not_started' : normalizeTaskStatus(task.status);

      setTasks((prev) =>
        prev.map((t) =>
          t.id === id
            ? {
                ...t,
                archived: false,
                archivedAt: null,
                status: nextStatus,
                completed: nextStatus === 'completed',
              }
            : t
        )
      );

      const { error } = await supabase
        .from(TABLE)
        .update({
          archived: false,
          archived_at: null,
          status: nextStatus,
          completed: nextStatus === 'completed',
          completed_at: nextStatus === 'completed' ? task.completedAt : null,
        })
        .eq('id', id);

      if (error) {
        console.error(error);
        setTasks((prev) => prev.map((t) => (t.id === id ? task : t)));
        showToast?.('تعذّر استرجاع المهمة', 'ph-x-circle', 'error');
        return;
      }

      showToast?.(`استُرجعت "${task.title}"`, 'ph-arrow-counter-clockwise');
    },
    [tasks, showToast]
  );

  const toggleComplete = useCallback(
    async (id) => {
      const task = tasks.find((t) => t.id === id);
      if (!task) return;

      const completed = !task.completed;
      const completedAt = completed ? new Date().toISOString() : null;
      const status = completed ? 'completed' : 'not_started';
      const occurrenceLog = task.recurrence
        ? { ...(task.occurrenceLog || {}), [toLocalISO(startOfToday())]: completed }
        : task.occurrenceLog || {};

      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, completed, completedAt, status, occurrenceLog } : t))
      );

      const { error } = await supabase
        .from(TABLE)
        .update({ completed, completed_at: completedAt, status, occurrence_log: occurrenceLog })
        .eq('id', id);

      if (error) {
        console.error(error);
        setTasks((prev) =>
          prev.map((t) =>
            t.id === id
              ? {
                  ...t,
                  completed: task.completed,
                  completedAt: task.completedAt,
                  status: task.status,
                  occurrenceLog: task.occurrenceLog || {},
                }
              : t
          )
        );
        showToast?.('تعذّر تحديث حالة المهمة', 'ph-x-circle', 'error');
        return;
      }

      if (completed) showToast?.(`✓ "${task.title}" مكتملة`, 'ph-check-circle');
    },
    [tasks, showToast]
  );

  const setTaskStatus = useCallback(
    async (id, statusRaw) => {
      const task = tasks.find((t) => t.id === id);
      if (!task) return;

      const prevStatus = normalizeTaskStatus(task);
      const status = normalizeTaskStatus(statusRaw);
      const completed = status === 'completed';
      const completedAt = completed ? new Date().toISOString() : null;
      const occurrenceLog = task.recurrence
        ? { ...(task.occurrenceLog || {}), [toLocalISO(startOfToday())]: completed }
        : task.occurrenceLog || {};
      const shouldArchive = status === 'cancelled';
      const archivedAt = shouldArchive ? new Date().toISOString() : task.archivedAt;

      let externalMeta = task.externalMeta;
      if (status === 'deferred' && prevStatus !== 'deferred') {
        externalMeta = appendScheduleLog(task.externalMeta, {
          reason: SCHEDULE_REASONS.park,
          from: task.dueDate || null,
          to: null,
        });
      } else if (prevStatus === 'deferred' && status !== 'deferred') {
        externalMeta = appendScheduleLog(task.externalMeta, {
          reason: SCHEDULE_REASONS.unpark,
          from: null,
          to: task.dueDate || null,
        });
      }

      setTasks((prev) =>
        prev.map((t) =>
          t.id === id
            ? {
                ...t,
                status,
                completed,
                completedAt,
                occurrenceLog,
                archived: shouldArchive ? true : t.archived,
                archivedAt: shouldArchive ? archivedAt : t.archivedAt,
                externalMeta,
              }
            : t
        )
      );

      const patch = {
        status,
        completed,
        completed_at: completedAt,
        occurrence_log: occurrenceLog,
        external_meta: externalMeta,
      };
      if (shouldArchive) {
        patch.archived = true;
        patch.archived_at = archivedAt;
      }

      const { error } = await supabase.from(TABLE).update(patch).eq('id', id);

      if (error) {
        console.error(error);
        setTasks((prev) =>
          prev.map((t) =>
            t.id === id
              ? {
                  ...t,
                  status: task.status,
                  completed: task.completed,
                  completedAt: task.completedAt,
                  occurrenceLog: task.occurrenceLog || {},
                  archived: task.archived,
                  archivedAt: task.archivedAt,
                  externalMeta: task.externalMeta,
                }
              : t
          )
        );
        showToast?.('تعذّر تحديث مرحلة المهمة', 'ph-x-circle', 'error');
        return;
      }

      if (shouldArchive) {
        showToast?.(`أُلغيت وأُرشفت "${task.title}"`, 'ph-x-circle');
      } else if (status === 'deferred') {
        showToast?.(
          `خارج الدورة الحالية · "${task.title}" معلّقة حتى تعيدها`,
          'ph-pause-circle'
        );
      }
    },
    [tasks, showToast]
  );

  const toggleSubtask = useCallback(
    async (taskId, subtaskId) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;

      const previousSubtasks = normalizeSubtasks(task.subtasks);
      const subtasks = previousSubtasks.map((item) =>
        String(item.id) === String(subtaskId) ? { ...item, completed: !item.completed } : item
      );

      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, subtasks } : t))
      );

      const { error } = await supabase.from(TABLE).update({ subtasks }).eq('id', taskId);

      if (error) {
        console.error(error);
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, subtasks: previousSubtasks } : t))
        );
        showToast?.('تعذّر تحديث المهمة الفرعية', 'ph-x-circle', 'error');
      }
    },
    [tasks, showToast]
  );

  const moveTask = useCallback(
    async (id, newQuadrant) => {
      const task = tasks.find((t) => t.id === id);
      if (!task || task.quadrant === newQuadrant) return;

      const previousQuadrant = task.quadrant;

      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, quadrant: newQuadrant } : t))
      );

      const { error } = await supabase
        .from(TABLE)
        .update({ quadrant: newQuadrant })
        .eq('id', id);

      if (error) {
        console.error(error);
        setTasks((prev) =>
          prev.map((t) => (t.id === id ? { ...t, quadrant: previousQuadrant } : t))
        );
        showToast?.('تعذّر نقل المهمة', 'ph-x-circle', 'error');
        return;
      }

      showToast?.('نُقلت المهمة', 'ph-arrows-out-card-horizontal');
    },
    [tasks, showToast]
  );

  const rescheduleTask = useCallback(
    async (id, newDate, options = {}) => {
      const task = tasks.find((t) => String(t.id) === String(id));
      if (!task) return;

      const reason = options.reason || SCHEDULE_REASONS.reschedule;
      const previousDate = task.dueDate;
      const previousStatus = task.status;
      const liftDefer = previousStatus === 'deferred';

      const externalMeta = appendScheduleLog(task.externalMeta, {
        reason,
        from: previousDate || null,
        to: newDate || null,
      });

      setTasks((prev) =>
        prev.map((t) =>
          String(t.id) === String(id)
            ? {
                ...t,
                dueDate: newDate,
                status: liftDefer ? 'not_started' : t.status,
                completed: liftDefer ? false : t.completed,
                externalMeta,
              }
            : t
        )
      );

      const patch = {
        due_date: newDate,
        external_meta: externalMeta,
      };
      if (liftDefer) {
        patch.status = 'not_started';
        patch.completed = false;
        patch.completed_at = null;
      }

      const { error } = await supabase.from(TABLE).update(patch).eq('id', task.id);

      if (error) {
        console.error(error);
        setTasks((prev) =>
          prev.map((t) =>
            String(t.id) === String(id)
              ? {
                  ...t,
                  dueDate: previousDate,
                  status: previousStatus,
                  externalMeta: task.externalMeta,
                }
              : t
          )
        );
        showToast?.('تعذّر تحديث الموعد', 'ph-x-circle', 'error');
        return;
      }

      if (reason === SCHEDULE_REASONS.defer_tomorrow) {
        showToast?.('لن أعمل عليها اليوم · نُقلت إلى غداً', 'ph-clock-countdown');
      } else if (liftDefer) {
        showToast?.('عادت للدورة · بموعد جديد', 'ph-calendar-check');
      } else {
        showToast?.('تم تحديث الخطة · موعد جديد', 'ph-calendar-check');
      }
    },
    [tasks, showToast]
  );

  const reorderInQuadrant = useCallback(async (quadrant, orderedIds) => {
    setTasks((prev) => {
      const map = new Map(orderedIds.map((id, i) => [String(id), i]));
      return prev.map((t) =>
        t.quadrant === quadrant && map.has(String(t.id))
          ? { ...t, sortOrder: map.get(String(t.id)) }
          : t
      );
    });

    await Promise.all(
      orderedIds.map((id, i) => supabase.from(TABLE).update({ sort_order: i }).eq('id', id))
    );
  }, []);

  const replaceTasksInContext = useCallback(
    async (context, importedTasks) => {
      const ctx = normalizeTaskContext(context);
      const archivedAt = new Date().toISOString();

      const { error: archiveError } = await supabase
        .from(TABLE)
        .update({ archived: true, archived_at: archivedAt })
        .eq('context', ctx)
        .eq('archived', false);

      if (archiveError) {
        console.error(archiveError);
        showToast?.('حدث خطأ أثناء أرشفة مهام المساحة', 'ph-x-circle', 'error');
        return;
      }

      setTasks((prev) =>
        prev.map((t) =>
          normalizeTaskContext(t.context) === ctx && !t.archived
            ? { ...t, archived: true, archivedAt }
            : t
        )
      );

      const rows = importedTasks.map((t, i) => ({
        title: t.title,
        quadrant: t.quadrant,
        context: ctx,
        subtasks: normalizeSubtasks(t.subtasks),
        completed: !!t.completed,
        notes: t.notes || '',
        due_date: t.dueDate || null,
        duration: t.duration || 1,
        sort_order: i,
        recurrence: t.recurrence || null,
        recurrence_days: t.recurrence === 'weekly' ? t.recurrenceDays || [] : null,
        completed_at: t.completed ? new Date().toISOString() : null,
        archived: false,
      }));

      if (rows.length === 0) {
        showToast?.('أُرشفت مهام المساحة الحالية', 'ph-archive');
        return;
      }

      const { data, error: insertError } = await supabase.from(TABLE).insert(rows).select();
      if (insertError) {
        console.error(insertError);
        showToast?.('حدث خطأ أثناء استيراد المهام', 'ph-x-circle', 'error');
        await fetchTasks(false);
        return;
      }

      const inserted = (data ?? []).map(fromRow);
      setTasks((prev) => [...inserted, ...prev]);
      showToast?.(`تم استيراد ${rows.length} مهمة (السابقة أُرشفت)`, 'ph-upload-simple');
    },
    [showToast, fetchTasks]
  );

  return {
    tasks,
    loading,
    connected,
    addTask,
    updateTask,
    deleteTask,
    archiveTask,
    archiveTasksInContext,
    restoreTask,
    toggleComplete,
    setTaskStatus,
    toggleSubtask,
    moveTask,
    rescheduleTask,
    reorderInQuadrant,
    replaceTasksInContext,
    refetch: () => fetchTasks(false),
    initialError,
    retry: () => fetchTasks(true),
  };
}
