import { useState, useEffect } from 'react';
import { FileText, ExternalLink } from 'lucide-react';
import AwardReport from './AwardReport';
import { supabase } from '../lib/supabase';

interface ProjectReportPageProps {
  projectId: string;
  projectName: string;
  onNavigateToHub: () => void;
  onToast?: (message: string, type: 'success' | 'error') => void;
}

export default function ProjectReportPage({
  projectId,
  projectName,
  onNavigateToHub,
  onToast
}: ProjectReportPageProps) {
  const [hasReport, setHasReport] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkForReport();
  }, [projectId]);

  const checkForReport = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('reports')
        .select('id')
        .eq('project_id', projectId)
        .eq('report_type', 'award_recommendation')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error checking for report:', error);
        setHasReport(false);
      } else {
        setHasReport(!!data);
      }
    } catch (err) {
      console.error('Failed to check report:', err);
      setHasReport(false);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading report...</p>
        </div>
      </div>
    );
  }

  if (hasReport === false) {
    return (
      <div className="p-8">
        <div className="max-w-3xl mx-auto">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500 mb-1">
                Projects &gt; {projectName} &gt; Report
              </div>
              <h1 className="text-3xl font-bold text-gray-900">{projectName} – Report</h1>
              <p className="text-gray-600 mt-1">Award Recommendation & Itemised Comparison</p>
            </div>
            <button
              onClick={onNavigateToHub}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
            >
              <ExternalLink size={16} />
              View all project reports
            </button>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              No Report Generated Yet
            </h2>
            <p className="text-gray-600 mb-6">
              To generate an award recommendation report, you need to complete the Scope Matrix workflow step first.
            </p>
            <div className="space-y-3 text-left max-w-md mx-auto">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 mt-0.5">
                  1
                </div>
                <div>
                  <div className="font-medium text-gray-900">Import Quotes</div>
                  <div className="text-sm text-gray-600">Upload supplier quotes for analysis</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 mt-0.5">
                  2
                </div>
                <div>
                  <div className="font-medium text-gray-900">Review & Clean</div>
                  <div className="text-sm text-gray-600">Normalize and validate quote data</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 mt-0.5">
                  3
                </div>
                <div>
                  <div className="font-medium text-gray-900">Scope Matrix</div>
                  <div className="text-sm text-gray-600">Compare suppliers and generate report</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-500 mb-1">
              Projects &gt; {projectName} &gt; Report
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{projectName} – Report</h1>
            <p className="text-sm text-gray-600 mt-1">
              Award Recommendation & Itemised Comparison generated by PassiveFire Verify+
            </p>
          </div>
          <button
            onClick={onNavigateToHub}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
          >
            <ExternalLink size={16} />
            View all project reports
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <AwardReport
          projectId={projectId}
          onToast={onToast}
          onNavigate={(page) => {
            console.log('Navigate to:', page);
          }}
        />
      </div>
    </div>
  );
}
