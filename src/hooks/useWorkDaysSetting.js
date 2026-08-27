import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { DEFAULT_WORK_DAYS, normalizeWorkDays } from '../utils/taskMeta';

const CACHE_KEY = 'mahd_work_days_v1';

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return DEFAULT_WORK_DAYS;
    return normalizeWorkDays(JSON.parse(raw));
  } catch {
    return DEFAULT_WORK_DAYS;
  }
}

function writeCache(days) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(days));
  } catch {
    // تجاهل أخطاء التخزين المحلي (وضع خاص، مساحة ممتلئة...)
  }
}

/**
 * أيام العمل مخزّنة في جدول app_settings بقاعدة بيانات Supabase (صف واحد ثابت id=1)
 * حتى تتزامن بين كل الأجهزة فوراً. localStorage يُستخدم فقط كـ cache للتحميل الفوري
 * قبل ما يوصل رد الشبكة، وكـ احتياط لو انقطع الاتصال.
 */
export function useWorkDaysSetting(showToast) {
  const [workDays, setWorkDaysState] = useState(readCache);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const { data, error } = await supabase
          .from('app_settings')
          .select('work_days')
          .eq('id', 1)
          .single();

        if (!active) return;
        if (error) throw error;
        if (data?.work_days) {
          const normalized = normalizeWorkDays(data.work_days);
          setWorkDaysState(normalized);
          writeCache(normalized);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setLoaded(true);
      }
    })();

    const channel = supabase
      .channel('app-settings-realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'app_settings' },
        (payload) => {
          const normalized = normalizeWorkDays(payload.new?.work_days);
          setWorkDaysState(normalized);
          writeCache(normalized);
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const setWorkDays = useCallback(
    async (days) => {
      const normalized = normalizeWorkDays(days);
      setWorkDaysState(normalized);
      writeCache(normalized);

      const { error } = await supabase
        .from('app_settings')
        .update({ work_days: normalized, updated_at: new Date().toISOString() })
        .eq('id', 1);

      if (error) {
        console.error(error);
        showToast?.('تعذّر حفظ أيام العمل في قاعدة البيانات (تم الحفظ محلياً فقط)', 'ph-warning', 'error');
        return;
      }
      showToast?.('تم حفظ أيام العمل — يتزامن مع كل أجهزتك', 'ph-check-circle');
    },
    [showToast]
  );

  return { workDays, setWorkDays, loaded };
}
