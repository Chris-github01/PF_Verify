import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from './supabase';

interface AdminContextType {
  isMasterAdmin: boolean;
  loading: boolean;
}

const AdminContext = createContext<AdminContextType | null>(null);

export function AdminProvider({ children }: { children: ReactNode }) {
  const [isMasterAdmin, setIsMasterAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (loading) {
        console.warn('⚠️ [AdminContext] Loading timeout - forcing completion');
        setLoading(false);
      }
    }, 3000);

    checkAdminStatus().finally(() => clearTimeout(timeout));

    return () => clearTimeout(timeout);
  }, []);

  const checkAdminStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setIsMasterAdmin(false);
        setLoading(false);
        return;
      }

      const { data: adminCheck } = await supabase
        .from('platform_admins')
        .select('is_active')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      setIsMasterAdmin(!!adminCheck);
    } catch (error) {
      console.error('Error checking admin status:', error);
      setIsMasterAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminContext.Provider value={{ isMasterAdmin, loading }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdmin must be used within AdminProvider');
  }
  return context;
}
