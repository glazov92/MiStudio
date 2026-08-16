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
    portfolio: 'portfolio'
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

/* Хранилище-состояние: всегда загружается при загрузке страницы,
   чтобы даже без режима редактирования правки применялись к рендеру.
   main.js читает его через геттеры getPromos()/getServices()/getPortfolioItems(). */
const EDITOR_STORE = {
    texts: {},
    images: {},
    paths: {},
    promos: null,
    services: null,
    portfolio: null
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

            editorSaveJSON('texts', texts);
            editorSaveJSON('images', images);
            if (paths && Object.keys(paths).length) editorSaveJSON('paths', paths);
            if (promos) editorSaveJSON('promos', promos);
            if (services) editorSaveJSON('services', services);
            if (portfolio) editorSaveJSON('portfolio', portfolio);

            EDITOR_STORE.texts = texts;
            EDITOR_STORE.images = images;
            EDITOR_STORE.paths = paths;
            EDITOR_STORE.promos = promos;
            EDITOR_STORE.services = services;
            EDITOR_STORE.portfolio = portfolio;

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
    if (!confirm('Сбросить ВСЕ изменения (тексты, изображения, услуги, акции, портфолио)? Действие необратимо.')) return;
    Object.keys(EDITOR_KEYS).forEach(k => {
        try { localStorage.removeItem(editorStorageKey(k)); } catch (_) { /* ignore */ }
    });
    location.reload();
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
