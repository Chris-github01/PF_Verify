import { useState, useEffect } from 'react';
import { Download, Filter, X, AlertCircle, Lightbulb, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getModelRateProvider } from '../lib/modelRate/modelRateProvider';
import { compareAgainstModelHybrid } from '../lib/comparison/hybridCompareAgainstModel';
import type { ComparisonRow, MatrixRow, MatrixCell, MatrixFilters } from '../types/comparison.types';
import WorkflowNav from '../components/WorkflowNav';
import { needsQuantity } from '../lib/quoteUtils';
import { useSuggestedSystems } from '../lib/useSuggestedSystems';
import SuggestedSystemsPanel from '../components/SuggestedSystemsPanel';
import { useOrganisation } from '../lib/organisationContext';

interface ScopeMatrixProps {
  projectId: string;
  onNavigateBack?: () => void;
  onNavigateNext?: () => void;
}

const getFlagColor = (flag: string): string => {
  switch (flag) {
    case 'GREEN':
      return 'bg-green-100 text-green-900 border-green-300';
    case 'AMBER':
      return 'bg-amber-100 text-amber-900 border-amber-300';
    case 'RED':
      return 'bg-red-100 text-red-900 border-red-300';
    default:
      return 'bg-gray-100 text-gray-600 border-gray-300';
  }
};

