/**
 * Provider Registry
 *
 * Central registry that manages LLM providers and per-mode model selection.
 * On startup it registers all providers whose API keys are configured, then
 * loads the active configuration from the `system_settings` table (falling
 * back to OpenAI gpt-4o-mini when nothing is persisted yet).
 *
 * Usage:
 *   await ProviderRegistry.initialize();                     // call once in server.ts
 *   const { provider, model } = ProviderRegistry.getForMode('chat');
 */

import type { LLMProvider, ModelInfo } from './llm-provider.interface';
import { OpenAIProvider } from './openai.provider';
import { AnthropicProvider } from './anthropic.provider';
import { GoogleProvider } from './google.provider';
import { GroqProvider } from './groq.provider';
import config from '../config/env';
import logger from '../config/logger';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ModeConfig {
  providerId: string;
  modelId: string;
}

export interface ProviderListItem {
  id: string;
  displayName: string;
  models: ModelInfo[];
  configured: boolean;
}

type ConversationMode = 'research' | 'chat';

// ─── Default fallback ────────────────────────────────────────────────────────

const DEFAULT_CONFIG: ModeConfig = { providerId: 'openai', modelId: 'gpt-4o-mini' };

// ─── Registry ────────────────────────────────────────────────────────────────

export class ProviderRegistry {
  /** All registered providers keyed by id. */
  private static providers = new Map<string, LLMProvider>();

  /** Per-mode active configuration. */
  private static chatConfig: ModeConfig = { ...DEFAULT_CONFIG };
  private static researchConfig: ModeConfig = { ...DEFAULT_CONFIG };

  /** Whether initialize() has run. */
  private static initialized = false;

  // ── Bootstrap ──────────────────────────────────────────────────────────

  /**
   * Call once at server startup.
   * 1. Registers every provider whose API key is present.
   * 2. Loads persisted mode configs from `system_settings`.
   */
  static async initialize(): Promise<void> {
    // 1 — Register providers conditionally on API key presence
    ProviderRegistry.registerIfConfigured('openai', () => new OpenAIProvider(), !!config.OPENAI_API_KEY);
    ProviderRegistry.registerIfConfigured('anthropic', () => new AnthropicProvider(), !!config.ANTHROPIC_API_KEY);
    ProviderRegistry.registerIfConfigured('google', () => new GoogleProvider(), !!config.GOOGLE_AI_API_KEY);
    ProviderRegistry.registerIfConfigured('groq', () => new GroqProvider(), !!config.GROQ_API_KEY);

    logger.info('Provider registry: registered providers', {
      providers: Array.from(ProviderRegistry.providers.keys()),
    });

    // 2 — Load persisted config from database (best-effort)
    try {
      await ProviderRegistry.loadFromDatabase();
    } catch (err: any) {
      logger.warn('Provider registry: could not load config from DB, using defaults', {
        error: err.message,
      });
    }

    ProviderRegistry.initialized = true;

    logger.info('Provider registry initialized', {
      chatConfig: ProviderRegistry.chatConfig,
      researchConfig: ProviderRegistry.researchConfig,
    });
  }

  // ── Registration ───────────────────────────────────────────────────────

  /** Register a provider instance. */
  static register(provider: LLMProvider): void {
    ProviderRegistry.providers.set(provider.id, provider);
  }

  /** Conditionally register a provider only when its API key is present. */
  private static registerIfConfigured(
    id: string,
    factory: () => LLMProvider,
    hasKey: boolean,
  ): void {
    if (hasKey) {
      ProviderRegistry.providers.set(id, factory());
    } else {
      logger.debug(`Provider registry: skipping ${id} (no API key)`);
    }
  }

  // ── Mode-aware lookups ─────────────────────────────────────────────────

  /**
   * Return the provider + model ID for a conversation mode.
   * Validates that the provider is registered and the model exists.
   * Falls back to default if anything is wrong.
   */
  static getForMode(mode: ConversationMode): { provider: LLMProvider; model: string } {
    const cfg = mode === 'research' ? ProviderRegistry.researchConfig : ProviderRegistry.chatConfig;

    const provider = ProviderRegistry.providers.get(cfg.providerId);
    if (!provider) {
      logger.warn(`Provider registry: configured provider "${cfg.providerId}" for mode "${mode}" is not registered, falling back to default`);
      return ProviderRegistry.fallback();
    }

    // Validate the model exists in the provider catalogue
    const modelExists = provider.supportedModels.some((m) => m.id === cfg.modelId);
    if (!modelExists) {
      logger.warn(`Provider registry: model "${cfg.modelId}" not found in provider "${cfg.providerId}", using provider default`);
      const defaultModel = provider.supportedModels.find((m) => m.isDefault) || provider.supportedModels[0];
      return { provider, model: defaultModel.id };
    }

    return { provider, model: cfg.modelId };
  }

  /** Absolute fallback: OpenAI gpt-4o-mini or the first available provider. */
  private static fallback(): { provider: LLMProvider; model: string } {
    const openai = ProviderRegistry.providers.get('openai');
    if (openai) {
      return { provider: openai, model: DEFAULT_CONFIG.modelId };
    }

    // Pick any registered provider
    const first = ProviderRegistry.providers.values().next().value;
    if (first) {
      const defaultModel = (first as LLMProvider).supportedModels.find((m) => m.isDefault) || (first as LLMProvider).supportedModels[0];
      return { provider: first as LLMProvider, model: defaultModel.id };
    }

    throw new Error('Provider registry: no providers registered. At least one API key must be configured.');
  }

