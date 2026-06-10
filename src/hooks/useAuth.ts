import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Staff } from '../types';

export function useAuth() {
  const navigate = useNavigate();
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  // Simulated Current User (Initial state)
  const [currentUser, setCurrentUser] = useState<Staff>({
    id: 'guest',
    full_name: 'Visitante',
    role: 'staff',
    email: '',
    avatar_url: ''
  });

  const syncUser = async (sbUser: any) => {
    
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', sbUser.id)
        .single();

      if (error || !profile) {
        const role = sbUser.user_metadata?.role || 'staff';
        const name = sbUser.user_metadata?.full_name || sbUser.user_metadata?.name || sbUser.email?.split('@')[0] || 'Usuário';
        const avatar = sbUser.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;

        setCurrentUser({
          id: sbUser.id,
          full_name: name,
          role: role,
          email: sbUser.email || '',
          avatar_url: avatar
        });
      } else {
        setCurrentUser({
          id: profile.id,
          full_name: profile.full_name || 'Usuário',
          role: profile.role || 'staff',
          email: sbUser.email || '',
          avatar_url: profile.avatar_url || sbUser.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.full_name || 'U')}&background=random`
        });
      }
      
    } catch (err) {
      console.error('Error syncing user:', err);
    } finally {
      setIsLoadingAuth(false);
    }
  };

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        syncUser(session.user);
      } else {
        setIsLoadingAuth(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        syncUser(session.user);
      } else {
        // Handle logout or no session
        setIsLoadingAuth(false);
        navigate('/');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser({
      id: 'guest',
      full_name: 'Visitante',
      role: 'staff',
      email: '',
      avatar_url: ''
    });
    navigate('/');
  };

  return {
    currentUser,
    setCurrentUser,
    isLoadingAuth,
    handleLogout
  };
}
