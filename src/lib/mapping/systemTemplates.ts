export interface SystemTemplate {
  id: string;
  label: string;
  service?: string;
  frr?: number;
  size_min?: number;
  size_max?: number;
}

export const SYSTEM_TEMPLATES: SystemTemplate[] = [
  { id: 'PE_50_PEN', label: '50mm Penetration Seal', service: 'penetration', size_min: 0, size_max: 75 },
  { id: 'PE_150_PEN', label: '150mm Penetration Seal', service: 'penetration', size_min: 76, size_max: 200 },
  { id: 'LJ_25_PERIMETER', label: '25mm Linear Joint', service: 'joint', size_min: 0, size_max: 50 },
];

export async function loadSystemTemplates(): Promise<SystemTemplate[]> {
  return SYSTEM_TEMPLATES;
}

export function getAllSystemLabels(): Record<string, string> {
  return SYSTEM_TEMPLATES.reduce((acc, template) => {
    acc[template.id] = template.label;
    return acc;
  }, {} as Record<string, string>);
}
