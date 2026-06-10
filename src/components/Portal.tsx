import React, { useState } from 'react';
import { Mail, Lock, ArrowRight, ShieldCheck, UserCircle2, Briefcase, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { supabase } from '../lib/supabase';
import fundoLogin from '../assets/fundo_login.png';
import logoConsultoria from '../assets/logo_consultoria.png';

export function Portal() {
  const [activeTab, setActiveTab] = useState<'cliente' | 'colaborador'>('cliente');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Erro ao realizar login. Verifique suas credenciais.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen bg-background flex overflow-hidden">
      {/* Left Column - Image & Branding */}
      <div className="hidden lg:flex w-1/2 relative bg-primary flex-col justify-between overflow-hidden">
        <div className="absolute inset-0">
          <ImageWithFallback
            src={fundoLogin}
            alt="Corporate Office"
            className="w-full h-full object-cover opacity-20 mix-blend-luminosity"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/90 to-transparent"></div>
        </div>

        <div className="relative z-10 p-16 flex flex-col h-full justify-between">
          <div>
            <img
              src={logoConsultoria}
              alt="Mourão Consultoria"
              className="h-16 w-auto mb-6 brightness-0 invert"
            />
            <p className="text-lg text-white/80 max-w-md">
              Acesso seguro e exclusivo às suas informações, relatórios financeiros e andamento de processos fiscais.
            </p>
          </div>

          <div className="space-y-6">
            <div className="flex items-center gap-4 text-white/80">
              <div className="w-12 h-12 bg-accent/20 rounded-xl flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-accent" />
              </div>
              <div>
                <h4 className="font-bold text-white">Ambiente Seguro</h4>
                <p className="text-sm">Seus dados protegidos com criptografia de ponta a ponta.</p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-white/80">
              <div className="w-12 h-12 bg-accent/20 rounded-xl flex items-center justify-center">
                <Briefcase className="w-6 h-6 text-accent" />
              </div>
              <div>
                <h4 className="font-bold text-white">Gestão Transparente</h4>
                <p className="text-sm">Acompanhe seus projetos e KPIs em tempo real.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12 lg:p-16 relative overflow-y-auto">
        {/* Background glow for the form side */}
        <div className="absolute top-1/4 right-0 w-96 h-96 bg-accent/5 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="w-full max-w-md relative z-10">
          <div className="text-center lg:text-left mb-10">
            <h1 className="text-3xl sm:text-4xl font-bold text-primary mb-3">Bem-vindo ao Portal</h1>
            <p className="text-secondary/70">Faça login para acessar sua área exclusiva.</p>
          </div>

          {/* Type Toggle */}
          <div className="flex p-1 bg-white border border-border rounded-xl mb-8 shadow-sm">
            <button
              onClick={() => setActiveTab('cliente')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition-all ${
                activeTab === 'cliente'
                  ? 'bg-primary text-white shadow-md'
                  : 'text-secondary hover:bg-muted'
              }`}
            >
              <UserCircle2 className="w-4 h-4" />
              Sou Cliente
            </button>
            <button
              onClick={() => setActiveTab('colaborador')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition-all ${
                activeTab === 'colaborador'
                  ? 'bg-primary text-white shadow-md'
                  : 'text-secondary hover:bg-muted'
              }`}
            >
              <Briefcase className="w-4 h-4" />
              Sou Colaborador
            </button>
          </div>

          <form className="space-y-6" onSubmit={handleLogin}>
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs font-bold rounded-xl animate-shake">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-bold text-secondary block">E-mail</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="block w-full pl-11 pr-4 py-3 bg-white border border-border rounded-xl text-secondary placeholder:text-muted-foreground focus:ring-2 focus:ring-accent focus:border-transparent transition-all outline-none"
                  placeholder={activeTab === 'cliente' ? 'seu@email.com.br' : 'nome@mouraoconsultoria.com.br'}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm font-bold text-secondary block">Senha</label>
                <a href="#" className="text-sm text-accent font-medium hover:text-primary transition-colors">
                  Esqueci minha senha
                </a>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-muted-foreground" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="block w-full pl-11 pr-4 py-3 bg-white border border-border rounded-xl text-secondary placeholder:text-muted-foreground focus:ring-2 focus:ring-accent focus:border-transparent transition-all outline-none"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-accent text-primary font-bold py-4 rounded-xl hover:bg-primary hover:text-white transition-all duration-300 flex items-center justify-center gap-2 group shadow-lg shadow-accent/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Entrando...
                </>
              ) : (
                <>
                  Entrar no Portal
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          {activeTab === 'cliente' && (
            <div className="mt-8 text-center text-sm text-secondary/70">
              Ainda não tem acesso?{' '}
              <a href="#contato" className="text-accent font-bold hover:text-primary transition-colors">
                Fale com seu consultor
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
