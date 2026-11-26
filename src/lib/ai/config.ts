export type ChatProvider = 'azure' | 'openrouter';
export type VisionProvider = 'azure' | 'openrouter' | 'disabled';
export type EmbeddingProvider = 'azure' | 'openai_compat' | 'disabled';

export function getAiConfig() {
  const chatProvider = (process.env.AI_CHAT_PROVIDER?.trim() || 'azure') as ChatProvider;
  const visionProvider = (process.env.AI_VISION_PROVIDER?.trim() ||
    chatProvider) as VisionProvider;
  const embeddingProvider = (process.env.AI_EMBEDDING_PROVIDER?.trim() ||
    'azure') as EmbeddingProvider;

  return {
    chatProvider,
    visionProvider,
    embeddingProvider,
    chatTimeoutMs: Number(process.env.AI_CHAT_TIMEOUT_MS ?? 8000),
    visionTimeoutMs: Number(process.env.AI_VISION_TIMEOUT_MS ?? 12000),
    embeddingTimeoutMs: Number(process.env.AI_EMBEDDING_TIMEOUT_MS ?? 4000),
    azureEndpoint: process.env.AZURE_OPENAI_ENDPOINT?.trim() || '',
    azureApiKey: process.env.AZURE_OPENAI_API_KEY?.trim() || '',
    azureApiVersion: process.env.AZURE_OPENAI_API_VERSION?.trim() || '2024-10-21',
    azureChatDeployment: process.env.AZURE_OPENAI_CHAT_DEPLOYMENT?.trim() || 'gpt-4o-mini',
    azureVisionDeployment:
      process.env.AZURE_OPENAI_VISION_DEPLOYMENT?.trim() ||
      process.env.AZURE_OPENAI_CHAT_DEPLOYMENT?.trim() ||
      'gpt-4o-mini',
    azureEmbeddingDeployment:
      process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT?.trim() || 'text-embedding-3-small',
    openrouterApiKey: process.env.OPENROUTER_API_KEY?.trim() || '',
    openrouterChatModel:
      process.env.OPENROUTER_CHAT_MODEL?.trim() || 'deepseek/deepseek-chat-v3-0324',
    openrouterVisionModel:
      process.env.OPENROUTER_VISION_MODEL?.trim() || 'google/gemini-2.0-flash-001',
    openaiApiKey: process.env.OPENAI_API_KEY?.trim() || '',
    openaiCompatBaseUrl: process.env.OPENAI_COMPAT_BASE_URL?.trim() || undefined,
    openaiCompatEmbeddingModel:
      process.env.OPENAI_COMPAT_EMBEDDING_MODEL?.trim() || 'text-embedding-3-small',
  };
}
