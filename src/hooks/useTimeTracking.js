import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

/**
 * تتبع الوقت الفعلي: جلسة واحدة نشطة كحد أقصى بنفس اللحظة (زي أي أداة time-tracking بسيطة).
 * بدء مهمة جديدة يوقف تلقائياً أي جلسة شغّالة على مهمة ثانية.
 * كل جلسة تُسجّل في time_sessions، والمجموع التراكمي يُحدَّث في tasks.time_spent_seconds.
 */
export function useTimeTracking(showToast) {
  const [activeSession, setActiveSession] = useState(null); // { id, taskId, startedAt }
  const [elapsed, setElapsed] = useState(0);
  const tickRef = useRef(null);

  const fetchActive = useCallback(async () => {
    const { data, error } = await supabase
      .from('time_sessions')
      .select('id, task_id, started_at')
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      setActiveSession({ id: data.id, taskId: data.task_id, startedAt: data.started_at });
    }
  }, []);

  useEffect(() => {
    fetchActive();
  }, [fetchActive]);

  useEffect(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    if (!activeSession) {
      setElapsed(0);
      return;
    }
    const update = () => {
      const secs = Math.floor((Date.now() - new Date(activeSession.startedAt).getTime()) / 1000);
      setElapsed(Math.max(0, secs));
    };
    update();
    tickRef.current = setInterval(update, 1000);
    return () => clearInterval(tickRef.current);
  }, [activeSession]);

  const stop = useCallback(
    async (silentTaskId) => {
      if (!activeSession) return;
      const endedAt = new Date();
      const durationSeconds = Math.max(
        0,
        Math.floor((endedAt.getTime() - new Date(activeSession.startedAt).getTime()) / 1000)
      );

      await supabase
        .from('time_sessions')
        .update({ ended_at: endedAt.toISOString(), duration_seconds: durationSeconds })
        .eq('id', activeSession.id);

      // نراكم الوقت على المهمة عبر قراءة القيمة الحالية ثم تحديثها (كافٍ لجلسة واحدة بنفس اللحظة)
      const { data: task } = await supabase
        .from('tasks')
        .select('time_spent_seconds')
        .eq('id', activeSession.taskId)
        .single();

      await supabase
        .from('tasks')
        .update({ time_spent_seconds: (task?.time_spent_seconds || 0) + durationSeconds })
        .eq('id', activeSession.taskId);

      if (!silentTaskId) {
        showToast?.('تم إيقاف تتبع الوقت', 'ph-stop-circle');
      }
      setActiveSession(null);
    },
    [activeSession, showToast]
  );

  const start = useCallback(
    async (taskId, taskTitle) => {
      if (activeSession) {
        if (activeSession.taskId === taskId) return; // شغّالة أصلاً على نفس المهمة
        await stop(taskId); // أوقف الجلسة السابقة تلقائياً
      }

      const { data, error } = await supabase
        .from('time_sessions')
        .insert({ task_id: taskId })
        .select('id, task_id, started_at')
        .single();

      if (error) {
        console.error(error);
        showToast?.('تعذّر بدء تتبع الوقت', 'ph-x-circle', 'error');
        return;
      }

      setActiveSession({ id: data.id, taskId: data.task_id, startedAt: data.started_at });
      showToast?.(`بدأ تتبع الوقت لـ "${taskTitle}"`, 'ph-play-circle');
    },
    [activeSession, stop, showToast]
  );

  const formatElapsed = useCallback((totalSeconds) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  }, []);

  return {
    activeTaskId: activeSession?.taskId || null,
    elapsed,
    formatElapsed,
    start,
    stop: () => stop(),
  };
}
