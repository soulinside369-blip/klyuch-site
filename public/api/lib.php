<?php
// Общие функции заявок: настройки и файловое хранилище. Подключается из send.php и admin/index.php.
// Заявка = один JSON-файл в api/leads/data/ (папка закрыта от доступа из интернета). База данных не нужна:
// на сотнях заявок это быстрее и проще в резервном копировании; при тысячах — перевести на MySQL.
if (basename($_SERVER['SCRIPT_FILENAME'] ?? '') === 'lib.php') { http_response_code(404); exit; }
date_default_timezone_set('Asia/Yekaterinburg');   // время владельца

const KS_STATUSES = ['new' => 'Новая', 'work' => 'В работе', 'deal' => 'Договор', 'lost' => 'Отказ'];

function ks_config(): array {
  $f = __DIR__ . '/config.php';
  $cfg = is_file($f) ? (require $f) : [];
  return is_array($cfg) ? $cfg : [];
}

// Папка заявок; при первом обращении создаётся и закрывается от веб-доступа.
function ks_dir(): string {
  $dir = __DIR__ . '/leads';
  if (!is_dir("$dir/data")) { @mkdir("$dir/data", 0750, true); }
  if (!is_file("$dir/.htaccess")) { @file_put_contents("$dir/.htaccess", "Require all denied\n"); }
  return $dir;
}

function ks_valid_id(string $id): bool { return (bool)preg_match('/^\d{8}-\d{6}-[A-F0-9]{6}$/', $id); }

function ks_lead_save(array $lead): bool {
  if (!ks_valid_id($lead['id'] ?? '')) return false;
  $json = json_encode($lead, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
  return $json !== false && @file_put_contents(ks_dir() . "/data/{$lead['id']}.json", $json, LOCK_EX) !== false;
}

function ks_lead_load(string $id): ?array {
  if (!ks_valid_id($id)) return null;
  $f = ks_dir() . "/data/$id.json";
  if (!is_file($f)) return null;
  $lead = json_decode((string)@file_get_contents($f), true);
  return is_array($lead) ? $lead : null;
}

function ks_lead_delete(string $id): bool {
  if (!ks_valid_id($id)) return false;
  $f = ks_dir() . "/data/$id.json";
  return is_file($f) && @unlink($f);
}

// Все заявки, новые сверху (номер начинается с даты и времени — сортировка по имени файла).
function ks_leads_all(): array {
  $files = glob(ks_dir() . '/data/*.json') ?: [];
  rsort($files);
  $out = [];
  foreach ($files as $f) {
    $lead = json_decode((string)@file_get_contents($f), true);
    if (is_array($lead) && ks_valid_id($lead['id'] ?? '')) $out[] = $lead;
  }
  return $out;
}

// Адрес сайта для ссылок в уведомлениях: из настроек или из запроса.
function ks_site_url(array $cfg): string {
  $u = trim((string)($cfg['site_url'] ?? ''));
  if ($u === '') {
    $host = preg_replace('/[^A-Za-z0-9.\-:]/', '', (string)($_SERVER['HTTP_HOST'] ?? ''));
    $u = $host !== '' ? "https://$host" : '';
  }
  return rtrim($u, '/');
}
