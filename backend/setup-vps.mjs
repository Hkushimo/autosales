import { chmodSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";

const raw = readFileSync("/opt/global-syndicate-form/telegram_token.txt", "utf8").trim();
const token = raw.includes("=")
  ? raw.split("=").slice(1).join("=").trim().replace(/^['"]|['"]$/g, "")
  : raw;

let botOk = false;
let updateCount = 0;
let chatId = "";

try {
  const getMe = await fetch(`https://api.telegram.org/bot${token}/getMe`).then((res) => res.json());
  botOk = Boolean(getMe.ok);

  if (botOk) {
    const updates = await fetch(`https://api.telegram.org/bot${token}/getUpdates`).then((res) => res.json());
    updateCount = Array.isArray(updates.result) ? updates.result.length : 0;

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
unlinkSync("/opt/global-syndicate-form/telegram_token.txt");

console.log(JSON.stringify({ bot_ok: botOk, update_count: updateCount, chat_configured: Boolean(chatId) }));
