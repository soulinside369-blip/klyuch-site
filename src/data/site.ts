// ЕДИНСТВЕННЫЙ источник контента сайта. Заглушки в квадратных скобках — заменить реальными данными.
// Формат (решение владельца 15.10.2026): минимализм, 3 полноэкранных слайда + трейлер-заставка.

export const brand = {
  name: 'КЛЮЧ',
  tagline: 'IT-агентство полного цикла',
  phone: '[+7 000 000-00-00]',
  phoneHref: 'tel:+70000000000',
  email: '[hello@домен.ru]',
  telegram: 'https://t.me/',
  telegramLabel: '[@telegram]',
  legal: '[ООО «…», ИНН …, ОГРН …]',
  address: '[Адрес]',
  responseTime: '[N] часов',
};

// Трейлер: кадры заставки по порядку (до 7 секунд, показывается один раз за визит).
export const trailer = {
  open: ['У каждой задачи', 'есть решение'],
  cuts: ['Сайты', 'Приложения', 'Реклама', 'Маркетинг', 'Автоматизация'],
  close: 'Нужен только',
};

// Слайд 1 — оффер
export const hero = {
  kicker: 'IT-агентство полного цикла',
  titleStart: 'Открываем',
  rotating: ['рост.', 'продажи.', 'процессы.', 'рынки.'],
  lead: 'Приложения, сайты, реклама и автоматизация для бизнеса, который не может позволить себе ошибку.',
  directions: ['Приложения', 'Сайты', 'Реклама', 'Маркетинг', 'Автоматизация', 'IT-консалтинг', 'ИИ-ассистенты', 'CRM'],
  range: { from: '30 тыс. ₽', to: '25 млн ₽' },
};

// Слайд 2 — портфолио: панели в фирменных цветах клиентов (без логотипов — права на знаки у владельцев).
// Цвета — по публичному фирменному стилю, ПРИБЛИЗИТЕЛЬНО: заменить точными HEX из брендбуков.
// Только реальные факты: result — когда есть цифры. Названия клиентов — с их согласия.
export type CaseArt = 'realty' | 'electronics' | 'finance' | 'hockey';
export type CaseTheme = { bg: string; text: string; line: string; faint: string; accent: string; stripe?: string };
export type Case = { client: string; industry: string; work: string; art: CaseArt; theme: CaseTheme; result?: string; draft?: boolean };

export const cases: Case[] = [
  { client: 'Циан', industry: 'Недвижимость', work: 'Сайт', art: 'realty',
    theme: { bg: '#0468FF', text: '#FFFFFF', line: 'rgba(255,255,255,.62)', faint: 'rgba(255,255,255,.22)', accent: '#FFFFFF' } },
  { client: 'Toshiba', industry: 'Электроника', work: 'Сайт', art: 'electronics',
    theme: { bg: '#F4F4F2', text: '#141414', line: 'rgba(20,20,20,.5)', faint: 'rgba(20,20,20,.14)', accent: '#E60012' } },
  { client: 'Сбербанк', industry: 'Финансы', work: 'Сайт', art: 'finance',
    theme: { bg: 'linear-gradient(150deg,#0B7F3F 0%,#21A038 55%,#3DBA4E 100%)', text: '#FFFFFF', line: 'rgba(255,255,255,.6)', faint: 'rgba(255,255,255,.2)', accent: '#F2E52E' } },
  { client: 'ХК «Спартак» Москва', industry: 'Спорт', work: 'Сайт', art: 'hockey',
    theme: { bg: '#C8102E', text: '#FFFFFF', line: 'rgba(255,255,255,.6)', faint: 'rgba(255,255,255,.2)', accent: '#FFFFFF', stripe: 'rgba(255,255,255,.92)' } },
];
export const publishedCases = cases.filter((c) => !c.draft);

// Слайд 3 — контакты
export const contact = {
  titleA: 'Есть задача?',
  titleB: 'Откроем.',
  lead: 'Ответим в течение [N] часов: разберём задачу, назовём сроки и вилку бюджета.',
};
