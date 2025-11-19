import { useState } from 'react';
import ImportQuotes from './pages/ImportQuotes';
import QuoteIntelligenceReport from './pages/QuoteIntelligenceReport';
import TradeAnalysisReport from './pages/TradeAnalysisReport';
import OrganisationsList from './pages/admin/OrganisationsList';

type Page = 'import' | 'intelligence' | 'analysis' | 'admin';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('import');

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex space-x-8">
              <button
                onClick={() => setCurrentPage('import')}
                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                  currentPage === 'import'
                    ? 'border-blue-500 text-gray-900'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                Import Quotes
              </button>
              <button
                onClick={() => setCurrentPage('intelligence')}
                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                  currentPage === 'intelligence'
                    ? 'border-blue-500 text-gray-900'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                Quote Intelligence
              </button>
              <button
                onClick={() => setCurrentPage('analysis')}
                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                  currentPage === 'analysis'
                    ? 'border-blue-500 text-gray-900'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                Trade Analysis
              </button>
              <button
                onClick={() => setCurrentPage('admin')}
                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                  currentPage === 'admin'
                    ? 'border-blue-500 text-gray-900'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                Admin
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {currentPage === 'import' && <ImportQuotes />}
        {currentPage === 'intelligence' && <QuoteIntelligenceReport />}
        {currentPage === 'analysis' && <TradeAnalysisReport />}
        {currentPage === 'admin' && <OrganisationsList />}
      </main>
    </div>
  );
}

export default App;
