import React, { useState } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, Edit, Settings, X, Eye, Loader2 } from 'lucide-react';
import { Staff } from '../types';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

export function ProfileView({ user, onUpdateUser }: { user: Staff, onUpdateUser: (user: Staff) => void }) {
  const [name, setName] = useState(user.full_name);
  const [email, setEmail] = useState(user.email || '');
  const [avatar, setAvatar] = useState(user.avatar_url || '');
  const [password, setPassword] = useState(''); // Only used if user wants to change password
  const [isEditing, setIsEditing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      // 1. Update database profile
      const { error: dbError } = await supabase
        .from('profiles')
        .update({
          full_name: name,
          avatar_url: avatar,
          email: email
        })
        .eq('id', user.id);

      if (dbError) throw dbError;

      // 2. Update Auth metadata (persists Name and Avatar URL even if profiles table lacks the column)
      await supabase.auth.updateUser({
        data: { 
          full_name: name,
          avatar_url: avatar 
        }
      });

      // 3. Update password if provided
      if (password && password.length >= 6) {
        const { error: pwdError } = await supabase.auth.updateUser({
          password: password
        });
        if (pwdError) throw pwdError;
      }

      const updatedUser = { ...user, full_name: name, email, avatar_url: avatar };
      setIsEditing(false);
      setPassword('');
      // Call parent to update state
      onUpdateUser(updatedUser);
      toast.success('Perfil atualizado com sucesso.');
    } catch (err: any) {
      toast.error('Erro ao atualizar perfil: ' + (err.message || 'Tente novamente.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto scrollbar-hide p-8 text-slate-800">
      <div className="max-w-4xl mx-auto w-full">
        <header className="mb-8">
          <h2 className="text-4xl font-black text-slate-800 tracking-tight">Meu Perfil</h2>
          <p className="text-slate-500 font-medium">Gerencie suas informações e credenciais de acesso</p>
        </header>

        {message && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-bold rounded-2xl flex items-center gap-2"
          >
            <CheckCircle2 size={18} />
            {message}
          </motion.div>
        )}

        <div className="bg-white rounded-3xl border border-slate-200 shadow-elegant overflow-hidden">
          <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row items-center gap-8">
            <div className="relative group">
              <div className="w-32 h-32 rounded-3xl bg-brand-surface border-4 border-white shadow-float flex items-center justify-center font-black text-brand-accent text-3xl overflow-hidden">
                {avatar ? (
                  <img src={avatar} alt={name} className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-500" />
                ) : (
                  name.split(' ').map(n => n[0]).join('')
                )}
              </div>
              {isEditing && (
                <div 
                  onClick={() => {
                    const newAvatar = prompt('Insira a URL da nova imagem:', avatar);
                    if (newAvatar !== null) setAvatar(newAvatar);
                  }}
                  className="absolute inset-0 bg-black/40 rounded-3xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                >
                  <Edit size={24} className="text-white" />
                </div>
              )}
            </div>

            <div className="flex-1 text-center md:text-left">
              <h3 className="text-2xl font-black text-slate-800 mb-1">{user.full_name}</h3>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                <span className="px-3 py-1 bg-brand-primary/10 text-brand-primary text-xs font-bold rounded-full uppercase tracking-wider border border-brand-primary/10">
                  {user.role === 'admin' ? 'Administrador' : (user.role || 'Colaborador')}
                </span>
                <span className="text-slate-400 text-sm font-medium flex items-center gap-1.5">
                  <Settings size={14} className="opacity-50" />
                  ID Social: {user.id.substring(0, 8)}...
                </span>
              </div>
            </div>

            {!isEditing && (
              <button 
                onClick={() => setIsEditing(true)}
                className="px-6 py-2.5 bg-brand-primary text-white text-xs font-bold rounded-xl shadow-elegant hover:scale-105 transition-all uppercase tracking-wider cursor-pointer"
              >
                Editar Perfil
              </button>
            )}
          </div>

          <div className="p-8">
            <form onSubmit={handleSave} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Nome Completo</label>
                  <input 
                    type="text" value={name} onChange={(e) => setName(e.target.value)} disabled={!isEditing}
                    className={cn(
                      "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 transition-all outline-none",
                      isEditing ? "focus:ring-2 focus:ring-brand-accent bg-white" : "cursor-not-allowed opacity-70"
                    )}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">E-mail Corporativo</label>
                  <input 
                    type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={true}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 transition-all outline-none cursor-not-allowed opacity-70"
                  />
                  <p className="mt-1 text-[10px] text-slate-400 font-bold uppercase tracking-wider">O e-mail primário não pode ser alterado por aqui.</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">URL da Foto de Perfil (Avatar)</label>
                <input 
                  type="text" value={avatar} onChange={(e) => setAvatar(e.target.value)} disabled={!isEditing}
                  placeholder="https://images.unsplash.com/..."
                  className={cn(
                    "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 transition-all outline-none",
                    isEditing ? "focus:ring-2 focus:ring-brand-accent bg-white" : "cursor-not-allowed opacity-70"
                  )}
                />
              </div>

              <div className="pt-6 border-t border-slate-100">
                <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4">Segurança</h4>
                <div className="max-w-md">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Nova Senha (Mínimo 6 caracteres)</label>
                  <div className="relative">
                    <input 
                      type={showPassword ? "text" : "password"} 
                      value={password} onChange={(e) => setPassword(e.target.value)} disabled={!isEditing}
                      placeholder={isEditing ? "Deixe em branco para não alterar" : "••••••••"}
                      className={cn(
                        "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 transition-all outline-none",
                        isEditing ? "focus:ring-2 focus:ring-brand-accent bg-white" : "cursor-not-allowed opacity-70"
                      )}
                    />
                    <button 
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-brand-primary"
                    >
                      {showPassword ? <X size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              </div>

              {isEditing && (
                <div className="pt-6 flex justify-end gap-3">
                  <button 
                    type="button"
                    disabled={isLoading}
                    onClick={() => {
                      setIsEditing(false);
                      setName(user.full_name);
                      setEmail(user.email || '');
                      setAvatar(user.avatar_url || '');
                      setPassword('');
                    }}
                    className="px-6 py-3 border border-slate-200 text-slate-500 text-xs font-bold rounded-xl hover:bg-slate-50 transition-all uppercase tracking-wider cursor-pointer disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    disabled={isLoading}
                    className="px-8 py-3 bg-brand-primary text-white text-xs font-bold rounded-xl shadow-elegant hover:scale-[1.02] active:scale-[0.98] transition-all uppercase tracking-wider cursor-pointer flex items-center justify-center gap-2"
                  >
                    {isLoading ? <Loader2 size={16} className="animate-spin" /> : "Salvar Alterações"}
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
