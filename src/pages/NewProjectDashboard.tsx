import { useState } from 'react';
import { Plus, FolderOpen, X } from 'lucide-react';
import PageHeader from '../components/PageHeader';

interface NewProjectDashboardProps {
  projectId: string | null;
  projectName?: string;
  allProjects: any[];
  onProjectSelect: (id: string) => void;
  onCreateProject: (name: string, client: string, reference: string) => Promise<string | null>;
  onNavigateToQuotes: () => void;
  onNavigateToMatrix: () => void;
  onNavigateToReports: () => void;
  onNavigateToLibrary: () => void;
}

export default function NewProjectDashboard({
  projectId,
  projectName,
  allProjects,
  onProjectSelect,
  onCreateProject,
  onNavigateToQuotes,
}: NewProjectDashboardProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectClient, setNewProjectClient] = useState('');
  const [newProjectReference, setNewProjectReference] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateClick = () => {
    setShowCreateModal(true);
  };

  const handleCloseModal = () => {
    setShowCreateModal(false);
    setNewProjectName('');
    setNewProjectClient('');
    setNewProjectReference('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    setIsCreating(true);
    const projectId = await onCreateProject(newProjectName, newProjectClient, newProjectReference);
    setIsCreating(false);

    if (projectId) {
      handleCloseModal();
    }
  };

  return (
    <div className="p-8">
      <PageHeader
        title={projectId ? projectName || 'Project Dashboard' : 'All Projects'}
        description={projectId ? 'Manage your quote analysis workflow' : 'Select or create a project'}
      />

      {!projectId ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
            <button
              onClick={handleCreateClick}
              className="p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
            >
              <Plus className="mx-auto mb-2 text-gray-400" size={32} />
              <div className="font-medium">Create New Project</div>
            </button>

          {allProjects.map((project) => (
            <button
              key={project.id}
              onClick={() => onProjectSelect(project.id)}
              className="p-6 border border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-md transition-all text-left"
            >
              <FolderOpen className="mb-2 text-blue-600" size={24} />
              <div className="font-semibold text-gray-900 mb-1">{project.name}</div>
              <div className="text-sm text-gray-500">{project.client_reference}</div>
            </button>
          ))}
        </div>

        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Create New Project</h2>
                <button
                  onClick={handleCloseModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="projectName" className="block text-sm font-medium text-gray-700 mb-1">
                      Project Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="projectName"
                      type="text"
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter project name"
                      required
                      autoFocus
                    />
                  </div>

                  <div>
                    <label htmlFor="projectClient" className="block text-sm font-medium text-gray-700 mb-1">
                      Client Name
                    </label>
                    <input
                      id="projectClient"
                      type="text"
                      value={newProjectClient}
                      onChange={(e) => setNewProjectClient(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter client name"
                    />
                  </div>

                  <div>
                    <label htmlFor="projectReference" className="block text-sm font-medium text-gray-700 mb-1">
                      Project Reference
                    </label>
                    <input
                      id="projectReference"
                      type="text"
                      value={newProjectReference}
                      onChange={(e) => setNewProjectReference(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter project reference"
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                    disabled={isCreating}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                    disabled={isCreating || !newProjectName.trim()}
                  >
                    {isCreating ? 'Creating...' : 'Create Project'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          <button
            onClick={onNavigateToQuotes}
            className="p-6 bg-white border border-gray-200 rounded-lg hover:shadow-lg transition-shadow"
          >
            <div className="text-2xl font-bold text-blue-600 mb-2">Import Quotes</div>
            <p className="text-sm text-gray-600">Upload and parse supplier quotes</p>
          </button>
        </div>
      )}
    </div>
  );
}
