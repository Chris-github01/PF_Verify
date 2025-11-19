export async function getModelRatesForProject(projectId: string): Promise<Record<string, number>> {
  return {};
}

export async function getModelRateForSystem(projectId: string, systemId: string): Promise<number | null> {
  return null;
}

export async function getModelRateProvider(projectId: string) {
  return {
    getRate: async (systemId: string) => getModelRateForSystem(projectId, systemId),
    getRates: async () => getModelRatesForProject(projectId),
  };
}
