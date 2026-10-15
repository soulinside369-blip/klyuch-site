<?php
// Скопируйте этот файл в config.php НА СЕРВЕРЕ и впишите данные бота.
// config.php не хранится в репозитории и не пересылается в чат.
return [
  'token'   => 'ТОКЕН_ОТ_BOTFATHER',        // @BotFather → /newbot
  'chat_id' => 'ID_ЧАТА_ДЛЯ_ЗАЯВОК',        // ваш ID или ID группы (узнать: @userinfobot или getUpdates)
  // true  — имя и контакт приходят прямо в Telegram (трансграничная передача: уведомить Роскомнадзор, см. DEPLOY.md);
  // false — в Telegram только номер заявки, данные лежат в api/leads/leads.csv на сервере в РФ.
  'telegram_personal' => true,
];
