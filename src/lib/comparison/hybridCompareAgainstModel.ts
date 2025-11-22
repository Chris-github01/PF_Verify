import type { ComparisonRow } from '../../types/comparison.types';

export interface ComparisonResult {
  system_id: string;
  supplier_rates: Record<string, number>;
  model_rate: number | null;
  variances: Record<string, number>;
}

interface NormalisedLine {
  quoteId: string;
  quoteItemId: string;
  supplier: string;
  originalDescription: string;
  quantity: number;
  rate: number;
  total: number;
  section?: string;
  service?: string;
  serviceType?: string;
  subclass?: string;
  frr?: string;
  size?: string;
  systemType?: string;
  penetrationType?: string;
}

interface Mapping {
  quoteItemId: string;
  systemId: string | null;
  systemLabel: string | null;
}

type ModelRateLookup = (criteria: any) => { rate: number | null; componentCount: number | null };

export async function compareAgainstModelHybrid(
  normalisedLines: NormalisedLine[],
  mappings: Mapping[],
  modelRateLookup: ModelRateLookup
): Promise<ComparisonRow[]> {
  console.log('compareAgainstModelHybrid: Processing', normalisedLines.length, 'lines');

  const comparisonRows: ComparisonRow[] = [];

  for (const line of normalisedLines) {
    const mapping = mappings.find(m => m.quoteItemId === line.quoteItemId);

    if (!mapping || !mapping.systemId) {
      console.log('compareAgainstModelHybrid: Skipping line without system mapping:', line.quoteItemId);
      continue;
    }

    const criteria = {
      systemId: mapping.systemId,
      section: line.section,
      service: line.service || line.serviceType,
      subclass: line.subclass,
      frr: line.frr,
      size: line.size,
    };

    const modelRateResult = modelRateLookup(criteria);
    const modelRate = modelRateResult?.rate || null;
    const componentCount = modelRateResult?.componentCount || null;

    let variancePct: number | null = null;
    let flag: 'GREEN' | 'AMBER' | 'RED' | 'NA' = 'NA';

    if (modelRate !== null && line.rate > 0) {
      variancePct = ((line.rate - modelRate) / modelRate) * 100;

      if (Math.abs(variancePct) <= 10) {
        flag = 'GREEN';
      } else if (Math.abs(variancePct) <= 25) {
        flag = 'AMBER';
      } else {
        flag = 'RED';
      }
    }

    comparisonRows.push({
      quoteId: line.quoteId,
      quoteItemId: line.quoteItemId,
      supplier: line.supplier,
      systemId: mapping.systemId,
      systemLabel: mapping.systemLabel || '',
      section: line.section,
      service: line.service || line.serviceType,
      subclass: line.subclass,
      frr: line.frr,
      sizeBucket: line.size,
      quantity: line.quantity,
      unitRate: line.rate,
      total: line.total,
      modelRate,
      componentCount,
      variancePct,
      flag,
    });
  }

  console.log('compareAgainstModelHybrid: Generated', comparisonRows.length, 'comparison rows');
  return comparisonRows;
}
