import { Building2, Plus, AlertCircle, Loader2, ChevronDown } from 'lucide-react';
import { useOrganisation } from '../lib/organisationContext';
import { supabase } from '../lib/supabase';
import { useState } from 'react';

interface OrganisationPickerProps {
  onOrganisationSelected: () => void;
}

export default function OrganisationPicker({ onOrganisationSelected }: OrganisationPickerProps) {
  const { organisations, setCurrentOrganisation, loading, refreshOrganisations } = useOrganisation();
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creatingOrg, setCreatingOrg] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
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
      setShowCreateForm(false);

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

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">or</span>
              </div>
            </div>

            {showCreateForm ? (
              <div className="space-y-3 pt-2">
                <input
                  type="text"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleCreateOrganisation()}
                  placeholder="New organisation name"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                  disabled={creatingOrg}
                  autoFocus
                />

                <div className="flex gap-2">
                  <button
                    onClick={handleCreateOrganisation}
                    disabled={creatingOrg}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 font-medium"
                  >
                    {creatingOrg ? (
                      <>
                        <Loader2 size={20} className="animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Plus size={20} />
                        Create
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setShowCreateForm(false);
                      setNewOrgName('');
                      setError('');
                    }}
                    disabled={creatingOrg}
                    className="px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => {
                  setShowCreateForm(true);
                  setError('');
                }}
                className="w-full px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium flex items-center justify-center gap-2"
              >
                <Plus size={20} />
                Create New Organisation
              </button>
            )}
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
