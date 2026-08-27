import { useMemo, useState } from 'react';
import PageHeader from './PageHeader';
import EmptyState from './EmptyState';
import TaskRow from './TaskRow';
import { isEffectivelyOpen } from '../utils/taskStatus';

export default function ProjectsView({ projects = [], tasks = [], onCreateProject, onEdit, onToggleComplete, onSetStatus, onToggleSubtask, onDelete, onReschedule, workDays, workspaces }) {
  const [activeId, setActiveId] = useState(null);
  const activeProject = projects.find((project) => project.id === activeId) || null;
  const projectStats = useMemo(() => projects.map((project) => {
    const projectTasks = tasks.filter((task) => task.projectId === project.id);
    const open = projectTasks.filter(isEffectivelyOpen).length;
    const completed = projectTasks.length - open;
    return { project, projectTasks, open, completed, total: projectTasks.length };
  }), [projects, tasks]);
  const unassignedTasks = useMemo(() => {
    const projectIds = new Set(projects.map((project) => project.id));
    return tasks.filter((task) => isEffectivelyOpen(task) && (!task.projectId || !projectIds.has(task.projectId)));
  }, [projects, tasks]);

  return (
    <div className="projects-view">
      <PageHeader
        eyebrow="مساحات العمل"
        title="المشاريع"
        description="حوّل العمل الكبير إلى حاويات واضحة بمخرج وموعد، ثم اسحب منه ما يستحق أن يدخل خطة اليوم."
        actions={<button type="button" className="btn-primary" onClick={onCreateProject}><i className="ph ph-folder-plus" /> مشروع جديد</button>}
        meta={<span>{projects.length} مشروع نشط</span>}
      />

      {projects.length === 0 ? (
        <>
          <EmptyState icon="ph-folder-open" title="لا توجد مشاريع بعد" hint="أنشئ أول مشروع، ثم اربط المهام به من تفاصيل المهمة." actionLabel="إنشاء مشروع" onAction={onCreateProject} />
          {unassignedTasks.length > 0 && <section className="unassigned-project-tasks" aria-label="مهام غير مصنفة">
            <div className="unassigned-project-heading"><div><span className="page-hero-eyebrow">تحتاج تنظيمًا اختياريًا</span><h2>مهام غير مصنفة</h2><p>هذه المهام تعمل خارج مشروع. يمكنك إبقاءها كذلك أو ربطها بمشروع عند وضوح المخرج.</p></div><strong>{unassignedTasks.length}</strong></div>
            <div className="project-unassigned-list">{unassignedTasks.slice(0, 12).map((task) => <TaskRow key={task.id} task={task} onToggleComplete={onToggleComplete} onSetStatus={onSetStatus} onToggleSubtask={onToggleSubtask} onEdit={onEdit} onDelete={onDelete} onReschedule={onReschedule} draggable={false} workDays={workDays} workspaces={workspaces} />)}</div>
          </section>}
        </>
      ) : (
        <div className="projects-layout">
          <section className="projects-grid" aria-label="المشاريع">
            {projectStats.map(({ project, open, completed, total }) => (
              <button type="button" key={project.id} className={`project-card ${activeId === project.id ? 'is-active' : ''}`} onClick={() => setActiveId(project.id)}>
                <span className="project-card-color" style={{ background: project.color }} />
                <span className="project-card-topline"><span>{project.context}</span><span>{total} مهام</span></span>
                <strong>{project.name}</strong>
                <span className="project-card-description">{project.description || 'لا يوجد وصف بعد'}</span>
                <span className="project-card-progress"><span style={{ width: `${total ? Math.round((completed / total) * 100) : 0}%`, background: project.color }} /></span>
                <span className="project-card-footer"><span>{completed} مكتملة</span><span>{open} متبقية</span></span>
              </button>
            ))}
          </section>

          <aside className="project-detail-panel">
            {activeProject ? (() => {
              const projectTasks = tasks.filter((task) => task.projectId === activeProject.id && isEffectivelyOpen(task));
              return (
                <>
                  <div className="project-detail-heading"><span className="page-hero-eyebrow">المشروع النشط</span><h2>{activeProject.name}</h2><p>{activeProject.description || 'أضف وصفًا يوضح المخرج المطلوب من المشروع.'}</p></div>
                  <div className="project-detail-meta"><span>{projectTasks.length} مهام مفتوحة</span>{activeProject.dueDate && <span>التسليم {activeProject.dueDate}</span>}</div>
                  {projectTasks.length > 0 ? projectTasks.map((task) => <TaskRow key={task.id} task={task} onToggleComplete={onToggleComplete} onSetStatus={onSetStatus} onToggleSubtask={onToggleSubtask} onEdit={onEdit} onDelete={onDelete} onReschedule={onReschedule} draggable={false} workDays={workDays} workspaces={workspaces} />) : <EmptyState icon="ph-check-circle" title="المشروع هادئ" hint="لا توجد مهام مفتوحة في هذا المشروع." />}
                </>
              );
            })() : <div className="project-detail-empty"><i className="ph ph-cursor-click" /><p>اختر مشروعًا لترى مهامه ومخرجه.</p></div>}
          </aside>
        </div>
      )}
    </div>
  );
}
