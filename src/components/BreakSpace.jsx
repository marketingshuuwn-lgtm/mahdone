import { useEffect, useMemo, useState } from 'react';
import { notify } from '../hooks/useLocalNotifications';
import { useLibrary } from '../hooks/useLibrary';
import PageHeader from './PageHeader';

const CATEGORIES = [
  {
    id: 'video',
    label: 'مشاهدة وتثقيف',
    tagline: 'محاضرة قصيرة تفتح لك زاوية جديدة',
    icon: 'ph-play-circle',
  },
  {
    id: 'read',
    label: 'قراءة وتعلّم',
    tagline: 'مكتبة حرة — مقالات وكتب كاملة مجاناً',
    icon: 'ph-book-open-text',
  },
  {
    id: 'inspire',
    label: 'جرعة إلهام',
    tagline: 'سؤال أو فكرة تستاهل وقفة قصيرة',
    icon: 'ph-sparkle',
  },
];

const PHRASES_KEY = 'mahd_motivation_phrases_v1';
const ACHIEVEMENT_KEY = 'mahd_small_achievement_v1';

function calculateStreak(tasks) {
  const completedDates = new Set(
    (tasks || [])
      .filter((t) => t.completed && t.completedAt)
      .map((t) => new Date(t.completedAt).toISOString().split('T')[0])
  );
  let streak = 0;
  const todayStr = new Date().toISOString().split('T')[0];
  let check = todayStr;
  if (!completedDates.has(check)) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    check = yesterday.toISOString().split('T')[0];
  }
  for (let i = 0; ; i++) {
    const d = new Date(check);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().split('T')[0];
    if (completedDates.has(iso)) streak++;
    else break;
  }
  return streak;
}

function pickRandom(list, excludeId) {
  const pool = list.length > 1 ? list.filter((i) => i.id !== excludeId) : list;
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

export default function BreakSpace({ tasks, showToast }) {
  const { items, addItem } = useLibrary(showToast);
  const [category, setCategory] = useState(null);
  const [current, setCurrent] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ title: '', url: '', description: '' });
  const [achievedToday, setAchievedToday] = useState(false);

  const streak = useMemo(() => calculateStreak(tasks), [tasks]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ACHIEVEMENT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setAchievedToday(parsed?.date === new Date().toISOString().split('T')[0]);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const itemsInCategory = useMemo(
    () => items.filter((i) => i.category === category),
    [items, category]
  );

  const openCategory = (id) => {
    setCategory(id);
    const list = items.filter((i) => i.category === id);
    setCurrent(pickRandom(list));
  };

  const nextItem = () => setCurrent(pickRandom(itemsInCategory, current?.id));

  const backToCategories = () => {
    setCategory(null);
    setCurrent(null);
  };

  const markSmallWin = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    localStorage.setItem(
      ACHIEVEMENT_KEY,
      JSON.stringify({ date: todayStr, text: 'أنجزت خطوة صغيرة اليوم' })
    );
    setAchievedToday(true);
    notify('مهد — إنجاز صغير', 'أحسنت! سجّلنا إنجازك الصغير لليوم');
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!addForm.title.trim()) return;
    const ok = await addItem({
      category,
      title: addForm.title.trim(),
      description: addForm.description.trim(),
      url: addForm.url.trim(),
      sourceName: 'إضافتك',
    });
    if (ok) {
      setAddForm({ title: '', url: '', description: '' });
      setShowAddForm(false);
    }
  };

  return (
    <div className="break-space">
      <PageHeader
        eyebrow="استعادة الطاقة"
        title="مساحة الاستراحة"
        description="توقف قصير مقصود يساعدك على العودة، بدل فتح مصدر عشوائي وسط العمل."
        meta={<span>{streak} يوم متتالي</span>}
      />
      <div className="break-topbar">
                  <div className="break-streak">
            <i className="ph ph-fire"></i>
            <span>استراحة قصيرة</span>
          </div>

        <button
          type="button"
          className={`break-win-btn ${achievedToday ? 'done' : ''}`}
          onClick={markSmallWin}
          disabled={achievedToday}
        >
          <i className="ph ph-check-circle"></i>
          {achievedToday ? 'سجّلت إنجازك اليوم' : 'أنجزت شيء صغير اليوم'}
        </button>
      </div>

      {!category && (
        <div className="break-intro">
          <div className="break-intro-title">وقت الاستراحة ☕</div>
          <p className="break-intro-sub">اختر شيء يناسب مزاجك الحين</p>
          <div className="break-category-grid">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                className="break-category-card"
                onClick={() => openCategory(c.id)}
              >
                <i className={`ph ${c.icon}`}></i>
                <div className="break-category-label">{c.label}</div>
                <div className="break-category-tagline">{c.tagline}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {category && (
        <div className="break-content">
          <button type="button" className="break-back-btn" onClick={backToCategories}>
            <i className="ph ph-arrow-right"></i> الفئات
          </button>

          {!current ? (
            <div className="break-empty">
              <p>ما فيه مصادر بهذا القسم بعد.</p>
              <button type="button" className="btn-primary" onClick={() => setShowAddForm(true)}>
                أضف أول مصدر
              </button>
            </div>
          ) : (
            <div className="break-card">
              {current.embed_provider === 'ted' && current.embed_id && (
                <div className="break-embed-wrap">
                  <iframe
                    src={`https://embed.ted.com/talks/${current.embed_id}`}
                    title={current.title}
                    className="break-embed"
                    allow="autoplay; fullscreen; encrypted-media"
                    loading="lazy"
                  ></iframe>
                </div>
              )}

              <div className="break-source-tag">{current.source_name}</div>
              <h2 className="break-card-title">{current.title}</h2>
              {current.description && <p className="break-card-desc">{current.description}</p>}

              {current.url && current.embed_provider !== 'ted' && (
                <a
                  href={current.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary break-open-btn"
                >
                  <i className="ph ph-arrow-square-out"></i> افتح المصدر
                </a>
              )}

              <div className="break-actions">
                <button type="button" className="btn-secondary" onClick={nextItem}>
                  <i className="ph ph-shuffle"></i> عطني غيره
                </button>
                <button
                  type="button"
                  className="break-add-link"
                  onClick={() => setShowAddForm((v) => !v)}
                >
                  + أضف مصدرك الخاص لهذا القسم
                </button>
              </div>
            </div>
          )}

          {showAddForm && (
            <form className="break-add-form" onSubmit={handleAddSubmit}>
              <input
                className="form-input"
                placeholder="العنوان"
                value={addForm.title}
                onChange={(e) => setAddForm({ ...addForm, title: e.target.value })}
                required
              />
              <input
                className="form-input"
                placeholder="الرابط (اختياري)"
                value={addForm.url}
                onChange={(e) => setAddForm({ ...addForm, url: e.target.value })}
              />
              <textarea
                className="form-input"
                placeholder="وصف قصير (اختياري)"
                rows={2}
                value={addForm.description}
                onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" className="btn-primary">
                  حفظ
                </button>
                <button type="button" className="btn-secondary" onClick={() => setShowAddForm(false)}>
                  إلغاء
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
