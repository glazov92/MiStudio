<?php
/* ==========================================================================
   MiStudio — синхронизация правок визуального редактора (AdminVPS/ispmanager)

   GET  /content-sync.php                      -> { ...правки } (JSON)
   GET  /content-sync.php?action=versions&key= -> { ok, versions:[{id,time}], max }
   GET  /content-sync.php?action=images_inventory&key=
                                               -> список файлов img/u + статус
   POST /content-sync.php                      -> { key, data } — сохранить
                                                   полный снимок правок
   POST /content-sync.php                      -> { action:'restore', key, version }
                                                   — откатить к версии
   POST /content-sync.php                      -> { action:'upload_image',
                                                   key, image_base64 }
                                                   — сохранить картинку файлом
                                                   на хост (img/u/YYYY-MM/)
   POST /content-sync.php                      -> { action:'cleanup_unused', key }
                                                   — удалить картинки, на которые
                                                   не ссылается ни текущее
                                                   состояние, ни история версий

   Данные хранятся в mistudio-data/editor-store.json — ВНЕ веб-корня
   (FTP-корень = <user>/data/, сайт в www/studiomi.ru, store рядом — 
   mistudio-data). nginx физически не отдаёт этот каталог (404).
   При каждом сохранении делается снапшот в mistudio-data/versions/
   (последние MAX_VERSIONS штук, файлы не больше MAX_SNAPSHOT_BYTES).

   Картинки-загрузки живут реальными файлами в www/studiomi.ru/img/u/:
   одна загрузка = один новый файл (хеш содержимого в имени), файлы
   никогда не перезаписываются и не удаляются автоматически — откат
   версии всегда находит свои файлы. Чистка — только по явной команде
   (action=cleanup_unused) с проверкой ссылок по всем версиям.

   После КАЖДОЙ мутации хранилища (сохранение/откат/сброс) в index.html
   атомарно обновляется блок <!--MI_SNAPSHOT-->…— снимок текущих правок,
   чтобы посетитель видел актуальный сайт с первого кадра (без «мигания»).
   Сбой обновления оставляет предыдущую версию файла нетронутой.

   Ключ записи CMS_KEY должен совпадать с EDITOR_CONFIG.serverSync.key
   в config.js. Это «дверь с защёлкой» (как и ?edit=КЛЮЧ), а не защита от
   взлома: ключ всё равно виден в JS на клиенте.
   ========================================================================== */

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

const CMS_KEY     = 'FZF6MGgNAq4mU653tHkPvCSP';
/* Хранилище правок — за пределами веб-корня (nginx не отдаёт): FTP-корень
   = <user-home>/data/, сайт лежит в www/studiomi.ru, а store — рядом (mistudio-data).
   define() вместо const: dirname() нельзя использовать в константном выражении. */
define('STORE_FILE', dirname(__DIR__, 2) . '/mistudio-data/editor-store.json');
define('VERSIONS_DIR', dirname(__DIR__, 2) . '/mistudio-data/versions');
define('INDEX_FILE', __DIR__ . '/index.html');
define('IMG_U_DIR', __DIR__ . '/img/u');
const MAX_VERSIONS      = 15;
const MAX_SNAPSHOT_BYTES = 1.5 * 1024 * 1024;  /* больше этого — снапшот не делаем */
const MAX_IMAGE_BYTES    = 1536 * 1024;        /* потолок декодированной картинки */
const ALLOWED_KEYS       = array('editable_texts', 'editable_images', 'service_paths',
                                 'promotions', 'services', 'portfolio', 'links');

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

/* Скользящее окно для загрузок: не более $max за $window секунд.
   Отдельно от throttleWrite, чтобы пакетная замена нескольких картинок
   подряд не упиралась в лимит «раз в секунду» на сохранения. */
function throttleWindow($tag, $max, $window) {
    $f = dirname(STORE_FILE) . '/.throttle-' . preg_replace('/[^a-z]/', '', $tag);
    $now = microtime(true);
    $hits = array();
    if (is_file($f)) {
        $hits = @json_decode((string) @file_get_contents($f), true);
        if (!is_array($hits)) $hits = array();
        $hits = array_values(array_filter($hits, function ($t) use ($now, $window) {
            return is_numeric($t) && ($now - (float) $t) < $window;
        }));
    }
    if (count($hits) >= $max) {
        respond(array('ok' => false, 'error' => 'slow down'), 429);
    }
    $hits[] = $now;
    @file_put_contents($f, json_encode($hits), LOCK_EX);
}

