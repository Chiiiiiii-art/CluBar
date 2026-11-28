import crypto from 'node:crypto';
import { AppError } from '@/lib/errors';

// Publish center phase 1 (docs/one-stop-publish-solution.md §3.7): Discord webhook storage and send.
// The webhook URL is a bearer secret: never log it, never return it to the client.

const DISCORD_HOSTS = new Set(['discord.com', 'discordapp.com', 'ptb.discord.com', 'canary.discord.com']);
const WEBHOOK_PATH = /^\/api\/webhooks\/(\d{5,25})\/([A-Za-z0-9_-]{20,200})$/;

/** Strictly validates a Discord channel webhook URL and returns its canonical form, or null. */
export function normalizeDiscordWebhookUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
  if (!DISCORD_HOSTS.has(url.hostname)) return null;
  if (url.search || url.hash) return null;
  const m = WEBHOOK_PATH.exec(url.pathname);
  if (!m) return null;
  return `https://${url.hostname}/api/webhooks/${m[1]}/${m[2]}`;
}

function secretKey(): Buffer {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret) {
    throw new AppError(
      500,
      'SERVER_SECRET_MISSING',
      '伺服器還沒設定加密金鑰，暫時無法保存或使用 Discord 頻道，請聯絡平台管理員。'
    );
  }
  return crypto.createHash('sha256').update(secret, 'utf8').digest();
}

/** AES-256-GCM; stored as base64 `iv.tag.ciphertext`. */
export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', secretKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), ct].map((b) => b.toString('base64')).join('.');
}

export function decryptSecret(stored: string): string {
  const key = secretKey();
  try {
    const [iv, tag, ct] = stored.split('.').map((p) => Buffer.from(p, 'base64'));
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
  } catch {
    throw new AppError(
      409,
      'DISCORD_WEBHOOK_UNREADABLE',
      '已保存的 Discord 頻道讀不出來，請到「發布管道」重新貼一次 Webhook 網址。'
    );
  }
}

export interface DiscordEmbedInput {
  title: string;
  url: string;
  description: string;
  imageUrl: string;
}

export function buildDiscordPayload(content: string, embed: DiscordEmbedInput) {
  return {
    content: content.slice(0, 2000),
    // Text typed by officers must never ping @everyone / @here / roles.
    allowed_mentions: { parse: [] as string[] },
    embeds: [
      {
        title: embed.title.slice(0, 256),
        url: embed.url,
        description: embed.description.slice(0, 4096),
        image: { url: embed.imageUrl },
      },
    ],
  };
}

/** Posts to a Discord webhook with a 10s timeout; maps failures to Chinese AppErrors without exposing the URL. */
export async function sendDiscordWebhook(
  webhookUrl: string,
  payload: ReturnType<typeof buildDiscordPayload>,
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  let res: Response;
  try {
    res = await fetchImpl(`${webhookUrl}?wait=true`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new AppError(504, 'DISCORD_TIMEOUT', 'Discord 超過 10 秒沒有回應，請稍後再發一次。');
    }
    throw new AppError(502, 'DISCORD_UNREACHABLE', '連不上 Discord，請稍後再試。');
  } finally {
    clearTimeout(timer);
  }
  if (res.ok) return;
  if (res.status === 401 || res.status === 403 || res.status === 404) {
    throw new AppError(
      409,
      'DISCORD_WEBHOOK_INVALID',
      '這個 Discord Webhook 已被刪除或失效，請到「發布管道」重新設定。'
    );
  }
  if (res.status === 429) {
    throw new AppError(429, 'DISCORD_RATE_LIMITED', 'Discord 說發太快了，請等幾秒再試。');
  }
  if (res.status === 400) {
    throw new AppError(400, 'DISCORD_REJECTED', 'Discord 不接受這則訊息，請縮短文字或移除特殊格式後再試。');
  }
  throw new AppError(502, 'DISCORD_ERROR', 'Discord 暫時出問題，請稍後再試。');
}
