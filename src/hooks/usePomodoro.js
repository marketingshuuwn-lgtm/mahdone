import { useState, useEffect, useCallback, useRef } from 'react';
import { recordPomodoroSession } from '../lib/pomodoroSessions';

const POMODORO_KEY = 'mahd_pomodoro_state_v1';
const WORK_SECONDS = 25 * 60;
const BREAK_SECONDS = 5 * 60;

const DEFAULT_STATE = {
  running: false,
  mode: 'work',
  remaining: WORK_SECONDS,
  plannedSeconds: WORK_SECONDS,
  startedAt: null,
  taskId: null,
  taskTitle: null,
  context: 'work',
};

function loadState() {
  try {
    const raw = localStorage.getItem(POMODORO_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_STATE,
      ...parsed,
      remaining: Number(parsed.remaining) || DEFAULT_STATE.remaining,
      plannedSeconds: Number(parsed.plannedSeconds) || DEFAULT_STATE.plannedSeconds,
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function persistLocal(next) {
  localStorage.setItem(
    POMODORO_KEY,
    JSON.stringify({
      running: next.running,
      mode: next.mode,
      remaining: next.remaining,
      plannedSeconds: next.plannedSeconds,
      startedAt: next.startedAt,
      taskId: next.taskId,
      taskTitle: next.taskTitle,
      context: next.context,
    })
  );
}

async function saveCompletedSession(prev) {
  const planned = prev.plannedSeconds || (prev.mode === 'break' ? BREAK_SECONDS : WORK_SECONDS);
  const elapsed = Math.max(0, planned - (prev.remaining || 0));
  // نحفظ فقط إذا مرّت ثانيتان على الأقل (تجنب ضوضاء)
  if (elapsed < 2) return;

  await recordPomodoroSession({
    taskId: prev.taskId,
    taskTitle: prev.taskTitle,
    context: prev.context,
    mode: prev.mode,
    plannedSeconds: planned,
    elapsedSeconds: planned, // اكتملت الدورة بالكامل
    completed: true,
    startedAt: prev.startedAt || Date.now() - planned * 1000,
    endedAt: Date.now(),
  });
}

export function usePomodoro() {
  const [state, setState] = useState(loadState);
  const intervalRef = useRef(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const apply = useCallback((next) => {
    setState(next);
    persistLocal(next);
  }, []);

  useEffect(() => {
    if (!state.running) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setState((prev) => {
        if (prev.remaining <= 1) {
          // اكتملت الجلسة الحالية
          void saveCompletedSession({ ...prev, remaining: 0 });

          const nextMode = prev.mode === 'work' ? 'break' : 'work';
          const nextPlanned = nextMode === 'work' ? WORK_SECONDS : BREAK_SECONDS;
          const next = {
            ...prev,
            mode: nextMode,
            remaining: nextPlanned,
            plannedSeconds: nextPlanned,
            startedAt: Date.now(),
            running: true,
          };
          persistLocal(next);
          return next;
        }

        const next = { ...prev, remaining: prev.remaining - 1 };
        persistLocal(next);
        return next;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [state.running]);

  const start = useCallback(
    (meta = {}) => {
      const prev = stateRef.current;
      const mode = prev.mode || 'work';
      const planned =
        prev.remaining > 0 && prev.remaining < (prev.plannedSeconds || WORK_SECONDS)
          ? prev.plannedSeconds || (mode === 'break' ? BREAK_SECONDS : WORK_SECONDS)
          : mode === 'break'
            ? BREAK_SECONDS
            : WORK_SECONDS;

      apply({
        ...prev,
        running: true,
        startedAt: prev.startedAt || Date.now(),
        plannedSeconds: planned,
        remaining: prev.remaining > 0 ? prev.remaining : planned,
        taskId: meta.taskId != null ? meta.taskId : prev.taskId,
        taskTitle: meta.taskTitle != null ? meta.taskTitle : prev.taskTitle,
        context: meta.context != null ? meta.context : prev.context,
      });
    },
    [apply]
  );

  const stop = useCallback(() => {
    apply({ ...stateRef.current, running: false });
  }, [apply]);

  const reset = useCallback(async () => {
    const prev = stateRef.current;
    // إن وُجدت جلسة جارية بوقت معتاد → نسجّلها كغير مكتملة
    if (prev.startedAt && prev.remaining < (prev.plannedSeconds || WORK_SECONDS) - 1) {
      const planned = prev.plannedSeconds || WORK_SECONDS;
      const elapsed = Math.max(0, planned - prev.remaining);
      if (elapsed >= 30) {
        await recordPomodoroSession({
          taskId: prev.taskId,
          taskTitle: prev.taskTitle,
          context: prev.context,
          mode: prev.mode,
          plannedSeconds: planned,
          elapsedSeconds: elapsed,
          completed: false,
          startedAt: prev.startedAt,
          endedAt: Date.now(),
        });
      }
    }
    apply({ ...DEFAULT_STATE });
  }, [apply]);

  const toggle = useCallback(() => {
    if (stateRef.current.running) stop();
    else start();
  }, [start, stop]);

  return {
    running: state.running,
    mode: state.mode,
    remaining: state.remaining,
    taskTitle: state.taskTitle,
    start,
    stop,
    reset,
    toggle,
  };
}