/* ==========================================================================
   Картинки-загрузки (img/u/YYYY-MM/…) — ссылки внутри хранилища
   ========================================================================== */

function startsWithImgU($s) {
    return is_string($s) && stripos($s, 'img/u/') === 0;
}

/* Собрать все ссылки на загрузки из хранилища (текущего или снимка):
   editable_images (id→url) + portfolio[].image + services[].images/masters.photo */
function collectImageRefs($store) {
    $out = array();
    $add = function ($v) use (&$out) {
        if (startsWithImgU($v)) { $out[$v] = true; }
    };
    if (isset($store['editable_images']) && is_array($store['editable_images'])) {
        foreach ($store['editable_images'] as $url) $add($url);
    }
    if (!empty($store['portfolio']) && is_array($store['portfolio'])) {
        foreach ($store['portfolio'] as $it) {
            if (is_array($it) && isset($it['image'])) $add($it['image']);
        }
    }
    if (!empty($store['services']) && is_array($store['services'])) {
        foreach ($store['services'] as $svc) {
            if (!is_array($svc)) continue;
            if (!empty($svc['images']) && is_array($svc['images'])) {
                foreach ($svc['images'] as $u) $add($u);
            }
            if (!empty($svc['masters']) && is_array($svc['masters'])) {
                foreach ($svc['masters'] as $m) {
                    if (is_array($m) && isset($m['photo'])) $add($m['photo']);
                }
            }
        }
    }
    return array_keys($out);
}

function imgUrlToPath($url) {
    /* url относительный ('img/u/…'); отсекаем ведущие '/' и '../' */
    $clean = ltrim((string) $url, '/');
    if (strpos($clean, '..') !== false) return null;
    $path = __DIR__ . '/' . $clean;
    $real = realpath(dirname($path));
    if ($real === false || strpos($real, realpath(__DIR__ . '/img')) !== 0) return null;
    return $real . '/' . basename($path);
}

/* Рекурсивный список файлов img/u → [{url, size, mtime}] */
function listUploadFiles() {
    $out = array();
    if (!is_dir(IMG_U_DIR)) return $out;
    $rii = new RecursiveIteratorIterator(new RecursiveDirectoryIterator(IMG_U_DIR, FilesystemIterator::SKIP_DOTS));
    foreach ($rii as $f) {
        if (!$f->isFile() || strpos($f->getFilename(), '.') === 0) continue;
        $rel = str_replace('\\', '/', substr($f->getPathname(), strlen(realpath(__DIR__)) + 1));
        $out[] = array('url' => $rel, 'size' => $f->getSize(), 'mtime' => $f->getMTime());
    }
    usort($out, function ($a, $b) { return strcmp($a['url'], $b['url']); });
    return $out;
}

/* Множество ссылок, на которые ссылается ХОТЬ одна версия истории */
function historyImageRefs() {
    $refs = array();
    $files = glob(VERSIONS_DIR . '/v-*.json');
    if ($files === false) return $refs;
    foreach ($files as $f) {
        $d = json_decode((string) @file_get_contents($f), true);
        if (is_array($d)) {
            foreach (collectImageRefs($d) as $u) $refs[$u] = true;
        }
    }
    return $refs;
}

/* ==========================================================================
   Fallback при откате: если файл картинки удалён — подставляем ближайшую
   выжившую версию из более поздних снапшотов; если и там нет — убираем
   правку (сайт показывает встроенную картинку по умолчанию).
   ========================================================================== */

