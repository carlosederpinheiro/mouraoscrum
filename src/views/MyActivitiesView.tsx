import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, SlidersHorizontal, ChevronDown, CheckCircle2, AlertCircle, Clock, Calendar, ArrowRight, User, ListTodo, TrendingUp, Plus, Filter, X } from 'lucide-react';
import { DndContext, closestCorners, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, DragOverlay, defaultDropAnimationSideEffects } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { EnrichedTask, Staff, TaskStatus, TaskPriority, MacroAreaWithProjects, Task, Company } from '../types';
import { cn, getPriorityColor, getPriorityLabel, getInitials, calculateDueDateStatus, mapStatusToDB } from '../lib/utils';
import { Modal } from '../components/shared/Modal';
import { TaskColumn } from '../components/kanban/TaskColumn';
import { DroppableColumn } from '../components/kanban/DroppableColumn';
import { TaskCard } from '../components/kanban/TaskCard';
import { toast } from 'sonner';
import { useConfirm } from '../hooks/useConfirm';
import { supabase } from '../lib/supabase';

export function MyActivitiesView({ 
  data, 
  personalTasks, 
  onUpdatePersonalTasks,
  onUpdateGlobalData,
  companies = [],
  currentUser,
  staff = []
}: { 
  data: MacroAreaWithProjects[], 
  personalTasks: Task[], 
  onUpdatePersonalTasks: (tasks: Task[]) => void,
  onUpdateGlobalData: (data: MacroAreaWithProjects[]) => void,
  companies?: Company[],
  currentUser: any,
  staff?: Staff[]
}) {
  const { confirm } = useConfirm();
  const [filterType, setFilterType] = useState<'all' | 'personal' | 'corporate'>('all');
  const [filterCompany, setFilterCompany] = useState<string>('all');
  const [filterMacro, setFilterMacro] = useState<string>('all');
  const [filterProject, setFilterProject] = useState<string>('all');
  const [filterSprint, setFilterSprint] = useState<string>('all');
  
  const [isPersonalModalOpen, setIsPersonalModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDeadline, setNewTaskDeadline] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>('medium');
  const [newTaskCompanyId, setNewTaskCompanyId] = useState<string>('');
  const [activeId, setActiveId] = useState<string | null>(null);

  const myName = currentUser?.full_name || 'Usuário Local';

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const allMyTasks = useMemo(() => {
    const tasks: (EnrichedTask & { macroAreaTitle: string, projectTitle: string, sprintTitle: string, isPersonal?: boolean, company_id?: string, companyName?: string })[] = [];
    
    // Corporate Tasks
    data.forEach(area => {
      area.projects.forEach(project => {
        project.sprints.forEach(sprint => {
          sprint.tasks.forEach(task => {
            const isAssignedToMe = (task.assignees || []).some(a => 
              a.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === 
              myName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            );
            if (isAssignedToMe) {
              const company = companies.find(c => c.id === project.company_id);
              tasks.push({
                ...task,
                macroAreaId: area.id,
                projectId: project.id,
                sprint_id: sprint.id,
                macroAreaTitle: area.name,
                projectTitle: project.name,
                sprintTitle: sprint.title,
                isPersonal: false,
                company_id: project.company_id,
                companyName: company?.name
              });
            }
          });
        });
      });
    });

    // Personal Tasks
    personalTasks.forEach(task => {
      const company = companies.find(c => c.id === task.company_id);
      tasks.push({
        ...task,
        macroAreaId: 'personal',
        projectId: 'personal',
        sprint_id: 'personal',
        macroAreaTitle: 'Particular',
        projectTitle: 'Minhas Atividades',
        sprintTitle: 'Privado',
        isPersonal: true,
        company_id: task.company_id,
        companyName: company?.name
      });
    });

    return tasks;
  }, [data, personalTasks]);

  const filteredTasks = useMemo(() => {
    let tasks = allMyTasks.filter(task => {
      const matchType = filterType === 'all' || 
                        (filterType === 'personal' && task.isPersonal) || 
                        (filterType === 'corporate' && !task.isPersonal);
      const matchCompany = filterCompany === 'all' || task.company_id === filterCompany;
      const matchMacro = filterMacro === 'all' || task.macroAreaId === filterMacro;
      const matchProject = filterProject === 'all' || task.projectId === filterProject;
      const matchSprint = filterSprint === 'all' || task.sprint_id === filterSprint;
      return matchType && matchCompany && matchMacro && matchProject && matchSprint;
    });

    // Sort tasks: Priority (High > Medium > Low), then Due Date (closest first)
    return tasks.sort((a, b) => {
      const priorityWeight = { high: 3, medium: 2, low: 1 };
      const pA = priorityWeight[a.priority || 'medium'];
      const pB = priorityWeight[b.priority || 'medium'];
      
      if (pA !== pB) return pB - pA;
      
      if (a.due_date && b.due_date) {
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      } else if (a.due_date) {
        return -1;
      } else if (b.due_date) {
        return 1;
      }
      
      return 0;
    });
  }, [allMyTasks, filterType, filterCompany, filterMacro, filterProject, filterSprint]);

  // Derived options for filters based on current selection
  const macroOptions = useMemo(() => {
    const unique = new Map();
    allMyTasks.forEach(t => unique.set(t.macroAreaId, t.macroAreaTitle));
    return Array.from(unique.entries());
  }, [allMyTasks]);

  const projectOptions = useMemo(() => {
    const unique = new Map();
    allMyTasks
      .filter(t => filterMacro === 'all' || t.macroAreaId === filterMacro)
      .forEach(t => unique.set(t.projectId, t.projectTitle));
    return Array.from(unique.entries());
  }, [allMyTasks, filterMacro]);

  const sprintOptions = useMemo(() => {
    const unique = new Map();
    allMyTasks
      .filter(t => (filterMacro === 'all' || t.macroAreaId === filterMacro) && (filterProject === 'all' || t.projectId === filterProject))
      .forEach(t => unique.set(t.sprint_id, t.sprintTitle));
    return Array.from(unique.entries());
  }, [allMyTasks, filterMacro, filterProject]);

  const handleCreatePersonalTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    try {
      const { data: authData } = await supabase.auth.getUser();
      // Use fallback if not logged in for local dev, though DB might reject if RLS is strict
      const profileId = authData.user?.id || '00000000-0000-0000-0000-000000000000';

      if (editingTask) {
        if (editingTask.isPersonal) {
          // Update DB
          const { error } = await supabase.from('personal_tasks').update({
            title: newTaskTitle,
            due_date: newTaskDeadline || null,
            priority: newTaskPriority,
            company_id: newTaskCompanyId || null
          }).eq('id', editingTask.id);

          if (error) throw error;

          onUpdatePersonalTasks(personalTasks.map(t => t.id === editingTask.id ? { 
            ...t, 
            title: newTaskTitle, 
            due_date: newTaskDeadline || undefined,
            priority: newTaskPriority,
            company_id: newTaskCompanyId || undefined
          } : t));
          toast.success('Atividade pessoal atualizada com sucesso.');
        } else {
          // Corporate Task Update
          const { error } = await supabase.from('tasks').update({
            title: newTaskTitle,
            due_date: newTaskDeadline || null,
            priority: newTaskPriority
          }).eq('id', editingTask.id);

          if (error) throw error;

          const newData = data.map(area => ({
            ...area,
            projects: area.projects.map(project => ({
              ...project,
              sprints: project.sprints.map(sprint => ({
                ...sprint,
                tasks: sprint.tasks.map(task => 
                  task.id === editingTask.id ? { 
                    ...task, 
                    title: newTaskTitle, 
                    due_date: newTaskDeadline || undefined,
                    priority: newTaskPriority
                  } : task
                )
              }))
            }))
          }));
          onUpdateGlobalData(newData);
          toast.success('Atividade atualizada com sucesso.');
        }
      } else {
        // Insert into DB
        const { data: inserted, error } = await supabase.from('personal_tasks').insert({
          profile_id: profileId,
          title: newTaskTitle,
          status: 'todo',
          priority: newTaskPriority,
          due_date: newTaskDeadline || null,
          company_id: newTaskCompanyId || null
        }).select().single();

        if (error) throw error;

        const newTask: Task = {
          id: inserted.id,
          title: newTaskTitle,
          status: 'todo',
          priority: newTaskPriority,
          assignees: [myName],
          due_date: newTaskDeadline || undefined,
          company_id: newTaskCompanyId || undefined
        };
        onUpdatePersonalTasks([...personalTasks, newTask]);
        toast.success('Atividade pessoal criada com sucesso.');
      }

      setNewTaskTitle('');
      setNewTaskDeadline('');
      setNewTaskPriority('medium');
      setNewTaskCompanyId('');
      setEditingTask(null);
      setIsPersonalModalOpen(false);
    } catch (err: any) {
      toast.error('Erro ao salvar atividade: ' + (err.message || 'Tente novamente.'));
    }
  };

  const handleDeleteAnyTask = async (taskId: string) => {
    const confirmed = await confirm({
      title: 'Excluir Atividade',
      message: 'Deseja realmente excluir esta atividade?'
    });
    if (!confirmed) return;

    const task = allMyTasks.find(t => t.id === taskId);
    const isPersonal = task?.isPersonal || taskId.startsWith('pt_');

    try {
      if (isPersonal) {
        if (!taskId.startsWith('pt_')) {
          const { error } = await supabase.from('personal_tasks').delete().eq('id', taskId);
          if (error) throw error;
        }
        onUpdatePersonalTasks(personalTasks.filter(t => t.id !== taskId));
        toast.success('Atividade pessoal excluída com sucesso.');
      } else {
        const { error } = await supabase.from('tasks').delete().eq('id', taskId);
        if (error) throw error;

        const newData = data.map(area => ({
          ...area,
          projects: area.projects.map(project => ({
            ...project,
            sprints: project.sprints.map(sprint => ({
              ...sprint,
              tasks: sprint.tasks.filter(t => t.id !== taskId)
            }))
          }))
        }));
        onUpdateGlobalData(newData);
        toast.success('Atividade excluída com sucesso.');
      }
    } catch (err: any) {
      toast.error('Erro ao excluir atividade: ' + (err.message || 'Tente novamente.'));
    }
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task as EnrichedTask);
    setNewTaskTitle(task.title);
    setNewTaskDeadline(task.due_date || '');
    setNewTaskPriority(task.priority || 'medium');
    setNewTaskCompanyId(task.company_id || '');
    setIsPersonalModalOpen(true);
  };

  const handleUpdateTaskStatus = async (taskId: string, newStatus: TaskStatus) => {
    const task = allMyTasks.find(t => t.id === taskId);
    const isPersonal = task?.isPersonal || taskId.startsWith('pt_');

    if (isPersonal) {
      try {
        if (!taskId.startsWith('pt_')) {
          const { error } = await supabase.from('personal_tasks').update({ status: newStatus }).eq('id', taskId);
          if (error) throw error;
        }
        onUpdatePersonalTasks(personalTasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
      } catch (err) {
        toast.error('Erro ao atualizar status da tarefa pessoal.');
      }
    } else {
      try {
        const { error } = await supabase.from('tasks').update({ status: mapStatusToDB(newStatus) }).eq('id', taskId);
        if (error) throw error;
        
        // Corporate Task Update
        const newData = data.map(area => ({
          ...area,
          projects: area.projects.map(project => ({
            ...project,
            sprints: project.sprints.map(sprint => ({
              ...sprint,
              tasks: sprint.tasks.map(t => 
                t.id === taskId ? { ...t, status: newStatus } : t
              )
            }))
          }))
        }));
        onUpdateGlobalData(newData);
      } catch (err: any) {
        toast.error('Erro ao atualizar status no DB: ' + (err.message || 'Desconhecido'));
      }
    }
  };

  const handleDragStart = (event: any) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const newStatus = over.id as TaskStatus;

    await handleUpdateTaskStatus(taskId, newStatus);
  };

  const columns: { id: TaskStatus, title: string, icon: any, color: string }[] = [
    { id: 'todo', title: 'A Fazer', icon: ListTodo, color: 'bg-slate-500' },
    { id: 'in-progress', title: 'Em Andamento', icon: TrendingUp, color: 'bg-brand-accent' },
    { id: 'review', title: 'Em Revisão', icon: CheckCircle2, color: 'bg-amber-400' },
    { id: 'done', title: 'Concluído', icon: CheckCircle2, color: 'bg-emerald-500' },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto scrollbar-hide">
      <div className="bg-white border-b border-slate-200 p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <nav className="flex text-xs uppercase font-bold text-slate-400 mb-1 space-x-2">
              <span>Carlos Eder</span>
              <span>/</span>
              <span className="text-brand-primary">Atividades</span>
            </nav>
            <h3 className="text-2xl font-bold text-slate-800">Minhas Atividades</h3>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                setEditingTask(null);
                setNewTaskTitle('');
                setNewTaskDeadline('');
                setNewTaskPriority('medium');
                setIsPersonalModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-brand-primary text-white rounded-xl text-xs font-bold shadow-elegant hover:scale-105 active:scale-95 transition-all cursor-pointer uppercase tracking-wider"
            >
              <Plus size={16} strokeWidth={3} /> Nova Atividade Pessoal
            </button>
            <div className="px-4 py-2 bg-brand-primary/5 rounded-lg border border-brand-primary/10">
              <span className="text-xs font-bold text-brand-primary/60 uppercase block mb-0.5">Total de Tarefas</span>
              <span className="text-lg font-black text-brand-primary">{filteredTasks.length}</span>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200 shadow-subtle">
            <div className="flex items-center gap-2 px-3 text-slate-400">
              <Filter size={16} />
              <span className="text-xs font-bold uppercase tracking-wider">Filtros:</span>
            </div>
            
            <div className="h-6 w-px bg-slate-200 mx-1"></div>

            <select 
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value as any);
                if (e.target.value === 'personal') {
                  setFilterCompany('all');
                  setFilterMacro('all');
                  setFilterProject('all');
                  setFilterSprint('all');
                }
              }}
              className="bg-transparent text-sm font-bold text-slate-600 focus:outline-none px-2 cursor-pointer"
            >
              <option value="all">Ver Tudo</option>
              <option value="corporate">Apenas Corporativo</option>
              <option value="personal">Apenas Pessoal</option>
            </select>

            {filterType !== 'personal' && (
              <>
                <div className="h-4 w-px bg-slate-200 mx-1"></div>
                <select 
                  value={filterCompany}
                  onChange={(e) => {
                    setFilterCompany(e.target.value);
                    setFilterMacro('all');
                    setFilterProject('all');
                    setFilterSprint('all');
                  }}
                  className="bg-transparent text-sm font-bold text-slate-600 focus:outline-none px-2 cursor-pointer"
                >
                  <option value="all">Empresa: Todas</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>

                <div className="h-4 w-px bg-slate-200 mx-1"></div>
                <select 
                  value={filterMacro}
                  onChange={(e) => {
                    setFilterMacro(e.target.value);
                    setFilterProject('all');
                    setFilterSprint('all');
                  }}
                  className="bg-transparent text-sm font-bold text-slate-600 focus:outline-none px-2 cursor-pointer"
                >
                  <option value="all">Todas as Áreas</option>
                  {macroOptions.filter(([id]) => id !== 'personal').map(([id, title]) => <option key={id} value={id}>{title}</option>)}
                </select>

                <div className="h-4 w-px bg-slate-200 mx-1"></div>
                <select 
                  value={filterProject}
                  onChange={(e) => {
                    setFilterProject(e.target.value);
                    setFilterSprint('all');
                  }}
                  className="bg-transparent text-sm font-bold text-slate-600 focus:outline-none px-2 cursor-pointer"
                >
                  <option value="all">Todos Projetos</option>
                  {projectOptions.filter(([id]) => id !== 'personal').map(([id, title]) => <option key={id} value={id}>{title}</option>)}
                </select>
              </>
            )}

            <div className="h-4 w-px bg-slate-200 mx-1"></div>

            <select 
              value={filterSprint}
              onChange={(e) => setFilterSprint(e.target.value)}
              className="bg-transparent text-sm font-bold text-slate-600 focus:outline-none px-2 cursor-pointer"
            >
              <option value="all">Todas as Etapas</option>
              {sprintOptions.map(([id, title]) => <option key={id} value={id}>{title}</option>)}
            </select>
          </div>
          
          {(filterType !== 'all' || filterCompany !== 'all' || filterMacro !== 'all' || filterProject !== 'all' || filterSprint !== 'all') && (
            <button 
              onClick={() => {
                setFilterType('all');
                setFilterCompany('all');
                setFilterMacro('all');
                setFilterProject('all');
                setFilterSprint('all');
              }}
              className="text-xs font-bold text-slate-400 hover:text-brand-primary flex items-center gap-1 transition-colors px-2"
            >
              <X size={14} /> Limpar Filtros
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 p-6">
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-6 h-full pb-10 overflow-x-auto">
            {columns.map(column => (
              <DroppableColumn 
                key={column.id} 
                column={column} 
                tasks={filteredTasks.filter(t => t.status === column.id)}
                onEditPersonalTask={handleEditTask}
                onDeletePersonalTask={handleDeleteAnyTask}
                personalTasksCount={personalTasks.length}
                staff={staff}
              />
            ))}
          </div>
          <DragOverlay dropAnimation={{
            duration: 250,
            easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
            sideEffects: defaultDropAnimationSideEffects({
              styles: {
                active: { opacity: '0.4' },
              },
            }),
          }}>
            {activeId && filteredTasks.find(t => t.id === activeId) ? (
              <TaskCard task={filteredTasks.find(t => t.id === activeId)!} isOverlay staff={staff || []} />
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      <Modal 
        isOpen={isPersonalModalOpen} 
        onClose={() => {
          setIsPersonalModalOpen(false);
          setEditingTask(null);
        }} 
        title={editingTask ? "Editar Atividade" : "Nova Atividade Pessoal"}
      >
        <form onSubmit={handleCreatePersonalTask} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">O que precisa ser feito?</label>
            <input 
              type="text" 
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/50 focus:border-brand-accent transition-all font-bold text-slate-800"
              placeholder="Ex: Revisar planilha de custos particular..."
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Prazo (Opcional)</label>
              <input 
                type="date" 
                value={newTaskDeadline}
                onChange={(e) => setNewTaskDeadline(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/50 focus:border-brand-accent transition-all font-bold text-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Prioridade</label>
              <select 
                value={newTaskPriority}
                onChange={(e) => setNewTaskPriority(e.target.value as TaskPriority)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/50 focus:border-brand-accent transition-all font-bold text-slate-800"
              >
                <option value="low">Baixa</option>
                <option value="medium">Média</option>
                <option value="high">Alta</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Empresa / Cliente (Opcional)</label>
            <select 
              value={newTaskCompanyId}
              onChange={(e) => setNewTaskCompanyId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/50 focus:border-brand-accent transition-all font-bold text-slate-800"
            >
              <option value="">Nenhuma</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <button 
            type="submit"
            className="w-full py-3.5 bg-brand-primary text-white rounded-xl text-xs font-bold shadow-elegant hover:scale-[1.02] active:scale-[0.98] transition-all uppercase tracking-wider mt-2"
          >
            {editingTask ? "Salvar Alterações" : "Criar Atividade"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
