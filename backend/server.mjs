import { appendFile, mkdir, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 8788);
const token = process.env.TELEGRAM_BOT_TOKEN || "";
const chatId = process.env.TELEGRAM_CHAT_ID || "";
const submissionsDir = process.env.SUBMISSIONS_DIR || join(__dirname, "submissions");

const requiredFields = [
  "vehicle_year",
  "vehicle_make",
  "vehicle_model",
  "odometer_target",
  "max_budget",
  "full_name",
  "phone",
  "email",
  "city",
  "state",
  "fee_acknowledgement",
];

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function text(value) {
  return String(value || "").trim();
}

function parseBody(body) {
  const params = new URLSearchParams(body);
  return Object.fromEntries(params.entries());
}

function response(res, status, body, contentType = "text/html; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(body);
}

function formatTelegramMessage(data) {
  const lines = [
    "New vehicle inquiry",
    "",
    `Vehicle: ${text(data.vehicle_year)} ${text(data.vehicle_make)} ${text(data.vehicle_model)}`,
    `Odometer target: ${text(data.odometer_target)}`,
    `Max budget: ${text(data.max_budget)}`,
    `Notes: ${text(data.vehicle_notes) || "None provided"}`,
    "",
    `Name: ${text(data.full_name)}`,
    `Phone: ${text(data.phone)}`,
    `Email: ${text(data.email)}`,
    `Location: ${text(data.city)}, ${text(data.state)}`,
    "",
    "Fee acknowledged: yes",
  ];

  return lines.join("\n");
}

async function sendTelegram(data) {
  if (!token || !chatId) {
    return { ok: false, skipped: true, reason: "Telegram token or chat ID is not configured." };
  }

  const telegramRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: formatTelegramMessage(data),
      disable_web_page_preview: true,
    }),
  });

  const result = await telegramRes.json().catch(() => ({}));
  if (!telegramRes.ok || !result.ok) {
    throw new Error(result.description || `Telegram request failed with ${telegramRes.status}`);
  }

  return { ok: true };
}

async function collectRequestBody(req) {
  let body = "";

  for await (const chunk of req) {
    body += chunk;
    if (body.length > 1_000_000) {
      throw new Error("Request body is too large.");
    }
  }

  return body;
}

function thankYouPage(returnUrl = "/") {
  const safeReturnUrl = /^https?:\/\//.test(returnUrl) ? returnUrl : "/";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Inquiry Sent | Global Syndicate Auto Sales</title>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #050505; color: #fff; font-family: Arial, sans-serif; }
      main { width: min(640px, calc(100vw - 40px)); padding: 42px; border: 1px solid rgba(255, 138, 0, .45); border-radius: 8px; background: #111; }
      h1 { margin: 0 0 12px; font-size: clamp(2rem, 6vw, 3.6rem); line-height: 1; text-transform: uppercase; }
      p { color: #b8b8b8; line-height: 1.6; }
      a { display: inline-flex; margin-top: 18px; min-height: 46px; align-items: center; padding: 0 18px; border-radius: 8px; background: #ff8a00; color: #111; font-weight: 900; text-decoration: none; }
    </style>
  </head>
  <body>
    <main>
      <h1>Inquiry sent.</h1>
      <p>Thank you. Global Syndicate Auto Sales received your vehicle request and will follow up with the next step.</p>
      <a href="${escapeHtml(safeReturnUrl)}">Back to site</a>
    </main>
  </body>
</html>`;
}

async function handleInquiry(req, res) {
  try {
    const data = parseBody(await collectRequestBody(req));

    if (text(data.website)) {
      response(res, 200, thankYouPage(req.headers.referer));
      return;
    }

    const missing = requiredFields.filter((field) => !text(data[field]));
    if (missing.length) {
      response(res, 400, `Missing required fields: ${missing.map(escapeHtml).join(", ")}`, "text/plain; charset=utf-8");
      return;
    }

    const record = {
      created_at: new Date().toISOString(),
      remote_address: req.socket.remoteAddress,
      vehicle_year: text(data.vehicle_year),
      vehicle_make: text(data.vehicle_make),
      vehicle_model: text(data.vehicle_model),
      odometer_target: text(data.odometer_target),
      max_budget: text(data.max_budget),
      vehicle_notes: text(data.vehicle_notes),
      full_name: text(data.full_name),
      phone: text(data.phone),
      email: text(data.email),
      city: text(data.city),
      state: text(data.state),
      fee_acknowledgement: text(data.fee_acknowledgement),
    };

    await mkdir(submissionsDir, { recursive: true });
    await appendFile(join(submissionsDir, "inquiries.ndjson"), `${JSON.stringify(record)}\n`);
    await sendTelegram(record);
    response(res, 200, thankYouPage(req.headers.referer));
  } catch (error) {
    console.error(error);
    response(
      res,
      500,
      "There was a problem sending the inquiry. Please call or email Global Syndicate Auto Sales.",
      "text/plain; charset=utf-8",
    );
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (req.method === "OPTIONS") {
    response(res, 204, "");
    return;
  }

  if (req.method === "GET" && url.pathname === "/health") {
    const status = {
      ok: true,
      telegram_configured: Boolean(token && chatId),
      port,
    };
    response(res, 200, JSON.stringify(status), "application/json; charset=utf-8");
    return;
  }

  if (req.method === "POST" && url.pathname === "/inquiry") {
    await handleInquiry(req, res);
    return;
  }

  response(res, 404, "Not found", "text/plain; charset=utf-8");
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Global Syndicate form handler listening on ${port}`);
});