function resolveMissingImages(&$store) {
    $changed = false;
    if (empty($store['editable_images']) || !is_array($store['editable_images'])) return false;

    /* Снапшоты от новых к старым */
    $maps = array();
    $files = glob(VERSIONS_DIR . '/v-*.json');
    if ($files !== false) {
        usort($files, function ($a, $b) {
            $ma = @filemtime($a); $mb = @filemtime($b);
            return ($mb ?: 0) - ($ma ?: 0);
        });
        foreach ($files as $f) {
            $d = json_decode((string) @file_get_contents($f), true);
            if (is_array($d) && !empty($d['editable_images']) && is_array($d['editable_images'])) {
                $maps[] = $d['editable_images'];
            }
        }
    }

    foreach ($store['editable_images'] as $id => $url) {
        if (!startsWithImgU($url)) continue;
        $p = imgUrlToPath($url);
        if ($p !== null && is_file($p)) continue;
        $found = null;
        foreach ($maps as $m) {
            if (isset($m[$id]) && startsWithImgU($m[$id])) {
                $mp = imgUrlToPath($m[$id]);
                if ($mp !== null && is_file($mp)) { $found = $m[$id]; break; }
            }
        }
        if ($found !== null) {
            $store['editable_images'][$id] = $found;
        } else {
            unset($store['editable_images'][$id]);
        }
        $changed = true;
    }
    return $changed;
}

/* ==========================================================================
   Автоснимок MI_SNAPSHOT в index.html — атомарно, под flock, только блок
   между маркерами <!--MI_SNAPSHOT--> … <!--/MI_SNAPSHOT--> (если маркеров
   нет — блок вставляется перед </head>). Сбой оставляет старый файл целым.
   ========================================================================== */

function buildSnapshotPayload($store) {
    $payload = array(
        'snapshot_time' => date('c'),
        'synced_at'     => isset($store['synced_at']) ? $store['synced_at'] : null
    );
    /* списки при отсутствии правок остаются null (фронт возьмёт встроенные
       данные), map-ключи кодируются пустым объектом {} */
    $listKeys = array_flip(array('promotions', 'services', 'portfolio'));
    foreach (ALLOWED_KEYS as $k) {
        if (!array_key_exists($k, $store)) {
            $payload[$k] = isset($listKeys[$k]) ? null : new stdClass();
            continue;
        }
        $v = $store[$k];
        /* пустые map-ключи кодируем объектом {}, а не списком [] */
        if (!isset($listKeys[$k]) && is_array($v) && count($v) === 0) $v = new stdClass();
        $payload[$k] = $v;
    }
    return $payload;
}

