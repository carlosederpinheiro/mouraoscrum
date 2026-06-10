import { TaskPriority, TaskStatus } from '../types';

export const cn = (...classes: (string | undefined | null | false)[]) => classes.filter(Boolean).join(' ');

export const getPriorityColor = (priority?: TaskPriority) => {
  switch (priority) {
    case 'high': return 'bg-red-600 text-white shadow-[0_0_8px_rgba(220,38,38,0.6)]';
    case 'medium': return 'bg-yellow-400 text-yellow-950 shadow-[0_0_8px_rgba(250,204,21,0.6)]';
    case 'low': return 'bg-emerald-500 text-white shadow-[0_0_8px_rgba(16,185,129,0.6)]';
    default: return 'bg-slate-500 text-white';
  }
};

export const getPriorityLabel = (priority?: TaskPriority) => {
  switch (priority) {
    case 'high': return 'ALTA';
    case 'medium': return 'MÉDIA';
    case 'low': return 'BAIXA';
    default: return 'NORMAL';
  }
};

export const getInitials = (name: string) => {
  const parts = name.split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
};

export const calculateDueDateStatus = (dueDateStr?: string) => {
  if (!dueDateStr) return null;
  const due = new Date(dueDateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  
  const diffTime = due.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return { label: 'ATRASADO', color: 'text-white bg-red-600 animate-pulse shadow-[0_0_8px_rgba(220,38,38,0.6)]' };
  if (diffDays <= 2) return { label: 'No limite', color: 'text-orange-800 bg-orange-200' };
  return { label: 'No prazo', color: 'text-emerald-700 bg-emerald-100' };
};

export const mapStatusToDB = (status: TaskStatus | string): string => {
  switch(status) {
    case 'todo': return 'a_fazer';
    case 'in-progress': return 'em_andamento';
    case 'review': return 'em_revisao';
    case 'done': return 'concluido';
    default: return status;
  }
};

export const mapStatusFromDB = (status: string): TaskStatus => {
  switch(status) {
    case 'a_fazer': return 'todo';
    case 'em_andamento': return 'in-progress';
    case 'em_revisao': return 'review';
    case 'concluido': return 'done';
    default: return 'todo';
  }
};

export const formatDate = (dateString?: string, options?: Intl.DateTimeFormatOptions) => {
  if (!dateString) return '-';
  const parts = dateString.split('T')[0].split('-');
  const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  return date.toLocaleDateString('pt-BR', options);
};
