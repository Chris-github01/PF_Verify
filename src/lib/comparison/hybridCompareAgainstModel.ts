export interface ComparisonResult {
  system_id: string;
  supplier_rates: Record<string, number>;
  model_rate: number | null;
  variances: Record<string, number>;
}

export async function hybridCompareAgainstModel(
  projectId: string,
  quoteIds: string[]
): Promise<ComparisonResult[]> {
  console.log('Hybrid comparison not fully implemented');
  return [];
}

export async function compareAgainstModelHybrid(
  projectId: string,
  quoteIds: string[]
): Promise<ComparisonResult[]> {
  return hybridCompareAgainstModel(projectId, quoteIds);
}