  // ── Configuration ──────────────────────────────────────────────────────

  /** Update the active provider + model for a mode (in-memory). */
  static setActiveConfig(mode: ConversationMode, providerId: string, modelId: string): void {
    const newConfig: ModeConfig = { providerId, modelId };

    if (mode === 'research') {
      ProviderRegistry.researchConfig = newConfig;
    } else {
      ProviderRegistry.chatConfig = newConfig;
    }

    logger.info('Provider registry: config updated', { mode, ...newConfig });
  }

  /** Get current config for a mode. */
  static getActiveConfig(mode: ConversationMode): ModeConfig {
    return mode === 'research'
      ? { ...ProviderRegistry.researchConfig }
      : { ...ProviderRegistry.chatConfig };
  }

  // ── Provider listing ───────────────────────────────────────────────────

  /**
   * List all known providers (registered or not) with their configuration
   * status — used by the admin UI.
   */
  static listProviders(): ProviderListItem[] {
    const knownProviders: Array<{ id: string; factory: () => LLMProvider; keyPresent: boolean }> = [
      { id: 'openai', factory: () => new OpenAIProvider(), keyPresent: !!config.OPENAI_API_KEY },
      { id: 'anthropic', factory: () => new AnthropicProvider(), keyPresent: !!config.ANTHROPIC_API_KEY },
      { id: 'google', factory: () => new GoogleProvider(), keyPresent: !!config.GOOGLE_AI_API_KEY },
      { id: 'groq', factory: () => new GroqProvider(), keyPresent: !!config.GROQ_API_KEY },
    ];

    return knownProviders.map(({ id, factory, keyPresent }) => {
      const registered = ProviderRegistry.providers.get(id);
      const instance = registered || factory();
      return {
        id: instance.id,
        displayName: instance.displayName,
        models: instance.supportedModels,
        configured: keyPresent,
      };
    });
  }

  /** Get a specific provider by id (or null). */
  static getProvider(id: string): LLMProvider | null {
    return ProviderRegistry.providers.get(id) ?? null;
  }

  /** Check whether any provider is registered. */
  static hasProviders(): boolean {
    return ProviderRegistry.providers.size > 0;
  }

  // ── Database persistence ───────────────────────────────────────────────

  /**
   * Load mode configs from the `system_settings` table.
   * Keys: `llm_provider_chat`, `llm_provider_research`
   */
  static async loadFromDatabase(): Promise<void> {
    const { supabaseAdmin } = await import('../config/database');

    const { data: rows, error } = await supabaseAdmin
      .from('system_settings')
      .select('key, value')
      .in('key', ['llm_provider_chat', 'llm_provider_research']);

    if (error) {
      // Table may not exist yet — non-fatal
      logger.debug('Provider registry: system_settings query failed', { error: error.message });
      return;
    }

    if (!rows || rows.length === 0) {
      logger.debug('Provider registry: no persisted config found, using defaults');
      return;
    }

    for (const row of rows) {
      const val = row.value as ModeConfig | null;
      if (!val?.providerId || !val?.modelId) continue;

      if (row.key === 'llm_provider_chat') {
        ProviderRegistry.chatConfig = { providerId: val.providerId, modelId: val.modelId };
      } else if (row.key === 'llm_provider_research') {
        ProviderRegistry.researchConfig = { providerId: val.providerId, modelId: val.modelId };
      }
    }
  }

  /**
   * Persist a key/value pair to `system_settings` (upsert).
   * Used by admin routes when updating provider config.
   */
  static async persistToDatabase(key: string, value: unknown, updatedBy?: string): Promise<void> {
    const { supabaseAdmin } = await import('../config/database');

    const { error } = await supabaseAdmin
      .from('system_settings')
      .upsert(
        {
          key,
          value,
          updated_by: updatedBy ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'key' },
      );

    if (error) {
      logger.error('Provider registry: failed to persist setting', { key, error: error.message });
      throw error;
    }

    logger.info('Provider registry: persisted setting', { key });
  }

  /**
   * Convenience: update mode config both in-memory AND in database.
   */
  static async setAndPersistConfig(
    mode: ConversationMode,
    providerId: string,
    modelId: string,
    updatedBy?: string,
  ): Promise<void> {
    ProviderRegistry.setActiveConfig(mode, providerId, modelId);

    const key = mode === 'research' ? 'llm_provider_research' : 'llm_provider_chat';
    await ProviderRegistry.persistToDatabase(key, { providerId, modelId }, updatedBy);
  }

  // ── Reset (for testing) ────────────────────────────────────────────────

  /** @internal — used only in tests. */
  static _reset(): void {
    ProviderRegistry.providers.clear();
    ProviderRegistry.chatConfig = { ...DEFAULT_CONFIG };
    ProviderRegistry.researchConfig = { ...DEFAULT_CONFIG };
    ProviderRegistry.initialized = false;
  }
}
