import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Target, Briefcase, Users, LayoutDashboard, Search, Settings, FileText, ChevronRight, Calculator, CheckCircle2, TrendingUp, Clock, Calendar, MessageSquare, Zap, BarChart2, Plus, Rocket, AlertCircle, LineChart as LucideLineChart, ArrowRight, Edit, Trash, MapPin, CalendarDays, ExternalLink } from 'lucide-react';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Bar, PieChart, Pie, Cell } from 'recharts';
import { MacroAreaWithProjects, Staff, Task, MacroArea, CalendarEvent } from '../types';
import { Modal } from '../components/shared/Modal';
import { cn, getPriorityColor, getPriorityLabel, getInitials, calculateDueDateStatus, formatDate } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { useConfirm } from '../hooks/useConfirm';

// Helper seguro para formatar datas no fuso horário LOCAL (YYYY-MM-DD)
const formatLocalDate = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Icon Mapping
const getIconForMacroArea = (name: string) => {
  switch (name) {
    case 'Estudo de Viabilidade Econômica': return Target;
    case 'Contábil': return Calculator;
    case 'Cursos': return Target;
    case 'Estudo de Competitividade': return Target;
    case 'Competitividade': return FileText;
    case 'Projetos': return Briefcase;
    case 'PPB': return Zap;
    default: return Settings;
  }
};

