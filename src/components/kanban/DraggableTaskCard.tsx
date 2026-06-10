import React, { useState, useRef, useEffect } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Edit, Trash, GripVertical, MoreVertical, GripHorizontal, MoreHorizontal } from 'lucide-react';
import { Task } from '../../types';
import { cn, getPriorityColor, getPriorityLabel, getInitials } from '../../lib/utils';

export function DraggableTaskCard({ 
  task, 
  onEdit, 
  onDelete,
  staff
}: { 
  task: any, 
  onEdit: (task: Task) => void,
  onDelete: (id: string) => void,
  staff?: import('../../types').Staff[],
  key?: React.Key
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
  });

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    if (isMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMenuOpen]);

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    zIndex: isDragging ? 50 : undefined,
  } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group/card relative",
        isDragging && "opacity-50 scale-95"
      )}
    >
      <div className={cn(
        "bg-white p-3.5 rounded-xl shadow-subtle border hover:shadow-elegant transition-all flex flex-col gap-2 relative",
        task.isPersonal ? "border-brand-primary/20 bg-brand-primary/5" : "border-slate-100"
      )}>
        {task.isPersonal && (
          <div className="absolute -top-2 -right-2 bg-brand-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm z-20">
            PESSOAL
          </div>
        )}
        
        <div className="relative z-10 flex items-center justify-between gap-2 border-b border-slate-50/50 pb-1 mb-1">
          <div 
            {...listeners}
            {...attributes}
            className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 p-1 -ml-1 rounded transition-colors"
            title="Segure para arrastar"
          >
            <GripHorizontal size={14} />
          </div>
          
          <div className="flex flex-1 items-center justify-end gap-1.5 relative">
            <span className={cn("text-[9px] px-1.5 py-0.5 font-bold rounded shrink-0", getPriorityColor(task.priority))}>
              {getPriorityLabel(task.priority)}
            </span>
            
            <div className="relative" ref={menuRef}>
              <button 
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); setIsMenuOpen(!isMenuOpen); }}
                className={cn(
                  "p-1 rounded transition-colors pointer-events-auto",
                  isMenuOpen ? "bg-slate-100 text-brand-primary" : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                )}
                title="Ações"
              >
                <MoreHorizontal size={14} />
              </button>
              
              {isMenuOpen && (
                <div className="absolute top-full right-0 mt-1 bg-white rounded-lg shadow-elegant border border-slate-100 py-1 z-50 min-w-[120px] origin-top-right animate-in fade-in zoom-in-95 duration-100">
                   <button 
                     className="flex w-full items-center gap-2 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-brand-primary transition-colors" 
                     onClick={(e) => { e.stopPropagation(); setIsMenuOpen(false); onEdit(task); }}
                   >
                     <Edit size={12} /> Editar
                   </button>
                   <button 
                     className="flex w-full items-center gap-2 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-red-500 transition-colors" 
                     onClick={(e) => { e.stopPropagation(); setIsMenuOpen(false); onDelete(task.id); }}
                   >
                     <Trash size={12} /> Excluir
                   </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col mb-1 relative z-10">
          <span className="text-xs font-bold text-brand-primary uppercase tracking-tight truncate max-w-[150px]">
            {task.macroAreaTitle || 'Atividade'}
          </span>
          {task.companyName && (
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
              {task.companyName}
            </span>
          )}
        </div>

        <h5 className="text-sm font-bold text-slate-800 leading-snug break-words relative z-10">{task.title}</h5>
        <div className="flex -space-x-1.5">
          {task.assignees?.map((assignee: string, idx: number) => {
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
        
        <div className="flex items-center justify-between pt-2 mt-1 border-t border-slate-50 relative z-10">
          <div className="flex items-center gap-2">
            <div className="flex flex-col">
              <span className="text-[9px] font-bold text-slate-400 leading-none uppercase">{task.isPersonal ? "Lista" : "Projeto"}</span>
              <span className="text-xs font-bold text-slate-700 truncate max-w-[120px]">{task.projectTitle || 'Pessoal'}</span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[9px] font-bold text-slate-400 leading-none block uppercase">{task.isPersonal ? "Referência" : "Sprint"}</span>
            <span className="text-xs font-bold text-brand-primary">{task.sprintTitle || '-'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
