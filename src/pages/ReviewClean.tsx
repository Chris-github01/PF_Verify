import { useState, useEffect } from 'react';
import { Trash2, Edit2, Check, X, Wand2, AlertCircle, Target, Sparkles, Zap } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { normaliseUnit, normaliseNumber, deriveRate, deriveTotal } from '../lib/normaliser/unitNormaliser';
import { extractAttributes } from '../lib/normaliser/attributeExtractor';
import { calculateConfidence, getConfidenceColor, getConfidenceLabel } from '../lib/normaliser/confidenceScorer';
import { matchLineToSystem } from '../lib/mapping/systemMatcher';
import { getAllSystemLabels } from '../lib/mapping/systemTemplates';
import WorkflowNav from '../components/WorkflowNav';
import { needsQuantity } from '../lib/quoteUtils';

interface Quote {
  id: string;
  supplier_name: string;
  quote_reference: string;
  total_amount: number;
  items_count: number;
  status: string;
  quoted_total?: number;
  reconciliation_status?: string;
  reconciliation_variance?: number;
  reconciliation_notes?: string;
}

interface QuoteItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
  is_excluded: boolean;
  canonical_unit?: string;
  size?: string;
  frr?: string;
  service?: string;
  subclass?: string;
  material?: string;
  confidence?: number;
  issues?: any;
  system_id?: string;
  system_label?: string;
  system_confidence?: number;
  system_needs_review?: boolean;
  system_manual_override?: boolean;
  matched_factors?: any;
  missed_factors?: any;
}

interface ReviewCleanProps {
  projectId: string;
  onNavigateBack?: () => void;
  onNavigateNext?: () => void;
}

