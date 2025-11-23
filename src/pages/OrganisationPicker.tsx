// PERMANENT FIX FOR CHRIS – DO NOT REGRESS – USER MUST SEE "Pi" ORG
import { Building2, AlertCircle, Loader2, ChevronDown, Shield, Bug } from 'lucide-react';
import { useOrganisation } from '../lib/organisationContext';
import { useState } from 'react';

interface OrganisationPickerProps {
  onOrganisationSelected: () => void;
}

export default function OrganisationPicker({ onOrganisationSelected }: OrganisationPickerProps) {
  const { organisations, setCurrentOrganisation, loading, isAdminView, debugInfo } = useOrganisation();
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [error, setError] = useState('');
  const [showDebug, setShowDebug] = useState(false);
  const isDev = import.meta.env.DEV;

  const handleSelect = () => {
    if (!selectedOrgId) {
      setError('Please select an organisation');
      return;
    }
    const org = organisations.find(o => o.id === selectedOrgId);
    if (org) {
      setCurrentOrganisation(org);
      onOrganisationSelected();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 text-blue-600 animate-spin" size={48} />
          <p className="text-gray-600">Loading organisations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-6">
          <Building2 className="mx-auto mb-4 text-blue-600" size={48} />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Select Organisation</h1>
          <p className="text-gray-600">Choose which organisation to work with</p>
          {isAdminView && (
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full">
              <Shield size={14} />
              Admin view: showing all organisations
            </div>
          )}
        </div>

        {organisations.length > 0 ? (
          <div className="space-y-4">
            <div className="relative">
              <select
                value={selectedOrgId}
                onChange={(e) => {
                  setSelectedOrgId(e.target.value);
                  setError('');
                }}
                className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 appearance-none cursor-pointer"
              >
                <option value="">Select an organisation...</option>
                {organisations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={20} />
            </div>

            {error && (
              <div className="text-red-600 text-sm">{error}</div>
            )}

            <button
              onClick={handleSelect}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Continue
            </button>
          </div>
        ) : (
          <div className="text-center py-8">
            <AlertCircle className="mx-auto mb-4 text-gray-400" size={48} />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Organisations Found</h3>
            <p className="text-gray-600 mb-6">
              You are not a member of any organisation. Please contact your administrator to be added to an organisation.
            </p>

            {isDev && (
              <div className="mt-6 border-t pt-6">
                <button
                  onClick={() => setShowDebug(!showDebug)}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
                >
                  <Bug size={16} />
                  {showDebug ? 'Hide' : 'Show'} Debug Info
                </button>

                {showDebug && debugInfo && (
                  <div className="mt-4 p-4 bg-gray-900 text-gray-100 rounded-lg text-left text-xs font-mono overflow-auto max-h-96">
                    <div className="mb-2 text-amber-400 font-bold">Debug Information:</div>
                    <pre className="whitespace-pre-wrap">{JSON.stringify(debugInfo, null, 2)}</pre>
                    <div className="mt-4 pt-4 border-t border-gray-700">
                      <div className="text-amber-400 font-bold mb-2">Quick Links:</div>
                      <a
                        href="/admin"
                        className="inline-block px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                      >
                        Open Admin Console
                      </a>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
