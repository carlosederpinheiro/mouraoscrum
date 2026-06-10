import React from 'react';
import { Modal } from './Modal';
import { AlertTriangle, Info } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  destructive = true,
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  return (
    <Modal isOpen={isOpen} onClose={onCancel} title={title}>
      <div className="flex flex-col items-center text-center space-y-4">
        <div className={cn("w-12 h-12 rounded-full flex items-center justify-center mb-2", destructive ? "bg-red-50 text-red-500" : "bg-brand-primary/10 text-brand-primary")}>
          {destructive ? <AlertTriangle size={24} /> : <Info size={24} />}
        </div>
        
        <p className="text-sm font-medium text-slate-600 px-4">
          {message}
        </p>

        <div className="flex items-center gap-3 w-full mt-6 pt-4 border-t border-slate-100">
          <button 
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 bg-slate-50 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-100 transition-colors uppercase tracking-wider border border-slate-200"
          >
            {cancelText}
          </button>
          <button 
            onClick={onConfirm}
            className={cn(
              "flex-1 px-4 py-2.5 text-white text-xs font-bold rounded-xl shadow-elegant transition-all uppercase tracking-wider",
              destructive ? "bg-red-500 hover:bg-red-600" : "bg-brand-primary hover:bg-brand-accent"
            )}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
}
