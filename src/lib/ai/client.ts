import OpenAI, { AzureOpenAI } from 'openai';
import type { z } from 'zod';
import { getAiConfig } from './config';

function getChatClient(): { client: OpenAI; model: string } | null {
  const cfg = getAiConfig();

  if (cfg.chatProvider === 'openrouter') {
    if (!cfg.openrouterApiKey) return null;
    return {
      client: new OpenAI({
        apiKey: cfg.openrouterApiKey,
        baseURL: 'https://openrouter.ai/api/v1',
      }),
      model: cfg.openrouterChatModel,
    };
  }

  if (!cfg.azureEndpoint || !cfg.azureApiKey) return null;
  return {
    client: new AzureOpenAI({
      endpoint: cfg.azureEndpoint,
      apiKey: cfg.azureApiKey,
      apiVersion: cfg.azureApiVersion,
      deployment: cfg.azureChatDeployment,
    }),
    model: cfg.azureChatDeployment,
  };
}

function getEmbeddingClient(): { client: OpenAI; model: string } | null {
  const cfg = getAiConfig();
  if (cfg.embeddingProvider === 'disabled') return null;

  if (cfg.embeddingProvider === 'openai_compat') {
    const key = cfg.openaiApiKey || cfg.openrouterApiKey;
    if (!key) return null;
    return {
      client: new OpenAI({
        apiKey: key,
        baseURL: cfg.openaiCompatBaseUrl,
      }),
      model: cfg.openaiCompatEmbeddingModel,
    };
  }

  if (!cfg.azureEndpoint || !cfg.azureApiKey) return null;
  return {
    client: new AzureOpenAI({
      endpoint: cfg.azureEndpoint,
      apiKey: cfg.azureApiKey,
      apiVersion: cfg.azureApiVersion,
      deployment: cfg.azureEmbeddingDeployment,
    }),
    model: cfg.azureEmbeddingDeployment,
  };
}

export async function chatJson<T>(params: {
  systemPrompt: string;
  userPrompt: string;
  schema: z.ZodType<T>;
  timeoutMs?: number;
  temperature?: number;
}): Promise<T> {
  const cfg = getAiConfig();
  const entry = getChatClient();
  if (!entry) {
    throw new Error('AI chat provider is not configured.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(new Error('AI_CHAT_TIMEOUT')),
    params.timeoutMs ?? cfg.chatTimeoutMs
  );

  try {
    // ponytail: force effort=none on OpenRouter so thinking models don't blow latency budgets on strict JSON endpoints; remove if reasoning is needed later.
    const requestBody = {
      model: entry.model,
      temperature: params.temperature ?? 0.2,
      response_format: { type: 'json_object' as const },
      messages: [
        { role: 'system' as const, content: params.systemPrompt },
        { role: 'user' as const, content: params.userPrompt },
      ],
      ...(cfg.chatProvider === 'openrouter' ? { reasoning: { effort: 'none' } } : {}),
    };

    const response = await entry.client.chat.completions.create(
      requestBody as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
      { signal: controller.signal }
    );

    const raw = response.choices[0]?.message?.content?.trim();
    if (!raw) {
      throw new Error('Empty AI chat response.');
    }

    const parsed = JSON.parse(raw);
    return params.schema.parse(parsed);
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateEmbedding(text: string): Promise<number[] | null> {
  const cfg = getAiConfig();
  const entry = getEmbeddingClient();
  if (!entry) return null;

  const trimmed = text.trim();
  if (!trimmed) return null;

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(new Error('AI_EMBEDDING_TIMEOUT')),
    cfg.embeddingTimeoutMs
  );

  try {
    const res = await entry.client.embeddings.create(
      {
        model: entry.model,
        input: trimmed.slice(0, 6000),
      },
      { signal: controller.signal }
    );
    const vec = res.data[0]?.embedding;
    if (!Array.isArray(vec) || vec.length !== 1536) {
      return null;
    }
    return vec;
  } catch (err) {
    console.warn('[AI Embedding skipped/failed]', err instanceof Error ? err.message : err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export function buildPostEmbeddingText(input: {
  universityShortName: string;
  clubName: string;
  categoryLabel: string;
  postTypeLabel: string;
  title: string;
  summary: string;
  tags: string[];
  contentMd: string;
}): string {
  return `[${input.universityShortName} ${input.clubName}｜${input.categoryLabel}｜${input.postTypeLabel}] 標題：${input.title}\n摘要：${input.summary}\n標籤：${input.tags.join(', ')}\n內文：${input.contentMd.slice(0, 1200)}`;
}
