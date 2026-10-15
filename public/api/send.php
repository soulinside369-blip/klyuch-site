<?php
// Приём заявки с сайта → Telegram. Настройки — в config.php рядом (не в репозитории).
header('Content-Type: application/json; charset=utf-8');

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
  . ($service ? "\nНаправление: $service" : '')
  . ($budget ? "\nБюджет: $budget" : '')
  . ($quiz ? "\n\nДиагностика:\n" . implode("\n", $quiz) : '')
  . ($task ? "\n\nЗадача:\n$task" : '')
  . "\n\nСтраница: $page" . ($utm ? "\nUTM: $utm" : '');

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

if ($code === 200) { echo '{"ok":true}'; } else { http_response_code(502); echo '{"ok":false}'; }
