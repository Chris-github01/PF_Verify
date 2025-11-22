import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from './supabase';
import { getImpersonatedOrgId, isImpersonating } from './admin/adminApi';

interface Organisation {
  id: string;
  name: string;
  created_at: string;
  settings?: any;
}

interface OrganisationContextType {
  currentOrganisation: Organisation | null;
  organisations: Organisation[];
  loading: boolean;
  setCurrentOrganisation: (org: Organisation | null) => void;
  refreshOrganisations: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

const OrganisationContext = createContext<OrganisationContextType | undefined>(undefined);

export function OrganisationProvider({ children }: { children: ReactNode }) {
  const [currentOrganisation, setCurrentOrganisation] = useState<Organisation | null>(null);
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrganisations();
  }, []);

  const loadOrganisations = async () => {
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    console.log('[OrganisationContext] Current user:', user?.id, user?.email);
    if (!user) {
      console.log('[OrganisationContext] No user found');
      setLoading(false);
      return;
    }

    // Check if admin is impersonating
    const impersonatedOrgId = getImpersonatedOrgId();
    if (impersonatedOrgId) {
      console.log('[OrganisationContext] Impersonating org:', impersonatedOrgId);
      // Load the specific org for impersonation
      const { data: org } = await supabase
        .from('organisations')
        .select('*')
        .eq('id', impersonatedOrgId)
        .single();

      if (org) {
        setOrganisations([org]);
        setCurrentOrganisation(org);
        setLoading(false);
        return;
      }
    }

    console.log('[OrganisationContext] Fetching memberships for user:', user.id);
    const { data: memberships, error: membershipError } = await supabase
      .from('organisation_members')
      .select('organisation_id, status, role')
      .eq('user_id', user.id)
      .eq('status', 'active');

    console.log('[OrganisationContext] Memberships query result:', { memberships, membershipError });

    if (membershipError) {
      console.error('[OrganisationContext] Error loading memberships:', membershipError);
      setLoading(false);
      return;
    }

    if (!memberships || memberships.length === 0) {
      console.log('[OrganisationContext] No active memberships found for user');
      setOrganisations([]);
      setLoading(false);
      return;
    }

    const orgIds = memberships.map(m => m.organisation_id);
    console.log('[OrganisationContext] Organisation IDs:', orgIds);

    const { data: orgs, error: orgsError } = await supabase
      .from('organisations')
      .select('id, name, created_at, settings, status')
      .in('id', orgIds);

    console.log('[OrganisationContext] Organisations query result:', { orgs, orgsError });

    if (orgsError) {
      console.error('[OrganisationContext] Error loading organisations:', orgsError);
      setLoading(false);
      return;
    }

    console.log('[OrganisationContext] Loaded organisations:', orgs);

    if (orgs) {
      setOrganisations(orgs);

      const savedOrgId = localStorage.getItem('passivefire_current_organisation_id');
      if (savedOrgId) {
        const savedOrg = orgs.find((o: Organisation) => o.id === savedOrgId);
        if (savedOrg) {
          setCurrentOrganisation(savedOrg);
        } else if (orgs.length > 0) {
          setCurrentOrganisation(orgs[0]);
          localStorage.setItem('passivefire_current_organisation_id', orgs[0].id);
        }
      } else if (orgs.length > 0) {
        setCurrentOrganisation(orgs[0]);
        localStorage.setItem('passivefire_current_organisation_id', orgs[0].id);
      }
    }

    setLoading(false);
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
        setCurrentOrganisation: handleSetCurrentOrganisation,
        refreshOrganisations,
        hasPermission,
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
