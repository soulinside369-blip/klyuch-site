<?php
// Приём заявки с сайта → Telegram. Настройки — в config.php рядом (не в репозитории).
header('Content-Type: application/json; charset=utf-8');
date_default_timezone_set('Asia/Yekaterinburg');   // время владельца; часы работы — будни 9–22

if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo '{"ok":false}'; exit; }

$cfgFile = __DIR__ . '/config.php';
if (!is_file($cfgFile)) { http_response_code(500); echo '{"ok":false,"error":"config"}'; exit; }
$cfg = require $cfgFile; // ['token' => '...', 'chat_id' => '...']

// Ловушка для ботов: скрытое поле должно быть пустым.
if (!empty($_POST['website'])) { echo '{"ok":true}'; exit; }

// Простейшее ограничение частоты: 1 заявка в 30 с с одного IP.
$ip = $_SERVER['REMOTE_ADDR'] ?? 'x';
$lock = sys_get_temp_dir() . '/klyuch_' . md5($ip);
if (is_file($lock) && time() - filemtime($lock) < 30) { http_response_code(429); echo '{"ok":false}'; exit; }
touch($lock);

$clean = fn($k, $max) => mb_substr(trim(strip_tags($_POST[$k] ?? '')), 0, $max);
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

// Ответы квиза: поля q_* (одиночные или массивы).
$quiz = [];
foreach ($_POST as $k => $v) {
  if (strpos($k, 'q_') !== 0) continue;
  $vals = is_array($v) ? $v : [$v];
  $quiz[] = substr($k, 2) . ': ' . mb_substr(implode(', ', array_map(fn($x) => trim(strip_tags($x)), $vals)), 0, 300);
}
if ($budget === '' && isset($_POST['q_budget'])) $budget = $clean('q_budget', 50);

$text = "🔑 Заявка с сайта КЛЮЧ\n\nИмя: $name\nКонтакт: $contact"
  . ($pains ? "\nЧто болит: " . implode('; ', $pains) : '')
  . ($service ? "\nНаправление: $service" : '')
  . ($budget ? "\nБюджет: $budget" : '')
  . ($quiz ? "\n\nДиагностика:\n" . implode("\n", $quiz) : '')
  . ($task ? "\n\nЗадача:\n$task" : '')
  . "\n\nСтраница: $page" . ($utm ? "\nUTM: $utm" : '');

// 1) Заявка сначала сохраняется на сервере в РФ (ч. 5 ст. 18 152-ФЗ — локализация) — она не потеряется, даже если Telegram недоступен.
$dir = __DIR__ . '/leads';
if (!is_dir($dir)) { @mkdir($dir, 0750, true); }
if (!is_file("$dir/.htaccess")) { @file_put_contents("$dir/.htaccess", "Require all denied\nDeny from all\n"); }
$id = date('Ymd-His') . '-' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 6));
$short = substr($id, -6);   // номер для человека: его видит клиент на странице «Спасибо»

// До скольки перезвонить: в рабочее время — в течение часа, иначе — к 10:00 первого рабочего дня.
$now = new DateTime();
$open = fn(DateTime $d) => (int)$d->format('N') <= 5 && (int)$d->format('G') >= 9 && (int)$d->format('G') < 22;
if ($open($now)) { $due = (clone $now)->modify('+60 minutes'); }
else { $due = (clone $now)->setTime(10, 0); if ($due <= $now || (int)$due->format('N') > 5) { do { $due->modify('+1 day')->setTime(10, 0); } while ((int)$due->format('N') > 5); } }
$text = str_replace('🔑 Заявка с сайта КЛЮЧ', "🔑 Заявка №$short с сайта КЛЮЧ\n⏰ Перезвонить до " . $due->format('d.m H:i') . ' (Екб)', $text);
$row = [$id, date('c'), $name, $contact, implode('; ', $pains), $service, $budget, str_replace(["\r", "\n"], ' ', $task), $page, $utm];
$fh = @fopen("$dir/leads.csv", 'a');
if ($fh) { if (flock($fh, LOCK_EX)) { fputcsv($fh, $row, ';'); flock($fh, LOCK_UN); } fclose($fh); }
$saved = (bool)$fh;

// 2) Уведомление в Telegram. 'telegram_personal' => false — в Telegram уходит только номер заявки,
//    без имени и контакта (тогда нет трансграничной передачи ПДн; заявку смотрят в api/leads/leads.csv на сервере).
if (($cfg['telegram_personal'] ?? true) === false) {
  $text = "🔑 Новая заявка №$short с сайта КЛЮЧ\n⏰ Перезвонить до " . $due->format('d.m H:i') . " (Екб)\nДанные: api/leads/leads.csv на сервере";
}

$ch = curl_init("https://api.telegram.org/bot{$cfg['token']}/sendMessage");
curl_setopt_array($ch, [
  CURLOPT_POST => true,
  CURLOPT_POSTFIELDS => ['chat_id' => $cfg['chat_id'], 'text' => $text],
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_TIMEOUT => 10,
]);
$res = curl_exec($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

// Заявка принята, если она сохранена на сервере ИЛИ дошла в Telegram.
if ($code === 200 || $saved) { echo json_encode(['ok' => true, 'id' => $short]); } else { http_response_code(502); echo '{"ok":false}'; }