export function DashboardView({ 
  data, 
  onNavigateToMacroArea, 
  onUpdateData, 
  staff = [],
  currentUser,
  onNavigateToCalendar
}: { 
  data: MacroAreaWithProjects[], 
  onNavigateToMacroArea: (id: string) => void,
  onUpdateData: (data: MacroAreaWithProjects[]) => void,
  staff?: Staff[],
  currentUser?: any,
  onNavigateToCalendar?: () => void
}) {
  const { confirm } = useConfirm();
  const [activeTab, setActiveTab] = useState<'overview' | 'metrics' | 'personal'>('overview');
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [isInterventionModalOpen, setIsInterventionModalOpen] = useState(false);
  const [isReprioritizeModalOpen, setIsReprioritizeModalOpen] = useState(false);
  const [isMeetingModalOpen, setIsMeetingModalOpen] = useState(false);
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  
  // Estado e busca das atividades de hoje no calendário (apenas visualização)
  const [todayEvents, setTodayEvents] = useState<CalendarEvent[]>([]);
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(true);

  // Formatação de data completa para o cabeçalho
  const todayFormatted = useMemo(() => {
    const d = new Date();
    const weekday = d.toLocaleDateString('pt-BR', { weekday: 'long' });
    const day = d.getDate();
    const month = d.toLocaleDateString('pt-BR', { month: 'long' });
    const year = d.getFullYear();
    return `${weekday.charAt(0).toUpperCase() + weekday.slice(1)}, ${day} de ${month} de ${year}`;
  }, []);

  const userName = currentUser?.full_name || 'Usuário';

  useEffect(() => {
    const fetchTodayEvents = async () => {
      setIsLoadingCalendar(true);
      try {
        const todayStr = formatLocalDate(new Date());

        const startWindow = new Date();
        startWindow.setDate(startWindow.getDate() - 1);
        startWindow.setHours(0, 0, 0, 0);

        const endWindow = new Date();
        endWindow.setDate(endWindow.getDate() + 1);
        endWindow.setHours(23, 59, 59, 999);

        const { data: eventsData, error } = await supabase
          .from('calendar_events')
          .select('*')
          .gte('start_time', startWindow.toISOString())
          .lte('start_time', endWindow.toISOString())
          .order('start_time', { ascending: true });

        if (error) throw error;

        const filtered = (eventsData as CalendarEvent[] || []).filter(ev => {
          if (!ev.start_time) return false;
          return formatLocalDate(new Date(ev.start_time)) === todayStr;
        });

        setTodayEvents(filtered);
      } catch (err) {
        console.warn('Erro ao buscar eventos do dia:', err);
      } finally {
        setIsLoadingCalendar(false);
      }
    };

    fetchTodayEvents();

    const channel = supabase
      .channel('dashboard_today_events')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_events' }, () => {
        fetchTodayEvents();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
  
  const [isMacroModalOpen, setIsMacroModalOpen] = useState(false);
  const [editingMacroArea, setEditingMacroArea] = useState<MacroArea | null>(null);
  const [newMacroTitle, setNewMacroTitle] = useState('');
  const [newMacroPOId, setNewMacroPOId] = useState('');

  const [meetingDate, setMeetingDate] = useState('');
  const [meetingTime, setMeetingTime] = useState('');

  const openMacroModal = (area?: MacroAreaWithProjects, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (area) {
      setEditingMacroArea(area);
      setNewMacroTitle(area.name);
      setNewMacroPOId(area.po_id || '');
    } else {
      setEditingMacroArea(null);
      setNewMacroTitle('');
      setNewMacroPOId('');
    }
    setIsMacroModalOpen(true);
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
    if (confirmed) {
      try {
        const { error } = await supabase.from('macro_areas').delete().eq('id', id);
        if (error) throw error;
        onUpdateData(data.filter(a => a.id !== id));
        toast.success('Macroárea excluída com sucesso.');
      } catch (err: any) {
        toast.error('Erro ao excluir macroárea: ' + (err.message || 'Tente novamente.'));
      }
    }
  };

  const handleSaveMacroArea = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMacroTitle.trim()) return;

    if (editingMacroArea) {
      onUpdateData(data.map(a => a.id === editingMacroArea.id ? { ...a, name: newMacroTitle, po_id: newMacroPOId } : a));
    } else {
      const newArea: MacroAreaWithProjects = {
        id: `ma_${Date.now()}`,
        name: newMacroTitle,
        po_id: newMacroPOId,
        projects: []
      };
      onUpdateData([...data, newArea]);
    }
    setIsMacroModalOpen(false);
  };

  const updateTaskInGlobalData = (taskId: string, updates: Partial<Task>) => {
    const newData = data.map(area => ({
      ...area,
      projects: area.projects.map(project => ({
        ...project,
        sprints: project.sprints.map(sprint => ({
          ...sprint,
          tasks: sprint.tasks.map(task => 
            task.id === taskId ? { ...task, ...updates } : task
          )
        }))
      }))
    }));
    onUpdateData(newData);
  };

  const stats = useMemo(() => {
    let totalProjects = 0;
    let totalTasks = 0;
    let completedTasks = 0;
    let delayedTasksCount = 0;
    const macroAreaData: { name: string, todo: number, progress: number, review: number, done: number, total: number }[] = [];
    const criticalTasks: (Task & { macroArea: string, project: string })[] = [];

    const userStatsMap = new Map<string, { todo: number, progress: number, review: number, done: number, total: number, delayed: number, tasks: (Task & { macroArea: string, project: string, sprint: string })[] }>();

    data.forEach(area => {
      let areaTodo = 0;
      let areaProgress = 0;
      let areaReview = 0;
      let areaDone = 0;
      
      totalProjects += area.projects.length;
      area.projects.forEach(project => {
        project.sprints.forEach(sprint => {
          totalTasks += sprint.tasks.length;
          sprint.tasks.forEach(task => {
            if (task.status === 'todo') areaTodo++;
            if (task.status === 'in-progress') areaProgress++;
            if (task.status === 'review') areaReview++;
            if (task.status === 'done') {
              areaDone++;
              completedTasks++;
            } else {
              // Check if delayed
              const status = calculateDueDateStatus(task.due_date);
              if (status?.label === 'ATRASADO') {
                delayedTasksCount++;
                criticalTasks.push({ ...task, macroArea: area.name, project: project.name });
              }
            }

            // User stats calculation
            (task.assignees || []).forEach(assignee => {
              if (!userStatsMap.has(assignee)) {
                userStatsMap.set(assignee, { todo: 0, progress: 0, review: 0, done: 0, total: 0, delayed: 0, tasks: [] });
              }
              const us = userStatsMap.get(assignee)!;
              us.total++;
              us.tasks.push({ ...task, macroArea: area.name, project: project.name, sprint: sprint.title });
              if (task.status === 'todo') us.todo++;
              if (task.status === 'in-progress') us.progress++;
              if (task.status === 'review') us.review++;
              if (task.status === 'done') us.done++;
              
              if (task.status !== 'done') {
                const status = calculateDueDateStatus(task.due_date);
                if (status?.label === 'ATRASADO') {
                  us.delayed++;
                }
              }
            });
          });
        });
      });

      macroAreaData.push({
        name: area.name,
        todo: areaTodo,
        progress: areaProgress,
        review: areaReview,
        done: areaDone,
        total: areaTodo + areaProgress + areaReview + areaDone
      });
    });

    const userStats = Array.from(userStatsMap.entries()).map(([name, stats]) => ({
      name,
      ...stats,
      progress: stats.total === 0 ? 0 : Math.round((stats.done / stats.total) * 100)
    })).sort((a, b) => b.delayed - a.delayed || b.total - a.total);

    const overallProgress = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

    const pieData = [
      { name: 'A Fazer', value: macroAreaData.reduce((a, b) => a + b.todo, 0), color: '#94a3b8' },
      { name: 'Em Andamento', value: macroAreaData.reduce((a, b) => a + b.progress, 0), color: '#6adad9' },
      { name: 'Revisão', value: macroAreaData.reduce((a, b) => a + b.review, 0), color: '#fbbf24' },
      { name: 'Concluído', value: macroAreaData.reduce((a, b) => a + b.done, 0), color: '#10b981' },
    ];

    const capacityPercent = userStatsMap.size === 0 ? 0 : Math.min(100, Math.round(((totalTasks - completedTasks) / (userStatsMap.size * 15)) * 100));

    let globalHealth = "Boa";
    let healthColor = "text-emerald-600";
    const delayedRatio = totalTasks === 0 ? 0 : delayedTasksCount / totalTasks;
    if (delayedRatio > 0.15) {
      globalHealth = "Crítica";
      healthColor = "text-red-600";
    } else if (delayedRatio > 0.05) {
      globalHealth = "Atenção";
      healthColor = "text-amber-500";
    } else if (delayedTasksCount === 0 && totalTasks > 0) {
      globalHealth = "Excelente";
      healthColor = "text-blue-600";
    }

    const attractivenessScore = totalTasks === 0 ? 0 : Math.max(0, Math.min(10, (10 - (delayedRatio * 20) + (overallProgress / 20)))).toFixed(1);

    return { 
      totalProjects, totalTasks, completedTasks, delayedTasksCount, overallProgress, 
      macroAreaData, pieData, criticalTasks, userStats,
      vitalSigns: { capacityPercent, globalHealth, healthColor, attractivenessScore }
    };
  }, [data]);

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto scrollbar-hide">
      {/* HEADER LIMPO DO DASHBOARD */}
      <div className="bg-white border-b border-slate-200 px-8 py-5 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            Olá, {userName}, bem-vindo! 👋
          </h3>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Hoje é {todayFormatted} • Mourão Consultoria Econômica
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="px-3.5 py-1.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-2 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">MourãoScrum</span>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* CARD QUE PEGA TODO O HORIZONTE: PRÉVIA DO CALENDÁRIO PARA O DIA DE HOJE */}
        <div className="w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary shrink-0">
                <Calendar size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-extrabold text-slate-800 uppercase tracking-tight">
                    Atividades de hoje
                  </h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                    {todayEvents.length} {todayEvents.length === 1 ? 'compromisso' : 'compromissos'}
                  </span>
                </div>
                <p className="text-xs font-medium text-slate-400 mt-0.5">
                  Lista das atividades de hoje de acordo com o calendário (apenas para visualizar)
                </p>
              </div>
            </div>

            {onNavigateToCalendar && (
              <button
                onClick={onNavigateToCalendar}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition-all shadow-2xs hover:border-slate-300 cursor-pointer self-start sm:self-auto"
                title="Abrir calendário completo"
              >
                <CalendarDays size={14} className="text-brand-primary" />
                <span>Ver agenda completa</span>
                <ChevronRight size={14} className="text-slate-400" />
              </button>
            )}
          </div>

          {/* Conteúdo das Atividades de Hoje */}
          {isLoadingCalendar ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 bg-slate-50 rounded-2xl border border-slate-100 animate-pulse p-4" />
              ))}
            </div>
          ) : todayEvents.length === 0 ? (
            <div className="bg-slate-50/70 border border-dashed border-slate-200 rounded-2xl p-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <h5 className="text-sm font-bold text-slate-800">Nenhum compromisso agendado para hoje</h5>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">
                    Seu dia está livre no calendário corporativo para focar nas entregas e projetos estratégicos.
                  </p>
                </div>
              </div>
              {onNavigateToCalendar && (
                <button
                  onClick={onNavigateToCalendar}
                  className="text-xs font-bold text-brand-primary hover:text-brand-primary/80 transition-colors shrink-0 flex items-center gap-1 cursor-pointer"
                >
                  Abrir calendário <ChevronRight size={14} />
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
              {todayEvents.map((ev) => {
                const startTimeFormatted = ev.all_day
                  ? 'Dia todo'
                  : new Date(ev.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

                const endTimeFormatted = !ev.all_day && ev.end_time
                  ? new Date(ev.end_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                  : null;

                return (
                  <div
                    key={ev.id}
                    className="bg-slate-50/80 hover:bg-slate-100/80 border border-slate-200/90 rounded-2xl p-4 flex flex-col justify-between gap-2.5 shadow-2xs transition-all"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1.5 mb-2">
                        <span className="text-[11px] font-bold text-brand-primary flex items-center gap-1.5">
                          <Clock size={12} className="text-brand-primary/70" />
                          {startTimeFormatted} {endTimeFormatted && `• ${endTimeFormatted}`}
                        </span>
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border bg-white text-slate-500 border-slate-200 shrink-0">
                          {ev.source === 'apple' ? '🍏 iCloud' : 'Mourão'}
                        </span>
                      </div>
                      <h5 className="text-sm font-bold text-slate-800 line-clamp-2 leading-snug" title={ev.title}>
                        {ev.title}
                      </h5>
                    </div>

                    {ev.location && (
                      <div className="flex items-center gap-1 text-[11px] text-slate-500 truncate pt-2 border-t border-slate-200/60">
                        <MapPin size={12} className="shrink-0 text-slate-400" />
                        <span className="truncate">{ev.location}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        {/* Priority Section: Critical Tasks & Team Workload */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Critical Tasks - NOW PRIMARY */}
          <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-elegant overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-white">
              <div>
                <h4 className="text-sm font-bold text-slate-800 uppercase tracking-tight">Tarefas Críticas & Atrasos</h4>
                <p className="text-xs font-medium text-slate-400 mt-0.5">{stats.delayedTasksCount} {stats.delayedTasksCount === 1 ? 'atividade necessita' : 'atividades necessitam'} de atenção</p>
              </div>
            </div>
            <div className="flex-1 overflow-auto max-h-[460px]">
              {stats.criticalTasks.length === 0 ? (
                <div className="p-16 text-center">
                  <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-100">
                    <CheckCircle2 size={32} />
                  </div>
                  <h5 className="text-lg font-bold text-slate-800 mb-2">Tudo no controle!</h5>
                  <p className="text-slate-400 text-sm font-medium">Não há tarefas em atraso no momento.</p>
                </div>
              ) : (
                <div className="p-4 space-y-3">
                  {stats.criticalTasks.map((task, i) => {
                    const due = new Date(task.due_date!);
                    const today = new Date();
                    today.setHours(0,0,0,0); due.setHours(0,0,0,0);
                    const diffDays = Math.max(1, Math.ceil((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)));
                    
                    return (
                      <div key={i} className="group relative bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-red-200 transition-all overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        {/* Left Accent border */}
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500"></div>
                        
                        <div className="flex-1 pl-2">
                           <div className="flex items-center gap-2 mb-1.5">
                             <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded uppercase tracking-wider">Atrasada há {diffDays} {diffDays === 1 ? 'dia' : 'dias'}</span>
                             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">• {task.macroArea}</span>
                           </div>
                           <h5 className="text-sm font-black text-slate-800 mb-1 line-clamp-1">{task.title}</h5>
                           <p className="text-xs font-medium text-slate-500 line-clamp-1">{task.project}</p>
                        </div>
                        
                        <div className="flex items-center justify-between sm:justify-end gap-6 shrink-0">
                           <div className="flex items-center gap-2">
                             <span className={cn("text-[9px] px-2 py-1 rounded-md font-bold uppercase tracking-widest", getPriorityColor(task.priority))}>
                               {getPriorityLabel(task.priority)}
                             </span>
                           </div>
                           
                           <div className="flex -space-x-2">
                             {task.assignees.slice(0, 3).map((a: string) => {
                               const staffMember = staff.find(s => 
                                 s.full_name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === 
                                 a.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                               );
                               return staffMember?.avatar_url ? (
                                 <img key={a} src={staffMember.avatar_url} alt={a} title={a} className="w-8 h-8 rounded-full object-cover border-2 border-white shadow-sm ring-1 ring-slate-100" />
                               ) : (
                                 <div key={a} className="w-8 h-8 rounded-full bg-slate-100 text-[10px] font-bold text-slate-500 flex items-center justify-center border-2 border-white shadow-sm ring-1 ring-slate-100" title={a}>
                                   {a.split(' ').map(n => n[0]).join('').substring(0, 2)}
                                 </div>
                               );
                             })}
                             {task.assignees.length > 3 && (
                               <div className="w-8 h-8 rounded-full bg-slate-50 text-[10px] font-bold text-slate-400 flex items-center justify-center border-2 border-white shadow-sm ring-1 ring-slate-100">
                                 +{task.assignees.length - 3}
                               </div>
                             )}
                           </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Team Vital Signs / Workload */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 flex flex-col font-sans overflow-hidden">
             <div className="flex items-center justify-between mb-5 pb-3.5 border-b border-slate-100 shrink-0">
                <div>
                  <h4 className="text-sm font-bold text-slate-800 uppercase tracking-tight">Sinais Vitais da Equipe</h4>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Carga e Capacidade Atual</p>
                </div>
                <div className="p-2 bg-brand-primary/5 rounded-xl border border-brand-primary/10 text-brand-primary shrink-0">
                  <Users size={18} />
                </div>
             </div>

             <div className="space-y-3.5 flex-1 min-h-0">
                {stats.userStats.slice(0, 5).map((user) => {
                  const workloadPercent = Math.min(100, (user.total / 15) * 100); // 15 tasks is "full capacity"
                  const isOverloaded = user.total > 12;
                  
                  const staffMember = staff.find(s => 
                    s.full_name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === 
                    user.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                  );

                  return (
                    <div key={user.name} className="space-y-1.5">
                       <div className="flex justify-between items-center gap-2">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            {staffMember?.avatar_url ? (
                              <img src={staffMember.avatar_url} alt={user.name} className="w-6 h-6 rounded-full object-cover shadow-2xs ring-1 ring-slate-100 shrink-0" />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-brand-primary text-[9px] font-bold text-white flex items-center justify-center shadow-2xs ring-1 ring-slate-100 shrink-0">
                                {user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-xs font-bold text-slate-800 truncate" title={user.name}>{user.name}</span>
                              {isOverloaded && (
                                <span className="text-[9px] font-bold bg-red-50 text-red-600 border border-red-200 px-1.5 py-0.2 rounded uppercase tracking-wider shrink-0">
                                  Alerta
                                </span>
                              )}
                            </div>
                          </div>
                          <span className={cn("text-[11px] font-bold shrink-0", isOverloaded ? "text-red-500" : "text-slate-500")}>
                            {user.total} {user.total === 1 ? 'ativa' : 'ativas'}
                          </span>
                       </div>
                       <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className={cn(
                              "h-full rounded-full transition-all duration-500",
                              isOverloaded ? "bg-red-500" : user.total > 8 ? "bg-amber-400" : "bg-emerald-500"
                            )} 
                            style={{ width: `${workloadPercent}%` }}
                          />
                       </div>
                    </div>
                  );
                })}
             </div>

             {/* Footer com métricas sintetizadas em Grid 3 colunas (sem vazamento) */}
             <div className="mt-5 pt-3.5 border-t border-slate-100 bg-slate-50/80 -mx-5 -mb-5 sm:-mx-6 sm:-mb-6 px-3 sm:px-4 py-3 shrink-0">
               <div className="grid grid-cols-3 divide-x divide-slate-200 text-center">
                  <div className="flex flex-col items-center px-1">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider truncate w-full">Capacidade</span>
                    <span className="text-base font-black text-slate-800 mt-0.5">{stats.vitalSigns.capacityPercent}%</span>
                  </div>
                  <div className="flex flex-col items-center px-1">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider truncate w-full">Saúde</span>
                    <span className={cn("text-base font-black mt-0.5 truncate w-full", stats.vitalSigns.healthColor)}>{stats.vitalSigns.globalHealth}</span>
                  </div>
                  <div className="flex flex-col items-center px-1">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider truncate w-full">Score</span>
                    <span className="text-base font-black text-brand-primary mt-0.5">{stats.vitalSigns.attractivenessScore}</span>
                  </div>
               </div>
             </div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h4 className="text-sm font-bold text-slate-800 uppercase tracking-tight">Carga por Macroárea</h4>
                <p className="text-xs text-slate-400">Distribuição de tarefas entre departamentos</p>
              </div>
              <LucideLineChart size={20} className="text-slate-300" />
            </div>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.macroAreaData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    stroke="#94a3b8" 
                    fontSize={10} 
                    fontWeight="600" 
                    tickLine={false} 
                    axisLine={false}
                    tick={{ fill: '#64748b' }}
                  />
                  <YAxis 
                    stroke="#94a3b8" 
                    fontSize={10} 
                    fontWeight="600" 
                    tickLine={false} 
                    axisLine={false}
                    tick={{ fill: '#64748b' }}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                  />
                  <Legend iconType="circle" />
                  <Bar dataKey="done" name="Concluído" fill="#10b981" radius={[4, 4, 0, 0]} stackId="a" />
                  <Bar dataKey="progress" name="Em Andamento" fill="#6adad9" radius={[4, 4, 0, 0]} stackId="a" />
                  <Bar dataKey="review" name="Revisão" fill="#fbbf24" radius={[4, 4, 0, 0]} stackId="a" />
                  <Bar dataKey="todo" name="A Fazer" fill="#cbd5e1" radius={[4, 4, 0, 0]} stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
             {/* Background Decoration */}
             <div className="absolute top-0 right-0 p-12 opacity-[0.03] scale-150 rotate-12 pointer-events-none">
                <LayoutDashboard size={200} />
             </div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h4 className="text-sm font-bold text-slate-800 uppercase tracking-tight">Status Global</h4>
                <p className="text-xs text-slate-400">Distribuição total de estados</p>
              </div>
              <LayoutDashboard size={20} className="text-slate-300" />
            </div>
            <div className="h-80 w-full flex flex-col items-center">
              <ResponsiveContainer width="100%" height="80%">
                <PieChart>
                  <Pie
                    data={stats.pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={105}
                    paddingAngle={8}
                    dataKey="value"
                    stroke="none"
                  >
                    {stats.pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px 16px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-x-8 gap-y-3 w-full mt-4">
                {stats.pieData.map((item, i) => (
                  <div key={i} className="flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: item.color }}></div>
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider group-hover:text-slate-800 transition-colors">{item.name}</span>
                    </div>
                    <span className="text-xs font-bold text-slate-700">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Equipe / Funcionários Section - Detailed */}
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-bold text-slate-800 uppercase tracking-tight flex items-center gap-2">
                <Users size={20} className="text-brand-accent animate-bounce-slow" />
                Performance & Estado dos Funcionários
              </h4>
              <p className="text-xs text-slate-400 font-medium">Monitoramento em tempo real de capacidade e atrasos por consultor</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs font-bold text-slate-400 bg-white border border-slate-200 px-4 py-1.5 rounded-xl shadow-subtle">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div> No Prazo
              </span>
              <span className="flex items-center gap-1.5 text-xs font-bold text-slate-400 bg-white border border-slate-200 px-4 py-1.5 rounded-xl shadow-subtle">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"></div> Em Atraso
              </span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {stats.userStats.map((user, idx) => {
               const isOverloaded = user.total > 12;
               return (
                <motion.div 
                  key={user.name}
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.05 }}
                  className={cn(
                    "bg-white p-6 rounded-2xl border transition-all duration-300 group relative overflow-hidden",
                    user.delayed > 0 ? "border-red-100 shadow-elegant" : "border-slate-200 shadow-sm hover:shadow-elegant",
                    isOverloaded && "ring-2 ring-amber-400 ring-offset-2"
                  )}
                >
                  {/* Performance Badge */}
                  <div className="absolute top-4 right-4">
                     <span className={cn(
                       "text-[10px] font-bold px-2 py-0.5 rounded-full ring-1 ring-inset uppercase tracking-wider",
                       user.progress > 80 ? "bg-emerald-50 text-emerald-600 ring-emerald-200" :
                       user.progress > 50 ? "bg-amber-50 text-amber-600 ring-amber-200" :
                       "bg-red-50 text-red-600 ring-red-200"
                     )}>
                       {user.progress}% Efic.
                     </span>
                  </div>

                  <div className="flex items-start gap-4 mb-5">
                    <div className="relative">
                      {(() => {
                        const staffMember = staff.find(s => 
                          s.full_name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === 
                          user.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                        );
                        return staffMember?.avatar_url ? (
                          <img src={staffMember.avatar_url} alt={user.name} className="w-14 h-14 rounded-2xl object-cover border-2 border-slate-100 shadow-inner group-hover:scale-105 transition-transform duration-500" />
                        ) : (
                          <div className="w-14 h-14 rounded-2xl bg-brand-primary/5 text-brand-primary flex items-center justify-center font-bold text-sm border-2 border-slate-100 shadow-inner group-hover:bg-brand-primary group-hover:text-white group-hover:scale-105 transition-all duration-500">
                            {user.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2)}
                          </div>
                        );
                      })()}
                      <div className={cn(
                        "absolute -bottom-1 -right-1 w-5 h-5 rounded-lg border-2 border-white flex items-center justify-center text-white",
                        user.delayed === 0 ? "bg-emerald-500" : "bg-red-500 animate-pulse"
                      )}>
                        {user.delayed === 0 ? <CheckCircle2 size={10} strokeWidth={3} /> : <AlertCircle size={10} strokeWidth={3} />}
                      </div>
                    </div>
                    <div>
                      <h5 className="text-base font-black text-slate-800 leading-tight group-hover:text-brand-primary transition-colors">{user.name}</h5>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-tighter mt-0.5">
                        {(() => {
                          const staffMember = staff.find(s => 
                            s.full_name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === 
                            user.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                          );
                          return staffMember?.job_title || (staffMember?.role === 'admin' ? 'Administrador' : 'Colaborador');
                        })()}
                      </p>
                      
                      <div className="flex items-center gap-2 mt-2">
                        {isOverloaded && (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded uppercase ring-1 ring-amber-200">
                            <TrendingUp size={8} /> Sobrecarregado
                          </span>
                        )}
                        {user.delayed > 0 && (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded uppercase ring-1 ring-red-200">
                            Atrasado
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="p-3 bg-slate-50/50 rounded-xl border border-slate-100 group-hover:bg-white transition-colors">
                      <span className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Status Ativo</span>
                      <div className="flex items-end gap-1.5">
                        <span className="text-xl font-black text-slate-700 leading-none">{user.total}</span>
                        <span className="text-xs font-bold text-slate-400 mb-0.5 uppercase tracking-tighter">Tasks</span>
                      </div>
                    </div>
                    <div className="p-3 bg-brand-accent/5 rounded-xl border border-brand-accent/10 group-hover:bg-white transition-colors">
                      <span className="text-[9px] font-bold text-brand-primary/60 uppercase block mb-1">Completas</span>
                      <div className="flex items-end gap-1.5">
                        <span className="text-xl font-black text-brand-primary leading-none">{user.done}</span>
                        <span className="text-xs font-bold text-brand-primary/40 mb-0.5 uppercase tracking-tighter">Fiel</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Saúde da Entrega</span>
                        <span className="text-xs font-bold text-slate-600">{user.progress}%</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden flex gap-0.5 shadow-inner">
                        <div className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]" style={{ width: `${user.progress}%` }}></div>
                        <div className="h-full bg-slate-200" style={{ width: `${100 - user.progress}%` }}></div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Em Dia</span>
                          <span className="text-sm font-bold text-emerald-600">{user.total - user.delayed}</span>
                        </div>
                        <div className="w-px h-6 bg-slate-100"></div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Atraso</span>
                          <span className={cn("text-sm font-bold", user.delayed > 0 ? "text-red-500" : "text-slate-400")}>{user.delayed}</span>
                        </div>
                      </div>
                      
                      <motion.button 
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setSelectedUser(user)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-brand-primary text-white text-xs font-bold rounded-lg shadow-elegant transition-all opacity-0 group-hover:opacity-100 uppercase tracking-wider"
                      >
                         Gerenciar <ArrowRight size={12} />
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Quick Access Grid */}
        <div className="pt-4">
          <div className="flex items-center justify-between mb-6">
             <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">Explorar Macroáreas</h4>
                <p className="text-xs text-slate-400 font-medium">Navegação rápida por departamentos</p>
             </div>
             <button 
               onClick={() => openMacroModal()}
               className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white text-xs font-bold rounded-lg shadow-elegant hover:scale-105 transition-all uppercase tracking-wider"
             >
                <Plus size={14} /> Nova Área
             </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-6 w-full">
            {data.map(area => {
              const Icon = getIconForMacroArea(area.name);
              const totalProjects = area.projects.length;
              const totalSprints = area.projects.reduce((acc, p) => acc + p.sprints.length, 0);

              return (
                <motion.div 
                  key={area.id} 
                  onClick={() => onNavigateToMacroArea(area.id)}
                  whileHover={{ 
                    y: -10, 
                    scale: 1.03, 
                    rotateY: 2, 
                    rotateX: -2,
                    boxShadow: "0 25px 50px -12px rgba(13, 148, 136, 0.15)"
                  }}
                  whileTap={{ scale: 0.97 }}
                  className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:border-brand-accent transition-all cursor-pointer group flex flex-col relative overflow-hidden preserve-3d"
                >
                  <div className="absolute -right-4 -bottom-4 opacity-[0.03] scale-150 rotate-12 transition-transform group-hover:rotate-0 duration-700">
                    <Icon size={120} />
                  </div>
                  <div className="flex items-start justify-between mb-5">
                    <div className="w-12 h-12 bg-brand-primary/5 rounded-xl flex items-center justify-center group-hover:bg-brand-primary group-hover:text-white transition-all duration-300 text-brand-primary shadow-inner">
                      <Icon size={24} />
                    </div>
                    {area.po_id && staff.find(s => s.id === area.po_id) ? (
                      <div className="flex items-center gap-2 bg-slate-50 rounded-lg pl-1.5 pr-2.5 py-1 border border-slate-100 group-hover:bg-brand-primary/10 transition-colors">
                        <img 
                          src={staff.find(s => s.id === area.po_id)?.avatar_url} 
                          alt="" 
                          className="w-5 h-5 rounded-md object-cover border border-slate-200"
                        />
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-brand-primary transition-colors">
                          PO: {staff.find(s => s.id === area.po_id)?.full_name}
                        </span>
                      </div>
                    ) : (
                      <span className="inline-flex items-center rounded-lg bg-slate-50 px-3 py-1 text-[9px] font-bold text-slate-500 uppercase tracking-wider border border-slate-100">
                        PO: Sem PO
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-black text-slate-800 mb-5 group-hover:text-brand-primary transition-colors">{area.name}</h3>
                  <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                    <button 
                      onClick={(e) => { e.stopPropagation(); openMacroModal(area, e); }}
                      className="p-1.5 bg-white shadow-subtle rounded-lg text-slate-400 hover:text-brand-accent hover:scale-110 transition-all border border-slate-100"
                      title="Editar"
                    >
                      <Edit size={12} />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDeleteMacroArea(area.id, e); }}
                      className="p-1.5 bg-white shadow-subtle rounded-lg text-slate-400 hover:text-red-500 hover:scale-110 transition-all border border-slate-100"
                      title="Excluir"
                    >
                      <Trash size={12} />
                    </button>
                  </div>
                  <div className="flex gap-8 mt-auto pt-5 border-t border-slate-50">
                    <div className="flex flex-col gap-0.5">
                      <div className="text-xl font-black text-slate-800 leading-none">{totalProjects}</div>
                      <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Projetos</div>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <div className="text-xl font-black text-slate-800 leading-none">{totalSprints}</div>
                      <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Sprints</div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>


      {/* User Details Modal */}
      <Modal 
        isOpen={!!selectedUser} 
        onClose={() => setSelectedUser(null)} 
        title={`Atividades: ${selectedUser?.full_name}`}
      >
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <span className="text-[9px] font-bold text-slate-400 uppercase block">Total</span>
              <span className="text-xl font-black text-slate-700">{selectedUser?.total}</span>
            </div>
            <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100">
              <span className="text-[9px] font-bold text-emerald-400 uppercase block">Concluídas</span>
              <span className="text-xl font-black text-emerald-700">{selectedUser?.done}</span>
            </div>
            <div className="p-3 bg-brand-accent/5 rounded-lg border border-brand-accent/10">
              <span className="text-[9px] font-bold text-brand-primary/60 uppercase block">Progresso</span>
              <span className="text-xl font-black text-brand-primary">{Math.max(0, (selectedUser?.total || 0) - (selectedUser?.done || 0) - (selectedUser?.todo || 0))}</span>
            </div>
            <div className="p-3 bg-red-50 rounded-lg border border-red-100">
              <span className="text-[9px] font-bold text-red-400 uppercase block">Atrasos</span>
              <span className="text-xl font-black text-red-700">{selectedUser?.delayed}</span>
            </div>
          </div>

          <div className="max-h-[60vh] overflow-y-auto scrollbar-hide space-y-3 pr-1">
            {selectedUser?.tasks.map((task: any, i: number) => {
              const delayStatus = calculateDueDateStatus(task.due_date);
              const isDelayed = task.status !== 'done' && delayStatus?.label === 'ATRASADO';

              return (
                <div key={i} className={cn(
                  "p-4 rounded-xl border transition-all",
                  isDelayed ? "bg-red-50 border-red-100 shadow-sm" : "bg-white border-slate-100"
                )}>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex flex-col">
                      <span className="text-[9px] font-bold text-brand-primary/60 uppercase tracking-wider leading-none mb-1">
                        {task.macroArea}
                      </span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase leading-none">
                        {task.project}
                      </span>
                    </div>
                    <span className={cn(
                      "text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-tighter",
                      task.status === 'done' ? "bg-emerald-100 text-emerald-600" : 
                      task.status === 'in-progress' ? "bg-blue-100 text-blue-600" : 
                      task.status === 'review' ? "bg-amber-100 text-amber-600" : "bg-slate-100 text-slate-600"
                    )}>
                      {task.status === 'done' ? 'Concluída' : 
                       task.status === 'in-progress' ? 'Em Progresso' : 
                       task.status === 'review' ? 'Em Revisão' : 'A Fazer'}
                    </span>
                  </div>
                  <h5 className="text-sm font-bold text-slate-800 mb-2 leading-tight">{task.title}</h5>
                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-50 mt-2">
                    <span className="font-bold text-slate-400">{task.sprint}</span>
                    <div className="flex items-center gap-1.5 font-black">
                      <Calendar size={12} className={isDelayed ? "text-red-400" : "text-slate-300"} />
                      <span className={isDelayed ? "text-red-500" : "text-slate-500"}>
                        {task.due_date ? formatDate(task.due_date) : 'Sem data'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Modal>

      {/* Intervention Modal */}
      <Modal 
        isOpen={isInterventionModalOpen} 
        onClose={() => setIsInterventionModalOpen(false)} 
        title="Painel de Intervenção Estratégica"
      >
        <div className="space-y-6">
          <div className="p-4 bg-red-50 rounded-2xl border border-red-100 mb-6">
            <div className="flex items-center gap-3 mb-2">
              <AlertCircle size={20} className="text-red-500" />
              <h5 className="text-sm font-bold text-red-700 uppercase">Relatório de Impacto Ativo</h5>
            </div>
            <p className="text-xs text-red-600 font-medium leading-relaxed">
              Existem <strong>{stats.delayedTasksCount} tarefas críticas</strong> fora do prazo original. 
              Isso representa um risco de <strong>{Math.round((stats.delayedTasksCount / (stats.totalTasks || 1)) * 100)}%</strong> no roadmap atual.
            </p>
          </div>

          <div className="space-y-4">
            <h6 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ações Recomendadas</h6>
            
            <div className="grid grid-cols-1 gap-3">
              <button 
                onClick={() => setIsReprioritizeModalOpen(true)}
                className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl hover:border-brand-primary hover:shadow-elegant transition-all group text-left w-full"
              >
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-800">Solicitar Repriorização Global</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase">Mover prazos de tarefas não críticas</span>
                </div>
                <ChevronRight size={16} className="text-slate-300 group-hover:text-brand-primary group-hover:translate-x-1 transition-all" />
              </button>

              <button 
                onClick={() => setIsMeetingModalOpen(true)}
                className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl hover:border-brand-primary hover:shadow-elegant transition-all group text-left w-full"
              >
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-800">Convocar Reunião de Desbloqueio</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase">Notificar todos os responsáveis via Slack/E-mail</span>
                </div>
                <ChevronRight size={16} className="text-slate-300 group-hover:text-brand-primary group-hover:translate-x-1 transition-all" />
              </button>

              <button 
                onClick={() => setIsStaffModalOpen(true)}
                className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl hover:border-brand-primary hover:shadow-elegant transition-all group text-left w-full"
              >
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-800">Alocar Reforço de Staff</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase">Redistribuir tarefas de funcionários sobrecarregados</span>
                </div>
                <ChevronRight size={16} className="text-slate-300 group-hover:text-brand-primary group-hover:translate-x-1 transition-all" />
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
             <button 
               onClick={() => setIsInterventionModalOpen(false)}
               className="w-full py-3 bg-brand-primary text-white text-xs font-bold rounded-xl shadow-elegant hover:scale-[1.02] active:scale-[0.98] transition-all uppercase tracking-wider"
             >
               Confirmar Plano de Ação
             </button>
          </div>
        </div>
      </Modal>

      {/* Modal 1: Repriorização */}
      <Modal 
        isOpen={isReprioritizeModalOpen} 
        onClose={() => setIsReprioritizeModalOpen(false)} 
        title="Repriorização Global de Atrasos"
      >
        <div className="space-y-4">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Ajustar Datas das Tarefas Críticas</p>
          <div className="max-h-[400px] overflow-auto space-y-3 pr-2">
            {stats.criticalTasks.map((task: any) => (
              <div key={task.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h6 className="text-[11px] font-bold text-slate-800 truncate uppercase">{task.title}</h6>
                  <p className="text-[9px] text-slate-400 font-bold uppercase">{task.macroArea} • {task.project}</p>
                </div>
                <input 
                  type="date" 
                  defaultValue={task.due_date?.split('T')[0]} 
                  onChange={(e) => updateTaskInGlobalData(task.id, { due_date: e.target.value })}
                  className="text-xs font-bold bg-white border border-slate-200 rounded-lg px-2 py-1 focus:ring-2 focus:ring-brand-primary outline-none"
                />
              </div>
            ))}
          </div>
          <button 
            onClick={() => setIsReprioritizeModalOpen(false)}
            className="w-full py-3 bg-brand-primary text-white text-xs font-bold rounded-xl uppercase tracking-wider mt-4"
          >
            Salvar Novas Datas
          </button>
        </div>
      </Modal>

      {/* Modal 2: Reunião de Desbloqueio */}
      <Modal 
        isOpen={isMeetingModalOpen} 
        onClose={() => setIsMeetingModalOpen(false)} 
        title="Agendar Reunião de Desbloqueio"
      >
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Data</label>
              <input 
                type="date" 
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
                className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-brand-primary shadow-inner"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Horário</label>
              <input 
                type="time" 
                value={meetingTime}
                onChange={(e) => setMeetingTime(e.target.value)}
                className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-brand-primary shadow-inner"
              />
            </div>
          </div>
          <div className="p-4 bg-brand-accent/5 rounded-2xl border border-brand-accent/10">
             <p className="text-xs font-bold text-brand-primary leading-relaxed text-center">
               Esta ação enviará uma notificação no Slack para todos os {stats.userStats.length} envolvidos nas tarefas críticas.
             </p>
          </div>
          <button 
            type="button"
            onClick={() => {
              toast.success(`Reunião agendada para ${meetingDate} às ${meetingTime}. Notificações enviadas!`);
              setIsMeetingModalOpen(false);
            }}
            className="w-full py-4 bg-brand-primary text-white text-xs font-bold rounded-xl uppercase tracking-wider shadow-elegant hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            Convocar Time
          </button>
        </div>
      </Modal>

      {/* Modal 3: Reforço de Staff */}
      <Modal 
        isOpen={isStaffModalOpen} 
        onClose={() => setIsStaffModalOpen(false)} 
        title="Redistribuir Carga de Trabalho"
      >
        <div className="space-y-4">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Realocar Tarefas Críticas</p>
          <div className="max-h-[450px] overflow-auto space-y-4 pr-2">
            {stats.criticalTasks.map((task: any) => (
              <div key={task.id} className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-3">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <h6 className="text-[11px] font-bold text-slate-800 truncate uppercase">{task.title}</h6>
                    <p className="text-[9px] text-slate-400 font-bold uppercase">{task.project}</p>
                  </div>
                  <span className="text-[10px] font-bold bg-red-50 text-red-600 px-1.5 py-0.5 rounded uppercase">Atrasado</span>
                </div>
                
                <div className="space-y-2">
                   <p className="text-[10px] font-bold text-slate-400 uppercase">Consultores Atuais: <span className="text-slate-800">{task.assignees.join(', ')}</span></p>
                   <select 
                     multiple
                     className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold h-24 outline-none focus:ring-2 focus:ring-brand-primary"
                     value={task.assignees}
                     onChange={(e) => {
                        const target = e.target as HTMLSelectElement;
                        const selected = Array.from(target.selectedOptions, option => option.value);
                        if (selected.length > 0) {
                          updateTaskInGlobalData(task.id, { assignees: selected });
                        }
                     }}
                   >
                     {stats.userStats.map((u: any) => (
                       <option key={u.name} value={u.name}>
                         {u.name} ({u.total} tasks)
                       </option>
                     ))}
                   </select>
                   <p className="text-[10px] text-slate-300 font-bold italic">* Use CTRL para selecionar múltiplos</p>
                </div>
              </div>
            ))}
          </div>
          <button 
            onClick={() => setIsStaffModalOpen(false)}
            className="w-full py-3 bg-brand-primary text-white text-xs font-bold rounded-xl uppercase tracking-wider mt-4"
          >
            Salvar Alocações
          </button>
        </div>
      </Modal>

      {/* Modal: Área Estratégica */}
      <Modal 
        isOpen={isMacroModalOpen} 
        onClose={() => setIsMacroModalOpen(false)} 
        title={editingMacroArea ? "Editar Área Estratégica" : "Nova Área Estratégica"}
      >
        <form onSubmit={handleSaveMacroArea} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Cargo / Título da Área</label>
            <input 
              type="text" 
              value={newMacroTitle}
              onChange={(e) => setNewMacroTitle(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/50 transition-all font-bold text-slate-800"
              placeholder="Ex: Diretor de Operações"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Responsável (Product Owner)</label>
            <select 
              value={newMacroPOId}
              onChange={(e) => setNewMacroPOId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/50 transition-all font-bold text-slate-800"
              required
            >
              <option value="">Selecione um membro do staff</option>
              {staff.map(s => <option key={s.id} value={s.id}>{s.full_name} ({s.role})</option>)}
            </select>
          </div>
          <button 
            type="submit"
            className="w-full py-4 bg-brand-primary text-white text-xs font-bold rounded-xl uppercase tracking-wider shadow-elegant hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            {editingMacroArea ? "Salvar Alterações" : "Criar Área"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
