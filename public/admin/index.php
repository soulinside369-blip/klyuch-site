<?php
// CRM КЛЮЧа: заявки с сайта. Один файл, без базы данных — заявки лежат в api/leads/data (закрыто от интернета).
// Вход: пароль задаётся один раз с ключом admin_setup_key из api/config.php; хранится только его хеш (api/leads/admin.json).
require dirname(__DIR__) . '/api/lib.php';

header('X-Robots-Tag: noindex, nofollow');
header('X-Frame-Options: DENY');
header('Referrer-Policy: no-referrer');
header('Cache-Control: no-store');
header("Content-Security-Policy: default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; form-action 'self'; frame-ancestors 'none'");

session_name('ks_admin');
session_set_cookie_params(['lifetime' => 0, 'path' => '/admin/', 'secure' => !empty($_SERVER['HTTPS']), 'httponly' => true, 'samesite' => 'Strict']);
session_start();

$cfg = ks_config();
$dir = ks_dir();
$authFile = "$dir/admin.json";
$auth = is_file($authFile) ? (json_decode((string)file_get_contents($authFile), true) ?: []) : [];
$self = strtok($_SERVER['REQUEST_URI'] ?? '/admin/', '?') ?: '/admin/';

function h($s): string { return htmlspecialchars((string)$s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
function go(string $url): void { header("Location: $url", true, 303); exit; }
function csrf(): string { return $_SESSION['csrf'] ??= bin2hex(random_bytes(16)); }
function csrf_ok(): bool { return hash_equals($_SESSION['csrf'] ?? '', (string)($_POST['csrf'] ?? '')); }
function ru_date(string $iso, bool $year = false): string {
  try { $d = new DateTime($iso); } catch (Exception $e) { return ''; }
  return $d->format($year ? 'd.m.Y H:i' : 'd.m H:i');
}

// Защита от подбора: после 5 неудачных попыток с одного IP — пауза 15 минут.
$ip = $_SERVER['REMOTE_ADDR'] ?? 'x';
$failFile = "$dir/login-" . md5($ip) . '.json';
$fails = is_file($failFile) ? (json_decode((string)file_get_contents($failFile), true) ?: []) : [];
$fails = array_values(array_filter($fails, fn($t) => $t > time() - 900));
$locked = count($fails) >= 5;

$error = '';
$action = $_POST['action'] ?? '';

// ---------- первый вход: задать пароль ----------
if (empty($auth['hash'])) {
  $setupKey = (string)($cfg['admin_setup_key'] ?? '');
  if ($action === 'setup' && csrf_ok() && !$locked) {
    $pass = (string)($_POST['password'] ?? '');
    if ($setupKey === '' || !hash_equals($setupKey, (string)($_POST['key'] ?? ''))) {
      $fails[] = time(); @file_put_contents($failFile, json_encode($fails));
      $error = 'Ключ не подошёл.';
    } elseif (mb_strlen($pass) < 10) {
      $error = 'Пароль — не короче 10 символов.';
    } else {
      file_put_contents($authFile, json_encode(['hash' => password_hash($pass, PASSWORD_DEFAULT), 'set' => date('c')]), LOCK_EX);
      session_regenerate_id(true); $_SESSION['ok'] = true;
      go($self);
    }
  }
  page_head('Первый вход');
  ?>
  <main class="auth">
    <div class="brand"><?= logo() ?> КЛЮЧ · CRM</div>
    <h1>Задайте пароль</h1>
    <?php if ($setupKey === ''): ?>
      <p class="muted">Сначала впишите на сервере в файл <code>api/config.php</code> строку
        <code>'admin_setup_key' => 'любая фраза',</code> — с этой фразой здесь задаётся пароль.</p>
    <?php else: ?>
      <p class="muted">Один раз: ключ из <code>api/config.php</code> (admin_setup_key) и новый пароль. Потом ключ можно стереть.</p>
      <?php if ($error): ?><p class="err"><?= h($error) ?></p><?php endif; ?>
      <?php if ($locked): ?><p class="err">Слишком много попыток. Подождите 15 минут.</p><?php else: ?>
      <form method="post" class="stack">
        <input type="hidden" name="csrf" value="<?= h(csrf()) ?>"><input type="hidden" name="action" value="setup">
        <label>Ключ из config.php<input name="key" type="password" autocomplete="off" required></label>
        <label>Новый пароль (от 10 символов)<input name="password" type="password" autocomplete="new-password" minlength="10" required></label>
        <button class="btn">Сохранить и войти</button>
      </form>
      <?php endif; ?>
    <?php endif; ?>
  </main>
  <?php page_foot(); exit;
}

// ---------- вход ----------
if ($action === 'login' && csrf_ok() && !$locked) {
  if (password_verify((string)($_POST['password'] ?? ''), $auth['hash'])) {
    @unlink($failFile); session_regenerate_id(true); $_SESSION['ok'] = true;
    go($self . (isset($_GET['id']) ? '?id=' . urlencode((string)$_GET['id']) : ''));
  }
  $fails[] = time(); @file_put_contents($failFile, json_encode($fails));
  $error = 'Пароль не подошёл.'; $locked = count($fails) >= 5;
}
if ($action === 'logout' && csrf_ok()) { $_SESSION = []; session_destroy(); go($self); }

if (empty($_SESSION['ok'])) {
  page_head('Вход');
  ?>
  <main class="auth">
    <div class="brand"><?= logo() ?> КЛЮЧ · CRM</div>
    <h1>Вход</h1>
    <?php if ($error): ?><p class="err"><?= h($error) ?></p><?php endif; ?>
    <?php if ($locked): ?><p class="err">Слишком много попыток. Подождите 15 минут.</p><?php else: ?>
    <form method="post" class="stack">
      <input type="hidden" name="csrf" value="<?= h(csrf()) ?>"><input type="hidden" name="action" value="login">
      <label>Пароль<input name="password" type="password" autocomplete="current-password" required autofocus></label>
      <button class="btn">Войти</button>
    </form>
    <?php endif; ?>
  </main>
  <?php page_foot(); exit;
}

// ---------- действия с заявкой ----------
if ($action && $action !== 'logout') {
  if (!csrf_ok()) { http_response_code(400); exit('Форма устарела — обновите страницу.'); }
  $id = (string)($_POST['id'] ?? '');
  $lead = ks_lead_load($id);
  if ($action === 'export') {
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="klyuch-leads-' . date('Y-m-d') . '.csv"');
    $out = fopen('php://output', 'w'); fwrite($out, "\xEF\xBB\xBF");
    fputcsv($out, ['Номер', 'Дата', 'Статус', 'Имя', 'Контакт', 'Что болит', 'Направление', 'Бюджет', 'Задача', 'Заметки', 'Страница', 'UTM'], ';', '"', '\\');
    foreach (ks_leads_all() as $l) {
      fputcsv($out, [$l['short'] ?? '', ru_date($l['created'] ?? '', true), KS_STATUSES[$l['status'] ?? 'new'] ?? '', $l['name'] ?? '', $l['contact'] ?? '',
        implode('; ', $l['pains'] ?? []), $l['service'] ?? '', $l['budget'] ?? '', $l['task'] ?? '',
        implode(' | ', array_map(fn($n) => $n['text'] ?? '', $l['notes'] ?? [])), $l['page'] ?? '', $l['utm'] ?? ''], ';', '"', '\\');
    }
    exit;
  }
  if (!$lead) go($self);
  if ($action === 'status' && isset(KS_STATUSES[$_POST['status'] ?? ''])) {
    $new = $_POST['status'];
    if ($new !== ($lead['status'] ?? 'new')) { $lead['history'][] = ['at' => date('c'), 'from' => $lead['status'] ?? 'new', 'to' => $new]; $lead['status'] = $new; ks_lead_save($lead); }
  } elseif ($action === 'note') {
    $t = trim(mb_substr((string)($_POST['text'] ?? ''), 0, 2000));
    if ($t !== '') { $lead['notes'][] = ['at' => date('c'), 'text' => $t]; ks_lead_save($lead); }
  } elseif ($action === 'delete' && ($_POST['confirm'] ?? '') === $lead['short']) {
    ks_lead_delete($id); go($self);
  }
  go("$self?id=" . urlencode($id));
}

// ---------- карточка ----------
$all = ks_leads_all();
$id = (string)($_GET['id'] ?? '');
if ($id !== '') {
  $lead = ks_lead_load($id);
  if (!$lead) go($self);
  $st = $lead['status'] ?? 'new';
  $c = (string)($lead['contact'] ?? '');
  $digits = preg_replace('/\D/', '', $c);
  $tg = preg_match('/^@?([A-Za-z][A-Za-z0-9_]{4,31})$/', $c, $m) ? $m[1] : '';
  page_head('Заявка №' . $lead['short']);
  ?>
  <header class="top"><a class="back" href="<?= h($self) ?>">← Все заявки</a><?= logout_form() ?></header>
  <main class="card">
    <div class="card-head">
      <span class="num">№<?= h($lead['short']) ?></span>
      <span class="badge s-<?= h($st) ?>"><?= h(KS_STATUSES[$st] ?? $st) ?></span>
    </div>
    <h1><?= h($lead['name']) ?></h1>
    <div class="contact-row">
      <span class="contact"><?= h($c) ?></span>
      <?php if (strlen($digits) >= 10 && !$tg): ?><a class="btn" href="tel:+<?= h(strlen($digits) === 11 && $digits[0] === '8' ? '7' . substr($digits, 1) : $digits) ?>">Позвонить</a><?php endif; ?>
      <?php if ($tg): ?><a class="btn" href="https://t.me/<?= h($tg) ?>" rel="noopener">Написать в Telegram</a><?php endif; ?>
    </div>
    <dl class="facts">
      <div><dt>Пришла</dt><dd><?= h(ru_date($lead['created'] ?? '', true)) ?></dd></div>
      <div><dt>Перезвонить до</dt><dd><?= h(ru_date($lead['due'] ?? '')) ?></dd></div>
      <?php if (!empty($lead['pains'])): ?><div class="wide"><dt>Что болит</dt><dd><?= h(implode(' · ', $lead['pains'])) ?></dd></div><?php endif; ?>
      <?php if (!empty($lead['service'])): ?><div><dt>Что нужно</dt><dd><?= h($lead['service']) ?></dd></div><?php endif; ?>
      <?php if (!empty($lead['budget'])): ?><div><dt>Бюджет</dt><dd><?= h($lead['budget']) ?></dd></div><?php endif; ?>
      <?php if (!empty($lead['task'])): ?><div class="wide"><dt>Задача</dt><dd class="pre"><?= h($lead['task']) ?></dd></div><?php endif; ?>
      <?php if (!empty($lead['quiz'])): ?><div class="wide"><dt>Диагностика</dt><dd class="pre"><?= h(implode("\n", $lead['quiz'])) ?></dd></div><?php endif; ?>
      <?php if (!empty($lead['utm'])): ?><div class="wide"><dt>Источник (UTM)</dt><dd><?= h($lead['utm']) ?></dd></div><?php endif; ?>
    </dl>

    <h2>Статус</h2>
    <form method="post" class="statuses">
      <input type="hidden" name="csrf" value="<?= h(csrf()) ?>"><input type="hidden" name="action" value="status"><input type="hidden" name="id" value="<?= h($lead['id']) ?>">
      <?php foreach (KS_STATUSES as $k => $label): ?>
        <button name="status" value="<?= h($k) ?>" class="chip s-<?= h($k) ?><?= $k === $st ? ' on' : '' ?>"><?= h($label) ?></button>
      <?php endforeach; ?>
    </form>

    <h2>Заметки</h2>
    <form method="post" class="stack note-form">
      <input type="hidden" name="csrf" value="<?= h(csrf()) ?>"><input type="hidden" name="action" value="note"><input type="hidden" name="id" value="<?= h($lead['id']) ?>">
      <textarea name="text" rows="3" placeholder="Позвонил, договорились о встрече в четверг…" required></textarea>
      <button class="btn">Добавить заметку</button>
    </form>
    <ol class="timeline">
      <?php
      $events = [];
      foreach ($lead['notes'] ?? [] as $n) $events[] = ['at' => $n['at'], 'html' => '<span class="pre">' . h($n['text']) . '</span>'];
      foreach ($lead['history'] ?? [] as $e) $events[] = ['at' => $e['at'], 'html' => 'Статус: ' . h(KS_STATUSES[$e['from']] ?? $e['from']) . ' → <b>' . h(KS_STATUSES[$e['to']] ?? $e['to']) . '</b>'];
      $events[] = ['at' => $lead['created'], 'html' => 'Заявка с сайта' . (!empty($lead['page']) ? ' · ' . h($lead['page']) : '')];
      usort($events, fn($a, $b) => strcmp($b['at'], $a['at']));
      foreach ($events as $e): ?>
        <li><time><?= h(ru_date($e['at'])) ?></time><div><?= $e['html'] ?></div></li>
      <?php endforeach; ?>
    </ol>

    <details class="danger">
      <summary>Удалить заявку</summary>
      <p class="muted">Удаление нельзя отменить. Это нужно, например, по просьбе человека удалить его данные (152-ФЗ).</p>
      <form method="post" class="stack">
        <input type="hidden" name="csrf" value="<?= h(csrf()) ?>"><input type="hidden" name="action" value="delete"><input type="hidden" name="id" value="<?= h($lead['id']) ?>">
        <label>Для подтверждения введите номер <?= h($lead['short']) ?><input name="confirm" autocomplete="off" required></label>
        <button class="btn btn-danger">Удалить навсегда</button>
      </form>
    </details>
  </main>
  <?php page_foot(); exit;
}

// ---------- список ----------
$filter = (string)($_GET['s'] ?? '');
$q = trim((string)($_GET['q'] ?? ''));
$counts = array_fill_keys(array_keys(KS_STATUSES), 0);
foreach ($all as $l) { $counts[$l['status'] ?? 'new'] = ($counts[$l['status'] ?? 'new'] ?? 0) + 1; }
$list = array_values(array_filter($all, function ($l) use ($filter, $q) {
  if ($filter !== '' && ($l['status'] ?? 'new') !== $filter) return false;
  if ($q === '') return true;
  $hay = mb_strtolower(implode(' ', [$l['short'] ?? '', $l['name'] ?? '', $l['contact'] ?? '', $l['task'] ?? '', $l['service'] ?? '', implode(' ', $l['pains'] ?? [])]));
  return mb_strpos($hay, mb_strtolower($q)) !== false;
}));
$now = new DateTime();
page_head('Заявки');
?>
<header class="top">
  <div class="brand"><?= logo() ?> КЛЮЧ · CRM</div>
  <div class="top-actions">
    <form method="post"><input type="hidden" name="csrf" value="<?= h(csrf()) ?>"><input type="hidden" name="action" value="export"><button class="link">Скачать CSV</button></form>
    <?= logout_form() ?>
  </div>
</header>
<main>
  <nav class="tabs">
    <a href="<?= h($self) ?>" class="<?= $filter === '' ? 'on' : '' ?>">Все <b><?= count($all) ?></b></a>
    <?php foreach (KS_STATUSES as $k => $label): ?>
      <a href="?s=<?= h($k) ?>" class="<?= $filter === $k ? 'on' : '' ?>"><?= h($label) ?> <b><?= (int)$counts[$k] ?></b></a>
    <?php endforeach; ?>
  </nav>
  <form class="search" method="get">
    <?php if ($filter !== ''): ?><input type="hidden" name="s" value="<?= h($filter) ?>"><?php endif; ?>
    <input name="q" value="<?= h($q) ?>" placeholder="Имя, телефон, номер, задача" type="search">
  </form>
  <?php if (!$list): ?>
    <p class="empty"><?= $all ? 'Ничего не нашлось.' : 'Заявок пока нет. Как только человек отправит форму на сайте, она появится здесь, а в Telegram придёт уведомление.' ?></p>
  <?php else: ?>
    <ul class="leads">
      <?php foreach ($list as $l):
        $st = $l['status'] ?? 'new';
        $late = $st === 'new' && !empty($l['due']) && new DateTime($l['due']) < $now; ?>
        <li><a href="?id=<?= h(urlencode($l['id'])) ?>">
          <span class="badge s-<?= h($st) ?>"><?= h(KS_STATUSES[$st] ?? $st) ?></span>
          <span class="who"><b><?= h($l['name'] ?? '') ?></b><span><?= h($l['contact'] ?? '') ?></span></span>
          <span class="what"><?= h(implode(' · ', array_filter([$l['service'] ?? '', $l['budget'] ?? '', implode(', ', $l['pains'] ?? [])]))) ?></span>
          <span class="when<?= $late ? ' late' : '' ?>"><?= h(ru_date($l['created'] ?? '')) ?><?= $late ? '<i>просрочено</i>' : '' ?></span>
        </a></li>
      <?php endforeach; ?>
    </ul>
  <?php endif; ?>
</main>
<?php page_foot();

// ---------- оформление ----------
function logo(): string {
  return '<svg width="26" height="26" viewBox="0 0 34 34" fill="none" stroke="#E8B04B" stroke-width="2.2" aria-hidden="true"><circle cx="11" cy="17" r="7"/><path d="M18 17h14M27 17v6M31 17v4"/></svg>';
}
function logout_form(): string {
  return '<form method="post"><input type="hidden" name="csrf" value="' . h(csrf()) . '"><input type="hidden" name="action" value="logout"><button class="link">Выйти</button></form>';
}
function page_head(string $title): void { ?>
<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#0B0C0E">
<title><?= h($title) ?> — CRM КЛЮЧ</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<style>
:root{--bg:#0B0C0E;--bg2:#121417;--card:#16181C;--line:#2A2D33;--line2:#3A3E45;--text:#ECEAE4;--dim:#A9ADB3;--faint:#8A8F96;--acc:#E8B04B;--acc2:#F3C976;--red:#F0705A;--green:#5BC27A;--blue:#6FA8FF}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:400 16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-text-size-adjust:100%}
main{max-width:980px;margin:0 auto;padding:16px 16px 48px}
a{color:var(--acc)}
code{font:13px ui-monospace,Consolas,monospace;background:var(--bg2);padding:1px 6px;border-radius:5px}
h1{margin:6px 0 0;font-size:clamp(24px,5vw,34px);line-height:1.15}
h2{margin:28px 0 10px;font-size:13px;letter-spacing:1.5px;text-transform:uppercase;color:var(--faint);font-weight:500}
.muted{color:var(--dim)}.err{color:var(--red)}
.brand{display:flex;align-items:center;gap:10px;font-weight:700;letter-spacing:2px}
.top{position:sticky;top:0;z-index:5;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;background:rgba(11,12,14,.92);backdrop-filter:blur(8px);border-bottom:1px solid var(--line)}
.top-actions{display:flex;gap:16px;align-items:center}
.top form{margin:0}
.back{text-decoration:none;font-weight:600;min-height:44px;display:inline-flex;align-items:center}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:0 20px;border-radius:999px;border:0;background:var(--acc);color:#111;font:700 15px/1 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;text-decoration:none;cursor:pointer}
.btn:hover{background:var(--acc2);color:#111}
.btn-danger{background:var(--red)}
.link{background:none;border:0;color:var(--dim);font:inherit;cursor:pointer;min-height:44px;padding:0}
.link:hover{color:var(--text)}
.stack{display:flex;flex-direction:column;gap:12px;max-width:420px}
label{display:flex;flex-direction:column;gap:6px;font-size:14px;color:var(--dim)}
input,textarea{width:100%;min-height:46px;padding:10px 14px;border:1px solid var(--line2);border-radius:12px;background:var(--bg2);color:var(--text);font:inherit;font-size:16px}
input:focus,textarea:focus{outline:2px solid var(--acc);outline-offset:1px;border-color:transparent}
.auth{max-width:440px;padding-top:12vh}.auth h1{margin:28px 0 12px}
.tabs{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;margin:4px -16px 12px;padding:0 16px}
.tabs::-webkit-scrollbar{display:none}
.tabs a{flex:none;display:inline-flex;gap:8px;align-items:center;min-height:40px;padding:0 14px;border:1px solid var(--line2);border-radius:999px;color:var(--dim);text-decoration:none;font-size:14px}
.tabs a b{color:var(--text);font-weight:600}
.tabs a.on{background:var(--acc);border-color:var(--acc);color:#111}.tabs a.on b{color:#111}
.search{margin:0 0 14px}
.leads{list-style:none;margin:0;padding:0;border-top:1px solid var(--line)}
.leads a{display:grid;grid-template-columns:auto minmax(0,1.2fr) minmax(0,1.4fr) auto;gap:6px 16px;align-items:center;padding:14px 4px;border-bottom:1px solid var(--line);color:var(--text);text-decoration:none}
.leads a:hover{background:var(--bg2)}
.who{display:flex;flex-direction:column;min-width:0}.who b,.who span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.who span{color:var(--dim);font-size:14px}
.what{color:var(--dim);font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.when{color:var(--faint);font-size:13px;text-align:right;white-space:nowrap}
.when i{display:block;font-style:normal;color:var(--red)}
.badge{display:inline-flex;align-items:center;height:24px;padding:0 10px;border-radius:999px;font-size:12px;font-weight:600;white-space:nowrap;border:1px solid currentColor}
.s-new{color:var(--acc)}.s-work{color:var(--blue)}.s-deal{color:var(--green)}.s-lost{color:var(--faint)}
.empty{padding:40px 0;color:var(--dim);text-align:center}
.card-head{display:flex;align-items:center;gap:12px;margin-top:8px}
.num{font:14px ui-monospace,Consolas,monospace;color:var(--faint)}
.contact-row{display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px;margin-top:12px}
.contact{font-size:20px;font-weight:600}
.facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:22px 0 0;padding:16px;border:1px solid var(--line);border-radius:16px;background:var(--card)}
.facts div{min-width:0}.facts .wide{grid-column:1/-1}
.facts dt{font-size:12px;letter-spacing:1px;text-transform:uppercase;color:var(--faint)}
.facts dd{margin:4px 0 0;overflow-wrap:anywhere}
.pre{white-space:pre-wrap}
.statuses{display:flex;flex-wrap:wrap;gap:8px}
.chip{min-height:44px;padding:0 18px;border-radius:999px;border:1px solid currentColor;background:none;font:600 15px/1 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;cursor:pointer}
.chip.on{background:currentColor}.chip.on{color:#111}
.chip.s-new.on{background:var(--acc)}.chip.s-work.on{background:var(--blue)}.chip.s-deal.on{background:var(--green)}.chip.s-lost.on{background:var(--faint)}
.note-form{max-width:none}.note-form .btn{align-self:flex-start}
.timeline{list-style:none;margin:18px 0 0;padding:0;border-left:1px solid var(--line2)}
.timeline li{position:relative;display:grid;grid-template-columns:96px minmax(0,1fr);gap:12px;padding:0 0 14px 16px}
.timeline li::before{content:'';position:absolute;left:-4px;top:7px;width:7px;height:7px;transform:rotate(45deg);background:var(--acc)}
.timeline time{color:var(--faint);font-size:13px}
.danger{margin-top:36px;padding-top:16px;border-top:1px solid var(--line)}
.danger summary{cursor:pointer;color:var(--red);min-height:44px;display:flex;align-items:center}
@media(max-width:700px){
  .leads a{grid-template-columns:minmax(0,1fr) auto;padding:12px 2px}
  .leads .badge{grid-column:1;justify-self:start}.leads .when{grid-column:2;grid-row:1}
  .who,.what{grid-column:1/-1}
  .facts{grid-template-columns:1fr}
  .timeline li{grid-template-columns:1fr;gap:2px}
  .contact-row .btn{flex:1 1 100%}
}
</style>
</head>
<body>
<?php }
function page_foot(): void { echo "</body>\n</html>\n"; }
