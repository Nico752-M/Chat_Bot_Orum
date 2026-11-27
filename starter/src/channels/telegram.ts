
import type { ChannelAdapter, IncomingMessage, OutgoingReply, SendOptions } from "./shared";
import { IgnoredUpdate, reportSendFailure } from "./shared";
import type { Env } from "../env";

const TG_API = "https://api.telegram.org/bot";

interface TgUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: { id: number; first_name?: string; is_bot: boolean };
    chat: { id: number; type: string };
    date: number;
    text?: string;
    caption?: string;
    voice?: { file_id: string; duration: number };
    photo?: { file_id: string; width: number; height: number }[];
    document?: { file_id: string; file_name?: string; mime_type?: string };
  };
}

export async function resolveTelegramFileUrl(
  fileId: string,
  token: string,
): Promise<string | null> {
  // Telegram files are NOT directly addressable by file_id. You must call
  // getFile to obtain a file_path, then download from
  // https://api.telegram.org/file/bot<token>/<file_path> (per Bot API docs).
  const res = await fetch(`${TG_API}${token}/getFile?file_id=${fileId}`);
  if (!res.ok) return null;
  const json: any = await res.json();
  if (!json?.ok) return null;
  return `https://api.telegram.org/file/bot${token}/${json.result.file_path}`;
}

export const telegramAdapter: ChannelAdapter = {
  async parseIncoming(request: Request, env: Env): Promise<IncomingMessage> {
    const update = (await request.json()) as TgUpdate;
    const msg = update.message;

    // IgnoredUpdate → 200 para actualizaciones que no son mensajes procesables.
    if (!msg) throw new IgnoredUpdate("telegram: no es un message update");

    const channelUserId = String(msg.from.id);
    const displayName = msg.from.first_name;
    let text = msg.text;
    let audioUrl: string | undefined;
    let imageUrl: string | undefined;
    let fileUrl: string | undefined;
    const token = env.TELEGRAM_BOT_TOKEN ?? "";

    if (msg.voice) {
      audioUrl = (await resolveTelegramFileUrl(msg.voice.file_id, token)) ?? undefined;
    } else if (msg.photo?.length) {
      const largest = msg.photo[msg.photo.length - 1];
      imageUrl = (await resolveTelegramFileUrl(largest.file_id, token)) ?? undefined;
      text = msg.caption;
    } else if (msg.document) {
      fileUrl = (await resolveTelegramFileUrl(msg.document.file_id, token)) ?? undefined;
      text = msg.caption;
    }

    return {
      channel: "telegram",
      channelUserId,
      displayName,
      text,
      audioUrl,
      audioDurationS: msg.voice?.duration,
      imageUrl,
      fileUrl,
      fileName: msg.document?.file_name,
      fileMime: msg.document?.mime_type,
      // Detecta al propietario comparando con OWNER_TELEGRAM_CHAT_ID.
      isOwnerMessage:
        env.OWNER_TELEGRAM_CHAT_ID != null &&
        channelUserId === String(env.OWNER_TELEGRAM_CHAT_ID),
      receivedAt: Date.now(),
      rawPayload: update,
    };
  },

  async sendReply(reply: OutgoingReply, env: Env, opts?: SendOptions): Promise<void> {
    const token = env.TELEGRAM_BOT_TOKEN;
    if (!token) throw new Error("TELEGRAM_BOT_TOKEN not set");

    for (let i = 0; i < reply.chunks.length; i++) {
      // Indicador de escritura: best effort y sin bloquear el envío.
      void fetch(`${TG_API}${token}/sendChatAction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: reply.channelUserId,
          action: "typing",
        }),
      }).catch(() => {});

      const delay = i === 0 ? 0 : reply.interChunkDelayMs ?? 1000;
      if (delay > 0) {
        await new Promise((r) => setTimeout(r, delay));
      }

      const body: Record<string, unknown> = {
        chat_id: reply.channelUserId,
        text: reply.chunks[i],
      };

      // Teclado opcional únicamente en el último fragmento.
      if (reply.buttons?.length && i === reply.chunks.length - 1) {
        body.reply_markup = {
          keyboard: reply.buttons.map((b) => [{ text: b.title }]),
          one_time_keyboard: true,
          resize_keyboard: true,
        };
      }

      const res = await fetch(`${TG_API}${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        await reportSendFailure("telegram sendMessage", res, opts);
      }
    }

    // Los archivos multimedia se envían después de los mensajes de texto.
    for (const m of reply.media ?? []) {
      const method =
        m.kind === "image" ? "sendPhoto"
        : m.kind === "video" ? "sendVideo"
        : m.kind === "file" ? "sendDocument"
        : m.voice ? "sendVoice" : "sendAudio";

      const field =
        m.kind === "image" ? "photo"
        : m.kind === "video" ? "video"
        : m.kind === "file" ? "document"
        : m.voice ? "voice" : "audio";

      const res = await fetch(`${TG_API}${token}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: reply.channelUserId,
          [field]: m.url,
          ...(m.caption ? { caption: m.caption } : {}),
        }),
      }).catch((e) => {
        console.error("[telegram] media send:", e);
        if (opts?.strict) throw e;
        return null;
      });

      if (res && !res.ok) {
        await reportSendFailure(`[telegram] ${method}`, res, opts);
      }
    }
  },

  async showTyping(channelUserId: string, env: Env): Promise<void> {
    const token = env.TELEGRAM_BOT_TOKEN;
    if (!token) return;

    await fetch(`${TG_API}${token}/sendChatAction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: channelUserId, action: "typing" }),
    }).catch(() => {});
  },
};
