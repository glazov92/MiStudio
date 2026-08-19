<?php
/* ==========================================================================
   MiStudio — синхронизация правок визуального редактора (AdminVPS/ispmanager)

   GET  /content-sync.php                      -> { ...правки } (JSON)
   GET  /content-sync.php?action=versions&key= -> { ok, versions:[{id,time}], max }
   POST /content-sync.php                      -> { key, data } — сохранить
                                                  полный снимок правок
   POST /content-sync.php                      -> { action:'restore', key, version }
                                                  — откатить к версии

   Данные хранятся в mistudio-data/editor-store.json — ВНЕ веб-корня
   (FTP-корень = <user>/data/, сайт в www/studiomi.ru, store рядом — 
   mistudio-data). nginx физически не отдаёт этот каталог (404).
   При каждом сохранении делается снапшот в mistudio-data/versions/
   (последние MAX_VERSIONS штук, файлы не больше MAX_SNAPSHOT_BYTES).

   Ключ записи CMS_KEY должен совпадать с EDITOR_CONFIG.serverSync.key
   в config.js. Это «дверь с защёлкой» (как и ?edit=КЛЮЧ), а не защита от
   взлома: ключ всё равно виден в JS на клиенте.
   ========================================================================== */

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

const CMS_KEY    = 'S9x9Veh0hnHB4liskfCujugz';
/* Хранилище правок — за пределами веб-корня (nginx не отдаёт): FTP-корень
   = <user-home>/data/, сайт лежит в www/studiomi.ru, а store — рядом (mistudio-data).
   define() вместо const: dirname() нельзя использовать в константном выражении. */
define('STORE_FILE', dirname(__DIR__, 2) . '/mistudio-data/editor-store.json');
define('VERSIONS_DIR', dirname(__DIR__, 2) . '/mistudio-data/versions');
const MAX_VERSIONS      = 15;
const MAX_SNAPSHOT_BYTES = 1.5 * 1024 * 1024;  /* больше этого — снапшот не делаем */

function respond($payload, $code = 200) {
    http_response_code($code);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function readStore() {
    if (!is_file(STORE_FILE)) return array();
    $raw = file_get_contents(STORE_FILE);
    $data = json_decode($raw, true);
    return is_array($data) ? $data : array();
}

function writeStore($data) {
    $dir = dirname(STORE_FILE);
    if (!is_dir($dir)) {
        @mkdir($dir, 0775, true);
    }
    $tmp  = STORE_FILE . '.' . getmypid() . '.tmp';
    $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    if (@file_put_contents($tmp, $json, LOCK_EX) === false) {
        return false;
    }
    if (!@rename($tmp, STORE_FILE)) {
        @unlink($tmp);
        return false;
    }
    return true;
}

/* --- Версии (снапшоты правок) ------------------------------------------- */

function ensureVersionsDir() {
    if (!is_dir(VERSIONS_DIR)) {
        @mkdir(VERSIONS_DIR, 0775, true);
    }
    /* Защита подпапки, даже если корневой data/.htaccess не применится */
    $ht = VERSIONS_DIR . '/.htaccess';
    if (!is_file($ht)) {
        @file_put_contents($ht,
            "Require all denied\n" .
            "<IfModule !mod_authz_core.c>\n" .
            "    Order deny,allow\n" .
            "    Deny from all\n" .
            "</IfModule>\n");
    }
}

function pruneVersions() {
    $files = glob(VERSIONS_DIR . '/v-*.json');
    if ($files === false) return;
    usort($files, function ($a, $b) {
        $ma = @filemtime($a);
        $mb = @filemtime($b);
        if ($ma === false) $ma = 0;
        if ($mb === false) $mb = 0;
        return $mb - $ma;  /* новее первыми, пруним самые старые */
    });
    while (count($files) > MAX_VERSIONS) {
        $old = array_pop($files);
        if (is_file($old)) @unlink($old);
    }
}

function createSnapshot($data) {
    $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false || strlen($json) > MAX_SNAPSHOT_BYTES) return;
    ensureVersionsDir();
    $stamp = date('Ymd-His');
    $file  = VERSIONS_DIR . '/v-' . $stamp . '.json';
    $i = 2;
    while (is_file($file)) {
        $file = VERSIONS_DIR . '/v-' . $stamp . '-' . sprintf('%02d', $i) . '.json';
        $i++;
    }
    $tmp = $file . '.' . getmypid() . '.tmp';
    if (@file_put_contents($tmp, $json, LOCK_EX) === false) return;
    if (!@rename($tmp, $file)) {
        @unlink($tmp);
        return;
    }
    pruneVersions();
}

function versionTime($id) {
    /* id вида v-YYYYMMDD-HHMMSS[-N] */
    if (preg_match('/^v-(\d{8})-(\d{6})/', $id, $m)) {
        $d = DateTime::createFromFormat('Ymd His', $m[1] . ' ' . $m[2]);
        if ($d) return $d->format('d.m.Y H:i:s');
    }
    return $id;
}

function listVersions() {
    $files = glob(VERSIONS_DIR . '/v-*.json');
    $out   = array();
    if ($files !== false) {
        foreach ($files as $f) {
            $id = basename($f, '.json');
            $out[] = array(
                'id'   => $id,
                'time' => versionTime($id),
                'mtime' => @filemtime($f)
            );
        }
    }
    usort($out, function ($a, $b) {
        $d = $b['mtime'] - $a['mtime'];
        if ($d != 0) return $d;
        return strcmp($b['id'], $a['id']);
    });
    /* mtime не отдаём наружу — только id/time */
    foreach ($out as &$v) unset($v['mtime']);
    unset($v);
    return $out;
}

