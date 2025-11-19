import { Plus, FolderOpen } from 'lucide-react';
import PageHeader from '../components/PageHeader';

interface NewProjectDashboardProps {
  projectId: string | null;
  projectName?: string;
  allProjects: any[];
  onProjectSelect: (id: string) => void;
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
  onNavigateToQuotes,
}: NewProjectDashboardProps) {
  return (
    <div className="p-8">
      <PageHeader
        title={projectId ? projectName || 'Project Dashboard' : 'All Projects'}
        description={projectId ? 'Manage your quote analysis workflow' : 'Select or create a project'}
      />

      {!projectId ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
          <button className="p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors">
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
