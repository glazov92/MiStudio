/* ==========================================================================
   Frontend-редактор: слой localStorage
   Храним отдельными ключами (по ТЗ, раздел 4.1) с префиксом EDITOR_CONFIG.
   ========================================================================== */

const EDITOR_KEYS = {
    texts: 'editable_texts',
    images: 'editable_images',
    paths: 'service_paths',
    promos: 'promotions',
    services: 'services',
    portfolio: 'portfolio',
    links: 'links'
};

function editorStorageKey(short) {
    return EDITOR_CONFIG.storagePrefix + (EDITOR_KEYS[short] || short);
}

function editorLoadJSON(short, fallback) {
    try {
        const raw = localStorage.getItem(editorStorageKey(short));
        if (raw == null) return fallback;
        const parsed = JSON.parse(raw);
        return parsed;
    } catch (e) {
        console.warn('[editor] Не удалось прочитать', short, e);
        return fallback;
    }
}

function editorSaveJSON(short, value) {
    try {
        localStorage.setItem(editorStorageKey(short), JSON.stringify(value));
        editorScheduleSync();
        return true;
    } catch (e) {
        editorToast('Хранилище переполнено — изображение слишком большое. Сожмите его или удалите неиспользуемые.', true);
        console.warn('[editor] Не удалось сохранить', short, e);
        return false;
    }
}

function editorStorageSupported() {
    try {
        const k = '__editor_test__';
        localStorage.setItem(k, '1');
        localStorage.removeItem(k);
        return true;
    } catch (e) {
        return false;
    }
}

/* Пустой список = «правок нет» (null). Защита от случайного стирания
   секций: [] никогда не заменяет встроенный контент сайта. */
function editorNormalizeList(v) {
    return (Array.isArray(v) && v.length) ? v : null;
}

/* --- Серверная синхронизация правок (PHP content-sync.php на хостинге) -- */

function editorSyncUrl() {
    const c = EDITOR_CONFIG.serverSync;
    if (!c || !c.enabled || !c.url) return null;
    return c.url;
}

function editorSyncPayload() {
    return {
        key: (EDITOR_CONFIG.serverSync && EDITOR_CONFIG.serverSync.key) || '',
        data: {
            editable_texts: EDITOR_STORE.texts || {},
            editable_images: EDITOR_STORE.images || {},
            service_paths: EDITOR_STORE.paths || {},
            promotions: EDITOR_STORE.promos || null,
            services: EDITOR_STORE.services || null,
            portfolio: EDITOR_STORE.portfolio || null,
            links: EDITOR_STORE.links || {}
        }
    };
}

/* Получить правки с сервера. Возвращает Promise<object|null>. */
function editorSyncPull() {
    const url = editorSyncUrl();
    if (!url) return Promise.resolve(null);
    return fetch(url, { method: 'GET', cache: 'no-store' })
        .then(r => (r.ok ? r.json() : null))
        .catch(() => null);
}

/* Отправить полный снимок правок на сервер. Возвращает Promise<boolean>. */
function editorSyncPush() {
    const url = editorSyncUrl();
    if (!url) return Promise.resolve(false);
    return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editorSyncPayload())
    }).then(r => (r.ok ? true : false)).catch(() => false);
}

/* Тихая запись текущего хранилища в localStorage — БЕЗ отправки на сервер.
   Используется для кэша у посетителей (после успешного pull), чтобы
   повторные визиты рендерились с правками до первого кадра. */
function editorPersistSilent() {
    try {
        const put = (short, val) => {
            try {
                localStorage.setItem(editorStorageKey(short), JSON.stringify(val));
            } catch (e) { /* квота — молча */ }
        };
        put('texts', EDITOR_STORE.texts || {});
        put('images', EDITOR_STORE.images || {});
        put('paths', EDITOR_STORE.paths || {});
        ['promos', 'services', 'portfolio'].forEach(k => {
            if (EDITOR_STORE[k]) put(k, EDITOR_STORE[k]);
            else try { localStorage.removeItem(editorStorageKey(k)); } catch (e) {}
        });
        if (EDITOR_STORE.links) put('links', EDITOR_STORE.links);
        try { localStorage.setItem(EDITOR_CONFIG.storagePrefix + 'synced_at', EDITOR_STORE.synced_at || ''); } catch (e) {}
    } catch (e) { /* ignore */ }
}

function editorCachedSyncedAt() {
    try { return localStorage.getItem(EDITOR_CONFIG.storagePrefix + 'synced_at') || ''; }
    catch (e) { return ''; }
}

/* Инвентарь картинок img/u для чистки. -> Promise<{ok,files,bytes_total}|null> */
function editorSyncImagesInventory() {
    const base = editorSyncUrl();
    if (!base) return Promise.resolve(null);
    const c = EDITOR_CONFIG.serverSync;
    const url = base + (base.indexOf('?') >= 0 ? '&' : '?') +
        'action=images_inventory&key=' + encodeURIComponent((c && c.key) || '');
    return fetch(url, { method: 'GET', cache: 'no-store' })
        .then(r => (r.ok ? r.json() : null))
        .catch(() => null);
}

/* Удалить неиспользуемые картинки. -> Promise<{ok,deleted,freed_bytes}|null> */
function editorSyncCleanupUnused() {
    const url = editorSyncUrl();
    if (!url) return Promise.resolve(null);
    return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'cleanup_unused',
            key: (EDITOR_CONFIG.serverSync && EDITOR_CONFIG.serverSync.key) || ''
        })
    }).then(r => (r.ok ? r.json() : null)).catch(() => null);
}

