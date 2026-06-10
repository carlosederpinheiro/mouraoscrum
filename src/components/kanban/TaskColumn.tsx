import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Plus } from 'lucide-react';
import { EnrichedTask, TaskStatus, Staff } from '../../types';
import { cn } from '../../lib/utils';
import { TaskCard } from './TaskCard';

export function TaskColumn({ 
  id, 
  title, 
  tasks, 
  status, 
  onAddTask, 
  onEditTask, 
  onDeleteTask,
  staff
}: { 
  id: string, 
  title: string, 
  tasks: EnrichedTask[], 
  status: TaskStatus | 'review', 
  onAddTask?: () => void, 
  onEditTask: (task: EnrichedTask) => void, 
  onDeleteTask: (id: string) => void,
  staff?: Staff[]
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: id,
  });
  const getColumnStyles = (status: string) => {
    switch (status) {
      case 'todo': return {
        headerColor: 'text-slate-500',
        badgeBg: 'bg-slate-200',
        badgeText: 'text-slate-600',
        cardBorder: 'border-slate-200'
      };
      case 'in-progress': return {
        headerColor: 'text-brand-primary',
        badgeBg: 'bg-brand-accent/20',
        badgeText: 'text-brand-primary',
        cardBorder: 'border-l-4 border-brand-accent border-t border-r border-b border-slate-200'
      };
      case 'review': return {
        headerColor: 'text-slate-500',
        badgeBg: 'bg-slate-200',
        badgeText: 'text-slate-600',
        cardBorder: 'border-slate-200'
      };
      case 'done': return {
        headerColor: 'text-green-600',
        badgeBg: 'bg-green-100',
        badgeText: 'text-green-600',
        cardBorder: 'border-slate-200'
      };
      default: return {
        headerColor: 'text-slate-500',
        badgeBg: 'bg-slate-200',
        badgeText: 'text-slate-600',
        cardBorder: 'border-slate-200'
      };
    }
  };

  const styles = getColumnStyles(status);

  return (
    <div ref={setNodeRef} className={cn("flex-1 min-w-[300px] flex flex-col transition-colors rounded-xl", isOver && "bg-brand-accent/10")}>
      <div className="flex items-center justify-between mb-3 px-1 border-b border-slate-200 pb-2">
        <h4 className={cn("text-xs font-bold uppercase tracking-tighter", styles.headerColor)}>
          {title} <span className={cn("ml-2 text-xs px-1.5 py-0.5 rounded", styles.badgeBg, styles.badgeText)}>{tasks.length}</span>
        </h4>
      </div>
      
      <div className={cn("space-y-3 flex-1", status === 'done' ? 'opacity-70' : '')}>
        {tasks.length === 0 ? (
          <div className="border border-dashed border-slate-300 rounded-xl h-24 flex items-center justify-center bg-white/50">
            <span className="text-xs font-medium text-slate-400 italic">Solte aqui</span>
          </div>
        ) : (
          tasks.map(task => (
            <TaskCard key={task.id} task={task} onEdit={onEditTask} onDelete={onDeleteTask} staff={staff || []} />
          ))
        )}
        
        {status === 'todo' && (
          <button 
            onClick={onAddTask}
            className="w-full py-2.5 flex items-center justify-center gap-1.5 text-xs font-bold text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors border-2 border-dashed border-slate-200 uppercase tracking-wider mt-auto"
          >
            <Plus size={14} /> Adicionar Tarefa
          </button>
        )}
      </div>
    </div>
  );
}
