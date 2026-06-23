import React, { useState, useEffect } from 'react';
import { Plus, X, Trash2, Calendar, Target, Clock, AlertTriangle, Building2, AlignLeft, Users, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { Modal } from '../shared/Modal';
import { EnrichedTask, MacroAreaWithProjects, Staff, Company, TaskStatus, Project, Sprint } from '../../types';
import { mapStatusToDB } from '../../lib/utils';
import { ImageWithFallback } from '../figma/ImageWithFallback';

interface TaskEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: EnrichedTask | null;
  globalData: MacroAreaWithProjects[];
  staff: Staff[];
  companies: Company[];
  onSaveSuccess: (newData: MacroAreaWithProjects[]) => void;
  initialProjectId?: string; // Usado para criar tasks em um projeto especifico
}

export function TaskEditModal({ isOpen, onClose, task, globalData, staff, companies, onSaveSuccess, initialProjectId }: TaskEditModalProps) {
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'baixa' | 'media' | 'alta'>('media');
  const [newTaskStatus, setNewTaskStatus] = useState<TaskStatus>('todo');
  const [newTaskAssigneeIds, setNewTaskAssigneeIds] = useState<string[]>([]);
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskCompanyId, setNewTaskCompanyId] = useState('');
  const [newTaskSprintId, setNewTaskSprintId] = useState('');
  const [newTaskProjectId, setNewTaskProjectId] = useState<string>('');
  const [newTaskChecklists, setNewTaskChecklists] = useState<{ id?: string, title: string, is_completed: boolean }[]>([]);
  const [newChecklistTitle, setNewChecklistTitle] = useState('');

  // Identificar o projeto da task ou usar o inicial
  useEffect(() => {
    if (isOpen) {
      if (task) {
        setNewTaskTitle(task.title);
        setNewTaskPriority(task.priority);
        setNewTaskStatus(task.status);
        setNewTaskDueDate(task.due_date || '');
        setNewTaskCompanyId(task.company_id || '');
        setNewTaskSprintId(task.sprint_id || '');
        setNewTaskProjectId(task.projectId || initialProjectId || '');
        
        // Match assignees com os ids reais da staff baseados nos nomes
        const assigneeIds = task.assignees?.map(name => {
          const person = staff.find(s => s.full_name === name);
          return person ? person.id : null;
        }).filter(Boolean) as string[] || [];
        setNewTaskAssigneeIds(assigneeIds);
        
        setNewTaskChecklists(task.checklists?.map(c => ({
          id: c.id,
          title: c.title,
          is_completed: c.is_completed
        })) || []);
      } else {
        setNewTaskTitle('');
        setNewTaskPriority('media');
        setNewTaskStatus('todo');
        setNewTaskDueDate('');
        setNewTaskCompanyId('');
        setNewTaskProjectId(initialProjectId || '');
        setNewTaskSprintId('');
        setNewTaskAssigneeIds([]);
        setNewTaskChecklists([]);
      }
      setNewChecklistTitle('');
    }
  }, [isOpen, task, initialProjectId, staff]);

  // Derived dados baseados no projeto selecionado
  let availableSprints: Sprint[] = [];
  let availableStaffIds: string[] = [];
  let projectContext: Project | undefined;
  let activeMacroArea: any = undefined;

  if (newTaskProjectId) {
    globalData.forEach(area => {
      const proj = area.projects.find(p => p.id === newTaskProjectId);
      if (proj) {
        projectContext = proj;
        activeMacroArea = area;
      }
    });
    if (projectContext) {
      availableSprints = projectContext.sprints || [];
      availableStaffIds = projectContext.staff_ids || [];
    }
  }

  // Preencher sprint_id se nao tiver e houver sprints disponiveis
  useEffect(() => {
    if (!newTaskSprintId && availableSprints.length > 0 && isOpen && !task) {
      setNewTaskSprintId(availableSprints[0].id);
    }
  }, [availableSprints, newTaskSprintId, isOpen, task]);

  const addChecklist = () => {
    if (!newChecklistTitle.trim()) return;
    setNewTaskChecklists([...newTaskChecklists, { title: newChecklistTitle.trim(), is_completed: false }]);
    setNewChecklistTitle('');
  };

  const removeChecklist = (index: number) => {
    setNewTaskChecklists(newTaskChecklists.filter((_, i) => i !== index));
  };

  const toggleAssignee = (profileId: string) => {
    setNewTaskAssigneeIds(prev => 
      prev.includes(profileId) ? prev.filter(id => id !== profileId) : [...prev, profileId]
    );
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !newTaskSprintId || !newTaskProjectId || !activeMacroArea || !projectContext) return;

    try {
      let taskId = task?.id;

      if (task) {
        const { error } = await supabase.from('tasks').update({
          title: newTaskTitle,
          status: mapStatusToDB(newTaskStatus),
          priority: newTaskPriority,
          due_date: newTaskDueDate || null,
          sprint_id: newTaskSprintId,
          company_id: newTaskCompanyId || null
        }).eq('id', task.id);

        if (error) throw error;
        await supabase.from('task_assignees').delete().eq('task_id', task.id);
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
        status: task ? newTaskStatus : 'todo',
        priority: newTaskPriority,
        due_date: newTaskDueDate || undefined,
        sprint_id: newTaskSprintId,
        company_id: newTaskCompanyId || undefined,
        assignees: newTaskAssigneeIds.map(id => staff.find(s => s.id === id)?.full_name || id),
        checklists: newTaskChecklists.map((c, idx) => ({ id: c.id || `temp-${idx}`, task_id: taskId as string, title: c.title, is_completed: c.is_completed })),
        companyName: newTaskCompanyId ? companies.find(c => c.id === newTaskCompanyId)?.name : undefined,
        macroAreaTitle: activeMacroArea.name,
        projectId: projectContext.id,
        projectTitle: projectContext.name,
        sprintTitle: projectContext.sprints?.find((s:any) => s.id === newTaskSprintId)?.title
      };

      const newData = globalData.map(a => {
        return {
          ...a,
          projects: a.projects.map(p => {
            let newSprints = p.sprints.map(s => {
              if (task && task.sprint_id === s.id) {
                return { ...s, tasks: s.tasks.filter(t => t.id !== task.id) };
              }
              return s;
            });
            
            if (p.id === projectContext?.id) {
              newSprints = newSprints.map(s => {
                 if (s.id === newTaskSprintId) {
                   return { ...s, tasks: [...s.tasks.filter(t => t.id !== task?.id), taskData] };
                 }
                 return s;
              });
            }
            return { ...p, sprints: newSprints };
          })
        };
      });

      onSaveSuccess(newData);
      toast.success(task ? 'Tarefa atualizada com sucesso.' : 'Tarefa criada com sucesso.');
      onClose();
    } catch (err: any) {
      toast.error('Erro ao salvar tarefa: ' + (err.message || 'Tente novamente.'));
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={task ? "Editar Tarefa" : "Nova Tarefa"} maxWidth="max-w-4xl">
        <form onSubmit={handleSaveTask} className="p-8 h-full max-h-[85vh] overflow-y-auto custom-scrollbar flex flex-col">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-8 flex-1">
            {/* Left Column */}
            <div className="space-y-8">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <AlignLeft size={16} className="text-brand-accent" /> Título da Tarefa
                </label>
                <textarea 
                  value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-accent focus:outline-none text-lg font-bold text-slate-800 resize-none min-h-[100px]"
                  placeholder="Ex: Implementar Nova Funcionalidade..." required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  Checklist / Subtarefas
                </label>
                <div className="flex gap-2 mb-4">
                  <input type="text" value={newChecklistTitle} onChange={(e) => setNewChecklistTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addChecklist())} placeholder="Adicionar novo item ao checklist..." className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-accent focus:outline-none font-medium" />
                  <button type="button" onClick={addChecklist} className="px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90 transition-colors cursor-pointer shadow-sm">
                    <Plus size={20} />
                  </button>
                </div>
                <div className="space-y-2.5">
                  {newTaskChecklists.map((checklist, index) => (
                    <div key={index} className="flex items-center gap-3 p-3.5 bg-white rounded-xl border border-slate-200 shadow-sm group hover:border-brand-accent/30 transition-all">
                      <label className="relative flex items-center justify-center shrink-0 cursor-pointer">
                        <input type="checkbox" checked={checklist.is_completed} onChange={() => {
                            const newChecklists = [...newTaskChecklists];
                            newChecklists[index].is_completed = !newChecklists[index].is_completed;
                            setNewTaskChecklists(newChecklists);
                          }} className="peer sr-only" />
                        <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${checklist.is_completed ? 'bg-brand-accent border-brand-accent' : 'border-slate-300 hover:border-brand-accent bg-white'}`}>
                          {checklist.is_completed && <CheckCircle2 size={16} className="text-white" />}
                        </div>
                      </label>
                      <span className={`flex-1 text-sm font-semibold transition-all ${checklist.is_completed ? 'line-through text-slate-400' : 'text-slate-700'}`}>{checklist.title}</span>
                      <button type="button" onClick={() => removeChecklist(index)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all cursor-pointer">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                  {newTaskChecklists.length === 0 && (
                    <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-xl">
                      <p className="text-sm font-medium text-slate-400">Nenhum item no checklist.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Target size={16} className="text-brand-primary" /> Sprint
                  </label>
                  <select value={newTaskSprintId} onChange={(e) => setNewTaskSprintId(e.target.value)} required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-accent cursor-pointer appearance-none">
                    <option value="">Selecione...</option>
                    {availableSprints.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <AlertTriangle size={16} className="text-amber-500" /> Prioridade
                  </label>
                  <select value={newTaskPriority} onChange={(e) => setNewTaskPriority(e.target.value as any)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-accent cursor-pointer appearance-none">
                    <option value="baixa">Baixa</option>
                    <option value="media">Média</option>
                    <option value="alta">Alta</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Building2 size={16} className="text-slate-500" /> Empresa
                  </label>
                  <select value={newTaskCompanyId} onChange={(e) => setNewTaskCompanyId(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-accent cursor-pointer appearance-none">
                    <option value="">Nenhuma</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Calendar size={16} className="text-emerald-500" /> Entrega
                  </label>
                  <input type="date" value={newTaskDueDate} onChange={(e) => setNewTaskDueDate(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-accent focus:outline-none text-sm font-bold text-slate-700 cursor-pointer" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Users size={16} className="text-purple-500" /> Equipe do Projeto
                </label>
                <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl shadow-inner max-h-[180px] overflow-y-auto custom-scrollbar">
                   {availableStaffIds.map(sid => {
                     const member = staff.find(s => s.id === sid);
                     if (!member) return null;
                     const isSelected = newTaskAssigneeIds.includes(sid);
                     return (
                       <div key={sid} onClick={() => toggleAssignee(sid)} className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all border-2 ${isSelected ? 'bg-brand-accent/5 border-brand-accent' : 'bg-white border-transparent hover:border-slate-300'}`}>
                         <ImageWithFallback src={member.avatar_url || ''} alt={member.full_name} className="w-8 h-8 rounded-full object-cover shrink-0 shadow-sm" />
                         <span className={`text-xs font-bold truncate ${isSelected ? 'text-brand-accent' : 'text-slate-600'}`}>{member.full_name}</span>
                       </div>
                     )
                   })}
                   {availableStaffIds.length === 0 && (
                     <div className="col-span-2 text-sm text-slate-400 font-medium text-center py-4">Nenhum membro vinculado ao projeto.</div>
                   )}
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6 mt-8 border-t border-slate-100">
            <button type="submit" className="w-full py-4 bg-brand-primary text-white text-sm font-black rounded-xl uppercase tracking-widest shadow-elegant hover:scale-[1.02] hover:bg-brand-secondary active:scale-[0.98] transition-all cursor-pointer">
              {task ? "SALVAR ALTERAÇÕES DA TAREFA" : "CRIAR NOVA TAREFA"}
            </button>
          </div>
        </form>
    </Modal>
  );
}
