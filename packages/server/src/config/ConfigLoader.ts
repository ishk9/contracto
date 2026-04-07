import { cosmiconfig } from 'cosmiconfig';
import { DEFAULT_SERVER_CONFIG } from './ServerConfig.js';
import type { ServerConfig } from './ServerConfig.js';

export class ConfigLoader {
  static async load(): Promise<ServerConfig> {
    const explorer = cosmiconfig('contractcheck');
    const result = await explorer.search();

    if (!result || result.isEmpty) {
      return DEFAULT_SERVER_CONFIG;
    }

    return ConfigLoader.merge(DEFAULT_SERVER_CONFIG, result.config);
  }

  private static merge(defaults: ServerConfig, overrides: Partial<ServerConfig>): ServerConfig {
    return {
      port: overrides.port ?? defaults.port,
      storage: { ...defaults.storage, ...overrides.storage },
      inference: { ...defaults.inference, ...overrides.inference },
      drift: { ...defaults.drift, ...overrides.drift },
      ingestion: { ...defaults.ingestion, ...overrides.ingestion },
      alerts: { ...defaults.alerts, ...overrides.alerts },
    };
  }
}
