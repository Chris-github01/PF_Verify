import { useState, useEffect, useCallback } from 'react';
import { CheckCircle, X, AlertCircle, ChevronRight, Zap, Filter, TrendingUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useOrganisation } from '../lib/organisationContext';
import PageHeader from '../components/PageHeader';

interface ReviewItem {
  id: string;
  quote_item_id: string;
  quote_id: string;
  project_id: string;
  issue_type: string;
  confidence: number | null;
  priority: string;
  status: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
  system_label: string | null;
  supplier_name: string;
  quote_reference: string;
  project_name: string;
  original_value: any;
  created_at: string;
}

interface ReviewStats {
  total_pending: number;
  in_review: number;
  resolved_today: number;
  critical: number;
  high: number;
  by_issue_type: Record<string, number>;
}

interface EditForm {
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
  system_label: string;
}

export default function ReviewQueue() {
  const { currentOrganisation } = useOrganisation();
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [resolving, setResolving] = useState(false);
  const [notes, setNotes] = useState('');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterIssueType, setFilterIssueType] = useState<string>('all');
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  useEffect(() => {
    if (currentOrganisation?.id) {
      loadQueue();
      loadStats();
    }
  }, [currentOrganisation?.id]);

  const loadQueue = async () => {
    if (!currentOrganisation?.id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('review_queue_with_details')
        .select('*')
        .eq('organisation_id', currentOrganisation.id)
        .in('status', ['pending', 'in_review'])
        .order('priority')
        .order('created_at');

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error('Failed to load review queue:', error);
      setMessage({ type: 'error', text: 'Failed to load review queue' });
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    if (!currentOrganisation?.id) return;

    try {
      const { data, error } = await supabase.rpc('get_review_queue_stats', {
        org_id: currentOrganisation.id
      });

      if (error) throw error;
      setStats(data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const selectItem = (item: ReviewItem) => {
    setSelectedItem(item.id);
    setEditForm({
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unit_price: item.unit_price,
      total_price: item.total_price,
      system_label: item.system_label || ''
    });
    setNotes('');
  };

  const resolveItem = async (skipCorrection: boolean = false) => {
    if (!selectedItem || !editForm) return;

    setResolving(true);
    try {
      if (skipCorrection) {
        await supabase
          .from('review_queue')
          .update({
            status: 'skipped',
            correction_notes: 'Skipped by user',
            resolved_by: (await supabase.auth.getUser()).data.user?.id,
            resolved_at: new Date().toISOString()
          })
          .eq('id', selectedItem);
      } else {
        await supabase.rpc('resolve_review_queue_item', {
          review_id: selectedItem,
          corrected_data: editForm,
          notes: notes || 'Corrected by reviewer'
        });
      }

      setMessage({ type: 'success', text: skipCorrection ? 'Item skipped' : 'Item resolved successfully' });
      await loadQueue();
      await loadStats();

      const currentIndex = items.findIndex(item => item.id === selectedItem);
      if (currentIndex < items.length - 1) {
        selectItem(items[currentIndex + 1]);
      } else {
        setSelectedItem(null);
        setEditForm(null);
      }
    } catch (error) {
      console.error('Failed to resolve item:', error);
      setMessage({ type: 'error', text: 'Failed to resolve item' });
    } finally {
      setResolving(false);
    }
  };

  const handleKeyPress = useCallback((e: KeyboardEvent) => {
    if (!selectedItem) return;

    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      resolveItem(false);
    } else if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      resolveItem(true);
    }
  }, [selectedItem, editForm]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-300';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getIssueTypeLabel = (issueType: string) => {
    const labels: Record<string, string> = {
      'low_confidence': 'Low Confidence',
      'missing_quantity': 'Missing Quantity',
      'missing_unit': 'Missing Unit',
      'invalid_unit': 'Invalid Unit',
      'unclear_description': 'Unclear Description',
      'arithmetic_error': 'Arithmetic Error',
      'system_match_unclear': 'System Match Unclear',
      'duplicate_suspected': 'Duplicate Suspected',
      'outlier_price': 'Outlier Price'
    };
    return labels[issueType] || issueType;
  };

  const filteredItems = items.filter(item => {
    if (filterPriority !== 'all' && item.priority !== filterPriority) return false;
    if (filterIssueType !== 'all' && item.issue_type !== filterIssueType) return false;
    return true;
  });

  const selectedItemData = items.find(item => item.id === selectedItem);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading review queue...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Review Queue"
        subtitle="Items requiring human review and correction"
      />

      {message && (
        <div className={`p-4 rounded-md ${
          message.type === 'success' ? 'bg-green-50 text-green-800' :
          message.type === 'error' ? 'bg-red-50 text-red-800' :
          'bg-blue-50 text-blue-800'
        }`}>
          <div className="flex items-start gap-2">
            <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
            <span>{message.text}</span>
          </div>
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-5 gap-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-sm text-gray-600">Pending</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{stats.total_pending}</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-sm text-gray-600">In Review</div>
            <div className="text-2xl font-bold text-blue-600 mt-1">{stats.in_review}</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-sm text-gray-600">Resolved Today</div>
            <div className="text-2xl font-bold text-green-600 mt-1">{stats.resolved_today}</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-red-200 p-4">
            <div className="text-sm text-red-600">Critical Priority</div>
            <div className="text-2xl font-bold text-red-600 mt-1">{stats.critical}</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-orange-200 p-4">
            <div className="text-sm text-orange-600">High Priority</div>
            <div className="text-2xl font-bold text-orange-600 mt-1">{stats.high}</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-5">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900">Items Needing Review</h3>
                <span className="text-sm text-gray-600">{filteredItems.length} items</span>
              </div>

              <div className="flex gap-2">
                <select
                  value={filterPriority}
                  onChange={(e) => setFilterPriority(e.target.value)}
                  className="flex-1 px-3 py-1 text-sm border border-gray-300 rounded-md"
                >
                  <option value="all">All Priorities</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>

                <select
                  value={filterIssueType}
                  onChange={(e) => setFilterIssueType(e.target.value)}
                  className="flex-1 px-3 py-1 text-sm border border-gray-300 rounded-md"
                >
                  <option value="all">All Issue Types</option>
                  <option value="low_confidence">Low Confidence</option>
                  <option value="missing_quantity">Missing Quantity</option>
                  <option value="system_match_unclear">System Match Unclear</option>
                </select>
              </div>
            </div>

            <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
              {filteredItems.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <CheckCircle size={48} className="mx-auto mb-3 text-green-500" />
                  <p className="font-medium">All clear!</p>
                  <p className="text-sm mt-1">No items need review</p>
                </div>
              ) : (
                filteredItems.map((item) => (
                  <div
                    key={item.id}
                    className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                      selectedItem === item.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                    }`}
                    onClick={() => selectItem(item)}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded border ${getPriorityColor(item.priority)}`}>
                        {item.priority.toUpperCase()}
                      </span>
                      <span className="text-xs text-gray-500">{getIssueTypeLabel(item.issue_type)}</span>
                    </div>

                    <p className="text-sm font-medium text-gray-900 mb-1 line-clamp-2">
                      {item.description}
                    </p>

                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <span>{item.supplier_name}</span>
                      <span>•</span>
                      <span>{item.project_name}</span>
                    </div>

                    {item.confidence !== null && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${
                              item.confidence < 0.5 ? 'bg-red-600' :
                              item.confidence < 0.75 ? 'bg-yellow-600' :
                              'bg-green-600'
                            }`}
                            style={{ width: `${(item.confidence * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-600">{(item.confidence * 100).toFixed(0)}%</span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="col-span-7">
          {!selectedItemData ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
              <ChevronRight size={48} className="mx-auto mb-3 text-gray-400" />
              <p className="text-gray-500">Select an item to review and edit</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">Review & Correct</h3>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded border ${getPriorityColor(selectedItemData.priority)}`}>
                      {selectedItemData.priority.toUpperCase()}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  Issue: <span className="font-medium">{getIssueTypeLabel(selectedItemData.issue_type)}</span>
                </p>
              </div>

              <div className="p-6 space-y-4">
                <div className="bg-gray-50 border border-gray-200 rounded-md p-3 mb-4">
                  <div className="text-xs font-medium text-gray-600 mb-1">Context</div>
                  <div className="text-sm text-gray-900">
                    <strong>{selectedItemData.supplier_name}</strong> • {selectedItemData.project_name}
                  </div>
                  {selectedItemData.confidence !== null && (
                    <div className="text-sm text-gray-600 mt-1">
                      Confidence: {(selectedItemData.confidence * 100).toFixed(1)}%
                    </div>
                  )}
                </div>

                {editForm && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description
                      </label>
                      <textarea
                        value={editForm.description}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Quantity
                        </label>
                        <input
                          type="number"
                          value={editForm.quantity}
                          onChange={(e) => setEditForm({ ...editForm, quantity: parseFloat(e.target.value) || 0 })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Unit
                        </label>
                        <input
                          type="text"
                          value={editForm.unit}
                          onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Unit Price ($)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={editForm.unit_price}
                          onChange={(e) => setEditForm({ ...editForm, unit_price: parseFloat(e.target.value) || 0 })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Total Price ($)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={editForm.total_price}
                          onChange={(e) => setEditForm({ ...editForm, total_price: parseFloat(e.target.value) || 0 })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        System Label
                      </label>
                      <input
                        type="text"
                        value={editForm.system_label}
                        onChange={(e) => setEditForm({ ...editForm, system_label: e.target.value })}
                        placeholder="e.g., Hilti CFS-F, Nullifire FS702"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Correction Notes
                      </label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={2}
                        placeholder="Optional: Explain what was corrected..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div className="flex gap-3 pt-4 border-t border-gray-200">
                      <button
                        onClick={() => resolveItem(false)}
                        disabled={resolving}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:bg-gray-400 font-medium"
                      >
                        <CheckCircle size={18} />
                        {resolving ? 'Saving...' : 'Save & Resolve'}
                        <span className="text-xs opacity-80">(Ctrl+Enter)</span>
                      </button>

                      <button
                        onClick={() => resolveItem(true)}
                        disabled={resolving}
                        className="flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors disabled:bg-gray-200"
                      >
                        <X size={18} />
                        Skip
                        <span className="text-xs opacity-80">(Ctrl+S)</span>
                      </button>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-blue-800">
                      <div className="font-medium mb-1">Keyboard Shortcuts</div>
                      <div className="text-xs space-y-1">
                        <div><kbd className="px-1.5 py-0.5 bg-white border border-blue-300 rounded">Ctrl + Enter</kbd> Save & Resolve</div>
                        <div><kbd className="px-1.5 py-0.5 bg-white border border-blue-300 rounded">Ctrl + S</kbd> Skip Item</div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
