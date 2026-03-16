export class RegistryClient {
  async listOfficialAgents(): Promise<string[]> {
    return ["context-collector", "code-review", "security-audit", "test-generation"];
  }
}
