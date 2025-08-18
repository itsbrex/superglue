import type { ApiConfig, ExtractConfig, Integration, RunResult, TransformConfig, Workflow } from "@superglue/client";
import { createHash } from 'node:crypto';
import { type RedisClientType, createClient } from 'redis';
import { logMessage } from "../utils/logs.js";
import type { DataStore } from "./types.js";
export class RedisService implements DataStore {
  private redis: RedisClientType;
  private readonly RUN_PREFIX = 'run:';
  private readonly API_PREFIX = 'api:';
  private readonly EXTRACT_PREFIX = 'extract:';
  private readonly TRANSFORM_PREFIX = 'transform:';
  private readonly WORKFLOW_PREFIX = 'workflow:';
  private readonly INTEGRATION_PREFIX = 'integration:';
  private readonly TTL = 60 * 60 * 24 * 90; // 90 days

  constructor(config: {
    host: string;
    port: number;
    username: string;
    password?: string;
  }) {
    this.redis = createClient({
      username: config.username,
      password: config.password,
      socket: {
        host: config.host,
        port: config.port
      }
    });
    this.redis.on('error', (err) => {
      console.error('redis error:', err);
    });
    this.redis.on('connect', () => {
      logMessage('info', '🔥 redis connected');
    });
    this.redis.connect();
  }

  private getKey(prefix: string, id: string, orgId: string): string {
    return `${orgId ? `${orgId}:` : ''}${prefix}${id}`;
  }

  private getPattern(prefix: string, orgId?: string): string {
    return `${orgId ? `${orgId}:` : ''}${prefix}*`;
  }

  private getRunsByConfigPattern(prefix: string, configId: string, orgId?: string): string {
    return `${orgId ? `${orgId}:` : ''}${prefix}${configId}:*`;
  }
  private getRunByIdPattern(prefix: string, id: string, orgId?: string): string {
    return `${orgId ? `${orgId}:` : ''}${prefix}*:${id}`;
  }

  private generateHash(data: any): string {
    return createHash('md5').update(JSON.stringify(data)).digest('hex');
  }

  // API Config Methods
  async getApiConfig(params: { id: string; orgId?: string }): Promise<ApiConfig | null> {
    const { id, orgId } = params;
    if (!id) return null;
    const data = await this.redis.get(this.getKey(this.API_PREFIX, id, orgId));
    return parseWithId(data, id);
  }

  async listApiConfigs(params?: { limit?: number; offset?: number; orgId?: string }): Promise<{ items: ApiConfig[], total: number }> {
    const { limit = 10, offset = 0, orgId } = params || {};
    const pattern = this.getPattern(this.API_PREFIX, orgId);
    const keys = await this.redis.keys(pattern);
    const slicedKeys = keys.slice(offset, offset + limit);
    const dataArray = slicedKeys.length > 0 ? await this.redis.mGet(slicedKeys) : [];
    const configs = slicedKeys.map((key, index) => {
      const data = dataArray[index];
      if (!data) return null;
      const id = key.split(':').pop()!.replace(this.API_PREFIX, '');
      return parseWithId(data, id);
    });
    return { items: configs.filter((c): c is ApiConfig => c !== null), total: keys.length };
  }

  async upsertApiConfig(params: { id: string; config: ApiConfig; orgId?: string }): Promise<ApiConfig> {
    const { id, config, orgId } = params;
    if (!id || !config) return null;
    const key = this.getKey(this.API_PREFIX, id, orgId);
    await this.redis.set(key, JSON.stringify(config));
    return config;
  }

  async deleteApiConfig(params: { id: string; orgId?: string }): Promise<boolean> {
    const { id, orgId } = params;
    if (!id) return false;
    const deleted = await this.redis.del(this.getKey(this.API_PREFIX, id, orgId));
    return deleted > 0;
  }

  // Extract Methods
  async getExtractConfig(params: { id: string; orgId?: string }): Promise<ExtractConfig | null> {
    const { id, orgId } = params;
    if (!id) return null;
    const data = await this.redis.get(this.getKey(this.EXTRACT_PREFIX, id, orgId));
    return parseWithId(data, id);
  }