function refreshSnapshot($store) {
    if (!is_file(INDEX_FILE)) return false;
    $lockFile = dirname(STORE_FILE) . '/.index-lock';
    $lf = @fopen($lockFile, 'c');
    if (!$lf) return false;
    if (!@flock($lf, LOCK_EX)) { fclose($lf); return false; }

    $ok = false;
    do {
        $content = @file_get_contents(INDEX_FILE);
        if ($content === false) break;

        $json = json_encode(buildSnapshotPayload($store),
                            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($json === false) break;

        /* HEAD: данные снимка + скрытие заменённых картинок ДО их разбора,
           чтобы посетитель никогда не видел старую версию (даже на холодном
           кэше, пока внешние JS ещё грузятся) */
        $head = '<!--MI_SNAPSHOT--><script>window.MI_SNAPSHOT=' . $json . ';</script>'
              . '<script>(function(){var s=window.MI_SNAPSHOT;if(!s||!s.editable_images)return;'
              . 'var ids=[],urls={};for(var k in s.editable_images){if(String(s.editable_images[k]).indexOf("img/u/")===0){ids.push(k);urls[k]=s.editable_images[k];}}'
              . 'if(!ids.length)return;'
              . 'window.__MI_URLS=urls;'
              . 'document.documentElement.className+=" mi-preload";'
              . 'var css=ids.map(function(id){return \'.mi-preload [data-editable-id="\'+id+\'"]\';}).join(",")+"{visibility:hidden}";'
              . 'var st=document.createElement("style");st.textContent=css;document.head.appendChild(st);})();</script>';
        $block = '<!--MI_SNAPSHOT-->' . $head . '<!--/MI_SNAPSHOT-->';

        /* Конец BODY: мгновенная подмена src/текстов из снимка + снятие класса */
        $apply = '<!--MI_APPLY--><script>(function(){'
               . 'var s=window.MI_SNAPSHOT;if(!s)return;'
               . 'try{var im=window.__MI_URLS||{};'
               . 'for(var id in im){var e=document.querySelector(\'[data-editable-id="\'+id+\'"]\');if(e)e.setAttribute("src",im[id]);}'
               . 'var tx=s.editable_texts||{};'
               . 'for(var t in tx){if(!tx[t])continue;var el=document.querySelector(\'[data-editable-id="\'+t+\'"]\');if(el)el.textContent=tx[t];}'
               . '}catch(e){}'
               . 'var h=document.documentElement;h.className=h.className.replace(/ ?mi-preload/,"");'
               . '})();</script><!--/MI_APPLY-->';

        /* Нормализация: сносим ВСЕ прежние блоки и сиротские маркеры
           (защита от задвоения), затем вставляем ровно по одному */
        $content = preg_replace('/<!--MI_SNAPSHOT-->.*?<!--\/MI_SNAPSHOT-->/s', '', $content);
        $content = preg_replace('/<!--MI_APPLY-->.*?<!--\/MI_APPLY-->/s', '', $content);
        $content = str_replace(
            array('<!--MI_SNAPSHOT-->', '<!--/MI_SNAPSHOT-->', '<!--MI_APPLY-->', '<!--/MI_APPLY-->'),
            '',
            $content
        );

        $h = stripos($content, '</head>');
        if ($h === false) break;
        $out = substr($content, 0, $h) . $block . "\n" . substr($content, $h);

        $bp = strripos($out, '</body>');
        if ($bp !== false) {
            $out = substr($out, 0, $bp) . $apply . "\n" . substr($out, $bp);
        }

        $tmp = INDEX_FILE . '.tmp.' . getmypid();
        if (@file_put_contents($tmp, $out) === false) break;
        if (!@rename($tmp, INDEX_FILE)) { @unlink($tmp); break; }
        $ok = true;
    } while (false);

    @flock($lf, LOCK_UN);
    @fclose($lf);
    return $ok;
}

/* ==========================================================================
   Защита от двойной кодировки (инцидент 24.08.2026): строка, чьи UTF-8 байты
   были прочитаны как CP1251 и снова сохранены, содержит плотные пары
   «Р/С + строчная кириллица» (каждая исходная буква превращается в две).
   В нормальном русском тексте такие пары редки (только заглавная в начале
   слова), поэтому порог по количеству надёжно отличает мусор.
   ========================================================================== */

function looksLikeDoubleEncoded($s) {
    if (!is_string($s) || !function_exists('mb_convert_encoding')) return false;
    if (mb_strlen($s) < 12) return false;
    /* Внешний слой — символы кириллических блоков (Р, С, џ, Ѓ…), иначе
       проверять нечего */
    if (!preg_match('/[\x{0400}-\x{04FF}]/u', $s)) return false;

    /* Обратный проход: строку → байты CP1251 (=исходные UTF-8 байты при
       двойной кодировке). Если эти байты — валидный UTF-8 с осмысленными
       русскими словами, значит текст был дважды закодирован. Для нормального
       текста такой раундрип почти невозможен. */
    $bytes = @mb_convert_encoding($s, 'Windows-1251', 'UTF-8');
    if (!is_string($bytes) || $bytes === '') return false;
    if (!@mb_check_encoding($bytes, 'UTF-8')) return false;

    /* PHP-строка — это байты; /u читает их как UTF-8 */
    preg_match_all('/[а-яё]{3,}/iu', $bytes, $m);
    $letters = 0;
    foreach ($m[0] as $w) $letters += mb_strlen($w);
    return $letters >= 12;
}

function payloadHasMojibake($data) {
    if (is_string($data)) return looksLikeDoubleEncoded($data);
    if (is_array($data)) {
        foreach ($data as $v) {
            if (payloadHasMojibake($v)) return true;
        }
    }
    return false;
}

/* ==========================================================================
   История изменений → VK-бот (через GAS вебхук, тот же что для заявок)
   Сервер сам сравнивает старое↔новое хранилище и формирует готовый текст.
   ========================================================================== */

const CHANGE_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbwSXCUxpovSVT0mTybdRdrBeIiiSmUKmJ44aWCLpqqpNWUrRoTv07oIAvVXfoEEyPCB/exec';
const CHANGES_MAX_LINES  = 12;

function textLabel($id) {
    static $map = array(
        'hero_title'        => 'Hero — заголовок',
        'hero_subtitle'     => 'Hero — подзаголовок',
        'hero_meta'         => 'Hero — надзаголовок',
        'about_title'       => 'О студии — заголовок',
        'about_text'        => 'О студии — текст',
        'portfolio_title'   => 'Портфолио — заголовок',
        'portfolio_sub'     => 'Портфолио — подпись',
        'promos_title'      => 'Акции — заголовок',
        'promos_sub'        => 'Акции — подпись',
        'services_title'    => 'Услуги — заголовок',
        'services_sub'      => 'Услуги — подпись',
        'contacts_title'    => 'Контакты — заголовок',
        'contacts_sub'      => 'Контакты — подпись',
        'contacts_address'  => 'Контакты — адрес',
        'contacts_schedule' => 'Контакты — часы работы',
        'site_phone_0'      => 'Телефон (основной)',
        'site_phone_1'      => 'Телефон (дополнительный)'
    );
    return isset($map[$id]) ? $map[$id] : ucwords(str_replace('_', ' ', $id));
}

/* Человекочитаемая метка ключа картинки; названия услуг берём из стейта */
function imageLabel($key, $svcTitles) {
    if (preg_match('/^hero_img_back$/', $key))   return 'Герой — фон';
    if (preg_match('/^hero_img_mid$/', $key))    return 'Герой — центр';
    if (preg_match('/^hero_img_front$/', $key))  return 'Герой — передний план';
    if ($key === 'about_image')                  return 'Фото «О студии»';
    if (preg_match('/^svc_([a-z0-9_]+?)_img_(\d+)$/', $key, $m)) {
        $t = isset($svcTitles[$m[1]]) ? '«' . $svcTitles[$m[1]] . '»' : '';
        return 'Услуга ' . $t . ' — фото' . ((int) $m[2] > 0 ? ' №' . ($m[2] + 1) : '');
    }
    if (preg_match('/^svc_([a-z0-9_]+?)_master_(\d+)$/', $key, $m)) {
        $t = isset($svcTitles[$m[1]]) ? '«' . $svcTitles[$m[1]] . '»' : '';
        return 'Услуга ' . $t . ' — фото мастера';
    }
    if (strpos($key, 'gallery_') === 0)          return 'Портфолио — фото';
    return $key;
}

function indexById($list) {
    $out = array();
    if (is_array($list)) {
        foreach ($list as $it) {
            if (is_array($it) && !empty($it['id'])) $out[$it['id']] = $it;
        }
    }
    return $out;
}

function serviceAspects($a, $b) {
    $aspects = array();
    if (($a['title'] ?? '') !== ($b['title'] ?? ''))                       $aspects[] = 'название';
    if (($a['shortDesc'] ?? '') !== ($b['shortDesc'] ?? ''))               $aspects[] = 'описание';
    if (($a['category'] ?? '') !== ($b['category'] ?? ''))                 $aspects[] = 'категория';
    if (($a['priceText'] ?? '') !== ($b['priceText'] ?? ''))               $aspects[] = 'цена в карточке';
    if (json_encode($a['price'] ?? null) !== json_encode($b['price'] ?? null))       $aspects[] = 'прайс';
    if (json_encode($a['images'] ?? null) !== json_encode($b['images'] ?? null))     $aspects[] = 'фото';
    if (json_encode(array_column($a['masters'] ?? array(), 'name'))
        !== json_encode(array_column($b['masters'] ?? array(), 'name')))             $aspects[] = 'мастера';
    if (($a['phone'] ?? '') !== ($b['phone'] ?? ''))                       $aspects[] = 'телефон';
    return $aspects;
}

function itemAspects($a, $b, $fields) {
    $aspects = array();
    foreach ($fields as $f => $label) {
        if (($a[$f] ?? '') !== ($b[$f] ?? '')) $aspects[] = $label;
    }
    return $aspects;
}

/* Основной дифф: массив готовых строк-пунктов */
function diffStores($old, $new) {
    $items   = array();
    $titles  = array();
    foreach (array($old, $new) as $st) {
        if (!empty($st['services']) && is_array($st['services'])) {
            foreach ($st['services'] as $s) {
                if (!empty($s['id']) && !empty($s['title'])) $titles[$s['id']] = $s['title'];
            }
        }
    }

    /* Тексты */
    $ot = isset($old['editable_texts']) && is_array($old['editable_texts']) ? $old['editable_texts'] : array();
    $nt = isset($new['editable_texts']) && is_array($new['editable_texts']) ? $new['editable_texts'] : array();
    foreach ($nt as $id => $v) {
        if (!isset($ot[$id])) {
            /* первой правке блока — быть в истории так же */
            if (is_string($v) && trim($v) !== '') $items[] = 'Текст «' . textLabel($id) . '»: изменён';
            continue;
        }
        if ($ot[$id] !== $v)  $items[] = 'Текст «' . textLabel($id) . '»: изменён';
    }

    /* Картинки */
    $oi = isset($old['editable_images']) && is_array($old['editable_images']) ? $old['editable_images'] : array();
    $ni = isset($new['editable_images']) && is_array($new['editable_images']) ? $new['editable_images'] : array();
    foreach ($ni as $id => $url) {
        if (isset($oi[$id]) && $oi[$id] === $url) continue;
        $items[] = 'Фото «' . imageLabel($id, $titles) . '»: заменено';
    }

    /* Услуги */
    $os = indexById(isset($old['services']) ? $old['services'] : null);
    $ns = indexById(isset($new['services']) ? $new['services'] : null);
    foreach ($ns as $id => $s) {
        if (!isset($os[$id])) { $items[] = '➕ Новая услуга «' . ($s['title'] ?? $id) . '»'; continue; }
        $asp = serviceAspects($os[$id], $s);
        if ($asp) $items[] = 'Услуга «' . ($s['title'] ?: $id) . '»: изменено ' . implode(', ', $asp);
    }
    foreach ($os as $id => $s) {
        if (!isset($ns[$id])) $items[] = '❌ Удалена услуга «' . ($s['title'] ?? $id) . '»';
    }

    /* Портфолио */
    $op = indexById(isset($old['portfolio']) ? $old['portfolio'] : null);
    $np = indexById(isset($new['portfolio']) ? $new['portfolio'] : null);
    foreach ($np as $id => $p) {
        $t = $p['title'] ?? $id;
        if (!isset($op[$id])) { $items[] = '📁 Портфолио: добавлена работа «' . $t . '»'; continue; }
        $asp = itemAspects($op[$id], $p, array('title' => 'название', 'desc' => 'описание', 'image' => 'фото'));
        if ($asp) $items[] = 'Портфолио, работа «' . $t . '»: изменено ' . implode(', ', $asp);
    }
    foreach ($op as $id => $p) {
        if (!isset($np[$id])) $items[] = '📁 Портфолио: удалена работа «' . ($p['title'] ?? $id) . '»';
    }

    /* Акции */
    $oa = indexById(isset($old['promotions']) ? $old['promotions'] : null);
    $na = indexById(isset($new['promotions']) ? $new['promotions'] : null);
    foreach ($na as $id => $p) {
        $t = $p['title'] ?? $id;
        if (!isset($oa[$id])) { $items[] = '🎁 Новая акция «' . $t . '»'; continue; }
        $asp = itemAspects($oa[$id], $p, array('badge' => 'бейдж', 'tag' => 'метка', 'title' => 'название', 'desc' => 'описание', 'note' => 'условия'));
        if ($asp) $items[] = 'Акция «' . $t . '»: изменено ' . implode(', ', $asp);
    }
    foreach ($oa as $id => $p) {
        if (!isset($na[$id])) $items[] = '🎁 Акция «' . ($p['title'] ?? $id) . '» удалена';
    }

    /* Ссылки и подписи прайса */
    $ol = isset($old['links']) && is_array($old['links']) ? $old['links'] : array();
    $nl = isset($new['links']) && is_array($new['links']) ? $new['links'] : array();
    if (json_encode($ol) !== json_encode($nl)) $items[] = '🔗 Ссылки / соцсети: обновлены';

    $opa = isset($old['service_paths']) && is_array($old['service_paths']) ? $old['service_paths'] : array();
    $npa = isset($new['service_paths']) && is_array($new['service_paths']) ? $new['service_paths'] : array();
    $diffPaths = count(array_diff_assoc($npa, $opa)) + count(array_diff_assoc($opa, $npa));
    if ($diffPaths > 0) $items[] = 'Подписи услуг: обновлены (' . $diffPaths . ')';

    return $items;
}

function storeIsEmptyish($s) {
    if (!is_array($s)) return true;
    foreach (ALLOWED_KEYS as $k) {
        $v = isset($s[$k]) ? $s[$k] : null;
        if (is_array($v) && count($v) > 0) return false;
    }
    return true;
}

function sendChangesToVk($message) {
    if (!defined('CHANGE_WEBHOOK_URL') || !CHANGE_WEBHOOK_URL) return false;
    $payload = json_encode(array(
        'type'    => 'site_changes',
        'time'    => date('c'),
        'message' => $message
    ), JSON_UNESCAPED_UNICODE);
    if (function_exists('curl_init')) {
        $ch = curl_init(CHANGE_WEBHOOK_URL);
        curl_setopt_array($ch, array(
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $payload,
            CURLOPT_HTTPHEADER     => array('Content-Type: text/plain'),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT_MS     => 5000,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_POSTREDIR      => CURL_REDIR_POST_ALL
        ));
        @curl_exec($ch);
        curl_close($ch);
        return true;
    }
    $ctx = stream_context_create(array('http' => array(
        'method'  => 'POST',
        'header'  => "Content-Type: application/json\r\n",
        'content' => $payload,
        'timeout' => 5
    )));
    @file_get_contents(CHANGE_WEBHOOK_URL, false, $ctx);
    return true;
}

/* Формирует и отправляет сообщение; возвращает число отправленных пунктов */
function maybeSendChanges($items) {
    $items = array_values(array_filter(array_map('trim', (array) $items), function ($v) { return $v !== ''; }));
    if (!$items) return 0;
    $extra = 0;
    if (count($items) > CHANGES_MAX_LINES) {
        $extra = count($items) - CHANGES_MAX_LINES;
        $items = array_slice($items, 0, CHANGES_MAX_LINES);
        $items[] = '…и ещё ' . $extra . ' правок';
    }
    $msg  = '🔧 Правки сайта — ' . date('d.m H:i') . "\n";
    $msg .= '━━━━━━━━━━━━━━━━━━━' . "\n";
    $msg .= '• ' . implode("\n• ", $items);
    sendChangesToVk($msg);
    return count($items);
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
    if (isset($_GET['action']) && $_GET['action'] === 'images_inventory') {
        if (!originAllowed()) {
            respond(array('ok' => false, 'error' => 'forbidden'), 403);
        }
        if ((isset($_GET['key']) ? $_GET['key'] : '') !== CMS_KEY) {
            respond(array('ok' => false, 'error' => 'forbidden'), 403);
        }
        $currentRefs = array_flip(collectImageRefs(readStore()));
        $historyRefs = historyImageRefs();
        $files = array();
        $total = 0;
        foreach (listUploadFiles() as $f) {
            $f['current'] = isset($currentRefs[$f['url']]);
            $f['history'] = isset($historyRefs[$f['url']]);
            unset($f['mtime']);
            $files[]   = $f;
            $total    += (int) $f['size'];
        }
        respond(array('ok' => true, 'files' => $files, 'bytes_total' => $total));
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

    $action = isset($body['action']) ? (string) $body['action'] : '';

    /* --- Загрузка картинки файлом на хост --------------------------------- */
    if ($action === 'upload_image') {
        throttleWindow('uploads', 8, 30);
        $dataUrl = isset($body['image_base64']) ? (string) $body['image_base64'] : '';
        if (!preg_match('/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+\/=\s]+)$/', $dataUrl, $m)) {
            respond(array('ok' => false, 'error' => 'bad image format'), 400);
        }
        $bin = base64_decode(str_replace(' ', '+', $m[2]), true);
        if ($bin === false || strlen($bin) === 0) {
            respond(array('ok' => false, 'error' => 'bad base64'), 400);
        }
        if (strlen($bin) > MAX_IMAGE_BYTES) {
            respond(array('ok' => false, 'error' => 'too large'), 413);
        }
        /* Реальный тип по содержимому, не по заявленному */
        $info = @getimagesizefromstring($bin);
        $realMime = is_array($info) && isset($info['mime']) ? $info['mime'] : '';
        $map = array('image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp');
        if (!isset($map[$realMime])) {
            respond(array('ok' => false, 'error' => 'unsupported type'), 400);
        }
        $ext  = $map[$realMime];
        $hash = substr(hash('sha256', $bin), 0, 14);

        $sub   = date('Y-m');
        $dir   = IMG_U_DIR . '/' . $sub;
        if (!is_dir($dir)) { @mkdir($dir, 0775, true); }
        if (!is_dir($dir)) {
            respond(array('ok' => false, 'error' => 'mkdir failed'), 500);
        }
        $name  = 'u' . $hash . '.' . $ext;
        $path  = $dir . '/' . $name;
        $dedup = is_file($path);
        if (!$dedup) {                               /* тот же контент = тот же файл */
            $tmp = $path . '.' . getmypid() . '.tmp';
            if (@file_put_contents($tmp, $bin) === false || !@rename($tmp, $path)) {
                @unlink($tmp);
                respond(array('ok' => false, 'error' => 'write failed'), 500);
            }
        }
        respond(array('ok'   => true,
                      'url'   => 'img/u/' . $sub . '/' . $name,
                      'bytes' => strlen($bin),
                      'dedup' => $dedup));
    }

    /* --- Чистка неиспользуемых картинок ------------------------------------ */
    if ($action === 'cleanup_unused') {
        throttleWrite();
        $currentRefs = array_flip(collectImageRefs(readStore()));
        $historyRefs = historyImageRefs();
        $deleted = array();
        $freed   = 0;
        foreach (listUploadFiles() as $f) {
            if (isset($currentRefs[$f['url']]) || isset($historyRefs[$f['url']])) continue;
            $p = imgUrlToPath($f['url']);
            if ($p !== null && is_file($p) && @unlink($p)) {
                $deleted[] = $f['url'];
                $freed    += (int) $f['size'];
            }
        }
        respond(array('ok' => true, 'deleted' => $deleted, 'freed_bytes' => $freed,
                      'changes_sent' => ($deleted ? maybeSendChanges(array('🧹 Чистка картинок: удалено ' . count($deleted) . ' шт, освобождено ' . round($freed / 1024 / 1024, 1) . ' МБ')) : 0)));
    }

    /* Один write-POST в секунду (в т.ч. откаты) */
    throttleWrite();

    if ($action === 'restore') {
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
        }        /* Текущее состояние сохраняем как версию — откат отменяем */
        $current = readStore();
        if (count($current)) createSnapshot($current);
        /* Файлы, удалённые чисткой: подставляем ближайшую выжившую версию */
        resolveMissingImages($data);
        if (!writeStore($data)) {
            respond(array('ok' => false, 'error' => 'write failed'), 500);
        }
        refreshSnapshot($data);
        maybeSendChanges(array('↩️ Откат сайта к версии от ' . versionTime($id)));
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

    $allowed = ALLOWED_KEYS;
    $clean = array();
    foreach ($allowed as $k) {
        if (array_key_exists($k, $data)) {
            $clean[$k] = $data[$k];
        }
    }
    $clean['synced_at'] = date('c');

    /* Старое состояние — до записи, для диффа истории изменений */
    $oldStore = readStore();

    /* Предохранитель: не публикуем двойную кодировку (см. инцидент 24.08.2026) */
    if (payloadHasMojibake($clean)) {
        respond(array('ok' => false,
                      'error' => 'encoding looks broken (double-encoded text) — save rejected'), 422);
    }

    if (!writeStore($clean)) {
        respond(array('ok' => false, 'error' => 'write failed'), 500);
    }
    createSnapshot($clean);
    refreshSnapshot($clean);   /* снимок в index.html — публикация = сохранение */

    /* История изменений в VK */
    if (storeIsEmptyish($oldStore) && !storeIsEmptyish($clean)) {
        $changes = array('📦 Первичное наполнение контента');
    } elseif (!storeIsEmptyish($oldStore) && storeIsEmptyish($clean)) {
        $changes = array('🗑 Сброс всех правок контента');
    } else {
        $changes = diffStores($oldStore, $clean);
    }
    $sent = maybeSendChanges($changes);
    respond(array('ok' => true, 'changes_sent' => $sent));
}

respond(array('ok' => false, 'error' => 'method not allowed'), 405);
