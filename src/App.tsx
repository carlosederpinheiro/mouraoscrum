import React, { useState, useMemo, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Portal } from './components/Portal';
import { 
  Search,
  Bell,
  Settings,
  LogOut,
  LayoutGrid,
  CheckSquare,
  DollarSign,
  FileText,
  LineChart as LucideLineChart, 
  Calculator, 
  GraduationCap, 
  Briefcase, 
  Lightbulb, 
  Target,
  LayoutDashboard,
  Users,
  Menu,
  X,
  ChevronRight,
  ChevronLeft,
  MoreVertical,
  Plus,
  Edit,
  Trash,
  Filter,
  Calendar,
  Clock,
  ChevronDown,
  AlertCircle,
  CheckCircle2,
  ListTodo,
  TrendingUp,
  ArrowRight,
  Eye,
  Loader2
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line
} from 'recharts';
import { 
  DndContext, 
  closestCorners, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  useDraggable,
  useDroppable,
  defaultDropAnimationSideEffects
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from './lib/supabase';
import { mockData as initialMockData, mockCompanies as initialCompanies, mockStaff as initialStaff } from './data';
import { MacroArea, MacroAreaWithProjects, Project, ProjectWithSprints, Sprint, SprintWithTasks, TaskStatus, Task, TaskPriority, Company, Staff, EnrichedTask } from './types';
import { useAuth } from './hooks/useAuth';
import { useScrumData } from './hooks/useScrumData';
import { Logo } from './components/shared/Logo';
import { Modal } from './components/shared/Modal';
import { cn, getPriorityColor, getPriorityLabel, getInitials, calculateDueDateStatus } from './lib/utils';
import { TaskCard } from './components/kanban/TaskCard';
import { TaskColumn } from './components/kanban/TaskColumn';
import { DroppableColumn } from './components/kanban/DroppableColumn';
import { DraggableTaskCard } from './components/kanban/DraggableTaskCard';
import { CompaniesView } from './views/CompaniesView';
import { ProfileView } from './views/ProfileView';
import { StaffView } from './views/StaffView';
import { toast } from 'sonner';
import { useConfirm } from './hooks/useConfirm';
import { DashboardView } from './views/DashboardView';
import { MyActivitiesView } from './views/MyActivitiesView';
import { MacroAreaView } from './views/MacroAreaView';
import { ProjectView } from './views/ProjectView';

// Icon Mapping
const getIconForMacroArea = (name: string) => {
  switch (name) {
    case 'Estudo de Viabilidade Econômica': return DollarSign;
    case 'Contábil': return Calculator;
    case 'Cursos': return GraduationCap;
    case 'Estudo de Competitividade': return Target;
    case 'Competitividade': return FileText;
    case 'Projetos': return Briefcase;
    case 'PPB': return Lightbulb;
    default: return Settings;
  }
};

export default function App() {
  const navigate = useNavigate();
  const { confirm } = useConfirm();
  const { data, setData, companies, setCompanies, staff, setStaff, personalTasks, setPersonalTasks, fetchData, handleDeleteStaff, handleUpdateStaff } = useScrumData();
  const { currentUser, setCurrentUser, isLoadingAuth, handleLogout } = useAuth();
  const [activeMacroAreaId, setActiveMacroAreaId] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [isMyActivitiesView, setIsMyActivitiesView] = useState(false);
  const [isCompaniesView, setIsCompaniesView] = useState(false);
  const [isStaffView, setIsStaffView] = useState(false);
  const [isProfileView, setIsProfileView] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  useEffect(() => {
    if (currentUser.id !== 'guest') {
      fetchData();
    }
  }, [currentUser.id, fetchData]);

  // MacroArea CRUD states
  const [isMacroModalOpen, setIsMacroModalOpen] = useState(false);
  const [editingMacroArea, setEditingMacroArea] = useState<MacroArea | null>(null);
  const [newMacroTitle, setNewMacroTitle] = useState('');
  const [newMacroPO, setNewMacroPO] = useState('');

  const activeMacroArea = data.find(m => m.id === activeMacroAreaId);
  const activeProject = activeMacroArea?.projects.find(p => p.id === activeProjectId);


  const navigateToDashboard = () => {
    setActiveMacroAreaId(null);
    setActiveProjectId(null);
    setIsMyActivitiesView(false);
    setIsCompaniesView(false);
    setIsStaffView(false);
    setIsProfileView(false);
    setSearchQuery('');
    setIsSearchFocused(false);
    setIsNotificationsOpen(false);
    setIsSidebarOpen(false);
  };

  const handleSelectSearchResult = (projectId?: string, macroAreaId?: string) => {
    if (projectId && macroAreaId) {
      setActiveMacroAreaId(macroAreaId);
      setActiveProjectId(projectId);
    }
    setIsMyActivitiesView(false);
    setIsCompaniesView(false);
    setIsStaffView(false);
    setIsProfileView(false);
    setSearchQuery('');
    setIsSearchFocused(false);
  };

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return { projects: [], companies: [], tasks: [] };
    const query = searchQuery.toLowerCase();
    
    const matchedProjects: { project: Project, macroArea: MacroAreaWithProjects }[] = [];
    const matchedTasks: { task: EnrichedTask, project: Project, macroArea: MacroAreaWithProjects }[] = [];
    
    data.forEach(ma => {
      ma.projects.forEach(p => {
        if (p.name.toLowerCase().includes(query)) {
          matchedProjects.push({ project: p, macroArea: ma });
        }
        p.sprints.forEach(s => {
          s.tasks.forEach(t => {
            if (t.title.toLowerCase().includes(query) || t.companyName?.toLowerCase().includes(query)) {
              matchedTasks.push({ task: t as EnrichedTask, project: p, macroArea: ma });
            }
          });
        });
      });
    });

    const matchedCompanies = companies.filter(c => 
      c.name.toLowerCase().includes(query) || 
      c.contact_person?.toLowerCase().includes(query) ||
      c.cnpj?.includes(query)
    );

    return { projects: matchedProjects, companies: matchedCompanies, tasks: matchedTasks };
  }, [searchQuery, data, companies]);

  const myNotifications = useMemo(() => {
    if (currentUser.id === 'guest') return [];
    
    const alerts: { type: 'late' | 'today' | 'recent', task: EnrichedTask, message: string }[] = [];
    const now = new Date();
    
    // Ajustar fuso horário para bater com o formato YYYY-MM-DD local
    const tzOffset = now.getTimezoneOffset() * 60000;
    const localNow = new Date(now.getTime() - tzOffset);
    const todayStr = localNow.toISOString().split('T')[0];
    
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    data.forEach(ma => {
      ma.projects.forEach(p => {
        p.sprints.forEach(s => {
          s.tasks.forEach(t => {
            if (t.assignees?.includes(currentUser.full_name)) {
              if (t.status !== 'done') {
                if (t.due_date) {
                  if (t.due_date < todayStr) {
                    alerts.push({ type: 'late', task: t as EnrichedTask, message: `Atrasada: ${t.title}` });
                  } else if (t.due_date === todayStr) {
                    alerts.push({ type: 'today', task: t as EnrichedTask, message: `Vence Hoje: ${t.title}` });
                  }
                }
              }
              if (t.created_at) {
                const createdAt = new Date(t.created_at);
                if (createdAt >= fortyEightHoursAgo) {
                  alerts.push({ type: 'recent', task: t as EnrichedTask, message: `Nova Tarefa: ${t.title}` });
                }
              }
            }
          });
        });
      });
    });
    
    return alerts.sort((a, b) => {
      const dateA = a.task.created_at ? new Date(a.task.created_at).getTime() : 0;
      const dateB = b.task.created_at ? new Date(b.task.created_at).getTime() : 0;
      return dateB - dateA;
    });
  }, [data, currentUser.id, currentUser.full_name]);

  const navigateToMyActivities = () => {
    setActiveMacroAreaId(null);
    setActiveProjectId(null);
    setIsMyActivitiesView(true);
    setIsCompaniesView(false);
    setIsStaffView(false);
    setIsProfileView(false);
    setIsSidebarOpen(false);
  };

  const navigateToCompanies = () => {
    setActiveMacroAreaId(null);
    setActiveProjectId(null);
    setIsMyActivitiesView(false);
    setIsCompaniesView(true);
    setIsStaffView(false);
    setIsProfileView(false);
    setIsSidebarOpen(false);
  };

  const navigateToStaff = () => {
    if (currentUser.role !== 'admin') return;
    setActiveMacroAreaId(null);
    setActiveProjectId(null);
    setIsMyActivitiesView(false);
    setIsCompaniesView(false);
    setIsStaffView(true);
    setIsProfileView(false);
    setIsSidebarOpen(false);
  };

  const navigateToProfile = () => {
    setActiveMacroAreaId(null);
    setActiveProjectId(null);
    setIsMyActivitiesView(false);
    setIsCompaniesView(false);
    setIsStaffView(false);
    setIsProfileView(true);
    setIsSidebarOpen(false);
  };

  const navigateToMacroArea = (id: string) => {
    setActiveMacroAreaId(id);
    setActiveProjectId(null);
    setIsMyActivitiesView(false);
    setIsCompaniesView(false);
    setIsStaffView(false);
    setIsProfileView(false);
    setIsSidebarOpen(false);
  };

  const navigateToProject = (id: string) => {
    setActiveProjectId(id);
  };

  const handleSaveMacroArea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMacroTitle.trim()) return;

    try {
      if (editingMacroArea) {
        const { error } = await supabase.from('macro_areas').update({ 
          name: newMacroTitle, 
          po_id: newMacroPO || null 
        }).eq('id', editingMacroArea.id);
        
        if (error) throw error;
        
        const newData = data.map(a => a.id === editingMacroArea.id ? { ...a, name: newMacroTitle, po_id: newMacroPO } : a);
        setData(newData);
        toast.success('Macroárea atualizada com sucesso.');
      } else {
        const { data: inserted, error } = await supabase.from('macro_areas').insert({
          name: newMacroTitle,
          po_id: newMacroPO || null
        }).select().single();
        
        if (error) throw error;
        
        const newArea: MacroAreaWithProjects = {
          id: inserted.id,
          name: inserted.name,
          po_id: inserted.po_id || undefined,
          projects: [],
          icon: inserted.icon,
          color: inserted.color,
          created_at: inserted.created_at
        };
        setData([...data, newArea]);
        toast.success('Macroárea criada com sucesso.');
      }
      
      setIsMacroModalOpen(false);
      setEditingMacroArea(null);
      setNewMacroTitle('');
      setNewMacroPO('');
    } catch (err: any) {
      toast.error('Erro ao salvar macroárea: ' + (err.message || 'Verifique se já existe uma área com este nome.'));
    }
  };

  const handleDeleteMacroArea = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (data.length <= 1) {
      toast.error("É necessário ter pelo menos uma macroárea.");
      return;
    }
    const confirmed = await confirm({
      title: 'Excluir Macroárea',
      message: 'Deseja realmente excluir esta área estratégica e todos os seus projetos?'
    });
    if (!confirmed) return;
    
    try {
      const { error } = await supabase.from('macro_areas').delete().eq('id', id);
      if (error) throw error;
      
      const newData = data.filter(a => a.id !== id);
      setData(newData);
      if (activeMacroAreaId === id) navigateToDashboard();
      toast.success('Macroárea excluída com sucesso.');
    } catch (err: any) {
      toast.error('Erro ao excluir macroárea: ' + (err.message || 'Tente novamente.'));
    }
  };

  const openMacroModal = (area?: MacroAreaWithProjects, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (area) {
      setEditingMacroArea(area);
      setNewMacroTitle(area.name);
      setNewMacroPO(area.po_id || '');
    } else {
      setEditingMacroArea(null);
      setNewMacroTitle('');
      setNewMacroPO('');
    }
    setIsMacroModalOpen(true);
  };

  if (isLoadingAuth) {
    return (
      <div className="h-screen w-screen bg-brand-noir flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-brand-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-white/60 font-bold tracking-wider text-xs uppercase">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Portal />} />
      <Route path="/dashboard" element={
        <div className="flex flex-col h-screen bg-slate-50 text-slate-800 font-sans overflow-hidden">
          <div className="flex flex-1 overflow-hidden relative">
            {/* Mobile Sidebar Overlay */}
            {isSidebarOpen && (
              <div 
                className="absolute inset-0 bg-slate-900/50 z-40 lg:hidden"
                onClick={() => setIsSidebarOpen(false)}
              />
            )}

        {/* Sidebar */}
        <aside className={cn(
          "absolute lg:relative inset-y-0 left-0 z-50 bg-brand-noir transform transition-all duration-300 ease-in-out flex flex-col shadow-subtle border-r border-white/5",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          isSidebarCollapsed ? "lg:w-20" : "w-64"
        )}>
           {/* Toggle Sidebar Collapse Button (Desktop) */}
           <motion.button 
             onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
             className="hidden lg:flex absolute -right-3 top-5 z-[60] w-6 h-6 bg-brand-primary text-white rounded-full items-center justify-center border border-white/20 shadow-float transition-all duration-200 cursor-pointer"
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.9 }}
             title={isSidebarCollapsed ? "Expandir menu" : "Recolher menu"}
           >
             {isSidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
           </motion.button>

           {/* Sidebar Brand */}
           <div className="h-16 flex items-center px-6 mb-4">
              <div onClick={navigateToDashboard} className="cursor-pointer">
                <Logo collapsed={isSidebarCollapsed} />
              </div>
           </div>

           <div className="px-4 flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide py-2">
             {!isSidebarCollapsed && (
               <motion.h2 
                 initial={{ opacity: 0 }}
                 animate={{ opacity: 1 }}
                 className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em] mb-4 ml-3"
               >
                 Visão Geral
               </motion.h2>
             )}
             <nav className="space-y-1.5 mb-8">
                <motion.button 
                  onClick={navigateToDashboard}
                  whileHover={{ x: 4, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-all duration-200 group relative cursor-pointer",
                    !activeMacroAreaId && !isMyActivitiesView && !isCompaniesView && !isStaffView 
                      ? "font-bold text-white bg-brand-primary shadow-[0_0_15px_rgba(13,148,136,0.3)]" 
                      : "text-slate-400 hover:bg-white/5 hover:text-white",
                    isSidebarCollapsed && "justify-center px-0 h-[42px]"
                  )}
                  title="Dashboard"
                >
                  <LayoutGrid size={20} className={cn(!activeMacroAreaId && !isMyActivitiesView && !isCompaniesView && !isStaffView && !isProfileView ? "text-white" : "text-slate-500 group-hover:text-white")} />
                  {!isSidebarCollapsed && <span className="tracking-tight">Início / Dashboard</span>}
                  {!isSidebarCollapsed && !activeMacroAreaId && !isMyActivitiesView && !isCompaniesView && !isStaffView && !isProfileView && (
                    <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-white/40 shadow-[0_0_8px_white]" />
                  )}
                </motion.button>

                <motion.button 
                  onClick={navigateToMyActivities}
                  whileHover={{ x: 4, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-all duration-200 group relative cursor-pointer",
                    isMyActivitiesView 
                      ? "font-bold text-white bg-brand-primary shadow-[0_0_15px_rgba(13,148,136,0.3)]" 
                      : "text-slate-400 hover:bg-white/5 hover:text-white",
                    isSidebarCollapsed && "justify-center px-0 h-[42px]"
                  )}
                  title="Minhas Atividades"
                >
                  <CheckSquare size={20} className={cn(isMyActivitiesView ? "text-white" : "text-slate-500 group-hover:text-white")} />
                  {!isSidebarCollapsed && <span className="tracking-tight">Minhas Atividades</span>}
                  {!isSidebarCollapsed && isMyActivitiesView && (
                    <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-white/40 shadow-[0_0_8px_white]" />
                  )}
                </motion.button>

                <motion.button 
                  onClick={navigateToCompanies}
                  whileHover={{ x: 4, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-all duration-200 group relative cursor-pointer",
                    isCompaniesView 
                      ? "font-bold text-white bg-brand-primary shadow-[0_0_15px_rgba(13,148,136,0.3)]" 
                      : "text-slate-400 hover:bg-white/5 hover:text-white",
                    isSidebarCollapsed && "justify-center px-0 h-[42px]"
                  )}
                  title="Empresas"
                >
                  <Briefcase size={20} className={cn(isCompaniesView ? "text-white" : "text-slate-500 group-hover:text-white")} />
                  {!isSidebarCollapsed && <span className="tracking-tight">Empresas / Clientes</span>}
                  {!isSidebarCollapsed && isCompaniesView && (
                    <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-white/40 shadow-[0_0_8px_white]" />
                  )}
                </motion.button>

                {currentUser.role === 'admin' && (
                  <motion.button 
                    onClick={navigateToStaff}
                    whileHover={{ x: 4, scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-all duration-200 group relative cursor-pointer",
                      isStaffView 
                        ? "font-bold text-white bg-brand-primary shadow-[0_0_15px_rgba(13,148,136,0.3)]" 
                        : "text-slate-400 hover:bg-white/5 hover:text-white",
                      isSidebarCollapsed && "justify-center px-0 h-[42px]"
                    )}
                    title="Staff"
                  >
                    <Users size={20} className={cn(isStaffView ? "text-white" : "text-slate-500 group-hover:text-white")} />
                    {!isSidebarCollapsed && <span className="tracking-tight">Time / Staff</span>}
                    {!isSidebarCollapsed && isStaffView && (
                      <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-white/40 shadow-[0_0_8px_white]" />
                    )}
                  </motion.button>
                )}
             </nav>
             
              {!isSidebarCollapsed && (
                <div className="flex items-center justify-between mb-4 ml-3">
                  <h2 className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em]">Macroáreas</h2>
                  <motion.button 
                    whileHover={{ scale: 1.1, rotate: 90 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => openMacroModal()}
                    className="p-1 hover:bg-white/10 rounded-lg transition-all text-slate-500 hover:text-brand-accent shadow-sm"
                    title="Nova Macroárea"
                  >
                    <Plus size={16} />
                  </motion.button>
                </div>
              )}
              <nav className="space-y-1.5">
                 {data.map((area) => {
                   const isActive = activeMacroAreaId === area.id;
                   const Icon = getIconForMacroArea(area.name);
                   return (
                     <div key={area.id} className="group relative">
                       <button
                         onClick={() => navigateToMacroArea(area.id)}
                         className={cn(
                           "relative w-full flex items-center justify-between px-4 py-2.5 rounded-xl transition-all text-sm group/btn",
                           isActive 
                             ? "font-bold text-white bg-brand-primary shadow-[0_0_15px_rgba(13,148,136,0.3)]" 
                             : "text-slate-400 hover:bg-white/5 hover:text-white",
                           !isSidebarCollapsed && "pr-12",
                           isSidebarCollapsed && "justify-center px-0"
                         )}
                         title={area.name}
                       >
                         <div className="flex items-center gap-3 truncate">
                           {isSidebarCollapsed ? (
                             <Icon size={20} className={cn(isActive ? "text-white" : "text-slate-500 group-hover/btn:text-white transition-colors")} />
                           ) : (
                             <>
                               <Icon size={18} className={cn(isActive ? "text-white" : "text-slate-500 group-hover/btn:text-white transition-colors")} />
                               <span className="truncate text-left tracking-tight">{area.name}</span>
                             </>
                           )}
                         </div>
                         {!isSidebarCollapsed && isActive && (
                            <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-white/40 shadow-[0_0_8px_white]" />
                         )}
                       </button>
                       {!isSidebarCollapsed && (
                         <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                           <button 
                             onClick={(e) => openMacroModal(area, e)}
                             className="p-1 hover:bg-white/10 rounded text-slate-500 hover:text-brand-accent"
                             title="Editar"
                           >
                             <Edit size={12} />
                           </button>
                           <button 
                             onClick={(e) => handleDeleteMacroArea(area.id, e)}
                             className="p-1 hover:bg-white/10 rounded text-slate-500 hover:text-red-400"
                             title="Excluir"
                           >
                             <Trash size={12} />
                           </button>
                         </div>
                       )}
                     </div>
                   );
                 })}
              </nav>
           </div>
           
           {/* Sidebar Logout */}
           <div className="p-4 border-t border-white/5">
              <button 
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-slate-400 hover:bg-white/5 hover:text-white transition-all group"
              >
                <LogOut size={18} className="text-slate-500 group-hover:text-white transition-colors" />
                {!isSidebarCollapsed && <span className="font-medium">Sair</span>}
              </button>
           </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Top Nav */}
          <header className="h-16 bg-brand-noir text-white flex items-center justify-between px-6 shrink-0 z-40 border-b border-white/5 shadow-elegant">
            <div className="flex items-center gap-4 flex-1">
              <div className="relative w-full max-w-md hidden sm:block">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-500">
                  <Search size={16} />
                </div>
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                  placeholder="Buscar projetos, empresas, tarefas..." 
                  className="w-full bg-white/5 border border-white/10 rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary placeholder:text-slate-500 transition-all font-medium text-white"
                />
                
                {/* Search Results Dropdown */}
                <AnimatePresence>
                  {isSearchFocused && searchQuery.trim().length > 0 && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-elegant border border-slate-100 max-h-[70vh] overflow-y-auto z-50 py-2 text-slate-800"
                    >
                      {searchResults.projects.length === 0 && searchResults.tasks.length === 0 && searchResults.companies.length === 0 ? (
                        <div className="px-4 py-6 text-center text-slate-500 text-sm font-medium">
                          Nenhum resultado encontrado para "{searchQuery}"
                        </div>
                      ) : (
                        <div className="flex flex-col">
                          {searchResults.projects.length > 0 && (
                            <div className="px-3 py-2">
                              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">Projetos</h3>
                              <div className="flex flex-col gap-1">
                                {searchResults.projects.map(({ project, macroArea }) => (
                                  <button 
                                    key={`p-${project.id}`}
                                    onClick={() => handleSelectSearchResult(project.id, macroArea.id)}
                                    className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors"
                                  >
                                    <div className="w-8 h-8 rounded bg-brand-primary/10 text-brand-primary flex items-center justify-center shrink-0">
                                      <Briefcase size={14} />
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                      <span className="text-sm font-bold truncate">{project.name}</span>
                                      <span className="text-[10px] text-slate-500 truncate font-medium">Macroárea: {macroArea.name}</span>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {searchResults.tasks.length > 0 && (
                            <div className="px-3 py-2 border-t border-slate-50">
                              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">Tarefas</h3>
                              <div className="flex flex-col gap-1">
                                {searchResults.tasks.map(({ task, project, macroArea }) => (
                                  <button 
                                    key={`t-${task.id}`}
                                    onClick={() => handleSelectSearchResult(project.id, macroArea.id)}
                                    className="flex items-start gap-2 w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors"
                                  >
                                    <div className="mt-0.5 shrink-0">
                                      <CheckSquare size={14} className={task.status === 'done' ? "text-emerald-500" : "text-slate-400"} />
                                    </div>
                                    <div className="flex flex-col min-w-0 flex-1">
                                      <span className={cn("text-sm font-semibold leading-tight", task.status === 'done' && 'line-through text-slate-500')}>{task.title}</span>
                                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                        <span className="text-[9px] font-bold text-brand-primary bg-brand-primary/10 px-1.5 py-0.5 rounded truncate">{project.name}</span>
                                        {task.companyName && (
                                          <span className="text-[9px] font-bold text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded truncate">{task.companyName}</span>
                                        )}
                                      </div>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {searchResults.companies.length > 0 && (
                            <div className="px-3 py-2 border-t border-slate-50">
                              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">Empresas</h3>
                              <div className="flex flex-col gap-1">
                                {searchResults.companies.map((c) => (
                                  <button 
                                    key={`c-${c.id}`}
                                    onClick={() => {
                                      setIsCompaniesView(true);
                                      setSearchQuery('');
                                      setIsSearchFocused(false);
                                    }}
                                    className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors"
                                  >
                                    <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 border border-slate-200 flex items-center justify-center shrink-0">
                                      {c.logo_url ? <img src={c.logo_url} alt={c.name} className="w-full h-full rounded-full object-cover" /> : <Briefcase size={14} />}
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                      <span className="text-sm font-bold truncate text-slate-700">{c.name}</span>
                                      {c.contact_person && <span className="text-[10px] text-slate-500 truncate font-medium">Contato: {c.contact_person}</span>}
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
            
            <div className="flex items-center gap-6">
              <div className="relative">
                <motion.button 
                  onClick={() => {
                    setIsNotificationsOpen(!isNotificationsOpen);
                    setIsSearchFocused(false);
                  }}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="relative p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-full transition-all cursor-pointer"
                >
                  <Bell size={20} />
                  {myNotifications.length > 0 && (
                    <span className="absolute top-1 right-1 min-w-[14px] h-[14px] px-1 bg-red-500 rounded-full border border-brand-noir flex items-center justify-center text-[8px] font-bold text-white">
                      {myNotifications.length}
                    </span>
                  )}
                </motion.button>

                {/* Notifications Dropdown */}
                <AnimatePresence>
                  {isNotificationsOpen && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute top-full right-0 mt-2 w-80 bg-white rounded-xl shadow-elegant border border-slate-100 max-h-[70vh] overflow-y-auto z-50 py-2 text-slate-800"
                    >
                      <div className="px-4 py-2 border-b border-slate-50 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-sm z-10">
                        <h3 className="text-sm font-bold text-slate-800">Notificações</h3>
                        <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                          {myNotifications.length}
                        </span>
                      </div>
                      
                      {myNotifications.length === 0 ? (
                        <div className="px-4 py-8 text-center text-slate-500 flex flex-col items-center">
                          <Bell size={24} className="text-slate-300 mb-2" />
                          <p className="text-sm font-medium">Tudo tranquilo por aqui!</p>
                          <p className="text-xs text-slate-400">Você não tem notificações pendentes.</p>
                        </div>
                      ) : (
                        <div className="flex flex-col">
                          {myNotifications.map((notif, idx) => (
                            <button 
                              key={`notif-${idx}`}
                              onClick={() => {
                                handleSelectSearchResult(notif.task.projectId, notif.task.macroAreaId);
                                setIsNotificationsOpen(false);
                              }}
                              className="flex items-start gap-3 w-full text-left px-4 py-3 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors group"
                            >
                              <div className="mt-0.5 shrink-0">
                                {notif.type === 'late' && <AlertCircle size={16} className="text-red-500" />}
                                {notif.type === 'today' && <Clock size={16} className="text-amber-500" />}
                                {notif.type === 'recent' && <CheckCircle2 size={16} className="text-brand-primary" />}
                              </div>
                              <div className="flex flex-col min-w-0 flex-1">
                                <span className={cn("text-[10px] font-bold uppercase tracking-wider mb-0.5", 
                                  notif.type === 'late' ? 'text-red-500' : 
                                  notif.type === 'today' ? 'text-amber-500' : 'text-brand-primary'
                                )}>
                                  {notif.message.split(':')[0]}
                                </span>
                                <span className="text-sm font-semibold text-slate-700 leading-tight group-hover:text-brand-primary transition-colors">
                                  {notif.task.title}
                                </span>
                                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                  <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded truncate">{notif.task.projectTitle}</span>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              
              <div className="h-8 w-px bg-white/10 mx-2 hidden sm:block" />

              <motion.div 
                whileHover={{ x: -2 }}
                onClick={navigateToProfile}
                className="flex items-center gap-3 group cursor-pointer"
              >
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-bold text-white group-hover:text-brand-accent transition-colors leading-tight">{currentUser.full_name}</p>
                  <p className="text-xs text-slate-500 font-medium tracking-tight">{currentUser.role === 'admin' ? 'Administrador' : currentUser.role}</p>
                </div>
                <div className="relative">
                  <div className="w-9 h-9 rounded-full bg-brand-surface border border-white/10 flex items-center justify-center font-black text-brand-accent text-sm shadow-sm group-hover:scale-105 transition-all overflow-hidden">
                    {currentUser.avatar_url ? (
                      <img src={currentUser.avatar_url} alt={currentUser.full_name} className="w-full h-full object-cover" />
                    ) : (
                      currentUser.full_name.split(' ').map(n => n[0]).join('')
                    )}
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-brand-noir" />
                </div>
                <ChevronDown size={14} className={cn("text-slate-500 group-hover:text-white transition-colors", isProfileView && "rotate-180")} />
              </motion.div>
              
              <button className="lg:hidden text-slate-300 cursor-pointer" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
                <Menu size={20} />
              </button>
            </div>
          </header>

          <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-white/50 relative">
            <AnimatePresence mode="wait">
            {isProfileView ? (
              <motion.div
                key="profile"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className="h-full overflow-hidden"
              >
                <ProfileView 
                  user={currentUser} 
                  onUpdateUser={(updated) => {
                    setCurrentUser(updated);
                    setStaff(staff.map(s => s.id === updated.id ? updated : s));
                  }}
                />
              </motion.div>
            ) : isStaffView ? (
              <motion.div
                key="staff"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className="h-full overflow-hidden"
              >
                <StaffView 
                  staff={staff} 
                  onUpdateStaff={handleUpdateStaff}
                  onDeleteStaff={handleDeleteStaff}
                  data={data}
                />
              </motion.div>
            ) : isCompaniesView ? (
              <motion.div
                key="companies"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className="h-full overflow-hidden"
              >
                <CompaniesView 
                  companies={companies} 
                  onUpdateCompanies={setCompanies}
                  data={data}
                  onUpdateGlobalData={setData}
                  staff={staff}
                />
              </motion.div>
            ) : isMyActivitiesView ? (
              <motion.div
                key="my-activities"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className="h-full overflow-hidden"
              >
                <MyActivitiesView 
                  data={data} 
                  personalTasks={personalTasks} 
                  onUpdatePersonalTasks={setPersonalTasks}
                  onUpdateGlobalData={setData}
                  companies={companies}
                  currentUser={currentUser}
                  staff={staff}
                />
              </motion.div>
            ) : !activeMacroAreaId ? (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className="h-full overflow-auto"
              >
                <DashboardView 
                  data={data} 
                  onNavigateToMacroArea={navigateToMacroArea} 
                  onUpdateData={setData}
                  staff={staff}
                />
              </motion.div>
            ) : !activeProjectId ? (
              <motion.div
                key={`macro-${activeMacroAreaId}`}
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className="h-full overflow-auto"
              >
                <MacroAreaView 
                  area={activeMacroArea!} 
                  onSelectProject={navigateToProject} 
                  onUpdateData={(newData) => setData(newData)}
                  allData={data}
                  companies={companies}
                  staff={staff}
                />
              </motion.div>
            ) : (
              <motion.div
                key={`project-${activeProjectId}`}
                initial={{ opacity: 0, scale: 0.99 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.01 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className="h-full overflow-auto"
              >
                <ProjectView 
                  project={activeProject!} 
                  activeMacroArea={activeMacroArea!} 
                  onBack={() => setActiveProjectId(null)} 
                  onUpdateData={(newData) => setData(newData)}
                  allData={data}
                  companies={companies}
                  staff={staff}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>

    <Modal isOpen={isMacroModalOpen} onClose={() => setIsMacroModalOpen(false)} title={editingMacroArea ? "Editar Macroárea" : "Nova Macroárea"}>
        <form onSubmit={handleSaveMacroArea} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Título da Macroárea</label>
            <input type="text" autoFocus value={newMacroTitle} onChange={(e) => setNewMacroTitle(e.target.value)} placeholder="Ex: Financeiro" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-accent focus:outline-none text-sm font-medium" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Product Owner</label>
            <select value={newMacroPO} onChange={(e) => setNewMacroPO(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-accent focus:outline-none text-sm font-medium cursor-pointer transition-all hover:border-brand-accent/50">
              <option value="">Nenhum PO Atribuído</option>
              {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </select>
          </div>
          <button type="submit" className="w-full py-3 bg-brand-primary text-white font-bold text-sm rounded-lg hover:bg-brand-secondary transition-colors mt-2">
            {editingMacroArea ? "SALVAR ALTERAÇÕES" : "CRIAR MACROÁREA"}
          </button>
        </form>
      </Modal>
        </div>
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

// --- Views ---








