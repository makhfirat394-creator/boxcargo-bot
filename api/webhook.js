const BOT_TOKEN = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
const WEBHOOK_SECRET = (process.env.TELEGRAM_WEBHOOK_SECRET || '').trim();

const CONFIG = {
  onboarding: {
    enabled: true,
    telegramChannelText:
      '1️⃣ Подпишитесь на наш Telegram-канал, чтобы не пропустить новости, акции и обновления!',
    telegramChannelButtonText: 'Подписаться на Telegram-канал',
    telegramChannelUrl: 'https://t.me/BoxCargoofficial',
    instagramText:
      '2️⃣ Подпишитесь на наш Instagram — там обзоры товаров, сторис и специальные предложения!',
    instagramButtonText: 'Подписаться на Instagram',
    instagramUrl: 'https://www.instagram.com/yoko_zfd?exln=MTA1dzE3eDU0Zmcxdg==',
    appMessageText:
      '🛍 Готово! Нажмите кнопку <b>«Приложение Йоко Магазин»</b> ниже, чтобы сразу открыть наше приложение:',
    appButtonText: 'Приложение Йоко Магазин',
    appUrl: 'https://yoko-store.ai.studio',
    persistentKeyboardEnabled: true,
    menuButtonEnabled: true,
  },
  commands: [
    {
      command: '/help',
      replyText:
        '<b>Доступные команды:</b>\n/start — Подписки и запуск Йоко Магазина\n/status — Проверка работы бота\n/ping — Замер отклика\n/help — Эта справка',
    },
    {
      command: '/status',
      replyText:
        'Бот работает 24/7 на Vercel (Webhook).\nВремя сервера: <code>{time}</code>',
    },
    {
      command: '/ping',
      replyText: 'Pong! Бот отвечает без задержек.',
    },
  ],
  autoReplies: [
    {
      trigger: 'привет',
      matchType: 'contains',
      replyText:
        'Здравствуйте, {name}! Нажмите /start или кнопку «Приложение Йоко Магазин», чтобы открыть магазин.',
    },
    {
      trigger: 'магазин',
      matchType: 'contains',
      replyText:
        'Вы можете открыть Йоко Магазин в любое время по кнопке в меню или через /start.',
    },
  ],
  fallbackText:
    'Получил ваше сообщение: «{text}».\nИспользуйте /start для запуска магазина или /help для списка команд.',
};

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

function isHttps(url) {
  return Boolean(url && /^https:\/\/.+/i.test(url.trim()));
}

function formatText(tpl, ctx) {
  const now = new Date().toISOString();
  return tpl
    .replaceAll('{name}', ctx.name || 'Пользователь')
    .replaceAll('{username}', ctx.username ? '@' + ctx.username : 'без username')
    .replaceAll('{text}', ctx.text || '')
    .replaceAll('{time}', now);
}

async function sendYokoAppMessage(chatId, ctx) {
  const ob = CONFIG.onboarding;
  const appBtnText = ob.appButtonText.trim();
  const inlineButton = isHttps(ob.appUrl)
    ? { text: appBtnText, web_app: { url: ob.appUrl.trim() } }
    : { text: appBtnText, callback_data: 'action:open_app' };

  await tg('sendMessage', {
    chat_id: chatId,
    text: formatText(ob.appMessageText, ctx),
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: [[inlineButton]] },
  });

  if (ob.persistentKeyboardEnabled && isHttps(ob.appUrl)) {
    await tg('sendMessage', {
      chat_id: chatId,
      text: `Кнопка «${appBtnText}» закреплена внизу меню бота.`,
      parse_mode: 'HTML',
      reply_markup: {
        keyboard: [[{ text: appBtnText, web_app: { url: ob.appUrl.trim() } }]],
        resize_keyboard: true,
        is_persistent: true,
      },
    });
  }
}

async function handleUpdate(update) {
  const isCallback = Boolean(update?.callback_query);
  const chatId = update?.message?.chat?.id ?? update?.callback_query?.message?.chat?.id;
  const from = update?.message?.from ?? update?.callback_query?.from;
  let text = isCallback ? update.callback_query?.data : update?.message?.text;
  if (!chatId || !text) return;

  if (isCallback) {
    await tg('answerCallbackQuery', {
      callback_query_id: update.callback_query.id,
    }).catch(() => {});
    if (text === 'action:status') text = '/status';
    if (text === 'action:help') text = '/help';
    if (text === 'action:open_app') text = CONFIG.onboarding.appButtonText;
  }

  const ctx = {
    name: from?.first_name || 'Пользователь',
    username: from?.username || '',
    text,
  };
  const trimmed = text.trim();
  const ob = CONFIG.onboarding;

  if (trimmed.startsWith('/')) {
    const cmdName = trimmed.split(/\s+/)[0].split('@')[0].toLowerCase();
    if (cmdName === '/start' && ob.enabled) {
      await tg('sendMessage', {
        chat_id: chatId,
        text: formatText(ob.telegramChannelText, ctx),
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[{ text: ob.telegramChannelButtonText, url: ob.telegramChannelUrl }]],
        },
      });
      await tg('sendMessage', {
        chat_id: chatId,
        text: formatText(ob.instagramText, ctx),
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[{ text: ob.instagramButtonText, url: ob.instagramUrl }]],
        },
      });
      await sendYokoAppMessage(chatId, ctx);

      if (ob.menuButtonEnabled && isHttps(ob.appUrl)) {
        await tg('setChatMenuButton', {
          chat_id: chatId,
          menu_button: {
            type: 'web_app',
            text: ob.appButtonText.slice(0, 32),
            web_app: { url: ob.appUrl.trim() },
          },
        }).catch(() => {});
      }
      return;
    }

    const cmd = CONFIG.commands.find((c) => c.command === cmdName);
    if (cmd) {
      await tg('sendMessage', {
        chat_id: chatId,
        text: formatText(cmd.replyText, ctx),
        parse_mode: 'HTML',
      });
      return;
    }
  }

  if (trimmed.toLowerCase() === ob.appButtonText.toLowerCase()) {
    await sendYokoAppMessage(chatId, ctx);
    return;
  }

  let reply = null;
  for (const rule of CONFIG.autoReplies) {
    if (trimmed.toLowerCase().includes(rule.trigger.toLowerCase())) {
      reply = formatText(rule.replyText, ctx);
      break;
    }
  }

  if (!reply) {
    reply = formatText(CONFIG.fallbackText, ctx);
  }

  await tg('sendMessage', {
    chat_id: chatId,
    text: reply,
    parse_mode: 'HTML',
  });
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      endpoint: '/api/webhook',
      tokenConfigured: Boolean(BOT_TOKEN),
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  if (!BOT_TOKEN) {
    return res.status(500).json({ ok: false, error: 'TELEGRAM_BOT_TOKEN is missing' });
  }

  if (
    WEBHOOK_SECRET &&
    req.headers['x-telegram-bot-api-secret-token'] !== WEBHOOK_SECRET
  ) {
    return res.status(401).json({ ok: false, error: 'Invalid secret token' });
  }

  try {
    await handleUpdate(req.body);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(200).json({ ok: false, error: err?.message || 'Error' });
  }
}