/* Список версий правок с сервера. Возвращает Promise<object|null>
   ({ ok, versions:[{id,time}], max } либо null при недоступности). */
function editorSyncVersions() {
    const base = editorSyncUrl();
    if (!base) return Promise.resolve(null);
    const c = EDITOR_CONFIG.serverSync;
    const url = base + (base.indexOf('?') >= 0 ? '&' : '?') +
        'action=versions&key=' + encodeURIComponent((c && c.key) || '');
    return fetch(url, { method: 'GET', cache: 'no-store' })
        .then(r => (r.ok ? r.json() : null))
        .catch(() => null);
}

/* Откатить правки к версии. Возвращает Promise<boolean>. */
function editorSyncRestore(version) {
    const url = editorSyncUrl();
    if (!url) return Promise.resolve(false);
    return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'restore',
            key: (EDITOR_CONFIG.serverSync && EDITOR_CONFIG.serverSync.key) || '',
            version: version
        })
    }).then(r => (r.ok ? true : false)).catch(() => false);
}

let editorSyncTimer = null;
function editorScheduleSync() {
    if (!editorSyncUrl()) return;
    clearTimeout(editorSyncTimer);
    editorSyncTimer = setTimeout(() => editorSyncPush(), 800);
}

/* Хранилище-состояние: всегда загружается при загрузке страницы,
   чтобы даже без режима редактирования правки применялись к рендеру.
   main.js читает его через геттеры getPromos()/getServices()/getPortfolioItems(). */
const EDITOR_STORE = {
    texts: {},
    images: {},
    paths: {},
    promos: null,
    services: null,
    portfolio: null,
    links: null
};

window.MiEditorData = EDITOR_STORE;

/* --- Экспорт / импорт / сброс ------------------------------------------ */

function editorExportData() {
    const data = {
        editable_texts: EDITOR_STORE.texts || {},
        editable_images: EDITOR_STORE.images || {},
        service_paths: EDITOR_STORE.paths || {},
        promotions: EDITOR_STORE.promos || [],
        services: EDITOR_STORE.services || [],
        portfolio: EDITOR_STORE.portfolio || [],
        links: EDITOR_STORE.links || {},
        exported_at: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `mistudio-editor-${date}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    editorToast('Данные выгружены в JSON-файл.');
}

function editorImportData(file) {
    const reader = new FileReader();
    reader.onload = () => {
        try {
            const data = JSON.parse(reader.result);
            const texts = data.editable_texts && typeof data.editable_texts === 'object' ? data.editable_texts : {};
            const images = data.editable_images && typeof data.editable_images === 'object' ? data.editable_images : {};
            const paths = data.service_paths && typeof data.service_paths === 'object' ? data.service_paths : {};
            const promos = Array.isArray(data.promotions) ? data.promotions : null;
            const services = Array.isArray(data.services) ? data.services : null;
            const portfolio = Array.isArray(data.portfolio) ? data.portfolio : null;
            const links = data.links && typeof data.links === 'object' ? data.links : null;

            editorSaveJSON('texts', texts);
            editorSaveJSON('images', images);
            if (paths && Object.keys(paths).length) editorSaveJSON('paths', paths);
            if (editorNormalizeList(promos)) editorSaveJSON('promos', promos);
            if (editorNormalizeList(services)) editorSaveJSON('services', services);
            if (editorNormalizeList(portfolio)) editorSaveJSON('portfolio', portfolio);
            if (links && Object.keys(links).length) editorSaveJSON('links', links);

            EDITOR_STORE.texts = texts;
            EDITOR_STORE.images = images;
            EDITOR_STORE.paths = paths;
            EDITOR_STORE.promos = editorNormalizeList(promos);
            EDITOR_STORE.services = editorNormalizeList(services);
            EDITOR_STORE.portfolio = editorNormalizeList(portfolio);
            EDITOR_STORE.links = links;

            editorToast('Импорт прошёл успешно. Страница обновляется...');
            setTimeout(() => location.reload(), 600);
        } catch (e) {
            editorToast('Не удалось прочитать JSON-файл.', true);
            console.warn('[editor] import:', e);
        }
    };
    reader.onerror = () => editorToast('Ошибка чтения файла.', true);
    reader.readAsText(file);
}

function editorResetAll() {
    if (!confirm('Сбросить ВСЕ изменения (тексты, изображения, услуги, акции, портфолио)? Действие необратимо и удалит правки и на сервере.')) return;
    Object.keys(EDITOR_KEYS).forEach(k => {
        try { localStorage.removeItem(editorStorageKey(k)); } catch (_) { /* ignore */ }
    });
    const done = () => location.reload();
    if (editorSyncUrl()) {
        EDITOR_STORE.texts = {};
        EDITOR_STORE.images = {};
        EDITOR_STORE.paths = {};
        EDITOR_STORE.promos = null;
        EDITOR_STORE.services = null;
        EDITOR_STORE.portfolio = null;
        EDITOR_STORE.links = null;
        editorSyncPush().then(done, done);
    } else {
        done();
    }
}

/* --- Тосты -------------------------------------------------------------- */

let editorToastTimer = null;
function editorToast(message, isError) {
    let toast = document.getElementById('editor-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'editor-toast';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.className = 'is-show' + (isError ? ' is-error' : '');
    clearTimeout(editorToastTimer);
    editorToastTimer = setTimeout(() => toast.classList.remove('is-show'), 3200);
}
