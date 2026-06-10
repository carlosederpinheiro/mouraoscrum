import React, { useState, useEffect, useRef } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { motion } from 'motion/react';
import { Clock, Edit, Trash, GripHorizontal, MoreHorizontal, CheckSquare } from 'lucide-react';
import { EnrichedTask } from '../../types';
import { cn, getPriorityColor, getPriorityLabel, getInitials, calculateDueDateStatus } from '../../lib/utils';

export function TaskCard({ 
  task, 
  isOverlay, 
  onEdit, 
  onDelete,
  staff
}: { 
  task: EnrichedTask, 
  isOverlay?: boolean,
  onEdit?: (task: EnrichedTask) => void,
  onDelete?: (id: string) => void,
  staff?: import('../../types').Staff[],
  key?: React.Key
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    zIndex: isDragging ? 100 : undefined,
  } : undefined;

  const dueStatus = calculateDueDateStatus(task.due_date);
  const status = task.status;

  const getCardBorder = () => {
    if (isOverlay) return "border-2 border-brand-accent shadow-xl";
    if (status === 'in-progress') return "border border-slate-200 border-l-4 border-l-brand-accent shadow-sm";
    if (status === 'review') return "border border-slate-200 border-l-4 border-l-amber-400 shadow-sm";
    if (status === 'done') return "border border-slate-200 border-l-4 border-l-emerald-500 opacity-70";
    return "border border-slate-200 border-l-4 border-l-slate-300 shadow-sm";
  };

  return (
    <motion.div 
      ref={setNodeRef} 
      style={style} 
      {...listeners}
      {...attributes}
      layout
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className={cn(
        "bg-white p-3.5 rounded-xl shadow-subtle transition-all flex flex-col gap-2.5 relative border border-slate-100 group/card cursor-grab active:cursor-grabbing",
        getCardBorder(),
        isDragging && !isOverlay && "opacity-40 scale-95"
      )}
    >
      <div className="relative z-10 flex items-center justify-between gap-2 pb-1 mb-1">
        
        <div className="flex flex-1 items-start justify-between gap-1.5 relative w-full">
          <div className="flex flex-1 flex-row flex-wrap gap-1.5 items-center pr-2">
            {task.macroAreaTitle && (
              <span className="text-[10px] font-bold text-brand-primary uppercase tracking-tight bg-brand-primary/10 px-1.5 py-0.5 rounded truncate max-w-[120px]">
                {task.macroAreaTitle}
              </span>
            )}
            {task.sprintTitle && (
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 px-1.5 py-0.5 rounded truncate max-w-[100px]">
                {task.sprintTitle}
              </span>
            )}
            <span className={cn("text-[9px] px-1.5 py-0.5 font-bold rounded shrink-0", getPriorityColor(task.priority))}>
              {getPriorityLabel(task.priority)}
            </span>
          </div>
          {!isOverlay && (
            <div className="flex items-center gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity shrink-0">
               <button 
                 onClick={(e) => { e.stopPropagation(); onEdit?.(task); }} 
                 className="p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-primary rounded transition-colors"
                 title="Editar Tarefa"
               >
                 <Edit size={14} />
               </button>
               <button 
                 onClick={(e) => { e.stopPropagation(); onDelete?.(task.id); }} 
                 className="p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-500 rounded transition-colors"
                 title="Excluir Tarefa"
               >
                 <Trash size={14} />
               </button>
            </div>
          )}
        </div>
      </div>
      
      <p className={cn("relative z-10 text-sm font-semibold text-slate-800 leading-snug break-words", status === 'done' && 'line-through text-slate-500')}>{task.title}</p>
      
      {task.checklists && task.checklists.length > 0 && status !== 'done' && (
        <div className="relative z-10 mt-2 mb-1 space-y-1.5 bg-slate-50 border border-slate-100 rounded-lg p-2">
          {task.checklists.slice(0, 3).map((item, index) => (
             <div key={index} className="flex items-start gap-1.5 text-[10px]">
               <CheckSquare size={12} className={cn("mt-[1px] shrink-0", item.is_completed ? "text-emerald-500" : "text-slate-300")} />
               <span className={cn("leading-tight truncate", item.is_completed ? "text-slate-400 line-through" : "text-slate-600")}>
                 {item.title}
               </span>
             </div>
          ))}
          {task.checklists.length > 3 && (
            <div className="text-[9px] text-slate-400 font-medium pl-4 mt-1">
              + {task.checklists.length - 3} item(s) oculto(s)...
            </div>
          )}
        </div>
      )}
      
      <div className="relative z-10 flex items-center justify-between mt-1 pt-2 border-t border-slate-100">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            {task.companyName && (
              <span className="text-[9px] font-bold text-indigo-700 uppercase tracking-tight bg-indigo-100 border border-indigo-200 px-1.5 py-0.5 rounded truncate max-w-[150px]" title={`Empresa: ${task.companyName}`}>
                🏢 {task.companyName}
              </span>
            )}
            {task.due_date && status !== 'done' && (
              <div className="flex items-center gap-1.5">
                <Clock size={12} className={cn(dueStatus?.color.split(' ')[0], "opacity-80")} />
                <span className={cn("text-[9px] font-bold px-1 py-0.5 rounded", dueStatus?.color)}>
                  {dueStatus?.label} ({new Date(task.due_date).toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'})})
                </span>
              </div>
            )}
          </div>
          {status === 'done' && (
            <div className="flex items-center gap-1 text-xs text-green-600 font-bold">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/></svg>
              Concluído
            </div>
          )}
        </div>
        
        {task.assignees && task.assignees.length > 0 && (
          <div className="flex items-center gap-1.5 shrink-0 max-w-[50%] overflow-hidden">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter hidden sm:block">PO/Resp:</span>
            <div className="flex -space-x-1.5">
              {task.assignees.map((assignee, idx) => {
                const staffMember = staff?.find(s => 
                  s.full_name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === 
                  assignee.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                );
                
                return (
                  <div 
                    key={idx} 
                    title={assignee}
                    className="w-6 h-6 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-[10px] font-bold text-slate-600 shadow-sm z-10 hover:z-20 transition-all hover:scale-110 overflow-hidden"
                  >
                    {staffMember?.avatar_url ? (
                      <img src={staffMember.avatar_url} alt={assignee} className="w-full h-full object-cover" />
                    ) : (
                      getInitials(assignee)
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
