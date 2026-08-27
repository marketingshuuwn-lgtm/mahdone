import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export function useLibrary(showToast) {
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const fetchItems = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('library_items')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      setItems(data ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    fetchItems();
    const channel = supabase
      .channel('library-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'library_items' }, () => {
        fetchItems();
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [fetchItems]);

  const addItem = useCallback(
    async ({ category, title, description, sourceName, url }) => {
      const { error } = await supabase.from('library_items').insert({
        category,
        title,
        description: description || '',
        source_name: sourceName || 'مصدرك الخاص',
        url: url || null,
        is_curated: false,
      });
      if (error) {
        console.error(error);
        showToast?.('تعذّرت إضافة المصدر', 'ph-x-circle', 'error');
        return false;
      }
      showToast?.('أُضيف مصدرك للمكتبة', 'ph-plus-circle');
      return true;
    },
    [showToast]
  );

  const removeItem = useCallback(
    async (id) => {
      const { error } = await supabase.from('library_items').delete().eq('id', id);
      if (error) {
        showToast?.('تعذّر حذف المصدر', 'ph-x-circle', 'error');
        return;
      }
      showToast?.('تم حذف المصدر', 'ph-trash');
    },
    [showToast]
  );

  return { items, loaded, addItem, removeItem, refetch: fetchItems };
}
