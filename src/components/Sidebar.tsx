import { useState } from 'react';
import {
  LayoutDashboard,
  FileText,
  Grid3x3,
  ShieldCheck,
  Shield,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Flame,
  Sparkles,
  ClipboardCheck,
  Briefcase,
  Library,
} from 'lucide-react';
import { t } from '../i18n';
import { useOrganisation } from '../lib/organisationContext';

export type SidebarTab =
  | 'dashboard'
  | 'quotes'
  | 'review'
  | 'quoteintel'
  | 'scope'
  | 'contract'
  | 'reports'
  | 'insights'
  | 'library'
  | 'systemcheck'
  | 'copilotaudit'
  | 'settings';

interface SidebarProps {
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
}

const menuItems = [
  { id: 'dashboard' as SidebarTab, label: 'Project Dashboard', icon: LayoutDashboard },
  { id: 'quotes' as SidebarTab, label: 'Import Quotes', icon: FileText },
  { id: 'review' as SidebarTab, label: 'Review & Clean', icon: ClipboardCheck },
  { id: 'quoteintel' as SidebarTab, label: 'Quote Intelligence', icon: Sparkles },
  { id: 'scope' as SidebarTab, label: 'Scope Matrix', icon: Grid3x3 },
  { id: 'reports' as SidebarTab, label: 'Reports', icon: BarChart3 },
  { id: 'contract' as SidebarTab, label: 'Contract Manager', icon: Briefcase },
  { id: 'library' as SidebarTab, label: t('sidebar.library'), icon: Library },
  { id: 'settings' as SidebarTab, label: 'Settings', icon: Settings, requiresManagePermission: true },
];

export default function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { hasPermission } = useOrganisation();

  return (
    <div
      className={`${
        collapsed ? 'w-20' : 'w-64'
      } bg-white border-r border-gray-200 flex flex-col transition-all duration-200 relative`}
    >
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-primary rounded-lg flex items-center justify-center flex-shrink-0">
            <Flame className="w-6 h-6 text-white" />
          </div>
          {!collapsed && (
            <div>
              <h1 className="text-base font-bold brand-navy leading-tight">PassiveFire</h1>
              <p className="text-xs text-gray-600">Verify+</p>
            </div>
          )}
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {menuItems.map((item) => {
          if ((item as any).requiresManagePermission && !hasPermission('manage')) {
            return null;
          }

          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`
                w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all
                ${
                  isActive
                    ? 'bg-orange-50 brand-primary border-l-3 border-brand-primary'
                    : 'text-gray-700 hover:bg-gray-50'
                }
                ${collapsed ? 'justify-center' : ''}
              `}
              title={collapsed ? item.label : undefined}
            >
              <Icon size={20} className="flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 w-6 h-6 bg-white border border-gray-200 rounded-full flex items-center justify-center hover:bg-gray-50 transition-colors shadow-sm"
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>
    </div>
  );
}
