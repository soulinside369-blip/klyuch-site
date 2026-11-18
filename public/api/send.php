<?php
// Приём заявки с сайта → CRM (api/leads/data, смотреть в /admin/) + Telegram. Настройки — в config.php рядом (не в репозитории).
header('Content-Type: application/json; charset=utf-8');
require __DIR__ . '/lib.php';   // хранилище заявок, часовой пояс владельца; часы работы — будни 9–22

if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo '{"ok":false}'; exit; }

// Без config.php заявка всё равно сохраняется в CRM — теряется только уведомление в Telegram.
$cfg = ks_config(); // ['token' => '...', 'chat_id' => '...', ...]

// Ловушка для ботов: скрытое поле должно быть пустым.
if (!empty($_POST['website'])) { echo '{"ok":true}'; exit; }

$clean = fn($k, $max) => mb_substr(trim(strip_tags(is_string($_POST[$k] ?? null) ? $_POST[$k] : '')), 0, $max);
$name = $clean('name', 100);
$contact = $clean('contact', 100);
$budget = $clean('budget', 50);
$task = $clean('task', 2000);

$service = $clean('service', 100);
$page = $clean('page', 200);
$utm = $clean('utm', 300);
// Ситуации, отмеченные в форме (анонимный выбор «что болит»).
$pains = array_slice(array_filter(array_map(fn($x) => mb_substr(trim(strip_tags((string)$x)), 0, 60), (array)($_POST['pains'] ?? []))), 0, 8);
if ($name === '' || $contact === '' || empty($_POST['consent'])) { http_response_code(422); echo '{"ok":false}'; exit; }

// Простейшее ограничение частоты: 1 заявка в 30 с с одного IP (после проверки полей — пустой запрос лимит не тратит).
$ip = $_SERVER['REMOTE_ADDR'] ?? 'x';
$lock = sys_get_temp_dir() . '/klyuch_' . md5($ip);
if (is_file($lock) && time() - filemtime($lock) < 30) { http_response_code(429); echo '{"ok":false}'; exit; }
@touch($lock);

// Ответы квиза: поля q_* (одиночные или массивы).
$quiz = [];
foreach ($_POST as $k => $v) {
  if (strpos((string)$k, 'q_') !== 0) continue;
  $vals = is_array($v) ? $v : [$v];
  $quiz[] = substr((string)$k, 2) . ': ' . mb_substr(implode(', ', array_map(fn($x) => trim(strip_tags((string)$x)), $vals)), 0, 300);
}
if ($budget === '' && isset($_POST['q_budget'])) $budget = $clean('q_budget', 50);

$text = "Имя: $name\nКонтакт: $contact"
  . ($pains ? "\nЧто болит: " . implode('; ', $pains) : '')
  . ($service ? "\nНаправление: $service" : '')
  . ($budget ? "\nБюджет: $budget" : '')
  . ($quiz ? "\n\nДиагностика:\n" . implode("\n", $quiz) : '')
  . ($task ? "\n\nЗадача:\n$task" : '')
  . "\n\nСтраница: $page" . ($utm ? "\nUTM: $utm" : '');

// 1) Заявка сначала сохраняется на сервере в РФ (ч. 5 ст. 18 152-ФЗ — локализация) — она не потеряется, даже если Telegram недоступен.
$dir = ks_dir();
$id = date('Ymd-His') . '-' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 6));
$short = substr($id, -6);   // номер для человека: его видит клиент на странице «Спасибо»

// До скольки перезвонить: в рабочее время — в течение часа, иначе — к 10:00 первого рабочего дня.
$now = new DateTime();
$open = fn(DateTime $d) => (int)$d->format('N') <= 5 && (int)$d->format('G') >= 9 && (int)$d->format('G') < 22;
if ($open($now)) { $due = (clone $now)->modify('+60 minutes'); }
else { $due = (clone $now)->setTime(10, 0); if ($due <= $now || (int)$due->format('N') > 5) { do { $due->modify('+1 day')->setTime(10, 0); } while ((int)$due->format('N') > 5); } }
$head = "🔑 Заявка №$short с сайта КЛЮЧ\n⏰ Перезвонить до " . $due->format('d.m H:i') . ' (Екб)';

// Журнал одной строкой (запасная копия) и карточка для CRM: статус, заметки и история меняются в /admin/.
$row = [$id, date('c'), $name, $contact, implode('; ', $pains), $service, $budget, str_replace(["\r", "\n"], ' ', $task), $page, $utm];
$fh = @fopen("$dir/leads.csv", 'a');
if ($fh) { if (flock($fh, LOCK_EX)) { fputcsv($fh, $row, ';', '"', '\\'); flock($fh, LOCK_UN); } fclose($fh); }
$card = ks_lead_save([
  'id' => $id, 'short' => $short, 'created' => date('c'), 'due' => $due->format('c'),
  'name' => $name, 'contact' => $contact, 'pains' => array_values($pains), 'service' => $service, 'budget' => $budget,
  'task' => $task, 'quiz' => $quiz, 'page' => $page, 'utm' => $utm,
  'status' => 'new', 'notes' => [], 'history' => [],
]);
$saved = $card || (bool)$fh;

// 2) Уведомление в Telegram — это и есть пуш на телефон. Ссылка ведёт сразу в карточку заявки.
//    'telegram_personal' => false — в Telegram уходит только номер заявки, без имени и контакта
//    (тогда нет трансграничной передачи ПДн; сами данные — в CRM на сервере в РФ).
$site = ks_site_url($cfg);
$link = $site !== '' ? "$site/admin/?id=$id" : '';
$body = ($cfg['telegram_personal'] ?? true) === false ? '' : "\n\n$text";
$message = $head . $body . ($link !== '' ? "\n\nОткрыть в CRM: $link" : '');

// Бот не настроен (токен вписывает владелец в config.php) — заявка принята, если сохранена.
$token = (string)($cfg['token'] ?? '');
$chat = (string)($cfg['chat_id'] ?? '');
if (!preg_match('/^\d+:[\w-]{20,}$/', $token) || $chat === '' || !function_exists('curl_init')) {
  if ($saved) { echo json_encode(['ok' => true, 'id' => $short]); } else { http_response_code(500); echo '{"ok":false}'; }
  exit;
}

$ch = curl_init("https://api.telegram.org/bot$token/sendMessage");
curl_setopt_array($ch, [
  CURLOPT_POST => true,
  CURLOPT_POSTFIELDS => ['chat_id' => $chat, 'text' => $message, 'disable_web_page_preview' => 'true'],
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_TIMEOUT => 10,
]);
curl_exec($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

// Заявка принята, если она сохранена на сервере ИЛИ дошла в Telegram.
if ($code === 200 || $saved) { echo json_encode(['ok' => true, 'id' => $short]); } else { http_response_code(502); echo '{"ok":false}'; }
