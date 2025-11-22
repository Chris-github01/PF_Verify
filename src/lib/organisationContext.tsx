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
  isAdminView: boolean;
  setCurrentOrganisation: (org: Organisation | null) => void;
  refreshOrganisations: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

const OrganisationContext = createContext<OrganisationContextType | undefined>(undefined);

export function OrganisationProvider({ children }: { children: ReactNode }) {
  const [currentOrganisation, setCurrentOrganisation] = useState<Organisation | null>(null);
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdminView, setIsAdminView] = useState(false);

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
      .select('organisation_id')
      .eq('user_id', user.id)
      .eq('status', 'active');

    if (membershipError) {
      console.error('Error loading memberships:', membershipError);
      setLoading(false);
      return;
    }

    let orgs = null;
    let orgsError = null;

    if (!memberships || memberships.length === 0) {
      // Check if user is a platform admin
      const { data: adminCheck } = await supabase
        .from('platform_admins')
        .select('is_active')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (adminCheck) {
        // Admin fallback: show all organisations
        const result = await supabase
          .from('organisations')
          .select('id, name, created_at, settings, status')
          .order('created_at', { ascending: false });

        orgs = result.data;
        orgsError = result.error;
        setIsAdminView(true);
      } else {
        // Not an admin and no memberships
        setOrganisations([]);
        setIsAdminView(false);
        setLoading(false);
        return;
      }
    } else {
      // User has memberships, load their organisations
      const orgIds = memberships.map(m => m.organisation_id);

      const result = await supabase
        .from('organisations')
        .select('id, name, created_at, settings, status')
        .in('id', orgIds);

      orgs = result.data;
      orgsError = result.error;
      setIsAdminView(false);
    }

    if (orgsError) {
      console.error('Error loading organisations:', orgsError);
      setLoading(false);
      return;
    }

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
        isAdminView,
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
