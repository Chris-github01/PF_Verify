import { useState, useEffect } from 'react';
import {
  Plus,
  FolderOpen,
  X,
  FileText,
  TrendingUp,
  Building2,
  Clock,
  CheckCircle2,
  Circle,
  ArrowRight
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { supabase } from '../lib/supabase';
import { useOrganisation } from '../lib/organisationContext';

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

interface StepStatus {
  id: string;
  name: string;
  status: 'not_started' | 'in_progress' | 'completed';
  route: string;
}

interface ProjectStats {
  quoteCount: number;
  totalValue: number;
  supplierCount: number;
  hasQuotes: boolean;
  hasReviewedItems: boolean;
  hasScopeMatrix: boolean;
  hasReports: boolean;
}

export default function NewProjectDashboard({
  projectId,
  projectName,
  allProjects,
  onProjectSelect,
  onCreateProject,
  onNavigateToQuotes,
  onNavigateToMatrix,
  onNavigateToReports,
  onNavigateToLibrary,
}: NewProjectDashboardProps) {
  const { currentOrganisation } = useOrganisation();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectClient, setNewProjectClient] = useState('');
  const [newProjectReference, setNewProjectReference] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ProjectStats>({
    quoteCount: 0,
    totalValue: 0,
    supplierCount: 0,
    hasQuotes: false,
    hasReviewedItems: false,
    hasScopeMatrix: false,
    hasReports: false,
  });
  const [steps, setSteps] = useState<StepStatus[]>([]);

  useEffect(() => {
    if (projectId) {
      loadProjectData();
    } else {
      setLoading(false);
    }
  }, [projectId]);

  const loadProjectData = async () => {
    if (!projectId) return;

    setLoading(true);
    try {
      const { data: quotes } = await supabase
        .from('quotes')
        .select('id, supplier_name, total_amount')
        .eq('project_id', projectId);

      const quoteCount = quotes?.length || 0;
      const totalValue = quotes?.reduce((sum, q) => sum + (q.total_amount || 0), 0) || 0;
      const supplierCount = new Set(quotes?.map(q => q.supplier_name)).size;

      const { data: settings } = await supabase
        .from('project_settings')
        .select('*')
        .eq('project_id', projectId)
        .maybeSingle();

      const { data: reportsList } = await supabase
        .from('award_reports')
        .select('id')
        .eq('project_id', projectId)
        .eq('status', 'ready');

      const newStats: ProjectStats = {
        quoteCount,
        totalValue,
        supplierCount,
        hasQuotes: quoteCount > 0,
        hasReviewedItems: settings?.review_clean_completed || false,
        hasScopeMatrix: settings?.scope_matrix_completed || false,
        hasReports: (reportsList?.length || 0) > 0,
      };

      setStats(newStats);
      updateStepStatuses(newStats);
    } catch (error) {
      console.error('Error loading project data:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateStepStatuses = (projectStats: ProjectStats) => {
    const updatedSteps: StepStatus[] = [
      {
        id: 'import',
        name: 'Import Quotes',
        status: projectStats.hasQuotes ? 'completed' : 'not_started',
        route: 'quotes'
      },
      {
        id: 'review',
        name: 'Review & Clean',
        status: projectStats.hasReviewedItems ? 'completed' : projectStats.hasQuotes ? 'in_progress' : 'not_started',
        route: 'review-clean'
      },
      {
        id: 'queue',
        name: 'Review Queue',
        status: projectStats.hasReviewedItems ? 'completed' : 'not_started',
        route: 'review-queue'
      },
      {
        id: 'intelligence',
        name: 'Quote Intelligence',
        status: projectStats.hasReviewedItems ? 'completed' : 'not_started',
        route: 'quote-intelligence'
      },
      {
        id: 'matrix',
        name: 'Scope Matrix',
        status: projectStats.hasScopeMatrix ? 'completed' : projectStats.hasReviewedItems ? 'in_progress' : 'not_started',
        route: 'scope-matrix'
      },
      {
        id: 'reports',
        name: 'Reports',
        status: projectStats.hasReports ? 'completed' : 'not_started',
        route: 'reports'
      },
    ];
    setSteps(updatedSteps);
  };

  const handleNavigateToStep = (route: string) => {
    switch (route) {
      case 'quotes':
        onNavigateToQuotes();
        break;
      case 'scope-matrix':
        onNavigateToMatrix();
        break;
      case 'reports':
        onNavigateToReports();
        break;
      case 'library':
        onNavigateToLibrary();
        break;
      default:
        console.log('Navigation to', route, 'not yet implemented');
    }
  };

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
      ) : loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-400">Loading project dashboard...</div>
        </div>
      ) : (
        <div className="space-y-6 mt-6">
          <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg p-6 border border-blue-500/20">
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
              <Building2 size={16} />
              <span>Organisation: {currentOrganisation?.name || 'Loading...'}</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Project: {projectName || 'Unnamed Project'}</h2>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <Clock size={14} />
                <span>Last updated: {new Date().toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <FileText className="text-blue-600" size={24} />
                <h3 className="text-lg font-semibold text-gray-900">Quotes</h3>
              </div>
              <p className="text-3xl font-bold text-gray-900">{stats.quoteCount}</p>
              <p className="text-sm text-gray-600 mt-1">
                from {stats.supplierCount} {stats.supplierCount === 1 ? 'supplier' : 'suppliers'}
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="text-green-600" size={24} />
                <h3 className="text-lg font-semibold text-gray-900">Total Value</h3>
              </div>
              <p className="text-3xl font-bold text-gray-900">
                ${stats.totalValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
              <p className="text-sm text-gray-600 mt-1">Combined quote value</p>
            </div>

            <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <FolderOpen className="text-purple-600" size={24} />
                <h3 className="text-lg font-semibold text-gray-900">Progress</h3>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-3xl font-bold text-gray-900">
                  {steps.filter(s => s.status === 'completed').length}/{steps.length}
                </div>
              </div>
              <p className="text-sm text-gray-600 mt-1">Steps completed</p>
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Project Workflow</h2>
            <div className="space-y-3">
              {steps.map((step, index) => (
                <button
                  key={step.id}
                  onClick={() => handleNavigateToStep(step.route)}
                  className="w-full flex items-center gap-4 p-4 bg-gray-50 hover:bg-blue-50 rounded-lg transition-colors border border-gray-200 hover:border-blue-300 text-left"
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-200 text-sm font-semibold text-gray-700">
                    {index + 1}
                  </div>
                  <div className="flex items-center gap-3 flex-1">
                    {step.status === 'completed' ? (
                      <CheckCircle2 className="text-green-600" size={24} />
                    ) : step.status === 'in_progress' ? (
                      <Circle className="text-blue-600 fill-blue-100" size={24} />
                    ) : (
                      <Circle className="text-gray-400" size={24} />
                    )}
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{step.name}</div>
                      <div className="text-xs text-gray-500 capitalize">{step.status.replace('_', ' ')}</div>
                    </div>
                  </div>
                  <ArrowRight className="text-gray-400" size={20} />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
