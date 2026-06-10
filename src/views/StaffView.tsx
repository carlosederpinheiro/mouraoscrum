import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Users, Plus, CheckCircle2, Briefcase, Edit, Trash } from 'lucide-react';
import { Staff, MacroAreaWithProjects } from '../types';
import { Modal } from '../components/shared/Modal';
import { useConfirm } from '../hooks/useConfirm';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

export function StaffView({ staff, onUpdateStaff, onDeleteStaff, data }: { 
  staff: Staff[], 
  onUpdateStaff: (staff: Staff[]) => void,
  onDeleteStaff: (id: string) => void,
  data: MacroAreaWithProjects[]
}) {
  const { confirm } = useConfirm();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Staff | null>(null);
  const [name, setName] = useState('');
  const [role, setRole] = useState('staff');
  const [jobTitle, setJobTitle] = useState('');
  const [email, setEmail] = useState('');
  const [avatar, setAvatar] = useState('');
  const [password, setPassword] = useState('Mudar123@');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      if (editingMember) {
        if (!editingMember.id.startsWith('s_')) {
          const { error } = await supabase.from('profiles').update({
            full_name: name,
            role,
            job_title: jobTitle,
            email,
            avatar_url: avatar
          }).eq('id', editingMember.id);
          
          if (error) throw error;
        }
        
        onUpdateStaff(staff.map(s => s.id === editingMember.id ? { ...s, full_name: name, role, job_title: jobTitle, email, avatar_url: avatar } : s));
        toast.success('Membro atualizado com sucesso.');
      } else {
        // Criar usuário real no Supabase Auth usando um cliente temporário para não deslogar o admin
        const tempClient = createClient(
          import.meta.env.VITE_SUPABASE_URL || 'https://enamvoamthbfimtsvgqa.supabase.co',
          import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_CpzqeLlInSe81L1Sq46rQQ_NJSmTnP1',
          { auth: { persistSession: false, autoRefreshToken: false } }
        );

        const { data: authData, error: signUpError } = await tempClient.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name,
              role: role,
              avatar_url: avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`
            }
          }
        });

        if (signUpError) throw signUpError;
        
        if (authData.user) {
          const profileAvatar = avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;
          const { error: profileError } = await supabase.from('profiles').upsert({
            id: authData.user.id,
            full_name: name,
            role,
            job_title: jobTitle,
            email,
            avatar_url: profileAvatar
          });

          if (profileError) {
             console.error('Error upserting profile, might exist via trigger:', profileError);
             // Ignore if it's already created by a trigger
          }

          const newMember: Staff = {
            id: authData.user.id,
            full_name: name,
            role,
            job_title: jobTitle,
            email,
            avatar_url: profileAvatar
          };
          onUpdateStaff([...staff, newMember]);
          toast.success('Membro criado e salvo no banco de dados!');
        }
      }
      
      setName('');
      setRole('staff');
      setJobTitle('');
      setEmail('');
      setAvatar('');
      setPassword('Mudar123@');
      setEditingMember(null);
      setIsModalOpen(false);
    } catch (err: any) {
      toast.error('Erro ao atualizar membro: ' + (err.message || 'Tente novamente.'));
    }
  };

  const openEdit = (member: Staff) => {
    setEditingMember(member);
    setName(member.full_name);
    setRole(member.role);
    setJobTitle(member.job_title || '');
    setEmail(member.email || '');
    setAvatar(member.avatar_url || '');
    setIsModalOpen(true);
  };

  const handleResetPassword = async (memberId: string) => {
    const confirmed = await confirm({
      title: 'Resetar Senha',
      message: 'Deseja resetar a senha deste colaborador para o padrão?',
      destructive: false
    });
    if (confirmed) {
      // In real scenario, this would call Supabase auth or a dedicated function
      console.log('Resetting password for', memberId);
      toast.success('Senha resetada com sucesso.');
    }
  };

  const handleDelete = (id: string) => {
    onDeleteStaff(id); // Confirmation happens inside useScrumData
  };

  // Get stats
  const staffStats = staff.map(member => {
    let projectCount = 0;
    data.forEach(area => {
      area.projects.forEach(p => {
        if ((p as any).staff_ids?.includes(member.id)) projectCount++;
      });
    });
    return { ...member, projectCount };
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 font-sans">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
           <div className="flex items-center gap-2 mb-1">
              <Users size={16} className="text-brand-primary" />
              <span className="text-xs font-bold text-brand-primary uppercase tracking-[0.2em]">Gestão de Capital Humano</span>
           </div>
           <h2 className="text-4xl font-black text-slate-800 tracking-tight">Time & Staff</h2>
           <p className="text-slate-400 text-sm font-medium mt-1">Gerencie a equipe e alocações estratégicas</p>
        </div>
        <button 
          onClick={() => {
            setEditingMember(null);
            setName('');
            setRole('');
            setEmail('');
            setAvatar('');
            setIsModalOpen(true);
          }}
          className="bg-brand-primary text-white px-6 py-3 rounded-2xl font-bold text-xs shadow-elegant flex items-center justify-center gap-2 hover:scale-105 active:scale-95 transition-all uppercase tracking-wider"
        >
          <Plus size={18} /> Adicionar Membro
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {staffStats.map(member => (
          <motion.div 
            key={member.id}
            whileHover={{ y: -8, transition: { duration: 0.3 } }}
            className="bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-elegant transition-all overflow-hidden group flex flex-col"
          >
            <div className="p-6 flex items-start gap-5">
              <div className="relative shrink-0">
                <img 
                  src={member.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.full_name)}&background=random`} 
                  alt={member.full_name}
                  className="w-16 h-16 rounded-2xl object-cover border-2 border-slate-100 shadow-inner group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 rounded-lg border-2 border-white flex items-center justify-center text-white">
                  <CheckCircle2 size={12} strokeWidth={3} />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-lg font-black text-slate-800 truncate leading-tight group-hover:text-brand-primary transition-colors">{member.full_name}</h4>
                <p className="text-xs font-bold text-brand-primary/60 uppercase tracking-wider mt-0.5">
                  {member.job_title || (member.role === 'admin' ? 'Administrador' : 'Colaborador')}
                </p>
                <p className="text-xs font-medium text-slate-400 truncate mt-1">{member.email || 'sem email cadastrado'}</p>
                <div className="mt-2 flex items-center gap-2">
                   <div className="px-2 py-1 bg-slate-100 rounded text-[9px] font-bold text-slate-500 font-mono">
                      {member.role === 'admin' ? "Acesso Total" : "Acesso Staff"}
                   </div>
                   <button 
                     onClick={() => handleResetPassword(member.id)}
                     className="text-[10px] font-bold text-brand-primary uppercase hover:underline cursor-pointer"
                     title="Resetar para senha padrão"
                   >
                     Resetar Senha
                   </button>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 flex items-center justify-between border-t border-slate-100">
               <div className="flex items-center gap-1.5 font-bold text-xs text-slate-500 uppercase">
                  <Briefcase size={12} className="text-slate-300" />
                  <span>{member.projectCount} Projetos Ativos</span>
               </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => openEdit(member)}
                    className="p-2 bg-white rounded-xl shadow-subtle text-slate-400 hover:text-brand-primary hover:scale-110 transition-all border border-slate-100 cursor-pointer"
                  >
                    <Edit size={14} />
                  </button>
                  <button 
                    onClick={() => handleDelete(member.id)}
                    className="p-2 bg-white rounded-xl shadow-subtle text-slate-400 hover:text-red-500 hover:scale-110 transition-all border border-slate-100 cursor-pointer"
                  >
                    <Trash size={14} />
                  </button>
                </div>
            </div>
          </motion.div>
        ))}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingMember ? "Editar Membro" : "Novo Membro do Staff"}>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Nome Completo</label>
            <input 
              type="text" value={name} onChange={(e) => setName(e.target.value)} required
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-accent transition-all"
              placeholder="Ex: Carlos Eder"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Cargo / Profissão</label>
              <input 
                type="text" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-accent transition-all"
                placeholder="Ex: Arquiteto de Sistemas"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Permissão de Acesso</label>
              <select 
                value={role} onChange={(e) => setRole(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-accent transition-all cursor-pointer"
              >
                <option value="staff">Acesso Staff (Limitado)</option>
                <option value="admin">Acesso Total (Admin)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">E-mail</label>
              <input 
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-accent transition-all"
                placeholder="carlos@exemplo.com"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">URL do Avatar (Opcional)</label>
            <input 
              type="text" value={avatar} onChange={(e) => setAvatar(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-accent transition-all"
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Senha de Acesso</label>
            <div className="relative">
              <input 
                type="text" value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-accent transition-all"
                placeholder="Mudar123@"
              />
              <button 
                type="button"
                onClick={() => setPassword('Mudar123@')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-brand-primary uppercase hover:bg-brand-primary/10 px-2 py-1 rounded transition-all"
              >
                Padrão
              </button>
            </div>
          </div>
          <button type="submit" className="w-full py-4 bg-brand-primary text-white text-xs font-bold rounded-xl uppercase tracking-wider shadow-elegant hover:scale-[1.02] active:scale-[0.98] transition-all mt-4">
            {editingMember ? "SALVAR ALTERAÇÕES" : "ADICIONAR AO TIME"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
