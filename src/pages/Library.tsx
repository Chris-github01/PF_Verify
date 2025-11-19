import { FileText, FormInput } from 'lucide-react';
import { t } from '../i18n';

interface LibraryProps {
  onNavigateToTemplates: () => void;
}

export default function Library({ onNavigateToTemplates }: LibraryProps) {
  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold brand-navy mb-2">{t('library.pageTitle')}</h1>
        <p className="text-gray-600 text-base">
          {t('library.pageSubtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <button
          onClick={onNavigateToTemplates}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 hover:shadow-md hover:border-gray-300 transition-all text-left group"
        >
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-blue-100 transition-colors">
              <FileText className="w-7 h-7 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                {t('library.cards.projectTemplates.title')}
              </h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                {t('library.cards.projectTemplates.body')}
              </p>
            </div>
          </div>
        </button>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 opacity-50 cursor-not-allowed">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <FormInput className="w-7 h-7 text-gray-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {t('library.cards.forms.title')}
              </h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                {t('library.cards.forms.body')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
