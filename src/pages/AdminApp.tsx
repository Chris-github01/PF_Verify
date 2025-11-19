import { useState, useEffect } from 'react';
import { Building2, LayoutDashboard, LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';
import AdminDashboard from './admin/AdminDashboard';
import OrganisationsList from './admin/OrganisationsList';
import OrganisationDetail from './admin/OrganisationDetail';
import CreateOrganisation from './admin/CreateOrganisation';

type AdminView = 'dashboard' | 'organisations' | 'organisation-detail' | 'create-organisation';

export default function AdminApp() {
  const [activeView, setActiveView] = useState<AdminView>('dashboard');
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);

  useEffect(() => {
    const path = window.location.pathname;

    if (path === '/admin' || path === '/admin/') {
      setActiveView('dashboard');
    } else if (path === '/admin/organisations') {
      setActiveView('organisations');
    } else if (path === '/admin/organisations/new') {
      setActiveView('create-organisation');
    } else if (path.startsWith('/admin/organisations/')) {
      const orgId = path.split('/').pop();
      if (orgId) {
        setSelectedOrgId(orgId);
        setActiveView('organisation-detail');
      }
    }
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  const renderContent = () => {
    switch (activeView) {
      case 'dashboard':
        return <AdminDashboard />;
      case 'organisations':
        return <OrganisationsList />;
      case 'organisation-detail':
        return selectedOrgId ? <OrganisationDetail organisationId={selectedOrgId} /> : null;
      case 'create-organisation':
        return <CreateOrganisation />;
      default:
        return <AdminDashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
              <Building2 className="text-white" size={20} />
            </div>
            <div>
              <div className="font-semibold text-slate-900">Admin Console</div>
              <div className="text-xs text-slate-500">Master Admin</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4">
          <button
            onClick={() => (window.location.href = '/admin')}
            className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeView === 'dashboard'
                ? 'bg-blue-50 text-blue-700'
                : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <LayoutDashboard size={18} />
            Dashboard
          </button>
          <button
            onClick={() => (window.location.href = '/admin/organisations')}
            className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeView === 'organisations' || activeView === 'organisation-detail' || activeView === 'create-organisation'
                ? 'bg-blue-50 text-blue-700'
                : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Building2 size={18} />
            Organisations
          </button>
        </nav>

        <div className="p-4 border-t border-slate-200 space-y-2">
          <button
            onClick={() => (window.location.href = '/')}
            className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
          >
            <LayoutDashboard size={18} />
            Main App
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium text-rose-600 hover:bg-rose-50 transition"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {renderContent()}
      </div>
    </div>
  );
}