export default function ScopeMatrix({ projectId, onNavigateBack, onNavigateNext }: ScopeMatrixProps) {
  const [comparisonData, setComparisonData] = useState<ComparisonRow[]>([]);
  const [matrixRows, setMatrixRows] = useState<MatrixRow[]>([]);
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [itemsWithMissingQty, setItemsWithMissingQty] = useState<Set<string>>(new Set());
  const [showSuggestedSystems, setShowSuggestedSystems] = useState(false);
  const [showMoreInfo, setShowMoreInfo] = useState(false);
  const { currentOrganisation } = useOrganisation();
  const organisationId = currentOrganisation?.id || '';
  const { suggestions } = useSuggestedSystems(projectId);

  const [filters, setFilters] = useState<MatrixFilters>({});
  const [availableFilters, setAvailableFilters] = useState({
    sections: [] as string[],
    services: [] as string[],
    subclasses: [] as string[],
    frrs: [] as string[],
    sizeBuckets: [] as string[],
  });

  useEffect(() => {
    loadData();
  }, [projectId]);

  useEffect(() => {
    buildMatrix();
  }, [comparisonData, filters]);

  const loadData = async () => {
    setLoading(true);

    try {
      const { data: quotesData } = await supabase
        .from('quotes')
        .select('id, supplier_name')
        .eq('project_id', projectId)
        .order('supplier_name');

      if (!quotesData || quotesData.length === 0) {
        setLoading(false);
        return;
      }

      const quoteIds = quotesData.map(q => q.id);

      const { data: itemsData } = await supabase
        .from('quote_items')
        .select('*')
        .in('quote_id', quoteIds);

      if (!itemsData) {
        setLoading(false);
        return;
      }

      const missingQtySet = new Set(
        itemsData
          .filter(item => needsQuantity(item))
          .map(item => item.id)
      );
      setItemsWithMissingQty(missingQtySet);

      const normalisedLines = itemsData.map(item => {
        const quote = quotesData.find(q => q.id === item.quote_id);
        return {
          quoteId: item.quote_id,
          quoteItemId: item.id,
          supplier: quote?.supplier_name || 'Unknown',
          originalDescription: item.description,
          quantity: item.quantity || 1,
          rate: item.unit_price,
          total: item.total_price,
          section: item.section,
          service: item.service,
          subclass: item.subclass,
          frr: item.frr,
          size: item.size,
        };
      });

      const mappings = itemsData.map(item => ({
        quoteItemId: item.id,
        systemId: item.system_id,
        systemLabel: item.system_label,
      }));

      const provider = getModelRateProvider(projectId);
      await provider.loadSettings();

      const comparisons = await compareAgainstModelHybrid(
        normalisedLines,
        mappings,
        (criteria) => provider.getModelRate(criteria)
      );

      setComparisonData(comparisons);
      extractAvailableFilters(comparisons);

      await supabase
        .from('project_settings')
        .upsert({
          project_id: projectId,
          scope_matrix_completed: true,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'project_id'
        });
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const extractAvailableFilters = (data: ComparisonRow[]) => {
    const sections = new Set<string>();
    const services = new Set<string>();
    const subclasses = new Set<string>();
    const frrs = new Set<string>();
    const sizeBuckets = new Set<string>();

    data.forEach(row => {
      if (row.section) sections.add(row.section);
      if (row.service) services.add(row.service);
      if (row.subclass) subclasses.add(row.subclass);
      if (row.frr) frrs.add(row.frr);
      if (row.sizeBucket) sizeBuckets.add(row.sizeBucket);
    });

    setAvailableFilters({
      sections: Array.from(sections).sort(),
      services: Array.from(services).sort(),
      subclasses: Array.from(subclasses).sort(),
      frrs: Array.from(frrs).sort(),
      sizeBuckets: Array.from(sizeBuckets).sort(),
    });
  };

  const buildMatrix = () => {
    let filteredData = comparisonData;

    if (filters.section) {
      filteredData = filteredData.filter(row => row.section === filters.section);
    }
    if (filters.service) {
      filteredData = filteredData.filter(row => row.service === filters.service);
    }
    if (filters.subclass) {
      filteredData = filteredData.filter(row => row.subclass === filters.subclass);
    }
    if (filters.frr) {
      filteredData = filteredData.filter(row => row.frr === filters.frr);
    }
    if (filters.sizeBucket) {
      filteredData = filteredData.filter(row => row.sizeBucket === filters.sizeBucket);
    }

    const uniqueSuppliers = Array.from(new Set(filteredData.map(row => row.supplier))).sort();
    setSuppliers(uniqueSuppliers);

    const rowMap = new Map<string, MatrixRow>();

    filteredData.forEach(row => {
      const key = `${row.systemId}|${row.systemLabel}`;

      if (!rowMap.has(key)) {
        rowMap.set(key, {
          systemId: row.systemId,
          systemLabel: row.systemLabel,
          section: row.section,
          service: row.service,
          subclass: row.subclass,
          frr: row.frr,
          sizeBucket: row.sizeBucket,
          cells: {},
        });
      }

      const matrixRow = rowMap.get(key)!;

      if (!matrixRow.cells[row.supplier]) {
        matrixRow.cells[row.supplier] = {
          unitRate: row.unitRate,
          flag: row.flag,
          modelRate: row.modelRate,
          variancePct: row.variancePct,
          componentCount: row.componentCount,
          quoteId: row.quoteId,
          quoteItemId: row.quoteItemId,
        };
      }
    });

    const rows = Array.from(rowMap.values()).sort((a, b) => {
      if (a.systemId === 'UNMAPPED' && b.systemId !== 'UNMAPPED') return 1;
      if (b.systemId === 'UNMAPPED' && a.systemId !== 'UNMAPPED') return -1;
      return a.systemLabel.localeCompare(b.systemLabel);
    });

    setMatrixRows(rows);
  };

  const exportToCSV = () => {
    try {
      console.log('Export CSV clicked', { matrixRowsCount: matrixRows.length, suppliersCount: suppliers.length });

      if (matrixRows.length === 0) {
        alert('No data available to export. Please ensure quotes are imported and the matrix has been generated.');
        return;
      }

      const headers = ['System ID', 'System Label', 'Section', 'Service', 'Subclass', 'FRR', 'Size Bucket'];
      suppliers.forEach(supplier => {
        headers.push(`${supplier} - Unit Rate`);
        headers.push(`${supplier} - Model Rate`);
        headers.push(`${supplier} - Variance %`);
        headers.push(`${supplier} - Flag`);
      });

      const rows = matrixRows.map(row => {
        const csvRow = [
          row.systemId,
          row.systemLabel,
          row.section || '',
          row.service || '',
          row.subclass || '',
          row.frr || '',
          row.sizeBucket || '',
        ];

        suppliers.forEach(supplier => {
          const cell = row.cells[supplier];
          if (cell) {
            csvRow.push(cell.unitRate?.toFixed(2) || '');
            csvRow.push(cell.modelRate?.toFixed(2) || '');
            csvRow.push(cell.variancePct?.toFixed(2) || '');
            csvRow.push(cell.flag);
          } else {
            csvRow.push('', '', '', '');
          }
        });

        return csvRow;
      });

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `scope-matrix-${projectId}-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      console.log('Export completed successfully');
    } catch (error) {
      console.error('Error exporting CSV:', error);
      alert('Failed to export CSV. Check console for details.');
    }
  };

  const clearFilters = () => {
    setFilters({});
  };

  const hasActiveFilters = Object.values(filters).some(v => v);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading scope matrix...</div>
      </div>
    );
  }

  if (comparisonData.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
        <p className="text-gray-500 text-lg">No data available.</p>
        <p className="text-gray-400 mt-2">Import quotes and configure model rate settings to view the scope matrix.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
          >
            <Filter size={18} />
            Filters
            {hasActiveFilters && (
              <span className="ml-1 px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">
                {Object.values(filters).filter(v => v).length}
              </span>
            )}
          </button>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900"
            >
              <X size={16} />
              Clear filters
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSuggestedSystems(true)}
            disabled={suggestions.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            <Lightbulb size={18} />
            Suggested Systems
            {suggestions.length > 0 && (
              <span className="ml-1 px-2 py-0.5 bg-purple-800 text-white text-xs rounded-full">
                {suggestions.length}
              </span>
            )}
          </button>
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <Download size={18} />
            Export CSV
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Section</label>
              <select
                value={filters.section || ''}
                onChange={(e) => setFilters({ ...filters, section: e.target.value || undefined })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All</option>
                {availableFilters.sections.map(section => (
                  <option key={section} value={section}>{section}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Service</label>
              <select
                value={filters.service || ''}
                onChange={(e) => setFilters({ ...filters, service: e.target.value || undefined })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All</option>
                {availableFilters.services.map(service => (
                  <option key={service} value={service}>{service}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Subclass</label>
              <select
                value={filters.subclass || ''}
                onChange={(e) => setFilters({ ...filters, subclass: e.target.value || undefined })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All</option>
                {availableFilters.subclasses.map(subclass => (
                  <option key={subclass} value={subclass}>{subclass}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">FRR</label>
              <select
                value={filters.frr || ''}
                onChange={(e) => setFilters({ ...filters, frr: e.target.value || undefined })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All</option>
                {availableFilters.frrs.map(frr => (
                  <option key={frr} value={frr}>{frr}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Size Bucket</label>
              <select
                value={filters.sizeBucket || ''}
                onChange={(e) => setFilters({ ...filters, sizeBucket: e.target.value || undefined })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All</option>
                {availableFilters.sizeBuckets.map(bucket => (
                  <option key={bucket} value={bucket}>{bucket}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-gray-900">Scope Matrix</h2>
            <div className="relative group">
              <Info size={18} className="text-gray-400 hover:text-gray-600 cursor-help" />
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block z-20 w-80 p-3 bg-gray-900 text-white text-sm rounded-lg shadow-lg">
                <div className="font-semibold mb-1">Scope Matrix</div>
                <div className="text-gray-200">
                  Compare supplier rates for each passive fire system and quickly see pricing differences and missing items.
                </div>
                <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-100 border-2 border-green-300 rounded"></div>
              <span className="text-gray-600">≤10%</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-amber-100 border-2 border-amber-300 rounded"></div>
              <span className="text-gray-600">≤20%</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-100 border-2 border-red-300 rounded"></div>
              <span className="text-gray-600">&gt;20%</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-gray-100 border-2 border-gray-300 rounded"></div>
              <span className="text-gray-600">N/A</span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-3 py-2 text-left font-medium text-gray-700 border border-gray-200 sticky left-0 bg-gray-50 z-10">
                  System
                </th>
                {suppliers.map(supplier => (
                  <th key={supplier} className="px-3 py-2 text-center font-medium text-gray-700 border border-gray-200 min-w-[120px]">
                    {supplier}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrixRows.map((row, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-sm font-medium text-gray-900 border border-gray-200 sticky left-0 bg-white z-10">
                    <div className="flex flex-col">
                      <span className="font-semibold">{row.systemLabel}</span>
                      {row.systemId !== row.systemLabel && (
                        <span className="text-xs text-gray-500">{row.systemId}</span>
                      )}
                    </div>
                  </td>
                  {suppliers.map(supplier => {
                    const cell = row.cells[supplier];
                    if (!cell) {
                      return (
                        <td key={supplier} className="px-3 py-2 text-center border border-gray-200">
                          <span className="text-gray-400">-</span>
                        </td>
                      );
                    }

                    const hasMissingQty = itemsWithMissingQty.has(cell.quoteItemId);

                    return (
                      <td key={supplier} className="px-3 py-2 border border-gray-200">
                        <div className="relative group">
                          <div className={`px-2 py-1.5 rounded text-center font-medium border-2 ${getFlagColor(cell.flag)} flex items-center justify-center gap-1`}>
                            <span>{cell.unitRate !== null ? `$${cell.unitRate.toFixed(2)}` : 'N/A'}</span>
                            {hasMissingQty && (
                              <AlertCircle size={14} className="text-yellow-600" />
                            )}
                          </div>
                          <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block z-20 w-48 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg">
                            <div className="space-y-1">
                              {hasMissingQty && (
                                <div className="pb-2 mb-2 border-b border-gray-700 text-yellow-300 flex items-start gap-1">
                                  <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                                  <span>Quantity missing in source quote. Please review before finalising.</span>
                                </div>
                              )}
                              <div className="flex justify-between">
                                <span className="text-gray-300">Unit Rate:</span>
                                <span className="font-semibold">{cell.unitRate !== null ? `$${cell.unitRate.toFixed(2)}` : 'N/A'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-300">Model Rate:</span>
                                <span className="font-semibold">{cell.modelRate !== null ? `$${cell.modelRate.toFixed(2)}` : 'N/A'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-300">Variance:</span>
                                <span className="font-semibold">{cell.variancePct !== null ? `${cell.variancePct > 0 ? '+' : ''}${cell.variancePct.toFixed(1)}%` : 'N/A'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-300">Components:</span>
                                <span className="font-semibold">{cell.componentCount || 'N/A'}</span>
                              </div>
                            </div>
                            <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {matrixRows.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No data matches the selected filters.
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-gray-200">
          <button
            onClick={() => setShowMoreInfo(!showMoreInfo)}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            {showMoreInfo ? (
              <>
                <ChevronUp size={16} />
                <span>Less Info</span>
              </>
            ) : (
              <>
                <ChevronDown size={16} />
                <span>More Info</span>
              </>
            )}
          </button>

          {showMoreInfo && (
            <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">How to Read This Matrix</h3>
              <p className="text-sm text-gray-700 leading-relaxed">
                This matrix compares each supplier's rates for the same passive fire systems so you can accurately assess scope and pricing differences. Every row is a system type, and each column shows how each supplier priced that system. Colour indicators highlight where prices vary, helping you quickly identify mismatches, missing items, and potential scope gaps.
              </p>
            </div>
          )}
        </div>
      </div>

      <WorkflowNav
        currentStep={4}
        onBack={onNavigateBack}
        onNext={onNavigateNext}
        backLabel="Back: Quote Intelligence"
        nextLabel="Next: Equalisation"
      />

      {showSuggestedSystems && (
        <SuggestedSystemsPanel
          projectId={projectId}
          organisationId={organisationId}
          onClose={() => setShowSuggestedSystems(false)}
          onSystemCreated={() => {
            loadData();
          }}
        />
      )}
    </div>
  );
}
