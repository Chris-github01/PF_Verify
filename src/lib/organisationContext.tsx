// PERMANENT FIX FOR CHRIS – DO NOT REGRESS – USER MUST SEE "Pi" ORG
// This context properly fetches organisations via organisation_members junction table
// CRITICAL FIX 23 Nov 2025 – NEVER select organisations.settings again – column was removed and broke all org loading
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from './supabase';
import { getImpersonatedOrgId, isImpersonating } from './admin/adminApi';

interface Organisation {
  id: string;
  name: string;
  created_at: string;
  status?: string;
}

interface OrganisationContextType {
  currentOrganisation: Organisation | null;
  organisations: Organisation[];
  loading: boolean;
  isAdminView: boolean;
  setCurrentOrganisation: (org: Organisation | null) => void;
  refreshOrganisations: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  debugInfo?: any;
}

const OrganisationContext = createContext<OrganisationContextType | undefined>(undefined);

export function OrganisationProvider({ children }: { children: ReactNode }) {
  const [currentOrganisation, setCurrentOrganisation] = useState<Organisation | null>(null);
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdminView, setIsAdminView] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);

  useEffect(() => {
    loadOrganisations();
  }, []);

  const loadOrganisations = async (retryCount = 0) => {
    setLoading(true);
    const debug: any = { timestamp: new Date().toISOString(), retryCount };

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    debug.session = session ? { user_id: session.user.id, expires_at: session.expires_at } : null;
    debug.sessionError = sessionError?.message;

    console.log('🔍 [OrganisationContext] Session check:', {
      hasSession: !!session,
      userId: session?.user?.id,
      email: session?.user?.email,
      retry: retryCount,
      sessionError: sessionError?.message
    });

    if (!session || !session.user) {
      if (retryCount < 3) {
        console.log('⏳ [OrganisationContext] Session not ready, retrying in 600ms... (attempt', retryCount + 1, 'of 3)');
        await new Promise(resolve => setTimeout(resolve, 600));
        return loadOrganisations(retryCount + 1);
      }

      console.log('ℹ️ [OrganisationContext] No session found - user not logged in');
      setDebugInfo({ ...debug, info: 'No session - user not logged in' });
      setOrganisations([]);
      setLoading(false);
      return;
    }

    const user = session.user;
    debug.user = { id: user.id, email: user.email };

    // Check if admin is impersonating
    const impersonatedOrgId = getImpersonatedOrgId();
    if (impersonatedOrgId) {
      console.log('👤 [OrganisationContext] Admin impersonating org:', impersonatedOrgId);
      const { data: org } = await supabase
        .from('organisations')
        .select('*')
        .eq('id', impersonatedOrgId)
        .single();

      if (org) {
        console.log('✅ [OrganisationContext] Loaded impersonated org:', org.name);
        setOrganisations([org]);
        setCurrentOrganisation(org);
        setDebugInfo({ ...debug, impersonating: true, org: org.name });
        setLoading(false);
        return;
      }
    }

    // PERMANENT FIX: Fetch memberships via organisation_members junction table
    const { data: memberships, error: membershipError } = await supabase
      .from('organisation_members')
      .select('organisation_id, role, status')
      .eq('user_id', user.id)
      .eq('status', 'active');

    debug.memberships = memberships || [];
    debug.membershipError = membershipError?.message;

    console.log('�� [OrganisationContext] Memberships query result:', {
      count: memberships?.length || 0,
      orgIds: memberships?.map(m => m.organisation_id),
      error: membershipError?.message
    });

    if (membershipError) {
      console.error('❌ [OrganisationContext] Error loading memberships:', membershipError);
      setDebugInfo(debug);
      setLoading(false);
      return;
    }

    let orgs = null;
    let orgsError = null;

    if (!memberships || memberships.length === 0) {
      console.log('🔍 [OrganisationContext] No memberships found, checking platform admin status');
      const { data: adminCheck, error: adminError } = await supabase
        .from('platform_admins')
        .select('is_active')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      debug.isAdmin = !!adminCheck;
      debug.adminError = adminError?.message;

      console.log('🔐 [OrganisationContext] Admin check result:', { isAdmin: !!adminCheck, error: adminError?.message });

      if (adminCheck) {
        console.log('👑 [OrganisationContext] User is platform admin, loading all organisations');
        const result = await supabase
          .from('organisations')
          .select('id, name, created_at, status')
          .order('created_at', { ascending: false });

        console.log('📦 [OrganisationContext] All orgs loaded:', result.data?.length || 0, 'organisations');
        orgs = result.data;
        orgsError = result.error;
        debug.orgCount = orgs?.length || 0;
        debug.orgNames = orgs?.map((o: any) => o.name) || [];
        setIsAdminView(true);
      } else {
        console.warn('⚠️ [OrganisationContext] Not an admin and no memberships - user cannot see any orgs');
        setOrganisations([]);
        setIsAdminView(false);
        setDebugInfo(debug);
        setLoading(false);
        return;
      }
    } else {
      console.log('✅ [OrganisationContext] User has', memberships.length, 'active memberships, loading organisations');
      const orgIds = memberships.map(m => m.organisation_id);

      const result = await supabase
        .from('organisations')
        .select('id, name, created_at, status')
        .in('id', orgIds)
        .order('name', { ascending: true });

      debug.orgCount = result.data?.length || 0;
      debug.orgNames = result.data?.map((o: any) => o.name) || [];

      console.log('📦 [OrganisationContext] Loaded', result.data?.length || 0, 'organisations:', result.data?.map((o: any) => o.name).join(', '));

      orgs = result.data;
      orgsError = result.error;
      setIsAdminView(false);
    }

    if (orgsError) {
      console.error('❌ [OrganisationContext] Error loading organisations:', orgsError);
      debug.orgsError = orgsError.message;
      setDebugInfo(debug);
      setLoading(false);
      return;
    }

    if (orgs) {
      setOrganisations(orgs);
      console.log('✅ [OrganisationContext] Successfully set', orgs.length, 'organisations in state');

      const savedOrgId = localStorage.getItem('passivefire_current_organisation_id');
      if (savedOrgId) {
        const savedOrg = orgs.find((o: Organisation) => o.id === savedOrgId);
        if (savedOrg) {
          setCurrentOrganisation(savedOrg);
          console.log('🎯 [OrganisationContext] Restored saved org:', savedOrg.name);
        } else if (orgs.length > 0) {
          setCurrentOrganisation(orgs[0]);
          localStorage.setItem('passivefire_current_organisation_id', orgs[0].id);
          console.log('🎯 [OrganisationContext] Set first org as current:', orgs[0].name);
        }
      } else if (orgs.length > 0) {
        setCurrentOrganisation(orgs[0]);
        localStorage.setItem('passivefire_current_organisation_id', orgs[0].id);
        console.log('🎯 [OrganisationContext] Set first org as current:', orgs[0].name);
      }
    }

    setDebugInfo(debug);
    setLoading(false);
    console.log('✅ [OrganisationContext] Load complete. Final org count:', orgs?.length || 0);
  };

  const refreshOrganisations = async () => {
    await loadOrganisations();
  };

  const handleSetCurrentOrganisation = (org: Organisation | null) => {
    setCurrentOrganisation(org);
    if (org) {
      localStorage.setItem('passivefire_current_organisation_id', org.id);
    } else {
      localStorage.removeItem('passivefire_current_organisation_id');
    }
  };

  const hasPermission = (permission: string) => {
    return true;
  };

  return (
    <OrganisationContext.Provider
      value={{
        currentOrganisation,
        organisations,
        loading,
        isAdminView,
        setCurrentOrganisation: handleSetCurrentOrganisation,
        refreshOrganisations,
        hasPermission,
        debugInfo,
      }}
    >
      {children}
    </OrganisationContext.Provider>
  );
}

export function useOrganisation() {
  const context = useContext(OrganisationContext);
  if (context === undefined) {
    throw new Error('useOrganisation must be used within an OrganisationProvider');
  }
  return context;
}
