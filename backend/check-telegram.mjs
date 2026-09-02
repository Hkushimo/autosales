import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync("/opt/global-syndicate-form/.env", "utf8")
    .split(/\n/)
    .filter(Boolean)
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1)];
    }),
);

const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getMe`);
const json = await res.json().catch(() => ({}));

console.log(JSON.stringify({
  http_status: res.status,
  ok: Boolean(json.ok),
  description: json.description || "",
}));
