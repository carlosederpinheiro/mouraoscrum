import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Plus } from 'lucide-react';
import { Task, TaskStatus } from '../../types';
import { cn } from '../../lib/utils';
import { TaskCard } from './TaskCard';

export function DroppableColumn({ 
  column, 
  tasks, 
  onEditPersonalTask, 
  onDeletePersonalTask,
  personalTasksCount,
  staff
}: { 
  column: { id: TaskStatus, title: string, color: string },
  tasks: any[],
  onEditPersonalTask: (task: Task) => void,
  onDeletePersonalTask: (id: string) => void,
  personalTasksCount: number,
  staff?: import('../../types').Staff[],
  key?: React.Key
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });

  return (
    <div 
      ref={setNodeRef}
      className={cn(
        "flex-1 min-w-[280px] flex flex-col bg-slate-100/50 rounded-2xl border border-slate-200/60 shadow-inner transition-all",
        isOver && "bg-brand-accent/5 border-brand-accent/30 ring-2 ring-brand-accent/10"
      )}
    >
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn("w-2 h-2 rounded-full", column.color)}></div>
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">{column.title}</h4>
          <span className="text-xs font-bold bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full">{tasks.length}</span>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[150px]">
        {tasks.map((task) => (
          <TaskCard 
            key={task.id} 
            task={task} 
            onEdit={onEditPersonalTask as any}
            onDelete={onDeletePersonalTask}
            staff={staff || []}
          />
        ))}
        
        {tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center opacity-40">
            <div className="w-10 h-10 border-2 border-dashed border-slate-300 rounded-full flex items-center justify-center mb-2">
              <Plus size={16} className="text-slate-400" />
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Solte aqui</p>
          </div>
        )}
      </div>
    </div>
  );
}
