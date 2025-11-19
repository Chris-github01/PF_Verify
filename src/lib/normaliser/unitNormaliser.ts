export function normaliseUnit(unit: string): string {
  const unitMap: Record<string, string> = {
    'm': 'm',
    'metre': 'm',
    'meter': 'm',
    'mtrs': 'm',
    'lm': 'lm',
    'm2': 'm2',
    'sqm': 'm2',
    'nr': 'nr',
    'ea': 'ea',
    'each': 'ea',
    'sum': 'sum',
  };
  return unitMap[unit.toLowerCase()] || unit;
}

export function normaliseNumber(value: any): number | null {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const num = parseFloat(value.replace(/[^0-9.-]/g, ''));
    return isNaN(num) ? null : num;
  }
  return null;
}

export function deriveRate(qty: number | null, total: number | null): number | null {
  if (qty && total && qty !== 0) {
    return total / qty;
  }
  return null;
}

export function deriveTotal(qty: number | null, rate: number | null): number | null {
  if (qty && rate) {
    return qty * rate;
  }
  return null;
}
