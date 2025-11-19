import type { QuoteIntelligenceAnalysis } from '../../types/quoteIntelligence.types';
import { analyzeQuoteIntelligenceHybrid } from './hybridAnalyzer';

export async function analyzeQuoteIntelligence(
  projectId: string,
  quoteIds?: string[]
): Promise<QuoteIntelligenceAnalysis> {
  return analyzeQuoteIntelligenceHybrid(projectId, quoteIds);
}