  async listExtractConfigs(params?: { limit?: number; offset?: number; orgId?: string }): Promise<{ items: ExtractConfig[], total: number }> {
    const { limit = 10, offset = 0, orgId } = params || {};
    const pattern = this.getPattern(this.EXTRACT_PREFIX, orgId);
    const keys = await this.redis.keys(pattern);
    const slicedKeys = keys.slice(offset, offset + limit);
    const dataArray = slicedKeys.length > 0 ? await this.redis.mGet(slicedKeys) : [];
    const configs = slicedKeys.map((key, index) => {
      const data = dataArray[index];
      if (!data) return null;
      const id = key.split(':').pop()!.replace(this.EXTRACT_PREFIX, '');
      return parseWithId(data, id);
    });
    return { items: configs.filter((c): c is ExtractConfig => c !== null), total: keys.length };
  }

  async upsertExtractConfig(params: { id: string; config: ExtractConfig; orgId?: string }): Promise<ExtractConfig> {
    const { id, config, orgId } = params;
    if (!id || !config) return null;
    const key = this.getKey(this.EXTRACT_PREFIX, id, orgId);
    await this.redis.set(key, JSON.stringify(config));
    return config;
  }

  async deleteExtractConfig(params: { id: string; orgId?: string }): Promise<boolean> {
    const { id, orgId } = params;
    if (!id) return false;
    const deleted = await this.redis.del(this.getKey(this.EXTRACT_PREFIX, id, orgId));
    return deleted > 0;
  }

  // Transform Methods
  async getTransformConfig(params: { id: string; orgId?: string }): Promise<TransformConfig | null> {
    const { id, orgId } = params;
    if (!id) return null;
    const data = await this.redis.get(this.getKey(this.TRANSFORM_PREFIX, id, orgId));
    return parseWithId(data, id);
  }

  async listTransformConfigs(params?: { limit?: number; offset?: number; orgId?: string }): Promise<{ items: TransformConfig[], total: number }> {
    const { limit = 10, offset = 0, orgId } = params || {};
    const pattern = this.getPattern(this.TRANSFORM_PREFIX, orgId);
    const keys = await this.redis.keys(pattern);
    const slicedKeys = keys.slice(offset, offset + limit);
    const dataArray = slicedKeys.length > 0 ? await this.redis.mGet(slicedKeys) : [];
    const configs = slicedKeys.map((key, index) => {
      const data = dataArray[index];
      if (!data) return null;
      const id = key.split(':').pop()!.replace(this.TRANSFORM_PREFIX, '');
      return parseWithId(data, id);
    });
    return { items: configs.filter((c): c is TransformConfig => c !== null), total: keys.length };
  }

  async upsertTransformConfig(params: { id: string; config: TransformConfig; orgId?: string }): Promise<TransformConfig> {
    const { id, config, orgId } = params;
    if (!id || !config) return null;
    const key = this.getKey(this.TRANSFORM_PREFIX, id, orgId);
    await this.redis.set(key, JSON.stringify(config));
    return config;
  }

  async deleteTransformConfig(params: { id: string; orgId?: string }): Promise<boolean> {
    const { id, orgId } = params;
    if (!id) return false;
    const deleted = await this.redis.del(this.getKey(this.TRANSFORM_PREFIX, id, orgId));
    return deleted > 0;
  }

  async getRun(params: { id: string; orgId?: string }): Promise<RunResult | null> {
    const { id, orgId } = params;
    if (!id) return null;
    const pattern = this.getRunByIdPattern(this.RUN_PREFIX, id, orgId);
    const keys = await this.redis.keys(pattern);
    if (keys.length === 0) {
      return null;
    }
    const data = await this.redis.get(keys[0]);
    return parseWithId(data, id);
  }

  async listRuns(params?: { limit?: number; offset?: number; configId?: string; orgId?: string }): Promise<{ items: RunResult[], total: number }> {
    const { limit = 10, offset = 0, configId, orgId } = params || {};
    const pattern = configId
      ? this.getRunsByConfigPattern(this.RUN_PREFIX, configId, orgId)
      : this.getPattern(this.RUN_PREFIX, orgId);

    const keys = await this.redis.keys(pattern);
    const total = keys.length;

    if (total === 0) {
      return { items: [], total: 0 };
    }

    const runs = await Promise.all(
      keys.map(async (key) => {
        const data = await this.redis.get(key);
        const runId = key.split(':').pop()!;
        return parseWithId(data, runId);
      })
    );

    const validRuns = runs
      .filter((run): run is RunResult =>
        run !== null &&
        run.config &&
        run.config.id &&
        run.startedAt
      )
      .sort((a, b) => (b.startedAt?.getTime() ?? 0) - (a.startedAt?.getTime() ?? 0));

    return {
      items: validRuns.slice(offset, offset + limit),
      total
    };
  }

