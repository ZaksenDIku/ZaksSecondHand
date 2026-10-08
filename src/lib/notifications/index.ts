import { db } from "../db/index";
import { notificationLog } from "../db/schema";
import { getAppSettings } from "../db/settings";

export interface NotificationPayload {
  title: string;
  body: string;
  url?: string;
}

export interface NotificationSendResult {
  ok: boolean;
  detail: string;
}

export interface NotificationChannel {
  key: string;
  label: string;
  /** Returns true when usable, otherwise a human readable reason. */
  status(): { ready: boolean; reason: string };
  send(payload: NotificationPayload): Promise<NotificationSendResult>;
}

function log(channel: string, status: string, title: string, detail: string) {
  try {
    db.insert(notificationLog)
      .values({
        id: `ntf_${Math.random().toString(36).slice(2, 10)}`,
        channel,
        status,
        title,
        detail,
        createdAt: Date.now(),
      })
      .run();
  } catch {
    // logging must never break a notification
  }
}

const browser: NotificationChannel = {
  key: "browser",
  label: "Browser-notifikation",
  status: () => ({
    ready: true,
    reason: "Vises i browseren når du giver tilladelse (klik bjælken øverst)",
  }),
  async send(payload) {
    // Browser notifications are delivered by the client polling /api/alerts.
    log("browser", "queued", payload.title, payload.body.slice(0, 200));
    return { ok: true, detail: "Kø til browser-polling" };
  },
};

const telegram: NotificationChannel = {
  key: "telegram",
  label: "Telegram",
  status() {
    const s = getAppSettings().notifications.telegram;
    if (!s.enabled) return { ready: false, reason: "Slået fra" };
    if (!s.botToken || !s.chatId) return { ready: false, reason: "botToken/chatId mangler" };
    return { ready: true, reason: "Konfigureret" };
  },
  async send(payload) {
    const s = getAppSettings().notifications.telegram;
    try {
      const res = await fetch(`https://api.telegram.org/bot${s.botToken}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: s.chatId,
          text: `*${payload.title}*\n${payload.body}${payload.url ? `\n${payload.url}` : ""}`,
          parse_mode: "Markdown",
          disable_web_page_preview: false,
        }),
        signal: AbortSignal.timeout(10000),
      });
      const ok = res.ok;
      log("telegram", ok ? "sent" : "failed", payload.title, `HTTP ${res.status}`);
      return { ok, detail: `HTTP ${res.status}` };
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      log("telegram", "failed", payload.title, detail);
      return { ok: false, detail };
    }
  },
};

const discord: NotificationChannel = {
  key: "discord",
  label: "Discord webhook",
  status() {
    const s = getAppSettings().notifications.discord;
    if (!s.enabled) return { ready: false, reason: "Slået fra" };
    if (!s.webhookUrl) return { ready: false, reason: "Webhook-URL mangler" };
    return { ready: true, reason: "Konfigureret" };
  },
  async send(payload) {
    const s = getAppSettings().notifications.discord;
    try {
      const res = await fetch(s.webhookUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          embeds: [
            {
              title: payload.title,
              description: payload.body,
              url: payload.url,
              color: 0xff4d3d,
            },
          ],
        }),
        signal: AbortSignal.timeout(10000),
      });
      log("discord", res.ok ? "sent" : "failed", payload.title, `HTTP ${res.status}`);
      return { ok: res.ok, detail: `HTTP ${res.status}` };
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      log("discord", "failed", payload.title, detail);
      return { ok: false, detail };
    }
  },
};

const email: NotificationChannel = {
  key: "email",
  label: "E-mail (Resend)",
  status() {
    const s = getAppSettings().notifications.email;
    const key = process.env.RESEND_API_KEY || s.resendApiKey;
    if (!s.enabled) return { ready: false, reason: "Slået fra" };
    if (!key) return { ready: false, reason: "RESEND_API_KEY mangler i .env.local" };
    if (!s.to) return { ready: false, reason: "Modtageradresse mangler" };
    return { ready: true, reason: "Konfigureret" };
  },
  async send(payload) {
    const s = getAppSettings().notifications.email;
    const key = process.env.RESEND_API_KEY || s.resendApiKey;
    if (!key || !s.to) return { ok: false, detail: "Ikke konfigureret" };
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: `Bearer ${key}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          from: s.from,
          to: [s.to],
          subject: payload.title,
          text: `${payload.body}\n\n${payload.url ?? ""}`,
        }),
        signal: AbortSignal.timeout(10000),
      });
      log("email", res.ok ? "sent" : "failed", payload.title, `HTTP ${res.status}`);
      return { ok: res.ok, detail: `HTTP ${res.status}` };
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      log("email", "failed", payload.title, detail);
      return { ok: false, detail };
    }
  },
};

export const notificationChannels: NotificationChannel[] = [browser, telegram, discord, email];

export async function dispatchNotifications(payload: NotificationPayload): Promise<void> {
  const settings = getAppSettings();
  const enabled = new Set<string>(settings.profile.notifications);
  if (settings.notifications.browser) enabled.add("browser");
  if (settings.notifications.telegram.enabled) enabled.add("telegram");
  if (settings.notifications.discord.enabled) enabled.add("discord");
  if (settings.notifications.email.enabled) enabled.add("email");

  for (const channel of notificationChannels) {
    if (!enabled.has(channel.key)) continue;
    const status = channel.status();
    if (!status.ready) continue;
    await channel.send(payload).catch(() => undefined);
  }
}
