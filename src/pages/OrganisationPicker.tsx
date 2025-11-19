import { Building2 } from 'lucide-react';
import { useOrganisation } from '../lib/organisationContext';

interface OrganisationPickerProps {
  onOrganisationSelected: () => void;
}

export default function OrganisationPicker({ onOrganisationSelected }: OrganisationPickerProps) {
  const { organisations, setCurrentOrganisation } = useOrganisation();

  const handleSelect = (org: any) => {
    setCurrentOrganisation(org);
    onOrganisationSelected();
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-6">
          <Building2 className="mx-auto mb-4 text-blue-600" size={48} />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Select Organisation</h1>
          <p className="text-gray-600">Choose which organisation to work with</p>
        </div>

        <div className="space-y-3">
          {organisations.map((org) => (
            <button
              key={org.id}
              onClick={() => handleSelect(org)}
              className="w-full p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-left"
            >
              <div className="font-semibold text-gray-900">{org.name}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
