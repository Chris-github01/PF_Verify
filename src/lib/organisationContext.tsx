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
    if (!user) {
      setLoading(false);
      return;
    }

    // Check if admin is impersonating
    const impersonatedOrgId = getImpersonatedOrgId();
    if (impersonatedOrgId) {
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

    const { data: memberships, error: membershipError } = await supabase
      .from('organisation_members')
      .select(`
        organisation_id,
        organisations:organisation_id (
          id,
          name,
          created_at,
          settings,
          status
        )
      `)
      .eq('user_id', user.id)
      .eq('status', 'active');

    if (membershipError) {
      console.error('Error loading organisations:', membershipError);
    }

    if (memberships) {
      const orgs = memberships
        .map((m: any) => m.organisations)
        .filter(Boolean);
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
