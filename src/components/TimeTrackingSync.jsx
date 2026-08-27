import { useEffect } from 'react';
import { useTimeTracking } from '../hooks/useTimeTracking';
import { useToast } from '../hooks/useToast';

export default function TimeTrackingSync() {
  const showToast = useToast();
  const { activeTaskId, elapsed, formatElapsed, start, stop } = useTimeTracking(showToast);

  useEffect(() => {
    const handleToggle = (e) => {
      const { taskId, title } = e.detail;
      if (activeTaskId === taskId) {
        stop();
      } else {
        start(taskId, title);
      }
    };
    window.addEventListener('toggle-time-tracking', handleToggle);
    return () => window.removeEventListener('toggle-time-tracking', handleToggle);
  }, [activeTaskId, start, stop]);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('time-tracking-state', {
        detail: { activeTaskId, label: formatElapsed(elapsed) },
      })
    );
  }, [activeTaskId, elapsed, formatElapsed]);

  return null;
}