  async deleteAllRuns(params?: { orgId?: string }): Promise<boolean> {
    const { orgId } = params || {};
    const pattern = this.getPattern(this.RUN_PREFIX, orgId);
    const keys = await this.redis.keys(pattern);

    if (keys.length > 0) {
      await this.redis.del(keys);
    }
    return keys.length > 0;
  }

  async createRun(params: { result: RunResult; orgId?: string }): Promise<RunResult> {
    const { result: run, orgId } = params;
    if (!run) return null;
    const key = this.getKey(this.RUN_PREFIX, `${run.config?.id}:${run.id}`, orgId);
    if ((run as any).stepResults) delete (run as any).stepResults;
    await this.redis.set(key, JSON.stringify(run), {
      EX: this.TTL
    });
    return run;
  }

  async deleteRun(params: { id: string; orgId?: string }): Promise<boolean> {
    const { id, orgId } = params;
    if (!id) return false;
    const pattern = this.getRunByIdPattern(this.RUN_PREFIX, id, orgId);
    const keys = await this.redis.keys(pattern);
    if (keys.length === 0) {
      return null;
    }
    const result = await this.redis.del(keys[0]);
    return result > 0;
  }

  // Utility methods
  async clearAll(orgId: string): Promise<void> {
    const pattern = `${orgId ? `${orgId}:` : ''}*`;
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(keys);
    }
  }

  async disconnect(): Promise<void> {
    await this.redis.quit();
  }

  // Health check
  async ping(): Promise<boolean> {
    if (!this.redis) return false;
    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch (error) {
      return false;
    }
  }

  private tenantKey(): string {
    return `tenant`;
  }

  async getTenantInfo(): Promise<{ email: string | null; emailEntrySkipped: boolean }> {
    try {
      const data = await this.redis.get(this.tenantKey());
      if (data) {
        return JSON.parse(data);
      }
      return {
        email: null,
        emailEntrySkipped: false
      };
    } catch (error) {
      console.error('Error getting tenant info:', error);
      return {
        email: null,
        emailEntrySkipped: false
      };
    }
  }

  async setTenantInfo(params?: { email?: string; emailEntrySkipped?: boolean }): Promise<void> {
    const { email, emailEntrySkipped } = params || {};
    try {
      const currentInfo = await this.getTenantInfo();
      const tenantInfo = {
        email: email !== undefined ? email : currentInfo.email,
        emailEntrySkipped: emailEntrySkipped !== undefined ? emailEntrySkipped : currentInfo.emailEntrySkipped
      };
      await this.redis.set(this.tenantKey(), JSON.stringify(tenantInfo));
    } catch (error) {
      console.error('Error setting tenant info:', error);
    }
  }

  // Workflow Methods
  async getWorkflow(params: { id: string; orgId?: string }): Promise<Workflow | null> {
    const { id, orgId } = params;
    try {
      if (!id) return null;
      const key = this.getKey(this.WORKFLOW_PREFIX, id, orgId);
      const data = await this.redis.get(key);
      return parseWithId(data, id);
    } catch (error) {
      console.error('Error getting workflow:', error);
      return null;
    }
  }

  async listWorkflows(params?: { limit?: number; offset?: number; orgId?: string }): Promise<{ items: Workflow[], total: number }> {
    const { limit = 10, offset = 0, orgId } = params || {};
    try {
      const pattern = this.getPattern(this.WORKFLOW_PREFIX, orgId);
      const keys = await this.redis.keys(pattern);
      const slicedKeys = keys.slice(offset, offset + limit);
      const dataArray = slicedKeys.length > 0 ? await this.redis.mGet(slicedKeys) : [];
      const workflows = slicedKeys.map((key, index) => {
        const data = dataArray[index];
        if (!data) return null;
        const id = key.split(':').pop()?.replace(this.WORKFLOW_PREFIX, '');
        return parseWithId(data, id);
      });
      return {
        items: workflows.filter((workflow): workflow is Workflow => workflow !== null),
        total: keys.length
      };
    } catch (error) {
      console.error('Error listing workflows:', error);
      return { items: [], total: 0 };
    }
  }

  async getManyWorkflows(params: { ids: string[]; orgId?: string }): Promise<Workflow[]> {
    const { ids, orgId } = params;
    if (!ids.length) return [];
    const keys = ids.map(id => this.getKey(this.WORKFLOW_PREFIX, id, orgId));
    const dataArray = await this.redis.mGet(keys);
    return dataArray
      .map((data, i) => data ? parseWithId(data, ids[i]) : null)
      .filter((w): w is Workflow => w !== null);
  }

  async upsertWorkflow(params: { id: string; workflow: Workflow; orgId?: string }): Promise<Workflow> {
    const { id, workflow, orgId } = params;
    try {
      if (!id || !workflow) return null;
      const key = this.getKey(this.WORKFLOW_PREFIX, id, orgId);
      await this.redis.set(key, JSON.stringify(workflow), {
        EX: this.TTL
      });
      return { ...workflow, id };
    } catch (error) {
      console.error('Error upserting workflow:', error);
      throw error;
    }
  }

  async deleteWorkflow(params: { id: string; orgId?: string }): Promise<boolean> {
    const { id, orgId } = params;
    try {
      if (!id) return false;
      const key = this.getKey(this.WORKFLOW_PREFIX, id, orgId);
      const result = await this.redis.del(key);
      return result > 0;
    } catch (error) {
      console.error('Error deleting workflow:', error);
      return false;
    }
  }

  // Integration Methods
  async getIntegration(params: { id: string; includeDocs?: boolean; orgId?: string }): Promise<Integration | null> {
    const { id, includeDocs = true, orgId } = params;
    if (!id) return null;
    const key = this.getKey(this.INTEGRATION_PREFIX, id, orgId);
    const data = await this.redis.get(key);
    return parseWithId(data, id);
  }

  async listIntegrations(params?: { limit?: number; offset?: number; includeDocs?: boolean; orgId?: string }): Promise<{ items: Integration[], total: number }> {
    const { limit = 10, offset = 0, includeDocs = true, orgId } = params || {};
    const pattern = this.getPattern(this.INTEGRATION_PREFIX, orgId);
    const keys = await this.redis.keys(pattern);
    const slicedKeys = keys.slice(offset, offset + limit);
    const dataArray = slicedKeys.length > 0 ? await this.redis.mGet(slicedKeys) : [];
    const integrations = slicedKeys.map((key, index) => {
      const data = dataArray[index];
      if (!data) return null;
      const id = key.split(':').pop()!.replace(this.INTEGRATION_PREFIX, '');
      return parseWithId(data, id);
    });
    return { items: integrations.filter((i): i is Integration => i !== null), total: keys.length };
  }

  async getManyIntegrations(params: { ids: string[]; includeDocs?: boolean; orgId?: string }): Promise<Integration[]> {
    const { ids, includeDocs = true, orgId } = params;
    if (!ids.length) return [];
    const keys = ids.map(id => this.getKey(this.INTEGRATION_PREFIX, id, orgId));
    const dataArray = await this.redis.mGet(keys);
    return dataArray
      .map((data, i) => data ? parseWithId(data, ids[i]) : null)
      .filter((i): i is Integration => i !== null);
  }

  async upsertIntegration(params: { id: string; integration: Integration; orgId?: string }): Promise<Integration> {
    const { id, integration, orgId } = params;
    if (!id || !integration) return null;
    const key = this.getKey(this.INTEGRATION_PREFIX, id, orgId);
    await this.redis.set(key, JSON.stringify(integration));
    return { ...integration, id };
  }

  async deleteIntegration(params: { id: string; orgId?: string }): Promise<boolean> {
    const { id, orgId } = params;
    if (!id) return false;
    const key = this.getKey(this.INTEGRATION_PREFIX, id, orgId);
    const result = await this.redis.del(key);
    return result > 0;
  }
}

function parseWithId(data: string, id: string): any {
  if (!data) return null;
  const parsed = typeof data === 'string' ? JSON.parse(data) : data;
  const result = {
    ...parsed,
    ...(parsed.startedAt && { startedAt: new Date(parsed.startedAt) }),
    ...(parsed.completedAt && { completedAt: new Date(parsed.completedAt) }),
    ...(parsed.createdAt && { createdAt: new Date(parsed.createdAt) }),
    ...(parsed.updatedAt && { updatedAt: new Date(parsed.updatedAt) }),
    id: id
  };

  // Only parse config if it exists and has an id
  if (parsed.config && parsed.config.id) {
    result.config = parseWithId(parsed.config, parsed.config.id);
  }

  return result;
}