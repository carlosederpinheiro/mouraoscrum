import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { Plus, Briefcase, Edit, Trash, FileText, Users, ChevronLeft, ListTodo, TrendingUp, CheckCircle2 } from 'lucide-react';
import { Company, MacroAreaWithProjects, EnrichedTask, TaskStatus, Staff } from '../types';
import { Modal } from '../components/shared/Modal';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { useConfirm } from '../hooks/useConfirm';
import { DndContext, closestCorners, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, DragOverlay, defaultDropAnimationSideEffects } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { TaskCard } from '../components/kanban/TaskCard';
import { DroppableColumn } from '../components/kanban/DroppableColumn';
import { TaskEditModal } from '../components/kanban/TaskEditModal';
import { mapStatusToDB } from '../lib/utils';

export function CompaniesView({ 
  companies, 
  onUpdateCompanies,
  data,
  onUpdateGlobalData,
  staff
}: { 
  companies: Company[], 
  onUpdateCompanies: (companies: Company[]) => void,
  data?: MacroAreaWithProjects[],
  onUpdateGlobalData?: (data: MacroAreaWithProjects[]) => void,
  staff?: Staff[]
}) {
  const { confirm } = useConfirm();
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [editingTask, setEditingTask] = useState<EnrichedTask | null>(null);
  const [name, setName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [industry, setIndustry] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);

  // DnD Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const selectedCompany = companies.find(c => c.id === selectedCompanyId);

  // Extract tasks for the selected company
  const companyTasks = useMemo(() => {
    if (!selectedCompanyId || !data) return [];
    
    const tasks: EnrichedTask[] = [];
    data.forEach(area => {
      area.projects.forEach(project => {
        // Se o projeto for da empresa, todas as tasks são da empresa
        // Ou se a task tiver sido atrelada diretamente à empresa (company_id da task)
        project.sprints.forEach(sprint => {
          sprint.tasks.forEach(task => {
            if (task.company_id === selectedCompanyId || project.company_id === selectedCompanyId) {
              tasks.push({
                ...task,
                macroAreaId: area.id,
                projectId: project.id,
                projectTitle: project.name,
                macroAreaTitle: area.name,
                sprint_id: sprint.id,
                sprintTitle: sprint.title
              });
            }
          });
        });
      });
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
  }, [data, selectedCompanyId]);

  const handleUpdateTaskStatus = async (taskId: string, newStatus: TaskStatus) => {
    if (!data || !onUpdateGlobalData) return;
    try {
      const { error } = await supabase.from('tasks').update({ status: mapStatusToDB(newStatus) }).eq('id', taskId);
      if (error) throw error;
      
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      if (editingCompany) {
        const { error } = await supabase.from('companies').update({
          name, cnpj, industry, contact_person: contactPerson
        }).eq('id', editingCompany.id);

        if (error) throw error;

        onUpdateCompanies(companies.map(c => c.id === editingCompany.id ? { 
          ...c, name, cnpj, industry, contact_person: contactPerson 
        } : c));
        toast.success('Empresa atualizada com sucesso.');
      } else {
        const { data: inserted, error } = await supabase.from('companies').insert({
          name, cnpj, industry, contact_person: contactPerson
        }).select().single();

        if (error) throw error;

        onUpdateCompanies([...companies, inserted]);
        toast.success('Empresa cadastrada com sucesso.');
      }

      setIsModalOpen(false);
      setEditingCompany(null);
      setName('');
      setCnpj('');
      setIndustry('');
      setContactPerson('');
    } catch (err: any) {
      toast.error('Erro ao salvar empresa: ' + (err.message || 'Tente novamente.'));
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    const confirmed = await confirm({
      title: 'Excluir Tarefa',
      message: 'Deseja realmente excluir esta tarefa associada a esta empresa?'
    });
    if (!confirmed) return;

    try {
      const { error } = await supabase.from('tasks').delete().eq('id', taskId);
      if (error) throw error;

      if (data && onUpdateGlobalData) {
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
      }
      toast.success('Tarefa excluída com sucesso.');
    } catch (err: any) {
      toast.error('Erro ao excluir tarefa: ' + (err.message || 'Tente novamente.'));
    }
  };

  const handleEditTask = (task: EnrichedTask) => {
    setEditingTask(task);
    setIsTaskModalOpen(true);
  };

  const openModal = (company?: Company) => {
    if (company) {
      setEditingCompany(company);
      setName(company.name);
      setCnpj(company.cnpj || '');
      setIndustry(company.industry || '');
      setContactPerson(company.contact_person || '');
    } else {
      setEditingCompany(null);
      setName('');
      setCnpj('');
      setIndustry('');
      setContactPerson('');
    }
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: 'Excluir Empresa',
      message: 'Deseja realmente excluir esta empresa?'
    });
    if (confirmed) {
      try {
        const { error } = await supabase.from('companies').delete().eq('id', id);
        if (error) throw error;
        onUpdateCompanies(companies.filter(c => c.id !== id));
        if (selectedCompanyId === id) setSelectedCompanyId(null);
        toast.success('Empresa excluída com sucesso.');
      } catch (err: any) {
        toast.error('Erro ao excluir empresa: ' + (err.message || 'Tente novamente.'));
      }
    }
  };

  const kanbanColumns: { id: TaskStatus, title: string, icon: any, color: string }[] = [
    { id: 'todo', title: 'A Fazer', icon: ListTodo, color: 'bg-slate-500' },
    { id: 'in-progress', title: 'Em Andamento', icon: TrendingUp, color: 'bg-brand-accent' },
    { id: 'review', title: 'Em Revisão', icon: CheckCircle2, color: 'bg-amber-400' },
    { id: 'done', title: 'Concluído', icon: CheckCircle2, color: 'bg-emerald-500' },
  ];

  if (selectedCompanyId && selectedCompany) {
    return (
      <div className="flex flex-col h-full bg-slate-50 overflow-y-auto scrollbar-hide">
        <div className="bg-white border-b border-slate-200 p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <button 
                onClick={() => setSelectedCompanyId(null)}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-brand-primary transition-colors mb-4 uppercase tracking-wider cursor-pointer"
              >
                <ChevronLeft size={14} /> Voltar para Empresas
              </button>
              <nav className="flex text-xs uppercase font-bold text-slate-400 mb-1 space-x-2">
                <span>Empresa</span>
                <span>/</span>
                <span className="text-brand-primary">Atividades</span>
              </nav>
              <h3 className="text-2xl font-bold text-slate-800">{selectedCompany.name}</h3>
              <p className="text-sm text-slate-500 font-medium mt-1">
                Visualizando as atividades relacionadas a este cliente.
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 p-6 overflow-x-auto">
          <DndContext 
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-6 h-full pb-4 min-w-max">
              {kanbanColumns.map(col => {
                const tasksInColumn = companyTasks.filter(t => t.status === col.id);
                return (
                  <DroppableColumn 
                    key={col.id}
                    column={col}
                    tasks={tasksInColumn}
                    onEditPersonalTask={handleEditTask} 
                    onDeletePersonalTask={handleDeleteTask}
                    personalTasksCount={0}
                    staff={staff || []}
                  />
                );
              })}
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
              {activeId && companyTasks.find(t => t.id === activeId) ? (
                <TaskCard task={companyTasks.find(t => t.id === activeId)!} isOverlay staff={staff || []} />
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto scrollbar-hide p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <nav className="flex text-xs uppercase font-bold text-slate-400 mb-1 space-x-2">
            <span>Gestão</span>
            <span>/</span>
            <span className="text-brand-primary">Empresas e Clientes</span>
          </nav>
          <h3 className="text-3xl font-black text-slate-900 tracking-tight">Empresas</h3>
          <p className="text-sm text-slate-500 font-medium mt-1">Gerencie as informações das empresas atendidas pela Mourão.</p>
        </div>
        <button 
          onClick={() => openModal()}
          className="flex items-center gap-2 px-6 py-3 bg-brand-primary text-white text-xs font-bold rounded-xl shadow-elegant hover:scale-105 active:scale-95 transition-all uppercase tracking-wider cursor-pointer"
        >
          <Plus size={18} /> Cadastrar Empresa
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {companies.map(company => (
          <motion.div 
            key={company.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -8, scale: 1.02, boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)" }}
            className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-elegant transition-all group relative cursor-pointer"
            onClick={() => setSelectedCompanyId(company.id)}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-16 h-16 bg-brand-primary/5 rounded-2xl flex items-center justify-center text-brand-primary border border-brand-primary/10 group-hover:bg-brand-primary group-hover:text-white transition-all duration-300">
                <Briefcase size={32} />
              </div>
              <div className="flex gap-2">
                <button onClick={(e) => { e.stopPropagation(); openModal(company); }} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-brand-accent transition-colors cursor-pointer">
                  <Edit size={16} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); handleDelete(company.id); }} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-red-500 transition-colors cursor-pointer">
                  <Trash size={16} />
                </button>
              </div>
            </div>
            
            <h4 className="text-xl font-bold text-slate-800 mb-1">{company.name}</h4>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">{company.industry || 'Setor não informado'}</p>
            
            <div className="space-y-3 pt-4 border-t border-slate-50">
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <FileText size={16} className="text-slate-300" />
                <span className="font-medium">{company.cnpj || 'CNPJ não informado'}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <Users size={16} className="text-slate-300" />
                <span className="font-medium">Ref: {company.contact_person || 'Sem contato'}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {companies.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-slate-300 mb-4 border border-dashed border-slate-300">
            <Briefcase size={40} />
          </div>
          <h4 className="text-lg font-bold text-slate-800 mb-2">Nenhuma empresa cadastrada</h4>
          <p className="text-slate-400 text-sm max-w-xs">Comece cadastrando sua primeira empresa para atrelar projetos a ela.</p>
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingCompany ? "Editar Empresa" : "Nova Empresa"}>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Nome da Empresa</label>
            <input 
              type="text" value={name} onChange={(e) => setName(e.target.value)} required
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-accent transition-all"
              placeholder="Ex: Mourão Consultoria S.A."
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">CNPJ</label>
            <input 
              type="text" value={cnpj} onChange={(e) => setCnpj(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-accent transition-all"
              placeholder="00.000.000/0000-00"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Setor / Indústria</label>
              <input 
                type="text" value={industry} onChange={(e) => setIndustry(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-accent transition-all"
                placeholder="Ex: Industrial"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Ponto de Contato</label>
              <input 
                type="text" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-accent transition-all"
                placeholder="Ex: João da Mourão"
              />
            </div>
          </div>
          <button type="submit" className="w-full py-4 bg-brand-primary text-white text-xs font-bold rounded-xl uppercase tracking-wider shadow-elegant hover:scale-[1.02] active:scale-[0.98] transition-all mt-4 cursor-pointer">
            {editingCompany ? "SALVAR ALTERAÇÕES" : "CADASTRAR EMPRESA"}
          </button>
        </form>
      </Modal>

      <TaskEditModal 
        isOpen={isTaskModalOpen}
        onClose={() => { setIsTaskModalOpen(false); setEditingTask(null); }}
        task={editingTask}
        globalData={data || []}
        staff={staff || []}
        companies={companies}
        onSaveSuccess={(newData) => onUpdateGlobalData && onUpdateGlobalData(newData)}
      />
    </div>
  );
}
