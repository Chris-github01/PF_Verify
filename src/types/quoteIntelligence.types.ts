export interface QuoteIntelligenceAnalysis {
  projectId: string;
  quoteIds?: string[];
  summary?: string;
  insights?: any[];
  recommendations?: string[];
}
