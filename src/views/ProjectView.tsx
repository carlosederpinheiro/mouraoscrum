import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Plus, Edit, Trash, Calendar, Users, ListTodo, TrendingUp, CheckCircle2, Clock, MessageSquare, AlertCircle, Search, Filter, X, Briefcase, ChevronDown, CheckSquare } from 'lucide-react';
import { DndContext, closestCorners, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, DragStartEvent, DragOverlay, defaultDropAnimationSideEffects } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { MacroAreaWithProjects, Staff, Company, ProjectWithSprints, Sprint, EnrichedTask, Task, TaskStatus, TaskPriority, SprintWithTasks } from '../types';
import { Modal } from '../components/shared/Modal';
import { supabase } from '../lib/supabase';
import { TaskColumn } from '../components/kanban/TaskColumn';
import { TaskCard } from '../components/kanban/TaskCard';
import { toast } from 'sonner';
import { useConfirm } from '../hooks/useConfirm';
import { mapStatusToDB, cn } from '../lib/utils';

export function ProjectView({ project, activeMacroArea, onBack, onUpdateData, allData, companies = [], staff = [] }: { project: ProjectWithSprints, activeMacroArea: MacroAreaWithProjects, onBack: () => void, onUpdateData: (data: MacroAreaWithProjects[]) => void, allData: MacroAreaWithProjects[], companies?: Company[], staff?: Staff[] }) {
  const { confirm } = useConfirm();
  const [selectedSprintId, setSelectedSprintId] = useState<string | 'all'>('all');
  const [isSprintModalOpen, setIsSprintModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  
  // Edit Mode state
  const [editingTask, setEditingTask] = useState<EnrichedTask | null>(null);
  const [editingSprint, setEditingSprint] = useState<Sprint | null>(null);

  // New/Edit Sprint Form State
  const [newSprintTitle, setNewSprintTitle] = useState('');
  const [newSprintStartDate, setNewSprintStartDate] = useState('');
  const [newSprintEndDate, setNewSprintEndDate] = useState('');
  const [newSprintStatus, setNewSprintStatus] = useState<'planejamento' | 'em_andamento' | 'concluido' | 'cancelado'>('planejamento');

  // New/Edit Task Form State
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>('medium');
  const [newTaskSprintId, setNewTaskSprintId] = useState<string>('');
  const [newTaskCompanyId, setNewTaskCompanyId] = useState<string>('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskAssigneeIds, setNewTaskAssigneeIds] = useState<string[]>([]);
  const [newTaskStatus, setNewTaskStatus] = useState<TaskStatus>('todo');
  const [newTaskChecklists, setNewTaskChecklists] = useState<{ id?: string, title: string, is_completed: boolean }[]>([]);
  const [newChecklistTitle, setNewChecklistTitle] = useState('');
  const [projectTasks, setProjectTasks] = useState<EnrichedTask[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const company = companies.find(c => c.id === project.company_id);

  // Initialize tasks from project sprints
  useEffect(() => {
    const enriched = project.sprints.flatMap(sprint => 
      sprint.tasks.map(task => ({ ...task, sprintTitle: sprint.title }))
    );
    setProjectTasks(enriched);
    if (project.sprints.length > 0 && !newTaskSprintId) {
      setNewTaskSprintId(project.sprints[0].id);
    }
  }, [project]);

  const handleSaveSprint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSprintTitle.trim()) return;

    try {
      let sprintId = editingSprint?.id;

      if (editingSprint) {
        const { error } = await supabase.from('sprints').update({
          title: newSprintTitle,
          start_date: newSprintStartDate || new Date().toISOString().split('T')[0],
          end_date: newSprintEndDate || new Date().toISOString().split('T')[0],
          status: newSprintStatus
        }).eq('id', editingSprint.id);

        if (error) throw error;
      } else {
        const startDate = newSprintStartDate || new Date().toISOString().split('T')[0];
        const endDate = newSprintEndDate || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        const { data: inserted, error } = await supabase.from('sprints').insert({
          project_id: project.id,
          title: newSprintTitle,
          start_date: startDate,
          end_date: endDate,
          status: newSprintStatus
        }).select().single();

        if (error) throw error;
        sprintId = inserted.id;
      }

      let newData;
      if (editingSprint) {
        newData = allData.map(a => {
          if (a.id === activeMacroArea.id) {
            return {
              ...a,
              projects: a.projects.map(p => {
                if (p.id === project.id) {
                  return {
                    ...p,
                    sprints: p.sprints.map(s => s.id === editingSprint.id ? { 
                      ...s, 
                      title: newSprintTitle,
                      start_date: newSprintStartDate,
                      end_date: newSprintEndDate,
                      status: newSprintStatus
                    } : s)
                  };
                }
                return p;
              })
            };
          }
          return a;
        });
      } else {
        const startDate = newSprintStartDate || new Date().toISOString().split('T')[0];
        const endDate = newSprintEndDate || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const newSprint: SprintWithTasks = {
          id: sprintId as string,
          title: newSprintTitle,
          start_date: startDate,
          end_date: endDate,
          status: newSprintStatus,
          tasks: []
        };
        newData = allData.map(a => {
          if (a.id === activeMacroArea.id) {
            return {
              ...a,
              projects: a.projects.map(p => {
                if (p.id === project.id) {
                  return { ...p, sprints: [...p.sprints, newSprint] };
                }
                return p;
              })
            };
          }
          return a;
        });
      }

      onUpdateData(newData);
      setNewSprintTitle('');
      setNewSprintStartDate('');
      setNewSprintEndDate('');
      setNewSprintStatus('planejamento');
      setEditingSprint(null);
      setIsSprintModalOpen(false);
      toast.success(editingSprint ? 'Sprint atualizada com sucesso.' : 'Sprint criada com sucesso.');
    } catch (err: any) {
      toast.error('Erro ao salvar sprint: ' + (err.message || 'Tente novamente.'));
    }
  };

  const handleDeleteSprint = async (sprintId: string) => {
    const confirmed = await confirm({
      title: 'Excluir Sprint',
      message: 'Deseja realmente excluir esta sprint e todas as suas tarefas?'
    });
    if (!confirmed) return;
    
    try {
      const { error } = await supabase.from('sprints').delete().eq('id', sprintId);
      if (error) throw error;
      
      const newSprints = project.sprints.filter(s => s.id !== sprintId);
      const newData = allData.map(area => ({
        ...area,
        projects: area.projects.map(p => p.id === project.id ? { ...p, sprints: newSprints } : p)
      }));
      onUpdateData(newData);
      if (selectedSprintId === sprintId) setSelectedSprintId('all');
      toast.success('Sprint excluída com sucesso.');
    } catch (err: any) {
      toast.error('Erro ao excluir sprint: ' + (err.message || 'Tente novamente.'));
    }
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !newTaskSprintId) return;

    try {
      let taskId = editingTask?.id;

      if (editingTask) {
        const { error } = await supabase.from('tasks').update({
          title: newTaskTitle,
          status: mapStatusToDB(newTaskStatus),
          priority: newTaskPriority,
          due_date: newTaskDueDate || null,
          sprint_id: newTaskSprintId,
          company_id: newTaskCompanyId || null
        }).eq('id', editingTask.id);

        if (error) throw error;
        
        await supabase.from('task_assignees').delete().eq('task_id', editingTask.id);
      } else {
        const { data: inserted, error } = await supabase.from('tasks').insert({
          title: newTaskTitle,
          status: mapStatusToDB('todo'),
          priority: newTaskPriority,
          due_date: newTaskDueDate || null,
          sprint_id: newTaskSprintId,
          company_id: newTaskCompanyId || null
        }).select().single();

        if (error) throw error;
        taskId = inserted.id;
      }

      if (newTaskAssigneeIds.length > 0 && taskId) {
        const assigneesToInsert = newTaskAssigneeIds.map(profileId => ({
          task_id: taskId,
          profile_id: profileId
        }));
        const { error: assigneesError } = await supabase.from('task_assignees').insert(assigneesToInsert);
        if (assigneesError) throw assigneesError;
      }

      if (taskId) {
        await supabase.from('task_checklists').delete().eq('task_id', taskId);
        if (newTaskChecklists.length > 0) {
          const checklistsToInsert = newTaskChecklists.map(c => ({
            task_id: taskId,
            title: c.title,
            is_completed: c.is_completed
          }));
          const { error: checklistsError } = await supabase.from('task_checklists').insert(checklistsToInsert);
          if (checklistsError) throw checklistsError;
        }
      }

      const taskData: any = {
        id: taskId as string,
        title: newTaskTitle,
        status: editingTask ? newTaskStatus : 'todo',
        priority: newTaskPriority,
        due_date: newTaskDueDate || undefined,
        sprint_id: newTaskSprintId,
        company_id: newTaskCompanyId || undefined,
        assignees: newTaskAssigneeIds.map(id => staff.find(s => s.id === id)?.full_name || id),
        checklists: newTaskChecklists.map((c, idx) => ({ id: c.id || `temp-${idx}`, task_id: taskId as string, title: c.title, is_completed: c.is_completed })),
        companyName: newTaskCompanyId ? companies.find(c => c.id === newTaskCompanyId)?.name : undefined,
        macroAreaTitle: activeMacroArea.name
      };

      const newData = allData.map(a => {
        if (a.id === activeMacroArea.id) {
          return {
            ...a,
            projects: a.projects.map(p => {
              if (p.id === project.id) {
                return {
                  ...p,
                  sprints: p.sprints.map(s => {
                    if (editingTask && editingTask.sprint_id !== newTaskSprintId) {
                      if (s.id === editingTask.sprint_id) return { ...s, tasks: s.tasks.filter(t => t.id !== editingTask.id) };
                      if (s.id === newTaskSprintId) return { ...s, tasks: [...s.tasks, taskData] };
                    } else if (s.id === newTaskSprintId) {
                      if (editingTask) return { ...s, tasks: s.tasks.map(t => t.id === editingTask.id ? taskData : t) };
                      else return { ...s, tasks: [...s.tasks, taskData] };
                    }
                    return s;
                  })
                };
              }
              return p;
            })
          };
        }
        return a;
      });

      onUpdateData(newData);
      setIsTaskModalOpen(false);
      resetTaskForm();
      toast.success(editingTask ? 'Tarefa atualizada com sucesso.' : 'Tarefa criada com sucesso.');
    } catch (err: any) {
      toast.error('Erro ao salvar tarefa: ' + (err.message || 'Tente novamente.'));
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    const confirmed = await confirm({
      title: 'Excluir Tarefa',
      message: 'Deseja realmente excluir esta tarefa?'
    });
    if (!confirmed) return;

    try {
      const { error } = await supabase.from('tasks').delete().eq('id', taskId);
      if (error) throw error;

      const newData = allData.map(area => ({
        ...area,
        projects: area.projects.map(p => ({
          ...p,
          sprints: p.sprints.map(s => ({
            ...s,
            tasks: s.tasks.filter(t => t.id !== taskId)
          }))
        }))
      }));
      onUpdateData(newData);
      toast.success('Tarefa excluída com sucesso.');
    } catch (err: any) {
      toast.error('Erro ao excluir tarefa: ' + (err.message || 'Tente novamente.'));
    }
  };

  const resetTaskForm = () => {
    setNewTaskTitle('');
    setNewTaskPriority('medium');
    setNewTaskDueDate('');
    setNewTaskAssigneeIds([]);
    setNewTaskCompanyId('');
    setNewTaskChecklists([]);
    setNewChecklistTitle('');
    setEditingTask(null);
  };

  const openTaskModal = (task?: EnrichedTask) => {
    if (task) {
      setEditingTask(task);
      setNewTaskTitle(task.title);
      setNewTaskPriority(task.priority || 'medium');
      setNewTaskSprintId(task.sprint_id);
      setNewTaskDueDate(task.due_date || '');
      // Match current names to IDs
      const currentIds = staff.filter(s => (task.assignees || []).includes(s.full_name)).map(s => s.id);
      setNewTaskAssigneeIds(currentIds);
      setNewTaskStatus(task.status);
      setNewTaskCompanyId(task.company_id || '');
      setNewTaskChecklists(task.checklists || []);
      setNewChecklistTitle('');
    } else {
      resetTaskForm();
      if (selectedSprintId !== 'all') setNewTaskSprintId(selectedSprintId);
    }
    setIsTaskModalOpen(true);
  };

  const openSprintModal = (sprint?: Sprint) => {
    if (sprint) {
      setEditingSprint(sprint);
      setNewSprintTitle(sprint.title);
      setNewSprintStartDate(sprint.start_date || '');
      setNewSprintEndDate(sprint.end_date || '');
      setNewSprintStatus(sprint.status || 'planejamento');
    } else {
      setEditingSprint(null);
      setNewSprintTitle('');
      setNewSprintStartDate(new Date().toISOString().split('T')[0]);
      setNewSprintEndDate(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
      setNewSprintStatus('planejamento');
    }
    setIsSprintModalOpen(true);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const filteredTasks = useMemo(() => {
    let tasks = projectTasks;
    if (selectedSprintId !== 'all') {
      tasks = projectTasks.filter(t => t.sprint_id === selectedSprintId);
    }
    
    // Sort tasks: Priority (High > Medium > Low), then Due Date (closest first)
    return [...tasks].sort((a, b) => {
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
  }, [projectTasks, selectedSprintId]);

  const activeTask = useMemo(() => 
    projectTasks.find(t => t.id === activeId), 
  [projectTasks, activeId]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const taskId = active.id as string;
    const overId = over.id as string;

    // Check if dropped over a column (status)
    const validStatuses: TaskStatus[] = ['todo', 'in-progress', 'review', 'done'];
    const newStatus = validStatuses.find(s => s === overId);

    if (newStatus) {
      try {
        const { error } = await supabase.from('tasks').update({ status: mapStatusToDB(newStatus) }).eq('id', taskId);
        if (error) throw error;
        
        setProjectTasks(prev => prev.map(task => 
          task.id === taskId ? { ...task, status: newStatus } : task
        ));

        // Update the global state so it syncs up nicely if we switch views
        const newData = allData.map(a => {
          if (a.id === activeMacroArea.id) {
            return {
              ...a,
              projects: a.projects.map(p => {
                if (p.id === project.id) {
                  return {
                    ...p,
                    sprints: p.sprints.map(s => ({
                      ...s,
                      tasks: s.tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t)
                    }))
                  };
                }
                return p;
              })
            };
          }
          return a;
        });
        onUpdateData(newData);
      } catch (err) {
        toast.error('Erro ao mover tarefa no banco de dados.');
      }
    }
  };

  const tasksByStatus = {
    todo: filteredTasks.filter(t => t.status === 'todo'),
    'in-progress': filteredTasks.filter(t => t.status === 'in-progress'),
    review: filteredTasks.filter(t => t.status === 'review'),
    done: filteredTasks.filter(t => t.status === 'done'),
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="bg-white border-b border-slate-200 p-6 flex flex-col lg:flex-row lg:items-end justify-between shrink-0 gap-4">
        <div>
          <nav className="flex text-xs uppercase font-bold text-slate-400 mb-2 space-x-2">
            <span className="cursor-pointer hover:text-slate-600" onClick={onBack}>{activeMacroArea.name}</span>
            <span>/</span>
            <span className="text-brand-primary">{project.name}</span>
          </nav>
          <div className="flex items-center gap-3">
             <div className="flex flex-col">
                {company && (
                  <span className="text-[9px] font-bold bg-brand-primary/10 text-brand-primary px-2 py-0.5 rounded-full w-fit mb-1 uppercase tracking-wider border border-brand-primary/10">
                    <Briefcase size={8} className="inline mr-1" /> {company.name}
                  </span>
                )}
                <h3 className="text-2xl font-bold text-slate-800">{project.name}</h3>
              </div>
              {(project as any).staff_ids && (project as any).staff_ids.length > 0 && (
                <div className="flex items-center gap-2 border-l border-slate-100 pl-4 ml-2">
                  <div className="flex -space-x-1.5">
                    {(project as any).staff_ids.map((sid: string) => {
                      const member = staff.find(s => s.id === sid);
                      if (!member) return null;
                      return (
                        <img 
                          key={sid}
                          src={member.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.full_name)}&background=random`} 
                          alt={member.full_name}
                          title={`${member.full_name} (${member.role})`}
                          className="w-6 h-6 rounded-full ring-2 ring-white object-cover shadow-sm"
                        />
                      );
                    })}
                  </div>
                  <span className="text-[9px] font-bold text-slate-400 font-bold uppercase tracking-wider hidden sm:inline">{(project as any).staff_ids.length} MEMBROS</span>
                </div>
              )}
             {selectedSprintId !== 'all' && (
               <button 
                 onClick={() => openSprintModal(project.sprints.find(s => s.id === selectedSprintId))}
                 className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-brand-accent transition-colors"
                 title="Editar Sprint"
               >
                 <Edit size={16} />
               </button>
             )}
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 items-center">
          {/* Compact Sprint Selector */}
          <div className="relative group w-full sm:w-auto">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
              <Filter size={14} />
            </div>
            <select 
              value={selectedSprintId}
              onChange={(e) => setSelectedSprintId(e.target.value)}
              className="pl-9 pr-10 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 shadow-sm appearance-none focus:outline-none focus:ring-2 focus:ring-brand-accent cursor-pointer w-full"
            >
              <option value="all">TODAS AS SPRINTS</option>
              {project.sprints.map((s, i) => (
                <option key={s.id} value={s.id}>Sprint {String(i + 1).padStart(2, '0')}: {s.title}</option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-400">
              <ChevronDown size={14} />
            </div>
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            <button 
              onClick={() => openSprintModal()}
              className="flex-1 px-4 py-2 bg-brand-primary text-white text-xs font-bold rounded shadow-lg flex items-center justify-center gap-2 hover:bg-brand-secondary transition-colors whitespace-nowrap"
            >
              <Plus size={14} /> NOVA SPRINT
            </button>
            <button 
              onClick={onBack}
              className="flex-1 px-4 py-2 bg-white text-slate-700 border border-slate-200 text-xs font-bold rounded shadow-sm hover:bg-slate-50 transition-colors whitespace-nowrap md:hidden"
            >
              VOLTAR
            </button>
          </div>
        </div>
      </div>

      <DndContext 
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 px-6 py-6 flex gap-4 overflow-x-auto min-h-0">
          <TaskColumn id="todo" title="A Fazer" tasks={tasksByStatus.todo} status="todo" onAddTask={() => openTaskModal()} onEditTask={openTaskModal} onDeleteTask={handleDeleteTask} staff={staff || []} />
          <TaskColumn id="in-progress" title="Em Andamento" tasks={tasksByStatus['in-progress']} status="in-progress" onEditTask={openTaskModal} onDeleteTask={handleDeleteTask} staff={staff || []} />
          <TaskColumn id="review" title="Revisão" tasks={tasksByStatus.review} status="review" onEditTask={openTaskModal} onDeleteTask={handleDeleteTask} staff={staff || []} />
          <TaskColumn id="done" title="Concluído" tasks={tasksByStatus.done} status="done" onEditTask={openTaskModal} onDeleteTask={handleDeleteTask} staff={staff || []} />
        </div>

        <DragOverlay dropAnimation={{
          sideEffects: defaultDropAnimationSideEffects({
            styles: {
              active: {
                opacity: '0.4',
              },
            },
          }),
        }}>
          {activeTask ? <TaskCard task={activeTask} isOverlay staff={staff || []} /> : null}
        </DragOverlay>
      </DndContext>

      <Modal isOpen={isSprintModalOpen} onClose={() => setIsSprintModalOpen(false)} title={editingSprint ? "Editar Sprint" : "Nova Sprint"}>
        <form onSubmit={handleSaveSprint} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Título da Sprint</label>
            <input type="text" autoFocus value={newSprintTitle} onChange={(e) => setNewSprintTitle(e.target.value)} placeholder="Ex: Sprint 4: Desenvolvimento..." className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-accent focus:outline-none text-sm font-medium" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Data de Início</label>
              <input type="date" value={newSprintStartDate} onChange={(e) => setNewSprintStartDate(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-accent focus:outline-none text-sm font-medium" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Data Final</label>
              <input type="date" value={newSprintEndDate} onChange={(e) => setNewSprintEndDate(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-accent focus:outline-none text-sm font-medium" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Status</label>
            <select value={newSprintStatus} onChange={(e) => setNewSprintStatus(e.target.value as any)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-accent focus:outline-none text-sm font-medium cursor-pointer">
              <option value="planejamento">Planejamento</option>
              <option value="em_andamento">Em Andamento</option>
              <option value="concluido">Concluído</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>
          <div className="flex gap-2 mt-2">
            <button type="submit" className="flex-1 py-3 bg-brand-primary text-white font-bold text-sm rounded-lg hover:bg-brand-secondary transition-colors">
              {editingSprint ? "SALVAR ALTERAÇÕES" : "CRIAR SPRINT"}
            </button>
            {editingSprint && (
              <button 
                type="button" 
                onClick={() => {
                  if (editingSprint) {
                    handleDeleteSprint(editingSprint.id);
                    setIsSprintModalOpen(false);
                  }
                }}
                className="px-4 py-3 bg-red-50 text-red-600 font-bold text-sm rounded-lg hover:bg-red-100 transition-colors"
                title="Excluir Sprint"
              >
                <Trash size={18} />
              </button>
            )}
          </div>
        </form>
      </Modal>

      <Modal isOpen={isTaskModalOpen} onClose={() => setIsTaskModalOpen(false)} title={editingTask ? "Editar Tarefa" : "Nova Tarefa"}>
        <form onSubmit={handleSaveTask} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Título da Tarefa</label>
            <input type="text" autoFocus value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} placeholder="O que precisa ser feito?" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-accent focus:outline-none text-sm font-medium" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Prioridade</label>
              <select value={newTaskPriority} onChange={(e) => setNewTaskPriority(e.target.value as TaskPriority)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent">
                <option value="low">Baixa</option>
                <option value="medium">Média</option>
                <option value="high">Alta</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Sprint</label>
              <select value={newTaskSprintId} onChange={(e) => setNewTaskSprintId(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent">
                {project.sprints.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Empresa Associada (Opcional)</label>
              <select value={newTaskCompanyId} onChange={(e) => setNewTaskCompanyId(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent">
                <option value="">Nenhuma Empresa</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Data de Entrega</label>
              <input type="date" value={newTaskDueDate} onChange={(e) => setNewTaskDueDate(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-accent focus:outline-none text-sm font-medium" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Atribuir a (Equipe do Projeto)</label>
            <div className="grid grid-cols-2 gap-2 p-3 bg-white border border-slate-200 rounded-xl max-h-32 overflow-y-auto shadow-inner">
               {(project.staff_ids || []).map(sid => {
                 const member = staff.find(s => s.id === sid);
                 if (!member) return null;
                 return (
                   <label key={sid} className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded-lg cursor-pointer border border-transparent hover:border-slate-100 transition-all">
                     <input 
                       type="checkbox" 
                       checked={newTaskAssigneeIds.includes(sid)}
                       onChange={(e) => {
                         if (e.target.checked) setNewTaskAssigneeIds([...newTaskAssigneeIds, sid]);
                         else setNewTaskAssigneeIds(newTaskAssigneeIds.filter(id => id !== sid));
                       }}
                       className="w-3.5 h-3.5 rounded border-slate-300 text-brand-primary focus:ring-brand-primary"
                     />
                     <span className="text-xs font-bold text-slate-700 truncate">{member.full_name}</span>
                   </label>
                 );
               })}
               {(project.staff_ids || []).length === 0 && (
                 <p className="col-span-2 text-[9px] text-slate-400 font-bold italic py-2 text-center bg-slate-50 rounded-lg">
                   Nenhum membro do staff alocado neste projeto.
                 </p>
               )}
            </div>
          </div>
          <div className="border-t border-slate-100 pt-4 mt-2">
            <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              <CheckSquare size={14} /> Checklist / Subtarefas
            </label>
            <div className="flex flex-col gap-2 mb-3 max-h-40 overflow-y-auto">
              {newTaskChecklists.map((c, idx) => (
                <div key={idx} className="flex items-center gap-2 group">
                  <button 
                    type="button" 
                    onClick={() => {
                      const newChecklists = [...newTaskChecklists];
                      newChecklists[idx].is_completed = !newChecklists[idx].is_completed;
                      setNewTaskChecklists(newChecklists);
                    }}
                    className={cn("w-5 h-5 rounded flex items-center justify-center border transition-colors shrink-0", c.is_completed ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-300 bg-white text-transparent")}
                  >
                    <CheckSquare size={12} />
                  </button>
                  <input 
                    type="text" 
                    value={c.title} 
                    onChange={(e) => {
                      const newChecklists = [...newTaskChecklists];
                      newChecklists[idx].title = e.target.value;
                      setNewTaskChecklists(newChecklists);
                    }}
                    className={cn("flex-1 bg-transparent text-sm font-medium border-none focus:ring-0 p-0 outline-none", c.is_completed ? "text-slate-400 line-through" : "text-slate-700")}
                  />
                  <button type="button" onClick={() => setNewTaskChecklists(newTaskChecklists.filter((_, i) => i !== idx))} className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1">
                    <Trash size={14} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={newChecklistTitle} 
                onChange={(e) => setNewChecklistTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (newChecklistTitle.trim()) {
                      setNewTaskChecklists([...newTaskChecklists, { title: newChecklistTitle.trim(), is_completed: false }]);
                      setNewChecklistTitle('');
                    }
                  }
                }}
                placeholder="Adicionar um item (Aperte Enter)" 
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-accent focus:outline-none text-sm font-medium" 
              />
              <button 
                type="button"
                onClick={() => {
                  if (newChecklistTitle.trim()) {
                    setNewTaskChecklists([...newTaskChecklists, { title: newChecklistTitle.trim(), is_completed: false }]);
                    setNewChecklistTitle('');
                  }
                }}
                className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="flex-1 py-3 bg-brand-primary text-white font-bold text-sm rounded-lg hover:bg-brand-secondary transition-colors px-4">
              {editingTask ? "SALVAR ALTERAÇÕES" : "ADICIONAR TAREFA"}
            </button>
            {editingTask && (
              <button 
                type="button" 
                onClick={() => { handleDeleteTask(editingTask.id); setIsTaskModalOpen(false); }}
                className="px-4 py-3 bg-red-50 text-red-600 font-bold text-sm rounded-lg hover:bg-red-100 transition-colors"
              >
                <Trash size={18} />
              </button>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
}
