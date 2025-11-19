import QuoteIntelligenceReport from './QuoteIntelligenceReport';

interface QuoteIntelligenceProps {
  projectId: string;
  onNavigateBack: () => void;
  onNavigateNext: () => void;
}

export default function QuoteIntelligence(props: QuoteIntelligenceProps) {
  return <QuoteIntelligenceReport {...props} />;
}
