import { useState } from 'react';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import { createOrganisation } from '../../lib/admin/adminApi';
import PageHeader from '../../components/PageHeader';

export default function CreateClient() {
  const [formData, setFormData] = useState({
    name: '',
    tradeType: 'passive_fire',
    trialDays: 14,
    ownerEmail: ''
  });
  const [creating, setCreating] = useState(false);
  const [success, setSuccess] = useState<{
    organisationId: string;
    message: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);

    try {
      const result = await createOrganisation({
        name: formData.name,
        tradeType: formData.tradeType,
        trialDays: formData.trialDays,
        ownerEmail: formData.ownerEmail
      });

      setSuccess({
        organisationId: result.organisationId,
        message: result.message
      });
    } catch (err) {
      console.error('Failed to create organisation:', err);
      setError(err instanceof Error ? err.message : 'Failed to create client');
    } finally {
      setCreating(false);
    }
  };

  if (success) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Client Created Successfully"
          subtitle="The new client organisation is ready"
        />

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 max-w-2xl mx-auto">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle size={32} className="text-green-600" />
            </div>

            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {formData.name} Created!
            </h2>

            <p className="text-gray-600 mb-6">{success.message}</p>

            <div className="bg-gray-50 rounded-lg p-4 text-left space-y-2 mb-6">
              <div className="flex justify-between">
                <span className="text-gray-600">Organisation ID:</span>
                <span className="font-mono text-sm text-gray-900">{success.organisationId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Owner Email:</span>
                <span className="font-medium text-gray-900">{formData.ownerEmail}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Trade:</span>
                <span className="font-medium text-gray-900">
                  {formData.tradeType === 'passive_fire' && 'PassiveFire Verify+'}
                  {formData.tradeType === 'electrical' && 'Electrical Verify+'}
                  {formData.tradeType === 'plumbing' && 'Plumbing Verify+'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Trial Length:</span>
                <span className="font-medium text-gray-900">{formData.trialDays} days</span>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left mb-6">
              <h3 className="font-semibold text-blue-900 mb-2">Next Steps:</h3>
              <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
                <li>Owner must sign up at the app using: <strong>{formData.ownerEmail}</strong></li>
                <li>They'll be automatically added to this organisation</li>
                <li>A default project has been created</li>
                <li>They can start uploading quotes immediately</li>
              </ol>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => window.location.href = '/admin/dashboard'}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
              >
                Back to Dashboard
              </button>
              <button
                onClick={() => {
                  setSuccess(null);
                  setFormData({
                    name: '',
                    tradeType: 'passive_fire',
                    trialDays: 14,
                    ownerEmail: ''
                  });
                }}
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 font-medium"
              >
                Create Another Client
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => window.location.href = '/admin/dashboard'}
          className="p-2 text-gray-600 hover:bg-gray-100 rounded transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <PageHeader
          title="Create New Client"
          subtitle="Set up a new organisation in under 15 seconds"
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Company Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Acme Fire Protection Ltd"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Trade / Product *
            </label>
            <select
              value={formData.tradeType}
              onChange={(e) => setFormData({ ...formData, tradeType: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="passive_fire">PassiveFire Verify+</option>
              <option value="electrical">Electrical Verify+</option>
              <option value="plumbing">Plumbing Verify+</option>
              <option value="mechanical">Mechanical Verify+</option>
              <option value="other">Other</option>
            </select>
            <p className="mt-1 text-sm text-gray-500">
              This determines which ontology and templates are auto-seeded
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Trial Length *
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[7, 14, 30, 60].map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setFormData({ ...formData, trialDays: days })}
                  className={`px-4 py-2 rounded-md font-medium transition-colors ${
                    formData.trialDays === days
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {days} days
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Owner Email *
            </label>
            <input
              type="email"
              required
              value={formData.ownerEmail}
              onChange={(e) => setFormData({ ...formData, ownerEmail: e.target.value })}
              placeholder="owner@company.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="mt-1 text-sm text-gray-500">
              They'll need to sign up with this email to access the organisation
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">What happens next:</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-blue-800">
              <li>Organisation created instantly</li>
              <li>Default project set up</li>
              <li>Owner receives instructions (manual for now)</li>
              <li>Ready to upload quotes immediately</li>
            </ul>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => window.location.href = '/admin/dashboard'}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating}
              className="flex-1 px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {creating ? 'Creating...' : 'Create Client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
