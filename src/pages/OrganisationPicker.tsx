import { Building2, Plus, AlertCircle, Loader2 } from 'lucide-react';
import { useOrganisation } from '../lib/organisationContext';
import { supabase } from '../lib/supabase';
import { useState } from 'react';

interface OrganisationPickerProps {
  onOrganisationSelected: () => void;
}

export default function OrganisationPicker({ onOrganisationSelected }: OrganisationPickerProps) {
  const { organisations, setCurrentOrganisation, loading, refreshOrganisations } = useOrganisation();
  const [creatingOrg, setCreatingOrg] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [error, setError] = useState('');

  const handleSelect = (org: any) => {
    setCurrentOrganisation(org);
    onOrganisationSelected();
  };

  const handleCreateOrganisation = async () => {
    if (!newOrgName.trim()) {
      setError('Please enter an organisation name');
      return;
    }

    setError('');
    setCreatingOrg(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('Not authenticated');
        setCreatingOrg(false);
        return;
      }

      const { data: newOrg, error: orgError } = await supabase
        .from('organisations')
        .insert({
          name: newOrgName.trim(),
          created_by_user_id: user.id,
          status: 'active'
        })
        .select()
        .single();

      if (orgError) throw orgError;

      await supabase
        .from('organisation_members')
        .insert({
          organisation_id: newOrg.id,
          user_id: user.id,
          role: 'admin',
          status: 'active'
        });

      await refreshOrganisations();
      setNewOrgName('');
      setError('');

      setCurrentOrganisation(newOrg);
      onOrganisationSelected();
    } catch (err: any) {
      setError(err.message || 'Failed to create organisation');
    } finally {
      setCreatingOrg(false);
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
        ) : (
          <div className="text-center py-8">
            <AlertCircle className="mx-auto mb-4 text-gray-400" size={48} />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Organisations Found</h3>
            <p className="text-gray-600 mb-6">You are not a member of any organisation yet. Create one to get started.</p>

            <div className="space-y-3">
              <input
                type="text"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleCreateOrganisation()}
                placeholder="Organisation name"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={creatingOrg}
              />

              {error && (
                <div className="text-red-600 text-sm">{error}</div>
              )}

              <button
                onClick={handleCreateOrganisation}
                disabled={creatingOrg}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {creatingOrg ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus size={20} />
                    Create Organisation
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
