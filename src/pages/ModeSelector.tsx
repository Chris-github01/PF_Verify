import { Building2, Shield, ShieldAlert } from 'lucide-react';

interface ModeSelectorProps {
  onSelectMode: (mode: 'admin' | 'app') => void;
  isMasterAdmin: boolean;
}

export default function ModeSelector({ onSelectMode, isMasterAdmin }: ModeSelectorProps) {
  if (!isMasterAdmin) {
    onSelectMode('app');
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
            <Shield className="text-white" size={32} />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back</h1>
          <p className="text-gray-600">Choose how you'd like to access the platform</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button
            onClick={() => onSelectMode('admin')}
            className="bg-white rounded-2xl shadow-lg p-8 hover:shadow-xl transition-all duration-200 border-2 border-transparent hover:border-red-500 group"
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4 group-hover:bg-red-500 transition-colors">
                <ShieldAlert className="text-red-600 group-hover:text-white transition-colors" size={32} />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Admin Console</h2>
              <p className="text-gray-600 mb-4">
                Platform administration, manage organizations, users, and system settings
              </p>
              <div className="inline-flex items-center gap-2 text-sm font-medium text-red-600">
                <Shield size={16} />
                Master Admin Access
              </div>
            </div>
          </button>

          <button
            onClick={() => onSelectMode('app')}
            className="bg-white rounded-2xl shadow-lg p-8 hover:shadow-xl transition-all duration-200 border-2 border-transparent hover:border-blue-500 group"
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4 group-hover:bg-blue-500 transition-colors">
                <Building2 className="text-blue-600 group-hover:text-white transition-colors" size={32} />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Main App</h2>
              <p className="text-gray-600 mb-4">
                Access your projects, quotes, reports, and organization workspace
              </p>
              <div className="inline-flex items-center gap-2 text-sm font-medium text-blue-600">
                <Building2 size={16} />
                Organization Access
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
