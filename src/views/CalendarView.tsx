import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Clock, 
  MapPin, 
  RefreshCw, 
  Trash2, 
  Edit3, 
  CalendarDays, 
  CalendarRange,
  ListFilter,
  CheckCircle2,
  ExternalLink,
  Info,
  X
} from 'lucide-react';
import { CalendarEvent } from '../types';
import { supabase } from '../lib/supabase';
import { Modal } from '../components/shared/Modal';
import { toast } from 'sonner';
import { useConfirm } from '../hooks/useConfirm';
import { cn } from '../lib/utils';

// Helper seguro para formatar datas no fuso horário LOCAL (YYYY-MM-DD)
const formatLocalDate = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper para calcular horário sugerido 1h após o início (HH:mm)
const calculateOneHourLater = (timeStr: string): string => {
  if (!timeStr) return '';
  const parts = timeStr.split(':');
  if (parts.length < 2) return '';
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return '';
  const nextH = (h + 1) % 24;
  return `${String(nextH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

export function CalendarView() {
  const { confirm } = useConfirm();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  // Visão Semanal como padrão inicial solicitado pelo usuário!
  const [viewMode, setViewMode] = useState<'week' | 'month' | 'agenda'>('week');

  // Modal states
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isDayEventsModalOpen, setIsDayEventsModalOpen] = useState(false);
  const [selectedDayDate, setSelectedDayDate] = useState<string>('');
  const [selectedDayEvents, setSelectedDayEvents] = useState<CalendarEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  // Form states
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formStartTime, setFormStartTime] = useState('09:00');
  const [formEndDate, setFormEndDate] = useState('');
  const [formEndTime, setFormEndTime] = useState('10:00');
  const [formAllDay, setFormAllDay] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Carregar eventos do Supabase
  const fetchEvents = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .order('start_time', { ascending: true });

      if (error) throw error;
      setEvents((data as CalendarEvent[]) || []);
    } catch (err: any) {
      toast.error('Erro ao carregar eventos: ' + (err.message || 'Tente novamente.'));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchEvents();

    // Supabase Realtime
    const channel = supabase
      .channel('calendar_events_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'calendar_events' },
        () => {
          fetchEvents(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchEvents(false);
    toast.success('Agenda atualizada!');
  };

  // Navegação de Período (Semana ou Mês)
  const handlePrev = () => {
    if (viewMode === 'week') {
      const d = new Date(currentDate);
      d.setDate(d.getDate() - 7);
      setCurrentDate(d);
    } else {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    }
  };

  const handleNext = () => {
    if (viewMode === 'week') {
      const d = new Date(currentDate);
      d.setDate(d.getDate() + 7);
      setCurrentDate(d);
    } else {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Dias da Semana Selecionada (7 dias: Domingo a Sábado)
  const weekDays = useMemo(() => {
    const curr = new Date(currentDate);
    const dayOfWeek = curr.getDay(); // 0 = Dom, 1 = Seg...
    const sunday = new Date(curr);
    sunday.setDate(curr.getDate() - dayOfWeek);

    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(sunday);
      d.setDate(sunday.getDate() + i);
      days.push({
        date: d,
        dayNumber: d.getDate(),
        dateString: formatLocalDate(d),
        dayName: ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'][i],
        dayNameFull: ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][i]
      });
    }
    return days;
  }, [currentDate]);

  // Título da Semana Formatado (ex: "11 a 17 de Outubro de 2026")
  const formattedWeekTitle = useMemo(() => {
    if (weekDays.length === 0) return '';
    const first = weekDays[0].date;
    const last = weekDays[6].date;

    if (first.getMonth() === last.getMonth()) {
      const month = first.toLocaleDateString('pt-BR', { month: 'long' });
      return `${first.getDate()} a ${last.getDate()} de ${month.charAt(0).toUpperCase() + month.slice(1)} de ${first.getFullYear()}`;
    } else {
      const m1 = first.toLocaleDateString('pt-BR', { month: 'short' });
      const m2 = last.toLocaleDateString('pt-BR', { month: 'short' });
      return `${first.getDate()} ${m1} - ${last.getDate()} ${m2} de ${last.getFullYear()}`;
    }
  }, [weekDays]);

  // Formatação do Mês / Ano no cabeçalho
  const monthName = currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const formattedMonthTitle = monthName.charAt(0).toUpperCase() + monthName.slice(1);

  // Estrutura da grade do mês (6 semanas = 42 células)
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days = [];

    // Dias do mês anterior
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const date = new Date(year, month - 1, d);
      days.push({
        date,
        dayNumber: d,
        isCurrentMonth: false,
        dateString: formatLocalDate(date),
      });
    }

    // Dias do mês atual
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      days.push({
        date,
        dayNumber: d,
        isCurrentMonth: true,
        dateString: formatLocalDate(date),
      });
    }

    // Dias do próximo mês
    const remainingDays = 42 - days.length;
    for (let d = 1; d <= remainingDays; d++) {
      const date = new Date(year, month + 1, d);
      days.push({
        date,
        dayNumber: d,
        isCurrentMonth: false,
        dateString: formatLocalDate(date),
      });
    }

    return days;
  }, [currentDate]);

  // Agrupamento de eventos por data (YYYY-MM-DD local)
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();

    events.forEach(ev => {
      if (!ev.start_time) return;
      const d = new Date(ev.start_time);
      const dateKey = formatLocalDate(d);
      
      const existing = map.get(dateKey) || [];
      existing.push(ev);
      map.set(dateKey, existing);
    });

    return map;
  }, [events]);

  // Agenda ordenada para modo Lista
  const agendaEvents = useMemo(() => {
    return [...events].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  }, [events]);

  // Abrir modal de criação
  const openCreateModal = (defaultDate?: string) => {
    setEditingEventId(null);
    setFormTitle('');
    setFormDescription('');
    setFormLocation('');
    const todayStr = defaultDate || formatLocalDate(new Date());
    setFormStartDate(todayStr);
    setFormEndDate(todayStr);
    setFormStartTime('09:00');
    setFormEndTime('10:00');
    setFormAllDay(false);
    setIsEventModalOpen(true);
  };

  // Abrir modal de edição
  const openEditModal = (ev: CalendarEvent) => {
    setEditingEventId(ev.id);
    setFormTitle(ev.title);
    setFormDescription(ev.description || '');
    setFormLocation(ev.location || '');
    
    const start = new Date(ev.start_time);
    const end = new Date(ev.end_time);
    
    setFormStartDate(formatLocalDate(start));
    setFormEndDate(formatLocalDate(end));
    setFormStartTime(start.toTimeString().substring(0, 5));
    setFormEndTime(end.toTimeString().substring(0, 5));
    setFormAllDay(ev.all_day);
    
    setIsDetailModalOpen(false);
    setIsDayEventsModalOpen(false);
    setIsEventModalOpen(true);
  };

  // Abrir modal com todos os eventos do dia
  const openDayEventsModal = (dateStr: string, dayEvents: CalendarEvent[]) => {
    setSelectedDayDate(dateStr);
    setSelectedDayEvents(dayEvents);
    setIsDayEventsModalOpen(true);
  };

  // Sugestão automática de término 1h após o início ao alterar horário de início
  const handleStartTimeChange = (newStartTime: string) => {
    setFormStartTime(newStartTime);
    if (!newStartTime) return;

    const suggestedEnd = calculateOneHourLater(newStartTime);
    if (suggestedEnd) {
      setFormEndTime(suggestedEnd);

      // Se virar o dia (ex: 23:xx -> 00:xx) e as datas eram iguais
      const startHour = parseInt(newStartTime.split(':')[0], 10);
      if (startHour === 23 && formStartDate && (!formEndDate || formEndDate === formStartDate)) {
        const [year, month, day] = formStartDate.split('-').map(Number);
        const nextDate = new Date(year, month - 1, day + 1);
        setFormEndDate(formatLocalDate(nextDate));
      } else if (startHour !== 23 && formStartDate && formEndDate !== formStartDate) {
        setFormEndDate(formStartDate);
      }
    }
  };

  // Sincronizar data de término caso estivesse acompanhando a data de início
  const handleStartDateChange = (newStartDate: string) => {
    if (!formEndDate || formEndDate === formStartDate) {
      const startHour = parseInt(formStartTime.split(':')[0], 10);
      if (startHour === 23) {
        const [year, month, day] = newStartDate.split('-').map(Number);
        const nextDate = new Date(year, month - 1, day + 1);
        setFormEndDate(formatLocalDate(nextDate));
      } else {
        setFormEndDate(newStartDate);
      }
    }
    setFormStartDate(newStartDate);
  };

  // Salvar evento (Criar ou Atualizar)
  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      toast.error('Informe o título do evento.');
      return;
    }

    if (!formAllDay) {
      const startTimestamp = new Date(`${formStartDate}T${formStartTime}:00`).getTime();
      const endTimestamp = new Date(`${formEndDate || formStartDate}T${formEndTime}:00`).getTime();
      if (endTimestamp <= startTimestamp) {
        toast.error('O horário de término deve ser posterior ao horário de início.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      let startIso: string;
      let endIso: string;

      if (formAllDay) {
        startIso = new Date(`${formStartDate}T00:00:00`).toISOString();
        endIso = new Date(`${formEndDate || formStartDate}T23:59:59`).toISOString();
      } else {
        startIso = new Date(`${formStartDate}T${formStartTime}:00`).toISOString();
        endIso = new Date(`${formEndDate || formStartDate}T${formEndTime}:00`).toISOString();
      }

      if (editingEventId) {
        const { error } = await supabase
          .from('calendar_events')
          .update({
            title: formTitle.trim(),
            description: formDescription.trim() || null,
            location: formLocation.trim() || null,
            start_time: startIso,
            end_time: endIso,
            all_day: formAllDay,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingEventId);

        if (error) throw error;
        toast.success('Evento atualizado e sincronizado com o Apple Calendar!');
      } else {
        const newId = crypto.randomUUID();
        const { error } = await supabase
          .from('calendar_events')
          .insert({
            id: newId,
            title: formTitle.trim(),
            description: formDescription.trim() || null,
            location: formLocation.trim() || null,
            start_time: startIso,
            end_time: endIso,
            all_day: formAllDay,
            calendar_name: 'Mourão Consultoria Econômica',
            status: 'CONFIRMED',
            source: 'system'
          });

        if (error) throw error;
        toast.success('Compromisso criado e enviado para o Apple Calendar!');
      }

      setIsEventModalOpen(false);
      fetchEvents(false);
    } catch (err: any) {
      toast.error('Erro ao salvar evento: ' + (err.message || 'Verifique os dados.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Excluir evento
  const handleDeleteEvent = async (id: string) => {
    const confirmed = await confirm({
      title: 'Excluir Compromisso',
      message: 'Deseja realmente remover este evento da agenda? Ele também será apagado do Apple Calendar.'
    });

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('calendar_events')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Evento removido da agenda e do Apple Calendar.');
      setIsDetailModalOpen(false);
      setIsDayEventsModalOpen(false);
      fetchEvents(false);
    } catch (err: any) {
      toast.error('Erro ao excluir: ' + (err.message || 'Tente novamente.'));
    }
  };

  const todayString = formatLocalDate(new Date());

  return (
    <div className="flex flex-col h-full w-full bg-white overflow-hidden font-sans">
      {/* HEADER UNIFICADO (Sem duplicidade, aproveitamento total de tela) */}
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shrink-0 shadow-2xs z-20">
        {/* Lado Esquerdo: Identidade do Calendário */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary shrink-0">
            <CalendarIcon size={19} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-800 tracking-tight leading-none">Agenda Corporativa</h1>
              <span className="text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-full flex items-center gap-1 leading-none">
                🍏 iCloud CalDAV
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium mt-1 leading-none">
              Mourão Consultoria Econômica
            </p>
          </div>
        </div>

        {/* Centro: Navegador de Período Integrado */}
        {viewMode !== 'agenda' && (
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-xl shadow-2xs">
            <button
              onClick={handlePrev}
              className="p-1 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors cursor-pointer"
              title={viewMode === 'week' ? "Semana anterior" : "Mês anterior"}
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-bold text-slate-800 min-w-[180px] text-center tracking-tight capitalize select-none">
              {viewMode === 'week' ? formattedWeekTitle : formattedMonthTitle}
            </span>
            <button
              onClick={handleNext}
              className="p-1 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors cursor-pointer"
              title={viewMode === 'week' ? "Próxima semana" : "Próximo mês"}
            >
              <ChevronRight size={16} />
            </button>
            <div className="h-4 w-px bg-slate-200 mx-1" />
            <button
              onClick={handleToday}
              className="px-2 py-0.5 text-[11px] font-bold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
            >
              Hoje
            </button>
          </div>
        )}

        {/* Lado Direito: Controles e Ações */}
        <div className="flex items-center gap-2.5">
          {/* Switcher Semana / Mês / Agenda */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center border border-slate-200">
            <button
              onClick={() => setViewMode('week')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                viewMode === 'week' ? "bg-white text-slate-800 shadow-xs" : "text-slate-500 hover:text-slate-800"
              )}
            >
              <CalendarRange size={13} />
              <span>Semana</span>
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                viewMode === 'month' ? "bg-white text-slate-800 shadow-xs" : "text-slate-500 hover:text-slate-800"
              )}
            >
              <CalendarDays size={13} />
              <span>Mês</span>
            </button>
            <button
              onClick={() => setViewMode('agenda')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                viewMode === 'agenda' ? "bg-white text-slate-800 shadow-xs" : "text-slate-500 hover:text-slate-800"
              )}
            >
              <ListFilter size={13} />
              <span>Agenda</span>
            </button>
          </div>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-600 transition-all shadow-xs cursor-pointer disabled:opacity-50"
            title="Sincronizar com Apple Calendar"
          >
            <RefreshCw size={15} className={isRefreshing ? "animate-spin text-brand-primary" : ""} />
          </button>

          <button
            onClick={() => openCreateModal()}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-brand-primary hover:bg-brand-primary/90 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
          >
            <Plus size={15} />
            <span>Novo Compromisso</span>
          </button>
        </div>
      </header>

      {/* ÁREA PRINCIPAL EXPANDIDA */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {viewMode === 'week' ? (
          /* ============================================== */
          /* MODO SEMANAL (VISÃO INICIAL EXECUTIVA)          */
          /* ============================================== */
          <div className="flex-1 flex flex-col min-h-0 bg-white">
            {/* Grade de 7 Colunas para a Semana Atual */}
            <div className="flex-1 grid grid-cols-7 gap-px bg-slate-200 min-h-0 overflow-hidden">
              {weekDays.map((dayObj) => {
                const dayEvents = eventsByDate.get(dayObj.dateString) || [];
                const isToday = dayObj.dateString === todayString;

                return (
                  <div
                    key={dayObj.dateString}
                    className={cn(
                      "flex flex-col min-h-0 bg-white overflow-hidden transition-colors",
                      isToday && "bg-brand-primary/[0.02]"
                    )}
                  >
                    {/* Cabeçalho do Dia na Semana */}
                    <div className={cn(
                      "px-3 py-2.5 border-b border-slate-100 flex items-center justify-between shrink-0",
                      isToday ? "bg-brand-primary/10" : "bg-slate-50/80"
                    )}>
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block leading-tight">
                          {dayObj.dayName}
                        </span>
                        <span className={cn(
                          "text-base font-extrabold leading-tight",
                          isToday ? "text-brand-primary" : "text-slate-800"
                        )}>
                          {dayObj.dayNumber}
                        </span>
                      </div>

                      {/* Contador ou Botão Rápido de Adicionar */}
                      <div className="flex items-center gap-1.5">
                        {dayEvents.length > 0 && (
                          <span className={cn(
                            "text-[10px] font-bold px-1.5 py-0.5 rounded-full border",
                            isToday ? "bg-brand-primary text-white border-brand-primary" : "bg-slate-100 text-slate-500 border-slate-200"
                          )}>
                            {dayEvents.length}
                          </span>
                        )}
                        <button
                          onClick={() => openCreateModal(dayObj.dateString)}
                          className="w-5 h-5 rounded-md hover:bg-slate-200/80 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
                          title={`Adicionar compromisso em ${dayObj.dayNumber}`}
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Lista Vertical de Compromissos do Dia (Com rolagem independente se houver muitas reuniões) */}
                    <div className="flex-1 p-2 overflow-y-auto space-y-2">
                      {dayEvents.length === 0 ? (
                        <div
                          onClick={() => openCreateModal(dayObj.dateString)}
                          className="h-full min-h-[120px] rounded-xl border border-dashed border-slate-200 hover:border-brand-primary/40 hover:bg-brand-primary/[0.02] flex flex-col items-center justify-center text-slate-400 text-xs font-medium cursor-pointer transition-all p-3 text-center group"
                        >
                          <Plus size={16} className="text-slate-300 group-hover:text-brand-primary group-hover:scale-110 transition-all mb-1" />
                          <span className="text-[11px] text-slate-400 group-hover:text-slate-600">Disponível</span>
                        </div>
                      ) : (
                        dayEvents.map((ev) => {
                          const startTimeFormatted = ev.all_day
                            ? 'Dia todo'
                            : new Date(ev.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

                          const endTimeFormatted = !ev.all_day && ev.end_time
                            ? new Date(ev.end_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                            : null;

                          return (
                            <motion.div
                              key={ev.id}
                              whileHover={{ y: -1 }}
                              onClick={() => {
                                setSelectedEvent(ev);
                                setIsDetailModalOpen(true);
                              }}
                              className={cn(
                                "p-2.5 rounded-xl border text-xs shadow-2xs hover:shadow-xs transition-all cursor-pointer flex flex-col gap-1.5",
                                ev.source === 'apple'
                                  ? "bg-slate-50/90 hover:bg-slate-100 border-slate-200 border-l-4 border-l-brand-primary text-slate-800"
                                  : "bg-emerald-50/90 hover:bg-emerald-100 border-emerald-200 border-l-4 border-l-emerald-500 text-emerald-950"
                              )}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                                  <Clock size={11} className="text-slate-400" />
                                  {startTimeFormatted} {endTimeFormatted && `• ${endTimeFormatted}`}
                                </span>
                                <span className={cn(
                                  "text-[8px] font-bold px-1.5 py-0.2 rounded uppercase tracking-wider",
                                  ev.source === 'apple' ? "bg-white text-slate-500 border border-slate-200" : "bg-emerald-200 text-emerald-800"
                                )}>
                                  {ev.source === 'apple' ? 'iCloud' : 'Sistema'}
                                </span>
                              </div>

                              <h4 className="font-bold text-slate-800 text-xs leading-snug line-clamp-2">
                                {ev.title}
                              </h4>

                              {ev.location && (
                                <p className="text-[10px] text-slate-500 flex items-center gap-1 font-medium truncate">
                                  <MapPin size={10} className="text-slate-400 shrink-0" />
                                  <span className="truncate">{ev.location}</span>
                                </p>
                              )}
                            </motion.div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : viewMode === 'month' ? (
          /* ============================================== */
          /* MODO MENSAL (GRADE COM BOTÃO NO TOPO DO DIA)    */
          /* ============================================== */
          <div className="flex-1 flex flex-col min-h-0 bg-white">
            {/* Linha dos Dias da Semana */}
            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/90 text-center py-2 shrink-0">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => (
                <div key={day} className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  {day}
                </div>
              ))}
            </div>

            {/* Grade dos Dias (6 Linhas x 7 Colunas) */}
            <div className="flex-1 grid grid-cols-7 grid-rows-6 gap-px bg-slate-200 min-h-0">
              {calendarDays.map((dayObj, index) => {
                const dayEvents = eventsByDate.get(dayObj.dateString) || [];
                const isToday = dayObj.dateString === todayString;

                return (
                  <div
                    key={index}
                    onClick={() => openCreateModal(dayObj.dateString)}
                    className={cn(
                      "relative p-1.5 md:p-2 flex flex-col min-h-0 overflow-hidden transition-colors cursor-pointer group",
                      dayObj.isCurrentMonth ? "bg-white hover:bg-slate-50/70" : "bg-slate-50/40 hover:bg-slate-100/40 text-slate-400",
                      isToday && "bg-brand-primary/[0.03]"
                    )}
                  >
                    {/* Topo da Célula: Dia à esquerda e indicador +X mais à direita */}
                    <div className="flex items-center justify-between mb-1 shrink-0 h-5">
                      {isToday ? (
                        <div className="w-5 h-5 rounded-full bg-brand-primary text-white font-bold text-[11px] flex items-center justify-center aspect-square shadow-xs shrink-0">
                          {dayObj.dayNumber}
                        </div>
                      ) : (
                        <span
                          className={cn(
                            "text-[11px] font-semibold px-0.5",
                            dayObj.isCurrentMonth ? "text-slate-700" : "text-slate-300"
                          )}
                        >
                          {dayObj.dayNumber}
                        </span>
                      )}

                      {/* Botão +X mais no cabeçalho da célula: 100% visível, nunca é cortado */}
                      {dayEvents.length > 2 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDayEventsModal(dayObj.dateString, dayEvents);
                          }}
                          className="text-[9px] font-bold text-brand-primary bg-brand-primary/10 hover:bg-brand-primary/20 px-1.5 py-0.5 rounded-md cursor-pointer transition-colors leading-none shrink-0"
                          title="Ver todos os eventos deste dia"
                        >
                          +{dayEvents.length - 2} mais
                        </button>
                      )}
                    </div>

                    {/* Lista de Compromissos Dentro da Célula */}
                    <div className="flex-1 flex flex-col gap-1 min-h-0 overflow-hidden">
                      {dayEvents.slice(0, 2).map((ev) => {
                        const startTimeFormatted = ev.all_day
                          ? 'Dia todo'
                          : new Date(ev.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

                        return (
                          <div
                            key={ev.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEvent(ev);
                              setIsDetailModalOpen(true);
                            }}
                            className={cn(
                              "h-[21px] px-1.5 rounded-md flex items-center gap-1.5 text-[10px] font-medium truncate shrink-0 cursor-pointer transition-colors border",
                              ev.source === 'apple'
                                ? "bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200/90 border-l-[3px] border-l-brand-primary"
                                : "bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border-emerald-200 border-l-[3px] border-l-emerald-500"
                            )}
                            title={`${startTimeFormatted} - ${ev.title}`}
                          >
                            <span className="text-[9px] text-slate-500 font-bold shrink-0">{startTimeFormatted}</span>
                            <span className="truncate font-semibold text-slate-700">{ev.title}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* ============================================== */
          /* MODO AGENDA / LISTA                            */
          /* ============================================== */
          <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
            <div className="max-w-4xl mx-auto w-full space-y-3">
              {isLoading ? (
                <div className="py-20 text-center text-slate-400 font-medium text-sm">Carregando compromissos...</div>
              ) : agendaEvents.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
                  <CalendarIcon size={40} className="mx-auto text-slate-300 mb-3" />
                  <h3 className="text-base font-bold text-slate-700">Nenhum compromisso agendado</h3>
                  <p className="text-xs text-slate-400 mt-1">Clique em "Novo Compromisso" para adicionar uma reunião.</p>
                </div>
              ) : (
                agendaEvents.map((ev) => {
                  const startDate = new Date(ev.start_time);
                  const endDate = new Date(ev.end_time);

                  const dateFormatted = startDate.toLocaleDateString('pt-BR', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  });

                  const timeFormatted = ev.all_day
                    ? 'Dia Inteiro'
                    : `${startDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} às ${endDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

                  return (
                    <div
                      key={ev.id}
                      className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs hover:shadow-xs transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="flex items-start gap-4 flex-1 min-w-0">
                        <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex flex-col items-center justify-center shrink-0 text-slate-700">
                          <span className="text-[10px] font-bold uppercase text-slate-400 leading-none">
                            {startDate.toLocaleDateString('pt-BR', { month: 'short' })}
                          </span>
                          <span className="text-base font-black leading-none mt-1">
                            {startDate.getDate()}
                          </span>
                        </div>

                        <div className="space-y-0.5 min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-brand-primary uppercase tracking-wider flex items-center gap-1">
                              <Clock size={12} />
                              {timeFormatted}
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="text-xs text-slate-400 font-medium capitalize">
                              {dateFormatted}
                            </span>
                          </div>

                          <h3 className="text-sm font-bold text-slate-800 leading-snug truncate">
                            {ev.title}
                          </h3>

                          {ev.location && (
                            <p className="text-xs text-slate-500 flex items-center gap-1 font-medium truncate">
                              <MapPin size={12} className="text-slate-400 shrink-0" />
                              <span>{ev.location}</span>
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                        <span className={cn(
                          "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                          ev.source === 'apple' ? "bg-slate-50 border-slate-200 text-slate-600" : "bg-emerald-50 border-emerald-200 text-emerald-700"
                        )}>
                          {ev.source === 'apple' ? 'iCloud' : 'Sistema'}
                        </span>

                        <button
                          onClick={() => openEditModal(ev)}
                          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors cursor-pointer"
                          title="Editar evento"
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          onClick={() => handleDeleteEvent(ev.id)}
                          className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                          title="Excluir evento"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* MODAL: Todos os Eventos do Dia (+X mais) */}
      <Modal
        isOpen={isDayEventsModalOpen}
        onClose={() => setIsDayEventsModalOpen(false)}
        title={selectedDayDate ? `Compromissos de ${new Date(`${selectedDayDate}T12:00:00`).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}` : 'Compromissos do Dia'}
        maxWidth="max-w-lg"
      >
        <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
          {selectedDayEvents.map((ev) => {
            const startTimeFormatted = ev.all_day
              ? 'Dia todo'
              : new Date(ev.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

            return (
              <div
                key={ev.id}
                onClick={() => {
                  setSelectedEvent(ev);
                  setIsDetailModalOpen(true);
                  setIsDayEventsModalOpen(false);
                }}
                className="p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-all cursor-pointer flex items-center justify-between gap-3 shadow-2xs"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-bold text-brand-primary uppercase">
                      {startTimeFormatted}
                    </span>
                    {ev.location && (
                      <span className="text-[10px] text-slate-400 truncate flex items-center gap-0.5">
                        <MapPin size={10} />
                        {ev.location}
                      </span>
                    )}
                  </div>
                  <h4 className="text-sm font-bold text-slate-800 truncate">{ev.title}</h4>
                </div>

                <span className={cn(
                  "text-[9px] font-bold px-2 py-0.5 rounded-full border shrink-0",
                  ev.source === 'apple' ? "bg-slate-50 border-slate-200 text-slate-600" : "bg-emerald-50 border-emerald-200 text-emerald-700"
                )}>
                  {ev.source === 'apple' ? 'iCloud' : 'Sistema'}
                </span>
              </div>
            );
          })}
        </div>
      </Modal>

      {/* MODAL: Criar / Editar Compromisso */}
      <Modal
        isOpen={isEventModalOpen}
        onClose={() => setIsEventModalOpen(false)}
        title={editingEventId ? "Editar Compromisso" : "Novo Compromisso"}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSaveEvent} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Título do Evento *
            </label>
            <input
              type="text"
              required
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="Ex: Reunião com Diretoria"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="all_day_check"
              checked={formAllDay}
              onChange={(e) => setFormAllDay(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-brand-primary focus:ring-brand-primary cursor-pointer"
            />
            <label htmlFor="all_day_check" className="text-xs font-semibold text-slate-700 cursor-pointer">
              Evento de dia inteiro
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Data de Início *
              </label>
              <input
                type="date"
                required
                value={formStartDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
              />
            </div>
            {!formAllDay && (
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Horário de Início
                </label>
                <input
                  type="time"
                  required
                  value={formStartTime}
                  onChange={(e) => handleStartTimeChange(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Data de Término
              </label>
              <input
                type="date"
                value={formEndDate}
                onChange={(e) => setFormEndDate(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
              />
            </div>
            {!formAllDay && (
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Horário de Término
                </label>
                <input
                  type="time"
                  required
                  value={formEndTime}
                  onChange={(e) => setFormEndTime(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Localização ou Link
            </label>
            <input
              type="text"
              value={formLocation}
              onChange={(e) => setFormLocation(e.target.value)}
              placeholder="Ex: Sala de Reunião 2 ou Google Meet"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Descrição
            </label>
            <textarea
              rows={3}
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="Pauta da reunião, observações..."
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary resize-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsEventModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-brand-primary hover:bg-brand-primary/90 text-white transition-all shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? 'Salvando...' : editingEventId ? 'Salvar Alterações' : 'Criar Compromisso'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Detalhes do Evento */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title="Detalhes do Compromisso"
        maxWidth="max-w-md"
      >
        {selectedEvent && (
          <div className="space-y-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-primary">
                {selectedEvent.all_day ? 'Evento de Dia Inteiro' : 'Compromisso com Hora Marcada'}
              </span>
              <h3 className="text-lg font-bold text-slate-800 leading-snug mt-0.5">
                {selectedEvent.title}
              </h3>
            </div>

            <div className="space-y-2.5 text-xs text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div className="flex items-center gap-2">
                <Clock size={15} className="text-slate-400 shrink-0" />
                <span>
                  {new Date(selectedEvent.start_time).toLocaleDateString('pt-BR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                  {!selectedEvent.all_day && (
                    <> às {new Date(selectedEvent.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</>
                  )}
                </span>
              </div>

              {selectedEvent.location && (
                <div className="flex items-center gap-2">
                  <MapPin size={15} className="text-slate-400 shrink-0" />
                  <span className="font-semibold">{selectedEvent.location}</span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Info size={15} className="text-slate-400 shrink-0" />
                <span>Calendário: <strong>{selectedEvent.calendar_name}</strong></span>
              </div>
            </div>

            {selectedEvent.description && (
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Descrição</h4>
                <p className="text-xs text-slate-600 whitespace-pre-wrap bg-slate-50 p-3 rounded-xl border border-slate-100">
                  {selectedEvent.description}
                </p>
              </div>
            )}

            <div className="pt-2 flex items-center justify-between border-t border-slate-100">
              <button
                onClick={() => handleDeleteEvent(selectedEvent.id)}
                className="px-3 py-2 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 size={14} />
                <span>Excluir</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => openEditModal(selectedEvent)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Edit3 size={14} />
                  <span>Editar</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
