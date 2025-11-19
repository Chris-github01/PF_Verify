export interface SystemMatch {
  system_id: string;
  confidence: number;
  reason: string;
}

export async function matchLineItemToSystem(item: any): Promise<SystemMatch | null> {
  console.log('System matcher not fully implemented');
  return null;
}

export async function suggestSystemMapping(projectId: string, items: any[]): Promise<any[]> {
  console.log('System mapping suggestions not fully implemented');
  return [];
}

export async function matchLineToSystem(item: any): Promise<SystemMatch | null> {
  return matchLineItemToSystem(item);
}
