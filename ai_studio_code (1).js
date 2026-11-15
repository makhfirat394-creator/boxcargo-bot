const BOT_TOKEN = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
const WEBHOOK_SECRET = (process.env.TELEGRAM_WEBHOOK_SECRET || '').trim();
const APP_URL = 'https://yoko-store.ai.studio';
const APP_BUTTON_TEXT = 'Приложение Йоко Магазин';

async function tg(method, payload) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const data = await res.json();
  if (!data.ok) {
    throw new Error(data.description || `Telegram API error (${res.status})`);
  }
  return data.result;
}

export default async function handler(req, res) {
  if (!BOT_TOKEN) {
    return res.status(400).json({
      ok: false,
      error:
        'Не задан TELEGRAM_BOT_TOKEN. Добавьте его в Vercel: Settings -> Environment Variables -> TELEGRAM_BOT_TOKEN, затем сделайте Redeploy.',
    });
  }

  try {
    const proto =
      String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
    const host = req.headers.host;
    const webhookUrl = `${proto}://${host}/api/webhook`;

    const me = await tg('getMe');
    await tg('setWebhook', {
      url: webhookUrl,
      secret_token: WEBHOOK_SECRET || undefined,
      allowed_updates: ['message', 'callback_query'],
    });
    await tg('setMyCommands', {
      commands: [
        { command: 'start', description: 'Подписки и запуск Йоко Магазина' },
        { command: 'status', description: 'Проверка работы бота' },
        { command: 'ping', description: 'Проверка отклика' },
        { command: 'help', description: 'Список команд' },
      ],
    });
    await tg('setChatMenuButton', {
      menu_button: {
        type: 'web_app',
        text: APP_BUTTON_TEXT.slice(0, 32),
        web_app: { url: APP_URL },
      },
    });

    return res.status(200).json({
      ok: true,
      message: 'Готово! Бот успешно подключён к Vercel и работает 24/7.',
      bot: `@${me.username}`,
      webhookUrl,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err?.message || 'Ошибка при настройке Telegram Webhook',
    });
  }
}