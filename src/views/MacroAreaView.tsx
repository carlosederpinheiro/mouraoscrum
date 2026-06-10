import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Plus, Edit, Trash, ChevronRight, Briefcase, Users, LayoutDashboard, Calendar, ArrowRight } from 'lucide-react';
import { MacroAreaWithProjects, Staff, Company, Project, ProjectWithSprints } from '../types';
import { Modal } from '../components/shared/Modal';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { useConfirm } from '../hooks/useConfirm';

export function MacroAreaView({ area, onSelectProject, onUpdateData, allData, companies = [], staff = [] }: { area: MacroAreaWithProjects, onSelectProject: (id: string) => void, onUpdateData: (data: MacroAreaWithProjects[]) => void, allData: MacroAreaWithProjects[], companies?: Company[], staff?: Staff[] }) {
  const { confirm } = useConfirm();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectTitle.trim()) return;

    try {
      let projectId = editingProject?.id;

      if (editingProject) {
        const { error } = await supabase.from('projects').update({
          name: newProjectTitle,
          company_id: selectedCompanyId || null
        }).eq('id', editingProject.id);

        if (error) throw error;
        
        // Delete existing members
        await supabase.from('project_members').delete().eq('project_id', editingProject.id);
      } else {
        const { data: inserted, error } = await supabase.from('projects').insert({
          macro_area_id: area.id,
          name: newProjectTitle,
          company_id: selectedCompanyId || null
        }).select().single();
        
        if (error) throw error;
        projectId = inserted.id;
      }

      // Insert new members
      if (selectedStaffIds.length > 0 && projectId) {
        const membersToInsert = selectedStaffIds.map(profileId => ({
          project_id: projectId,
          profile_id: profileId
        }));
        const { error: membersError } = await supabase.from('project_members').insert(membersToInsert);
        if (membersError) throw membersError;
      }

      // Update local state
      let newData;
      if (editingProject) {
        newData = allData.map(a => {
          if (a.id === area.id) {
            return {
              ...a,
              projects: a.projects.map(p => p.id === editingProject.id ? { 
                ...p, name: newProjectTitle, company_id: selectedCompanyId || undefined, staff_ids: selectedStaffIds 
              } : p)
            };
          }
          return a;
        });
      } else {
        const newProject: ProjectWithSprints = {
          id: projectId as string,
          name: newProjectTitle,
          macro_area_id: area.id,
          company_id: selectedCompanyId || undefined,
          sprints: []
        };
        newData = allData.map(a => {
          if (a.id === area.id) {
            return { ...a, projects: [...a.projects, { ...newProject, staff_ids: selectedStaffIds } as any] };
          }
          return a;
        });
      }

      onUpdateData(newData);
      setNewProjectTitle('');
      setSelectedCompanyId('');
      setSelectedStaffIds([]);
      setEditingProject(null);
      setIsModalOpen(false);
      toast.success(editingProject ? 'Projeto atualizado com sucesso.' : 'Projeto criado com sucesso.');
    } catch (err: any) {
      toast.error('Erro ao salvar projeto: ' + (err.message || 'Tente novamente.'));
    }
  };

  const handleDeleteProject = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = await confirm({
      title: 'Excluir Projeto',
      message: 'Deseja realmente excluir este projeto e todas as suas sprints?'
    });
    if (!confirmed) return;

    try {
      const { error } = await supabase.from('projects').delete().eq('id', id);
      if (error) throw error;
      
      const newData = allData.map(a => a.id === area.id ? { ...a, projects: a.projects.filter(p => p.id !== id) } : a);
      onUpdateData(newData);
      toast.success('Projeto excluído com sucesso.');
    } catch (err: any) {
      toast.error('Erro ao excluir projeto: ' + (err.message || 'Tente novamente.'));
    }
  };

  const openEditModal = (project: ProjectWithSprints, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingProject(project);
    setNewProjectTitle(project.name);
    setSelectedCompanyId(project.company_id || '');
    setSelectedStaffIds((project as any).staff_ids || []);
    setIsModalOpen(true);
  };

  const openCreateModal = () => {
    setEditingProject(null);
    setNewProjectTitle('');
    setSelectedCompanyId('');
    setIsModalOpen(true);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-slate-200 p-6 flex flex-col sm:flex-row sm:items-end justify-between shrink-0 gap-4">
        <div>
          <nav className="flex text-xs uppercase font-bold text-slate-400 mb-2 space-x-2">
            <span>Visão Geral</span>
            <span>/</span>
            <span className="text-brand-primary">{area.name}</span>
          </nav>
          <h3 className="text-2xl font-bold text-slate-800">Projetos Ativos</h3>
        </div>
        <button 
          onClick={openCreateModal}
          className="px-4 py-2 bg-brand-primary text-white text-xs font-bold rounded shadow-lg flex items-center justify-center gap-2 hover:bg-brand-secondary transition-colors w-full sm:w-auto cursor-pointer"
        >
          <Plus size={14} /> NOVO PROJETO
        </button>
      </div>

      <div className="p-6 overflow-y-auto">
        {area.projects.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-sm font-medium text-slate-500 italic shadow-sm max-w-5xl mx-auto">
            Nenhum projeto cadastrado nesta macroárea.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
            {area.projects.map((project, idx) => {
              const totalSprints = project.sprints.length;
              const activeSprints = project.sprints.filter(s => s.tasks.some(t => t.status !== 'done')).length;
              
              const totalTasks = project.sprints.reduce((acc, s) => acc + s.tasks.length, 0);
              const completedTasks = project.sprints.reduce((acc, s) => acc + s.tasks.filter(t => t.status === 'done').length, 0);
              const progressPercentage = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);
              
              const colorThemes = [
                { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', bar: 'bg-blue-500', barBg: 'bg-blue-100' },
                { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', bar: 'bg-teal-500', barBg: 'bg-teal-100' },
                { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', bar: 'bg-indigo-500', barBg: 'bg-indigo-100' },
                { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', bar: 'bg-purple-500', barBg: 'bg-purple-100' },
              ];
              const theme = colorThemes[idx % colorThemes.length];

              return (
              <motion.div 
                key={project.id} 
                onClick={() => onSelectProject(project.id)}
                whileHover={{ y: -8, scale: 1.02, boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)" }}
                whileTap={{ scale: 0.98 }}
                className="bg-white rounded-xl border border-slate-200 shadow-sm hover:border-brand-accent transition-all cursor-pointer overflow-hidden flex flex-col group"
              >
                  <div className={cn("px-5 py-4 border-b flex justify-between items-start", theme.bg, theme.border)}>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn("text-xs font-bold uppercase tracking-wider", theme.text)}>
                          Projeto {String(idx + 1).padStart(2, '0')}
                        </span>
                        {project.company_id && companies.find(c => c.id === project.company_id) && (
                          <span className="text-[10px] font-bold bg-white/60 px-1.5 py-0.5 rounded text-slate-500 border border-white">
                            {companies.find(c => c.id === project.company_id)?.name}
                          </span>
                        )}
                      </div>
                      <h3 className="text-base font-bold text-slate-800 mt-1 leading-tight group-hover:text-brand-primary transition-colors">
                        {project.name}
                      </h3>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={(e) => openEditModal(project, e)}
                          className="p-1 hover:bg-white/80 rounded transition-colors text-slate-400 hover:text-brand-accent cursor-pointer"
                          title="Editar"
                        >
                          <Edit size={14} />
                        </button>
                        <button 
                          onClick={(e) => handleDeleteProject(project.id, e)}
                          className="p-1 hover:bg-white/80 rounded transition-colors text-slate-400 hover:text-red-600 cursor-pointer"
                          title="Excluir"
                        >
                          <Trash size={14} />
                        </button>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-white/60 flex items-center justify-center shrink-0 border border-white">
                        <Briefcase size={16} className={theme.text} />
                      </div>
                    </div>
                  </div>
                  <div className="p-5 flex flex-col gap-5 flex-1">
                    <div className="flex gap-4">
                    {(project as any).staff_ids && (project as any).staff_ids.length > 0 && (
                        <div className="flex flex-col gap-2">
                           <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Time Alocado</span>
                           <div className="flex -space-x-2 overflow-hidden">
                              {(project as any).staff_ids.map((sid: string) => {
                                const member = staff.find(s => s.id === sid);
                                if (!member) return null;
                                return (
                                  <img 
                                    key={sid}
                                    src={member.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.full_name)}&background=random`} 
                                    alt={member.full_name}
                                    title={member.full_name}
                                    className="inline-block h-8 w-8 rounded-full ring-2 ring-white object-cover"
                                  />
                                );
                              })}
                           </div>
                        </div>
                      )}
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex-1">
                        <div className="text-xl font-bold text-slate-700">{totalSprints}</div>
                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-1">Total Sprints</div>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex-1">
                        <div className="text-xl font-bold text-brand-primary">{activeSprints}</div>
                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-1">Sprints Ativas</div>
                      </div>
                    </div>
                    <div className="mt-auto">
                      <div className="flex justify-between items-end mb-2">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Progresso Geral</span>
                        <span className={cn("text-xs font-bold", theme.text)}>{progressPercentage}%</span>
                      </div>
                      <div className={cn("w-full h-2.5 rounded-full overflow-hidden", theme.barBg)}>
                        <div 
                          className={cn("h-full transition-all duration-500 rounded-full", theme.bar)} 
                          style={{ width: `${progressPercentage}%` }}
                        />
                      </div>
                      <p className="text-xs text-slate-400 mt-2 font-medium">
                        {completedTasks} de {totalTasks} tarefas concluídas
                      </p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingProject ? "Editar Projeto" : "Novo Projeto"}>
        <form onSubmit={handleSaveProject} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Título do Projeto</label>
            <input type="text" autoFocus value={newProjectTitle} onChange={(e) => setNewProjectTitle(e.target.value)} placeholder="Digite o nome do projeto..." className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-accent focus:outline-none text-sm font-medium" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Empresa Associada</label>
            <select 
              value={selectedCompanyId} 
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-accent focus:outline-none text-sm font-medium cursor-pointer"
            >
              <option value="">Nenhuma Empresa</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Equipe Staff (Selecione Vários)</label>
            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-lg">
              {staff.map(s => (
                <label key={s.id} className="flex items-center gap-2 p-1.5 hover:bg-white rounded cursor-pointer transition-colors">
                  <input 
                    type="checkbox" 
                    checked={selectedStaffIds.includes(s.id)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedStaffIds([...selectedStaffIds, s.id]);
                      else setSelectedStaffIds(selectedStaffIds.filter(id => id !== s.id));
                    }}
                    className="rounded border-slate-300 text-brand-primary focus:ring-brand-primary"
                  />
                  <span className="text-xs font-bold text-slate-700 truncate">{s.full_name}</span>
                </label>
              ))}
            </div>
          </div>
          <button type="submit" className="w-full py-3 bg-brand-primary text-white font-bold text-sm rounded-lg hover:bg-brand-secondary transition-colors mt-2">
            {editingProject ? "SALVAR ALTERAÇÕES" : "CRIAR PROJETO"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
