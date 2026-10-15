// ЕДИНСТВЕННЫЙ источник контента сайта. Заглушки в квадратных скобках — заменить реальными данными.
// Формат (решение владельца 15.10.2026): минимализм, 3 полноэкранных слайда + трейлер-заставка.

export const brand = {
  name: 'КЛЮЧ',
  tagline: 'IT-агентство полного цикла',
  phone: '+7 996 406-69-65',          // владелец, 16.10.2026
  phoneHref: 'tel:+79964066965',
  email: '[hello@домен.ru]',
  telegram: 'https://t.me/tree_inside', // владелец, 16.10.2026 01:40 (было @inside_3); второй ник @nik-skolkovo — уточнить написание
  telegramLabel: '@tree_inside',
  legal: '[ООО «…», ИНН …, ОГРН …]',
  address: '[Адрес]',
  responseTime: '1 часа',
};

// Трейлер ~7 с: что делаем → для кого делали → бренд. 15.10 21:02 владелец: «слишком быстро, между словами 0,6 с».
// step — шаг между словами склейки, с. При изменении сдвинуть тайминги линии/прогресса/ключа в global.css (раздел ТРЕЙЛЕР).
export const trailer = {
  step: 0.6,
  cuts: ['Сайты', 'Приложения', 'Реклама', 'Маркетинг', 'Автоматизация'],
  proof: 'для Циана, Toshiba, Сбера и «Спартака»',
};

// Слайд 1 — оффер
export const hero = {
  kicker: 'IT-подразделение под ключ',
  titleStart: 'Открываем',
  rotating: ['рост.', 'продажи.', 'процессы.', 'рынки.'],
  lead: 'Приложения, сайты, реклама и автоматизация для бизнеса, где ошибка стоит дорого. Одна команда — от аудита до роста выручки.',
  cta: 'Разбор задачи за 1 час',
  guarantees: ['Ответ за 1 час', 'Договор и фиксированная смета', 'Код и доступы — ваши'],
  proofLabel: 'Нам доверяли',
  directions: ['Приложения', 'Сайты', 'Реклама', 'Маркетинг', 'Автоматизация', 'IT-консалтинг', 'ИИ-ассистенты', 'CRM'],
  range: { from: '30 тыс. ₽', to: '25 млн ₽' },
};

// Слайд 2 — портфолио: панели в фирменных цветах клиентов (без логотипов — права на знаки у владельцев).
// Цвета сверены 16.10.2026 по открытым источникам (логотипы и сайты брендов): Сбер #21A038/#F2E913 и Toshiba #E51F1E —
// по логотипам; «Спартак» #C32B46 — по логотипу ХК; Циан #0468FF — по интерфейсу cian.ru (брендбук не опубликован).
// Только реальные факты: result — когда есть цифры. Названия клиентов — с их согласия.
export type CaseArt = 'realty' | 'electronics' | 'finance' | 'hockey';
export type CaseTheme = { bg: string; text: string; line: string; faint: string; accent: string; stripe?: string };
export type Case = { client: string; industry: string; work: string; art: CaseArt; theme: CaseTheme; result?: string; draft?: boolean };

export const cases: Case[] = [
  { client: 'Циан', industry: 'Недвижимость', work: 'Сайт', art: 'realty',
    theme: { bg: '#0468FF', text: '#FFFFFF', line: 'rgba(255,255,255,.62)', faint: 'rgba(255,255,255,.22)', accent: '#FFFFFF' } },
  { client: 'Toshiba', industry: 'Электроника', work: 'Сайт', art: 'electronics',
    theme: { bg: '#F4F4F2', text: '#141414', line: 'rgba(20,20,20,.5)', faint: 'rgba(20,20,20,.14)', accent: '#E51F1E' } },
  { client: 'Сбербанк', industry: 'Финансы', work: 'Сайт', art: 'finance',
    theme: { bg: 'linear-gradient(150deg,#0B7F3F 0%,#21A038 55%,#3DBA4E 100%)', text: '#FFFFFF', line: 'rgba(255,255,255,.6)', faint: 'rgba(255,255,255,.2)', accent: '#F2E913' } },
  { client: 'ХК «Спартак» Москва', industry: 'Спорт', work: 'Сайт', art: 'hockey',
    theme: { bg: '#C32B46', text: '#FFFFFF', line: 'rgba(255,255,255,.6)', faint: 'rgba(255,255,255,.2)', accent: '#FFFFFF', stripe: 'rgba(255,255,255,.92)' } },
];
export const publishedCases = cases.filter((c) => !c.draft);

// Слайд 3 — контакты
export const contact = {
  titleA: 'Есть задача?',
  titleB: 'Откроем.',
  lead: 'Ответим в течение часа: разберём задачу, назовём сроки и вилку бюджета.',
};

// Яндекс Метрика. Пусто — счётчик, цели и плашка про cookie не подключаются. Вписать номер счётчика (только цифры).
// Цели (создать в Метрике: «Цели» → «JavaScript-событие», идентификатор как ниже):
//   portfolio — открыл кейсы · case_open — раскрыл кейс · contacts — дошёл до контактов · cta — нажал «Разбор задачи»
//   telegram — перешёл в Telegram · phone — нажал на телефон · form_error — ошибка в форме · lead — заявка отправлена
//   trailer_full — досмотрел трейлер · trailer_skip — пропустил трейлер · sound_on — включил звук
export const analytics = {
  metrikaId: '',
};