function safeVersionId($id) {
    $id = preg_replace('/[^A-Za-z0-9._-]/', '', (string) $id);
    if (!preg_match('/^v-\d{8}-\d{6}(-\d+)?$/', $id)) return null;
    $file = VERSIONS_DIR . '/' . $id . '.json';
    return is_file($file) ? $id : null;
}

/* Защита от кросс-сайтовых запросов (CSRF-стиль): если браузер прислал
   заголовок Origin, он должен быть своим доменом (или localhost — для
   локальной разработки). Запросы без Origin (curl, скрипты) проходят:
   это «защёлка», а не стена. */
function originAllowed() {
    if (empty($_SERVER['HTTP_ORIGIN'])) return true;
    $origin = trim($_SERVER['HTTP_ORIGIN']);
    $o = parse_url($origin);
    if (!isset($o['host'])) return false;
    $h = strtolower($o['host']);
    if ($h === 'localhost' || $h === '127.0.0.1' || $h === '[::1]') return true;
    $host = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : '';
    $host = strtolower(preg_replace('/:\d+$/', '', $host));
    return $h === $host;
}

/* Тормоз частых записей: не чаще одного раза в секунду. Мешает перебору
   ключа и затиранию данных автоматическими «молотками». Человеку, который
   нажимает кнопки мышью, не мешает. */
function throttleWrite($seconds = 1.0) {
    $f = dirname(STORE_FILE) . '/.lastwrite';
    $now = microtime(true);
    if (is_file($f)) {
        $last = (float) @file_get_contents($f);
        if ($now - $last < $seconds) {
            respond(array('ok' => false, 'error' => 'slow down'), 429);
        }
    }
    @file_put_contents($f, sprintf('%.3f', $now), LOCK_EX);
}

$method = isset($_SERVER['REQUEST_METHOD']) ? $_SERVER['REQUEST_METHOD'] : 'GET';

if ($method === 'GET') {
    if (isset($_GET['action']) && $_GET['action'] === 'versions') {
        if (!originAllowed()) {
            respond(array('ok' => false, 'error' => 'forbidden'), 403);
        }
        if ((isset($_GET['key']) ? $_GET['key'] : '') !== CMS_KEY) {
            respond(array('ok' => false, 'error' => 'forbidden'), 403);
        }
        respond(array('ok' => true, 'versions' => listVersions(), 'max' => MAX_VERSIONS));
    }
    respond(readStore());
}

if ($method === 'POST') {
    if (!originAllowed()) {
        respond(array('ok' => false, 'error' => 'forbidden'), 403);
    }
    $raw  = file_get_contents('php://input');
    $body = json_decode($raw, true);
    if (!is_array($body)) {
        respond(array('ok' => false, 'error' => 'bad json'), 400);
    }

    $key = isset($body['key']) ? (string) $body['key'] : '';
    if ($key !== CMS_KEY) {
        respond(array('ok' => false, 'error' => 'forbidden'), 403);
    }

    /* Один write-POST в секунду (в т.ч. откаты) */
    throttleWrite();

    if (isset($body['action']) && $body['action'] === 'restore') {
        $id = safeVersionId(isset($body['version']) ? $body['version'] : '');
        if ($id === null) {
            respond(array('ok' => false, 'error' => 'no such version'), 404);
        }
        /* Читаем целевую версию ДО снапшота: прунинг не должен её задеть */
        $json = @file_get_contents(VERSIONS_DIR . '/' . $id . '.json');
        if ($json === false) {
            respond(array('ok' => false, 'error' => 'read failed'), 500);
        }
        $data = json_decode($json, true);
        if (!is_array($data)) {
            respond(array('ok' => false, 'error' => 'corrupt version'), 500);
        }
        /* Текущее состояние сохраняем как версию — откат отменяем */
        $current = readStore();
        if (count($current)) createSnapshot($current);
        if (!writeStore($data)) {
            respond(array('ok' => false, 'error' => 'write failed'), 500);
        }
        respond(array('ok' => true, 'restored' => $id));
    }

    $data = isset($body['data']) ? $body['data'] : null;
    if (!is_array($data)) {
        respond(array('ok' => false, 'error' => 'no data'), 400);
    }

    /* Лимит ~7 МБ: localStorage (~5 МБ) — потолок клиентских данных + запас */
    $size = strlen(json_encode($data));
    if ($size > 7 * 1024 * 1024) {
        respond(array('ok' => false, 'error' => 'too large'), 413);
    }

    $allowed = array('editable_texts', 'editable_images', 'service_paths',
                     'promotions', 'services', 'portfolio', 'links');
    $clean = array();
    foreach ($allowed as $k) {
        if (array_key_exists($k, $data)) {
            $clean[$k] = $data[$k];
        }
    }
    $clean['synced_at'] = date('c');

    if (!writeStore($clean)) {
        respond(array('ok' => false, 'error' => 'write failed'), 500);
    }
    createSnapshot($clean);
    respond(array('ok' => true));
}

respond(array('ok' => false, 'error' => 'method not allowed'), 405);
