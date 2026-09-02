import { chmodSync, existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";

const raw = readFileSync("/opt/global-syndicate-form/telegram_token.txt", "utf8").trim();
const parsed = Object.fromEntries(
  raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "")];
    }),
);
const token = parsed.TELEGRAM_BOT_TOKEN || raw.split(/\r?\n/).find((line) => line.includes(":"))?.trim() || "";
const configuredChatId = parsed.TELEGRAM_CHAT_ID || "";

let botOk = false;
let updateCount = 0;
let chatId = configuredChatId;

try {
  const getMe = await fetch(`https://api.telegram.org/bot${token}/getMe`).then((res) => res.json());
  botOk = Boolean(getMe.ok);

  if (botOk) {
    const updates = await fetch(`https://api.telegram.org/bot${token}/getUpdates`).then((res) => res.json());
    updateCount = Array.isArray(updates.result) ? updates.result.length : 0;

    if (!chatId) {
      for (const item of updates.result || []) {
        const chat =
          item.message?.chat ||
          item.channel_post?.chat ||
          item.callback_query?.message?.chat;
        if (chat?.id) {
          chatId = String(chat.id);
        }
      }
    }
  }
} catch {
  botOk = false;
}

writeFileSync(
  "/opt/global-syndicate-form/.env",
  [
    "PORT=8788",
    `TELEGRAM_BOT_TOKEN=${token}`,
    `TELEGRAM_CHAT_ID=${chatId}`,
    "SUBMISSIONS_DIR=/opt/global-syndicate-form/submissions",
    "",
  ].join("\n"),
  { mode: 0o600 },
);
chmodSync("/opt/global-syndicate-form/.env", 0o600);
if (existsSync("/opt/global-syndicate-form/telegram_token.txt")) {
  unlinkSync("/opt/global-syndicate-form/telegram_token.txt");
}

console.log(JSON.stringify({ bot_ok: botOk, update_count: updateCount, chat_configured: Boolean(chatId) }));
