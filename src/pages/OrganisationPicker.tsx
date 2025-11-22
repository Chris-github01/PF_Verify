import { Building2, AlertCircle, Loader2, ChevronDown } from 'lucide-react';
import { useOrganisation } from '../lib/organisationContext';
import { useState } from 'react';

interface OrganisationPickerProps {
  onOrganisationSelected: () => void;
}

export default function OrganisationPicker({ onOrganisationSelected }: OrganisationPickerProps) {
  const { organisations, setCurrentOrganisation, loading } = useOrganisation();
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [error, setError] = useState('');

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
          </div>
        )}
      </div>
    </div>
  );
}
