import { useState, useEffect } from 'react';
import { FileText, Plus, Edit, Copy, Trash2, ChevronLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import TemplateEditorModal from '../components/TemplateEditorModal';
import { t } from '../i18n';

interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  trade: string;
  is_default: boolean;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
  project_settings: Record<string, any>;
  analysis_settings: Record<string, any>;
  report_settings: Record<string, any>;
  compliance_settings: Record<string, any>;
}

interface ProjectTemplatesProps {
  onBack: () => void;
  onNavigateToNewProject?: () => void;
}

export default function ProjectTemplates({ onBack, onNavigateToNewProject }: ProjectTemplatesProps) {
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ProjectTemplate | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingTemplate, setDeletingTemplate] = useState<ProjectTemplate | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('project_templates')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error loading templates:', error);
      setToast({ type: 'error', message: t('projectTemplates.toasts.loadError') });
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = (template: ProjectTemplate) => {
    setDeletingTemplate(template);
    setShowDeleteDialog(true);
  };

  const handleDelete = async () => {
    if (!deletingTemplate) return;

    try {
      const { error } = await supabase
        .from('project_templates')
        .delete()
        .eq('id', deletingTemplate.id);

      if (error) throw error;

      setToast({
        type: 'success',
        message: t('projectTemplates.toasts.deleteSuccess', { templateName: deletingTemplate.name })
      });
      await loadTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      setToast({ type: 'error', message: t('projectTemplates.toasts.loadError') });
    } finally {
      setShowDeleteDialog(false);
      setDeletingTemplate(null);
    }
  };

  const handleDuplicate = async (template: ProjectTemplate) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;

      if (!userId) {
        setToast({ type: 'error', message: 'You must be logged in to duplicate templates' });
        return;
      }

      const newName = `${template.name} (Copy)`;

      const { error } = await supabase
        .from('project_templates')
        .insert({
          name: newName,
          description: template.description,
          trade: template.trade,
          is_default: false,
          created_by_user_id: userId,
          project_settings: template.project_settings,
          analysis_settings: template.analysis_settings,
          report_settings: template.report_settings,
          compliance_settings: template.compliance_settings,
        });

      if (error) throw error;

      setToast({
        type: 'success',
        message: t('projectTemplates.toasts.duplicateSuccess', { newTemplateName: newName })
      });
      await loadTemplates();
    } catch (error) {
      console.error('Error duplicating template:', error);
      setToast({ type: 'error', message: t('projectTemplates.toasts.loadError') });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-NZ', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-600">Loading templates...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {toast && (
        <div className={`mb-4 p-4 rounded-lg ${toast.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {toast.message}
        </div>
      )}

      <div className="mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
        >
          <ChevronLeft size={20} />
          <span className="text-sm font-medium">{t('projectTemplates.backToLibrary')}</span>
        </button>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold brand-navy">{t('projectTemplates.pageTitle')}</h1>
              <p className="text-gray-600 text-base">
                {t('projectTemplates.pageSubtitle')}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setEditingTemplate(null);
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-blue-600 transition-colors font-medium text-sm"
          >
            <Plus size={18} />
            {t('projectTemplates.newTemplateButton')}
          </button>
        </div>
      </div>

      {templates.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <div className="max-w-md mx-auto">
            <div className="w-16 h-16 bg-gray-50 rounded-xl flex items-center justify-center mx-auto mb-4">
              <FileText size={32} className="text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {t('projectTemplates.emptyState.title')}
            </h3>
            <p className="text-gray-600 text-sm mb-6 leading-relaxed">
              {t('projectTemplates.emptyState.body')}
            </p>
            <button
              onClick={() => {
                setEditingTemplate(null);
                setShowModal(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-blue-600 transition-colors font-medium text-sm"
            >
              <Plus size={18} />
              {t('projectTemplates.emptyState.button')}
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    {t('projectTemplates.table.columns.template')}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    {t('projectTemplates.table.columns.trade')}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    {t('projectTemplates.table.columns.description')}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    {t('projectTemplates.table.columns.lastUpdated')}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    {t('projectTemplates.table.columns.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {templates.map((template) => (
                  <tr key={template.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{template.name}</span>
                        {template.is_default && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                            Default
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-700">{template.trade}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600 line-clamp-2">{template.description || '—'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600">{formatDate(template.updated_at)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onNavigateToNewProject?.()}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title={t('projectTemplates.table.rowActions.applyToNewProject')}
                        >
                          <Plus size={16} />
                        </button>
                        <button
                          onClick={() => {
                            setEditingTemplate(template);
                            setShowModal(true);
                          }}
                          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                          title={t('projectTemplates.table.rowActions.edit')}
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDuplicate(template)}
                          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                          title={t('projectTemplates.table.rowActions.duplicate')}
                        >
                          <Copy size={16} />
                        </button>
                        <button
                          onClick={() => confirmDelete(template)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title={t('projectTemplates.table.rowActions.delete')}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <TemplateEditorModal
          template={editingTemplate}
          onClose={() => {
            setShowModal(false);
            setEditingTemplate(null);
          }}
          onSave={(templateName: string) => {
            setToast({
              type: 'success',
              message: editingTemplate
                ? t('projectTemplates.toasts.updateSuccess', { templateName })
                : t('projectTemplates.toasts.createSuccess', { templateName })
            });
            loadTemplates();
          }}
        />
      )}

      {showDeleteDialog && deletingTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                {t('projectTemplates.deleteDialog.title')}
              </h2>
            </div>

            <div className="px-6 py-4">
              <p className="text-gray-700">
                {t('projectTemplates.deleteDialog.body', { templateName: deletingTemplate.name })}
              </p>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteDialog(false);
                  setDeletingTemplate(null);
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors font-medium text-sm"
              >
                {t('projectTemplates.deleteDialog.cancel')}
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium text-sm"
              >
                {t('projectTemplates.deleteDialog.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