export default function ReviewClean({ projectId, onNavigateBack, onNavigateNext }: ReviewCleanProps) {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [selectedQuote, setSelectedQuote] = useState<string | null>(null);
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<QuoteItem>>({});
  const [loading, setLoading] = useState(true);
  const [normalising, setNormalising] = useState(false);
  const [mapping, setMapping] = useState(false);
  const [smartCleaning, setSmartCleaning] = useState(false);
  const [processingAllQuotes, setProcessingAllQuotes] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [showIssues, setShowIssues] = useState<string | null>(null);
  const [showMatchDetails, setShowMatchDetails] = useState<string | null>(null);
  const availableSystems = getAllSystemLabels();

  const updateProjectTimestamp = async () => {
    await supabase
      .from('projects')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', projectId);
  };

  const markReviewCleanComplete = async () => {
    try {
      await supabase
        .from('project_settings')
        .upsert({
          project_id: projectId,
          review_clean_completed: true,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'project_id'
        });
    } catch (error) {
      console.error('Error marking Review & Clean as complete:', error);
    }
  };

  useEffect(() => {
    loadQuotes();
  }, [projectId]);

  useEffect(() => {
    if (selectedQuote) {
      loadItems(selectedQuote);
    }
  }, [selectedQuote]);

  const loadQuotes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('quotes')
      .select('*')
      .eq('project_id', projectId)
      .order('import_date', { ascending: false });

    if (!error && data) {
      setQuotes(data);
      if (data.length > 0 && !selectedQuote) {
        setSelectedQuote(data[0].id);
      }
    }
    setLoading(false);
  };

  const loadItems = async (quoteId: string) => {
    const { data, error } = await supabase
      .from('quote_items')
      .select('*')
      .eq('quote_id', quoteId)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setItems(data);
    }
  };

  const normaliseAllItems = async (itemsToProcess?: QuoteItem[]) => {
    if (!selectedQuote) {
      console.error('normaliseAllItems: No selectedQuote');
      return;
    }

    setNormalising(true);
    setMessage({ type: 'info', text: 'Normalising items...' });

    const targetItems = itemsToProcess || items;
    console.log('normaliseAllItems: Processing', targetItems.length, 'items');

    try {
      const updates = targetItems.map(item => {
        const qty = normaliseNumber(item.quantity);
        const rate = normaliseNumber(item.unit_price);
        let total = normaliseNumber(item.total_price);

        const derivedRate = deriveRate(total, qty);
        const derivedTotal = deriveTotal(qty, rate);

        const finalRate = rate || derivedRate;
        const finalTotal = total || derivedTotal;

        const unitResult = normaliseUnit(item.unit);
        const attributes = extractAttributes(item.description);

        const { confidence, issues } = calculateConfidence(
          item.description,
          qty,
          item.unit,
          unitResult.canonical,
          finalRate,
          finalTotal,
          attributes.confidence
        );

        return {
          id: item.id,
          quantity: qty || item.quantity,
          unit_price: finalRate || item.unit_price,
          total_price: finalTotal || item.total_price,
          canonical_unit: unitResult.canonical || '',
          size: attributes.size || '',
          frr: attributes.frr || '',
          service: attributes.service || '',
          subclass: attributes.subclass || '',
          material: attributes.material || '',
          confidence,
          issues: JSON.stringify(issues),
        };
      });

      console.log('normaliseAllItems: Saving', updates.length, 'updates to database');

      for (const update of updates) {
        const { id, ...data } = update;
        const { error } = await supabase
          .from('quote_items')
          .update(data)
          .eq('id', id);

        if (error) {
          console.error('normaliseAllItems: Error updating item', id, error);
        }
      }

      await updateProjectTimestamp();
      await loadItems(selectedQuote);
      await loadQuotes();

      const lowConfidenceCount = updates.filter(u => u.confidence < 0.6).length;
      console.log('normaliseAllItems: Complete!', updates.length, 'items,', lowConfidenceCount, 'low confidence');
      setMessage({
        type: 'success',
        text: `Normalisation complete! ${updates.length} items processed. ${lowConfidenceCount} items need review.`
      });
    } catch (error) {
      console.error('Normalisation error:', error);
      setMessage({ type: 'error', text: 'Failed to normalise items. Please try again.' });
    } finally {
      setNormalising(false);
    }
  };

  const mapAllItemsToSystems = async (itemsToProcess?: QuoteItem[]) => {
    if (!selectedQuote) {
      console.error('mapAllItemsToSystems: No selectedQuote');
      return;
    }

    setMapping(true);
    setMessage({ type: 'info', text: 'Mapping items to systems...' });

    const targetItems = itemsToProcess || items;
    console.log('mapAllItemsToSystems: Processing', targetItems.length, 'items');

    try {
      const updates = targetItems.map(item => {
        const mappingResult = matchLineToSystem({
          description: item.description,
          size: item.size,
          frr: item.frr,
          service: item.service,
          subclass: item.subclass,
          material: item.material,
        });

        return {
          id: item.id,
          system_id: mappingResult.systemId || '',
          system_label: mappingResult.systemLabel || '',
          system_confidence: mappingResult.confidence,
          system_needs_review: mappingResult.needsReview,
          system_manual_override: false,
          matched_factors: JSON.stringify(mappingResult.matchedFactors),
          missed_factors: JSON.stringify(mappingResult.missedFactors),
        };
      });

      console.log('mapAllItemsToSystems: Saving', updates.length, 'updates to database');

      for (const update of updates) {
        const { id, ...data } = update;
        const { error } = await supabase
          .from('quote_items')
          .update(data)
          .eq('id', id);

        if (error) {
          console.error('mapAllItemsToSystems: Error updating item', id, error);
        }
      }

      await updateProjectTimestamp();
      await loadItems(selectedQuote);
      await markReviewCleanComplete();

      const needsReviewCount = updates.filter(u => u.system_needs_review).length;
      const mappedCount = updates.filter(u => u.system_id).length;
      console.log('mapAllItemsToSystems: Complete!', mappedCount, '/', updates.length, 'mapped,', needsReviewCount, 'need review');
      setMessage({
        type: 'success',
        text: `Mapping complete! ${mappedCount}/${updates.length} items mapped. ${needsReviewCount} need review.`
      });
    } catch (error) {
      console.error('Mapping error:', error);
      setMessage({ type: 'error', text: 'Failed to map items to systems. Please try again.' });
    } finally {
      setMapping(false);
    }
  };

  const smartClean = async (itemsToProcess?: QuoteItem[]) => {
    if (!selectedQuote || normalising || mapping || smartCleaning) return;

    setSmartCleaning(true);
    setMessage({ type: 'info', text: 'Step 1/2: Normalising items...' });

    const targetItems = itemsToProcess || items;

    try {
      let normaliseSuccess = true;

      try {
        await normaliseAllItems(targetItems);
      } catch (error) {
        console.error('Normalise step failed:', error);
        setMessage({ type: 'error', text: 'Normalise failed — please try again.' });
        normaliseSuccess = false;
      }

      if (!normaliseSuccess) {
        return;
      }

      setMessage({ type: 'info', text: 'Step 2/2: Mapping items to systems...' });

      await new Promise(resolve => setTimeout(resolve, 200));

      const { data: refreshedItems } = await supabase
        .from('quote_items')
        .select('*')
        .eq('quote_id', selectedQuote)
        .order('created_at', { ascending: true });

      let mappingSuccess = true;

      try {
        await mapAllItemsToSystems(refreshedItems || targetItems);
      } catch (error) {
        console.error('Mapping step failed:', error);
        setMessage({ type: 'error', text: 'System mapping failed — please review items.' });
        mappingSuccess = false;
      }

      if (!mappingSuccess) {
        return;
      }

      setMessage({
        type: 'success',
        text: 'Smart Clean complete! All items normalised and mapped.'
      });
    } catch (error) {
      console.error('Smart Clean error:', error);
      setMessage({ type: 'error', text: 'Smart Clean failed. Please try individual steps.' });
    } finally {
      setSmartCleaning(false);
    }
  };

  const processAllQuotes = async () => {
    if (normalising || mapping || smartCleaning || processingAllQuotes) return;
    if (quotes.length === 0) return;

    console.log('========== PROCESS ALL QUOTES STARTED ==========');
    console.log('Processing', quotes.length, 'quotes');

    setProcessingAllQuotes(true);

    try {
      for (let i = 0; i < quotes.length; i++) {
        const quote = quotes[i];
        console.log(`\n--- Processing quote ${i + 1}/${quotes.length}: ${quote.supplier_name} ---`);
        setMessage({ type: 'info', text: `Processing quote ${i + 1}/${quotes.length}: ${quote.supplier_name}` });

        setSelectedQuote(quote.id);

        const { data: quoteItems } = await supabase
          .from('quote_items')
          .select('*')
          .eq('quote_id', quote.id)
          .order('created_at', { ascending: true });

        if (!quoteItems || quoteItems.length === 0) {
          console.warn(`No items found for quote ${quote.supplier_name}`);
          continue;
        }

        console.log('Loaded', quoteItems.length, 'items for quote', quote.supplier_name);
        setItems(quoteItems);

        try {
          await smartClean(quoteItems);
          console.log('Successfully processed quote:', quote.supplier_name);
        } catch (error) {
          console.error(`Processing failed for quote ${quote.supplier_name}:`, error);
        }
      }

      console.log('\n========== PROCESS ALL QUOTES COMPLETE ==========');
      setMessage({ type: 'success', text: 'All quotes processed successfully.' });
    } catch (error) {
      console.error('Process All Quotes error:', error);
      setMessage({ type: 'error', text: 'Failed to process all quotes. Some quotes may have been processed.' });
    } finally {
      setProcessingAllQuotes(false);
    }
  };

  const handleSystemOverride = async (itemId: string, systemId: string) => {
    const system = availableSystems.find(s => s.id === systemId);
    if (!system) return;

    const { error } = await supabase
      .from('quote_items')
      .update({
        system_id: systemId,
        system_label: system.label,
        system_manual_override: true,
        system_needs_review: false,
      })
      .eq('id', itemId);

    if (!error && selectedQuote) {
      await updateProjectTimestamp();
      loadItems(selectedQuote);
    }
  };

  const startEdit = (item: QuoteItem) => {
    setEditingItem(item.id);
    setEditForm({
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unit_price: item.unit_price,
      canonical_unit: item.canonical_unit,
      size: item.size,
      frr: item.frr,
      service: item.service,
      subclass: item.subclass,
      material: item.material,
    });
  };

  const cancelEdit = () => {
    setEditingItem(null);
    setEditForm({});
  };

  const saveEdit = async (itemId: string) => {
    const totalPrice = (editForm.quantity || 0) * (editForm.unit_price || 0);

    const unitResult = normaliseUnit(editForm.unit);
    const attributes = extractAttributes(editForm.description || '');

    const { confidence, issues } = calculateConfidence(
      editForm.description,
      editForm.quantity,
      editForm.unit,
      editForm.canonical_unit as any || unitResult.canonical,
      editForm.unit_price,
      totalPrice,
      attributes.confidence
    );

    const { error } = await supabase
      .from('quote_items')
      .update({
        ...editForm,
        total_price: totalPrice,
        canonical_unit: editForm.canonical_unit || unitResult.canonical || '',
        confidence,
        issues: JSON.stringify(issues),
      })
      .eq('id', itemId);

    if (!error) {
      await updateProjectTimestamp();
      setEditingItem(null);
      setEditForm({});
      loadItems(selectedQuote!);
      loadQuotes();
    }
  };

  const toggleExclude = async (itemId: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('quote_items')
      .update({ is_excluded: !currentStatus })
      .eq('id', itemId);

    if (!error && selectedQuote) {
      await updateProjectTimestamp();
      loadItems(selectedQuote);
    }
  };

  const deleteItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    const { error } = await supabase
      .from('quote_items')
      .delete()
      .eq('id', itemId);

    if (!error && selectedQuote) {
      await updateProjectTimestamp();
      loadItems(selectedQuote);
      loadQuotes();
    }
  };

  const deleteQuote = async (quoteId: string) => {
    if (!confirm('Are you sure you want to delete this entire quote?')) return;

    const { error } = await supabase
      .from('quotes')
      .delete()
      .eq('id', quoteId);

    if (!error) {
      if (selectedQuote === quoteId) {
        setSelectedQuote(null);
        setItems([]);
      }
      loadQuotes();
    }
  };

  const getConfidenceBadge = (confidence?: number) => {
    if (confidence === undefined || confidence === 0) {
      return (
        <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
          Not analysed
        </span>
      );
    }

    const color = getConfidenceColor(confidence);
    const label = getConfidenceLabel(confidence);
    const colorClasses = {
      green: 'bg-green-100 text-green-800',
      amber: 'bg-yellow-100 text-yellow-800',
      red: 'bg-red-100 text-red-800',
    };

    return (
      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${colorClasses[color as keyof typeof colorClasses]}`}>
        {label} ({Math.round(confidence * 100)}%)
      </span>
    );
  };

  const parseIssues = (issuesData: any): string[] => {
    if (!issuesData) return [];
    if (typeof issuesData === 'string') {
      try {
        return JSON.parse(issuesData);
      } catch {
        return [];
      }
    }
    if (Array.isArray(issuesData)) return issuesData;
    return [];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading quotes...</div>
      </div>
    );
  }

  if (quotes.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
        <p className="text-gray-500 text-lg">No quotes imported yet.</p>
        <p className="text-gray-400 mt-2">Go to Import Quotes to add your first quote.</p>
      </div>
    );
  }

  const selectedQuoteData = quotes.find(q => q.id === selectedQuote);
  const showReconciliationAlert = selectedQuoteData?.reconciliation_status === 'failed';

  return (
    <div className="space-y-6">
      {showReconciliationAlert && selectedQuoteData && (
        <div className="bg-red-50 border-2 border-red-400 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle size={24} className="text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-bold text-red-900 text-lg">⚠️ Totals Reconciliation Failed</h4>
              <p className="text-red-800 mt-1">{selectedQuoteData.reconciliation_notes}</p>
              <p className="text-red-700 mt-2 text-sm">
                <strong>Variance:</strong> {((selectedQuoteData.reconciliation_variance || 0) * 100).toFixed(2)}%
                {selectedQuoteData.quoted_total && (
                  <>
                    {' | '}
                    <strong>PDF Total:</strong> ${selectedQuoteData.quoted_total.toLocaleString()}
                    {' | '}
                    <strong>Extracted Total:</strong> ${selectedQuoteData.total_amount.toLocaleString()}
                  </>
                )}
              </p>
              <p className="text-red-800 mt-3 font-medium">
                This quote requires manual review. Possible causes: column swap, missing items, or incorrect extraction.
              </p>
            </div>
          </div>
        </div>
      )}

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

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-3">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Quotes</h3>
            </div>
            <div className="divide-y divide-gray-200">
              {quotes.map((quote) => (
                <div
                  key={quote.id}
                  className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                    selectedQuote === quote.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                  }`}
                  onClick={() => setSelectedQuote(quote.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{quote.supplier_name}</p>
                      <p className="text-sm text-gray-500 truncate">{quote.quote_reference || 'No ref'}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-sm font-medium text-gray-900">
                          ${quote.total_amount.toLocaleString()}
                        </span>
                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                          quote.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          quote.status === 'reviewed' ? 'bg-blue-100 text-blue-800' :
                          quote.status === 'accepted' ? 'bg-green-100 text-green-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {quote.status}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteQuote(quote.id);
                      }}
                      className="p-1 text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="col-span-9">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Quote Items</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={normaliseAllItems}
                  disabled={normalising || items.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  <Wand2 size={18} />
                  {normalising ? 'Normalising...' : 'Normalise All'}
                </button>
                <button
                  onClick={smartClean}
                  disabled={smartCleaning || normalising || mapping || items.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                  title="Runs Normalise All and Map Systems together in one step"
                >
                  <Sparkles size={18} />
                  {smartCleaning ? 'Smart Cleaning...' : '⭐ Smart Clean'}
                </button>
                <button
                  onClick={mapAllItemsToSystems}
                  disabled={mapping || items.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  <Target size={18} />
                  {mapping ? 'Mapping...' : 'Map Systems'}
                </button>
                <div className="border-l border-gray-300 h-8 mx-2"></div>
                <button
                  onClick={processAllQuotes}
                  disabled={processingAllQuotes || normalising || mapping || smartCleaning || quotes.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                  title="Process all quotes sequentially with normalise, clean, and map"
                >
                  <Zap size={18} />
                  {processingAllQuotes ? 'Processing All...' : 'Process All Quotes'}
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rate</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Attributes</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Suggest System</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Confidence</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {items.map((item) => {
                    const issues = parseIssues(item.issues);
                    return (
                      <tr key={item.id} className={item.is_excluded ? 'bg-gray-50 opacity-60' : ''}>
                        {editingItem === item.id ? (
                          <>
                            <td className="px-4 py-3">
                              <input
                                type="text"
                                value={editForm.description || ''}
                                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                value={editForm.quantity || ''}
                                onChange={(e) => setEditForm({ ...editForm, quantity: parseFloat(e.target.value) || 0 })}
                                className="w-20 px-2 py-1 border border-gray-300 rounded text-sm text-gray-900"
                                step="0.01"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="text"
                                value={editForm.unit || ''}
                                onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })}
                                className="w-20 px-2 py-1 border border-gray-300 rounded text-sm text-gray-900"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                value={editForm.unit_price || ''}
                                onChange={(e) => setEditForm({ ...editForm, unit_price: parseFloat(e.target.value) || 0 })}
                                className="w-24 px-2 py-1 border border-gray-300 rounded text-sm text-gray-900"
                                step="0.01"
                              />
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              ${((editForm.quantity || 0) * (editForm.unit_price || 0)).toFixed(2)}
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-xs space-y-1">
                                {editForm.canonical_unit && <div>Unit: {editForm.canonical_unit}</div>}
                                {editForm.service && <div>Service: {editForm.service}</div>}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm text-gray-500">Editing...</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm text-gray-500">Editing</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm text-gray-500">-</span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => saveEdit(item.id)}
                                  className="p-1 text-green-600 hover:bg-green-50 rounded"
                                >
                                  <Check size={18} />
                                </button>
                                <button
                                  onClick={cancelEdit}
                                  className="p-1 text-red-600 hover:bg-red-50 rounded"
                                >
                                  <X size={18} />
                                </button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-4 py-3 text-sm text-gray-900 max-w-xs">
                              <div className="flex items-center gap-2">
                                <div className="truncate" title={item.description}>{item.description}</div>
                                {needsQuantity(item) && (
                                  <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800 whitespace-nowrap">
                                    Needs quantity
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">{item.quantity}</td>
                            <td className="px-4 py-3 text-sm">
                              <div>{item.unit}</div>
                              {item.canonical_unit && (
                                <div className="text-xs text-blue-600 font-medium">→ {item.canonical_unit}</div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">${item.unit_price.toFixed(2)}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">${item.total_price.toFixed(2)}</td>
                            <td className="px-4 py-3">
                              <div className="text-xs space-y-1">
                                {item.size && <div className="text-gray-600">Size: {item.size}</div>}
                                {item.frr && <div className="text-gray-600">FRR: {item.frr}</div>}
                                {item.service && <div className="text-blue-600">Service: {item.service}</div>}
                                {item.subclass && <div className="text-gray-600">Type: {item.subclass}</div>}
                                {item.material && <div className="text-gray-600">Material: {item.material}</div>}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {item.system_label ? (
                                <div className="space-y-2">
                                  <div className="flex items-start gap-2">
                                    <div className="flex-1 min-w-0">
                                      <div className="text-xs font-medium text-gray-900 truncate" title={item.system_label}>
                                        {item.system_label}
                                      </div>
                                      <div className="text-xs text-gray-500">{item.system_id}</div>
                                      {item.system_manual_override && (
                                        <div className="text-xs text-blue-600 mt-0.5">Manual override</div>
                                      )}
                                    </div>
                                    {item.system_confidence !== undefined && (
                                      <span className={`inline-flex px-1.5 py-0.5 text-xs font-medium rounded ${
                                        item.system_confidence >= 0.7 ? 'bg-green-100 text-green-800' :
                                        item.system_confidence >= 0.5 ? 'bg-yellow-100 text-yellow-800' :
                                        'bg-red-100 text-red-800'
                                      }`}>
                                        {Math.round(item.system_confidence * 100)}%
                                      </span>
                                    )}
                                  </div>
                                  <select
                                    value={item.system_id || ''}
                                    onChange={(e) => handleSystemOverride(item.id, e.target.value)}
                                    className="w-full text-xs border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                                  >
                                    <option value="">-- Change System --</option>
                                    {availableSystems.map(sys => (
                                      <option key={sys.id} value={sys.id}>{sys.label}</option>
                                    ))}
                                  </select>
                                  {(item.matched_factors || item.missed_factors) && (
                                    <button
                                      onClick={() => setShowMatchDetails(showMatchDetails === item.id ? null : item.id)}
                                      className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                                    >
                                      <AlertCircle size={12} />
                                      Match details
                                    </button>
                                  )}
                                  {showMatchDetails === item.id && (
                                    <div className="mt-1 p-2 bg-gray-50 rounded text-xs">
                                      {item.matched_factors && JSON.parse(item.matched_factors).length > 0 && (
                                        <div className="mb-2">
                                          <div className="font-medium text-green-700 mb-1">Matched:</div>
                                          <ul className="list-disc list-inside text-green-600 space-y-0.5">
                                            {JSON.parse(item.matched_factors).map((factor: string, idx: number) => (
                                              <li key={idx}>{factor}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}
                                      {item.missed_factors && JSON.parse(item.missed_factors).length > 0 && (
                                        <div>
                                          <div className="font-medium text-red-700 mb-1">Missed:</div>
                                          <ul className="list-disc list-inside text-red-600 space-y-0.5">
                                            {JSON.parse(item.missed_factors).map((factor: string, idx: number) => (
                                              <li key={idx}>{factor}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="text-xs text-gray-400">Not mapped</div>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="space-y-1">
                                {getConfidenceBadge(item.confidence)}
                                {issues.length > 0 && (
                                  <button
                                    onClick={() => setShowIssues(showIssues === item.id ? null : item.id)}
                                    className="text-xs text-red-600 hover:text-red-800 flex items-center gap-1"
                                  >
                                    <AlertCircle size={12} />
                                    {issues.length} issue{issues.length !== 1 ? 's' : ''}
                                  </button>
                                )}
                              </div>
                              {showIssues === item.id && issues.length > 0 && (
                                <div className="mt-2 p-2 bg-red-50 rounded text-xs text-red-800">
                                  <ul className="list-disc list-inside space-y-1">
                                    {issues.map((issue, idx) => (
                                      <li key={idx}>{issue}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => toggleExclude(item.id, item.is_excluded)}
                                className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                  item.is_excluded
                                    ? 'bg-red-100 text-red-800 hover:bg-red-200'
                                    : 'bg-green-100 text-green-800 hover:bg-green-200'
                                }`}
                              >
                                {item.is_excluded ? 'Excluded' : 'Included'}
                              </button>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => startEdit(item)}
                                  className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                >
                                  <Edit2 size={16} />
                                </button>
                                <button
                                  onClick={() => deleteItem(item.id)}
                                  className="p-1 text-red-600 hover:bg-red-50 rounded"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <WorkflowNav
        currentStep={2}
        onBack={onNavigateBack}
        onNext={onNavigateNext}
        backLabel="Back: Import Quotes"
        nextLabel="Next: Quote Intelligence"
      />
    </div>
  );
}
