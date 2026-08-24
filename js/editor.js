/* ==========================================================================
   Frontend-редактор: ядро
   Активация: https://site.com/?edit=КЛЮЧ или https://site.com/?КЛЮЧ
   (EDITOR_CONFIG.secretKey). Слэш в конце адреса не важен — работает и
   file:///.../index.html?edit=КЛЮЧ, и file:///.../index.html/?edit=КЛЮЧ.
   Сохранение данных — localStorage (см. js/storage.js, ТЗ раздел 4).
   ========================================================================== */

let EDITOR_ACTIVE = false;
let EDITOR_MODE = false;   /* подтверждено сервером (action=auth) */
let EDITOR_ELEMENTS = { texts: [], images: [] };

/* Кандидат ключа из URL: ?edit=КЛЮЧ, голый ?КЛЮЧ или ?x=КЛЮЧ */
function editorCandidateFromUrl() {
    try {
        const p = new URLSearchParams(location.search);
        const e = p.get('edit');
        if (e) return e;
        for (const [k, v] of p) {
            if (!v && k.length >= 12) return k;
            if (v && v.length >= 12 && k !== 'test') return v;
        }
    } catch (err) { /* ignore */ }
    return null;
}

/* Проверка ключа НА СЕРВЕРЕ — ключ не хранится и не проверяется в браузере */
function editorTryAuth(candidate) {
    if (!candidate || !editorSyncUrl()) return;
    const url = editorSyncUrl() + (editorSyncUrl().indexOf('?') >= 0 ? '&' : '?') +
        'action=auth&k=' + encodeURIComponent(candidate);
    fetch(url, { method: 'GET', cache: 'no-store' })
        .then(r => r.json())
        .then(j => {
            if (j && j.ok) {
                EDITOR_MODE = true;
                editorScan();
                activateEditor();
                editorToast('Режим редактирования включён. Наведите на текст или картинку и нажмите.');
            } else {
                editorToast('Неверный ключ админки. Проверь ссылку.', true);
            }
        })
        .catch(() => { /* сервер недоступен — страница остаётся обычным сайтом */ });
}

/* Совместимость: активность редактора теперь определяется сервером */
function editorModeActive() {
    return EDITOR_MODE;
}

function editorLoadStore() {
    EDITOR_STORE.texts = editorLoadJSON('texts', {}) || {};
    EDITOR_STORE.images = editorLoadJSON('images', {}) || {};
    EDITOR_STORE.paths = editorLoadJSON('paths', {}) || {};
    EDITOR_STORE.promos = editorNormalizeList(editorLoadJSON('promos', null));
    EDITOR_STORE.services = editorNormalizeList(editorLoadJSON('services', null));
    EDITOR_STORE.portfolio = editorNormalizeList(editorLoadJSON('portfolio', null));
    EDITOR_STORE.links = editorLoadJSON('links', null);
    editorMergeSnapshot();
    if (!editorStorageSupported()) {
        editorToast('localStorage недоступен (режим инкогнито) — изменения не сохранятся.', true);
    }
}

/* Снимок из index.html (window.MI_SNAPSHOT, обновляется сервером при каждом
   «Сохранить»). Применяем, если он не старее кэша в localStorage — тогда даже
   первый заход устройства рендерит актуальный сайт с первого кадра. */
function editorMergeSnapshot() {
    const snap = window.MI_SNAPSHOT;
    if (!snap || typeof snap !== 'object') return;
    const snapTime = String(snap.synced_at || snap.snapshot_time || '');
    const cached = editorCachedSyncedAt();
    if (snapTime && cached && snapTime < cached) return;   /* кэш свежее снимка */
    if (!snapTime && cached) return;

    const maps = (a, b) => Object.assign({}, a || {}, b || {});
    const asMap = v => (Array.isArray(v) ? {} : (v || {}));
    const asList = v => editorNormalizeList(v);
    EDITOR_STORE.texts     = maps(null, asMap(snap.editable_texts));
    EDITOR_STORE.images    = maps(null, asMap(snap.editable_images));
    EDITOR_STORE.paths     = maps(null, asMap(snap.service_paths));
    EDITOR_STORE.links     = asMap(snap.links);
    EDITOR_STORE.promos    = asList(snap.promotions);
    EDITOR_STORE.services  = asList(snap.services);
    EDITOR_STORE.portfolio = asList(snap.portfolio);
    EDITOR_STORE.synced_at = snapTime || (EDITOR_STORE.synced_at || '');
    editorPersistSilent();
}

/* --- Применение сохранённых правок к DOM (для всех посетителей браузера) */

function editorApplySaved() {
    document.querySelectorAll('[data-editable="text"]').forEach(el => {
        const id = el.dataset.editableId;
        if (!id) return;
        const value = EDITOR_STORE.texts[id];
        if (value != null && String(value).trim() !== '') el.textContent = value;
    });

    document.querySelectorAll('[data-editable="image"]').forEach(el => {
        const id = el.dataset.editableId;
        if (!id) return;
        if (!el.dataset.editorOrig) el.dataset.editorOrig = el.getAttribute('src') || '';
        if (EDITOR_STORE.images[id]) el.src = EDITOR_STORE.images[id];
    });

    document.querySelectorAll('[data-ed-path]').forEach(el => {
        const path = el.dataset.edPath;
        if (!path) return;
        const value = editorReadPathValue(path);
        if (value != null) el.textContent = String(value);
    });

    editorUpdateTelHrefs();
}

/* --- Применение правок, полученных с сервера ---------------------------- */

function editorApplyServerData(server) {
    try {
        if (!server || typeof server !== 'object') return;
        let changed = false;
        const mergeMap = (store, key) => {
            const src = server[key];
            if (src && typeof src === 'object' && !Array.isArray(src)) {
                const merged = Object.assign({}, EDITOR_STORE[store], src);
                if (JSON.stringify(merged) !== JSON.stringify(EDITOR_STORE[store])) {
                    EDITOR_STORE[store] = merged;
                    changed = true;
                }
            }
        };
        mergeMap('texts', 'editable_texts');
        mergeMap('images', 'editable_images');
        mergeMap('paths', 'service_paths');
        mergeMap('links', 'links');
        /* Ключи сервера -> ключи стора: на сервере 'promotions', в сторе 'promos'.
           Пустые списки игнорируются: [] никогда не затирает контент сайта. */
        const listKeys = { promotions: 'promos', services: 'services', portfolio: 'portfolio' };
        Object.keys(listKeys).forEach(sk => {
            const storeKey = listKeys[sk];
            const incoming = editorNormalizeList(server[sk]);
            if (incoming && JSON.stringify(incoming) !== JSON.stringify(EDITOR_STORE[storeKey])) {
                EDITOR_STORE[storeKey] = incoming;
                changed = true;
            }
        });
        if (server.synced_at && server.synced_at !== EDITOR_STORE.synced_at) {
            EDITOR_STORE.synced_at = server.synced_at;
            if (!changed) {
                /* само состояние не поменялось, но время сервера обновляем,
                   чтобы кэш корректно сравнивался со снапшотом */
                editorPersistSilent();
            }
        }
        if (!changed) return;
        editorPersistSilent();   /* кэш у посетителя: следующий визит без мигания */
        editorApplySaved();
        ['promotions', 'services', 'portfolio', 'links'].forEach(k => editorRerenderSection(k));
        if (editorModeActive()) editorToast('Правки загружены с сервера.');
    } catch (e) {
        console.warn('[editor] editorApplyServerData:', e);
    }
}

function editorReadPathValue(path) {
    const parts = String(path || '').split('.');
    if (parts[0] !== 'svc' || parts.length < 2) return null;
    const svc = getServices().find(s => s.id === parts[1]);
    if (!svc) return null;
    let node = svc;
    for (let i = 2; i < parts.length; i++) {
        if (node == null) return null;
        node = node[parts[i]];
    }
    return (node === null || node === undefined) ? null : node;
}

function editorPathLabel(path) {
    const parts = String(path || '').split('.');
    if (parts[0] !== 'svc' || parts.length < 2) return path;
    const svc = getServices().find(s => s.id === parts[1]);
    const base = svc ? svc.title : parts[1];
    const rest = parts.slice(2);
    if (!rest.length) return base;
    if (rest[0] === 'title') return base + ' · название';
    if (rest[0] === 'shortDesc') return base + ' · описание';
    if (rest[0] === 'masters') {
        const k = parseInt(rest[1], 10);
        const field = rest[2] === 'name' ? 'имя' : (rest[2] === 'desc' ? 'описание' : (rest[2] || ''));
        return base + ' · мастер ' + (Number.isFinite(k) ? k + 1 : '') + ' · ' + field;
    }
    if (rest[0] === 'price') {
        const bi = parseInt(rest[1], 10);
        if (rest[2] === 'section') return base + ' · раздел ' + (Number.isFinite(bi) ? bi + 1 : '') + ' прайса';
        if (rest[2] === 'items') {
            const ii = parseInt(rest[3], 10);
            const field = rest[4] === 'name' ? 'название' : (rest[4] === 'price' ? 'цена' : (rest[4] === 'meta' ? 'примечание' : (rest[4] || '')));
            return base + ' · ' + (Number.isFinite(bi) ? bi + 1 : '') + '.' + (Number.isFinite(ii) ? ii + 1 : '') + ' · ' + field;
        }
    }
    return path;
}

function editorUpdateTelHrefs() {
    document.querySelectorAll('[data-editable-id^="site_phone_"], [data-editable-id^="contacts_phone"]').forEach(el => {
        const a = el.closest('a[href^="tel:"]') || (el.tagName === 'A' && el.href.indexOf('tel:') === 0 ? el : null);
        if (!a) return;
        const digits = (el.textContent || '').replace(/[^0-9]/g, '');
        if (digits) a.href = 'tel:+' + digits;
    });
}

/* --------------------------------------------------------------------------
   Модальные окна редактора
   -------------------------------------------------------------------------- */

let currentEditorModal = null;

function editorEscHandler(e) {
    if (e.key === 'Escape') closeEditorModal();
}

function editorOpenModal(title, body, onMount) {
    closeEditorModal();
    const root = document.createElement('div');
    root.className = 'ed-modal';
    root.innerHTML = `
        <div class="ed-modal__overlay"></div>
        <div class="ed-modal__box">
            <div class="ed-modal__head">
                <div class="ed-modal__title">${title}</div>
                <button type="button" class="ed-modal__close" data-ed-close aria-label="Закрыть">&times;</button>
            </div>
            <div class="ed-modal__body">${body}</div>
        </div>`;
    document.body.appendChild(root);
    currentEditorModal = root;
    root.querySelector('[data-ed-close]').addEventListener('click', closeEditorModal);
    root.querySelector('.ed-modal__overlay').addEventListener('click', closeEditorModal);
    document.addEventListener('keydown', editorEscHandler);
    if (onMount) onMount(root);
    return root;
}

function closeEditorModal() {
    if (currentEditorModal) {
        currentEditorModal.remove();
        currentEditorModal = null;
    }
    document.removeEventListener('keydown', editorEscHandler);
}

/* --- Сканирование редактируемых элементов ------------------------------ */

function editorScan() {
    EDITOR_ELEMENTS = { texts: [], images: [] };
    document.querySelectorAll('[data-editable="text"]').forEach((el, i) => {
        const id = el.dataset.editableId || `text_${i}`;
        el.dataset.editableId = id;
        if (el.dataset.editorTextOrig == null) el.dataset.editorTextOrig = el.textContent;
        if (el.dataset.editorTextOrigHtml == null) el.dataset.editorTextOrigHtml = el.innerHTML;
        EDITOR_ELEMENTS.texts.push({ id, el });
    });
    document.querySelectorAll('[data-editable="image"]').forEach((el, i) => {
        const id = el.dataset.editableId || `image_${i}`;
        el.dataset.editableId = id;
        if (el.dataset.editorOrig == null) el.dataset.editorOrig = el.getAttribute('src') || '';
        EDITOR_ELEMENTS.images.push({ id, el });
    });
    document.querySelectorAll('[data-editor-img]').forEach(el => {
        const id = el.dataset.editorImg;
        if (!id) return;
        if (el.dataset.editorOrig == null) el.dataset.editorOrig = el.getAttribute('src') || '';
        if (!EDITOR_ELEMENTS.images.some(t => t.id === id)) {
            EDITOR_ELEMENTS.images.push({ id, el, dynamic: true });
        }
    });
}

function editorFindTextEl(id) {
    return EDITOR_ELEMENTS.texts.find(t => t.id === id) || null;
}

function editorFindImageEl(id) {
    return EDITOR_ELEMENTS.images.find(t => t.id === id) || null;
}

/* --- Редактирование текста (Функция А) ---------------------------------- */

function openTextEditor(entry) {
    const el = entry.el;
    const id = entry.id;
    const current = el.textContent;

    const root = editorOpenModal(`Редактировать текст <span class="ed-modal__id">${id}</span>`, `
        <div class="ed-field">
            <label class="ed-field__label">Текст</label>
            <textarea class="ed-input ed-textarea" rows="6">${editorEscapeHtml(current)}</textarea>
        </div>
        <div class="ed-actions">
            <button type="button" class="ed-btn ed-btn--primary" data-ed-save>Сохранить</button>
            ${EDITOR_STORE.texts[id] != null ? '<button type="button" class="ed-btn" data-ed-reset>Сбросить к оригиналу</button>' : ''}
            <button type="button" class="ed-btn ed-btn--ghost" data-ed-cancel>Отмена</button>
        </div>`, rootEl => {
        const ta = rootEl.querySelector('textarea');
        ta.focus();
        ta.setSelectionRange(ta.value.length, ta.value.length);

        rootEl.querySelector('[data-ed-save]').addEventListener('click', () => {
            const value = ta.value.trim();
            if (value === '') {
                delete EDITOR_STORE.texts[id];
            } else {
                EDITOR_STORE.texts[id] = value;
            }
            el.textContent = value === '' ? (el.dataset.editorTextOrig || '') : value;
            editorSaveJSON('texts', EDITOR_STORE.texts);
            editorUpdateTelHrefs();
            closeEditorModal();
            editorToast('Текст сохранён.');
        });

        rootEl.querySelector('[data-ed-reset]').addEventListener('click', () => {
            delete EDITOR_STORE.texts[id];
            el.innerHTML = el.dataset.editorTextOrigHtml || editorEscapeHtml(el.dataset.editorTextOrig || '');
            editorSaveJSON('texts', EDITOR_STORE.texts);
            editorUpdateTelHrefs();
            closeEditorModal();
            editorToast('Текст сброшен к оригиналу.');
        });

        rootEl.querySelector('[data-ed-cancel]').addEventListener('click', closeEditorModal);
    });
    void root;
}

/* --- Точечные правки структуры услуг (попап, прайс-листы) ---------------- */

function openPathTextEditor(el) {
    const path = el.dataset.edPath;
    const current = el.textContent;
    const label = editorPathLabel(path);

    const root = editorOpenModal(`Редактировать <span class="ed-modal__id">${editorEscapeHtml(label)}</span>`, `
        <div class="ed-field">
            <label class="ed-field__label">Текст</label>
            <textarea class="ed-input ed-textarea" rows="5">${editorEscapeHtml(current)}</textarea>
        </div>
        <div class="ed-actions">
            <button type="button" class="ed-btn ed-btn--primary" data-ed-save>Сохранить</button>
            ${EDITOR_STORE.paths[path] != null ? '<button type="button" class="ed-btn" data-ed-reset>Сбросить к оригиналу</button>' : ''}
            <button type="button" class="ed-btn ed-btn--ghost" data-ed-cancel>Отмена</button>
        </div>`, rootEl => {
        const ta = rootEl.querySelector('textarea');
        ta.focus();
        ta.setSelectionRange(ta.value.length, ta.value.length);

        rootEl.querySelector('[data-ed-save]').addEventListener('click', () => {
            const value = ta.value.trim();
            if (value === '') {
                delete EDITOR_STORE.paths[path];
            } else {
                EDITOR_STORE.paths[path] = value;
            }
            editorSaveJSON('paths', EDITOR_STORE.paths);
            const next = editorReadPathValue(path);
            el.textContent = (next != null && String(next) !== '') ? String(next) : (value === '' ? current : value);
            closeEditorModal();
            editorToast('Сохранено.');
        });

        rootEl.querySelector('[data-ed-reset]').addEventListener('click', () => {
            delete EDITOR_STORE.paths[path];
            editorSaveJSON('paths', EDITOR_STORE.paths);
            const value = editorReadPathValue(path);
            if (value != null) el.textContent = String(value);
            closeEditorModal();
            editorToast('Сброшено к оригиналу.');
        });

        rootEl.querySelector('[data-ed-cancel]').addEventListener('click', closeEditorModal);
    });
    void root;
}

/* --- Замена изображений (Функция Б) ------------------------------------- */

function openImageEditor(entry) {
    const el = entry.el || null;
    const id = entry.id;
    const current = el ? el.src : (entry.src || '');

    const root = editorOpenModal(`Заменить изображение <span class="ed-modal__id">${id}</span>`, `
        <div class="ed-imgpreview"><img src="${current}" alt="Текущее изображение"></div>
        <div class="ed-field">
            <span class="ed-field__label">Загрузить файл (до ${Math.round(EDITOR_CONFIG.maxImageSize / 1024 / 1024)} МБ)</span>
            <input type="file" class="ed-file" accept="image/*" data-ed-file>
        </div>
        <div class="ed-field">
            <span class="ed-field__label">Или вставьте URL изображения</span>
            <div class="ed-urlrow">
                <input type="url" class="ed-input" data-ed-url placeholder="https://...">
                <button type="button" class="ed-btn" data-ed-url-apply>Применить</button>
            </div>
        </div>
        <div class="ed-actions">
            ${EDITOR_STORE.images[id] ? '<button type="button" class="ed-btn" data-ed-reset>Сбросить к оригиналу</button>' : ''}
            <button type="button" class="ed-btn ed-btn--ghost" data-ed-cancel>Отмена</button>
        </div>`, rootEl => {
        const fileInput = rootEl.querySelector('[data-ed-file]');
        const urlInput = rootEl.querySelector('[data-ed-url]');

        const apply = src => {
            if (!src) return;
            if (el) el.src = src;
            EDITOR_STORE.images[id] = src;
            editorApplyImageToDom(id, src);
            editorSaveJSON('images', EDITOR_STORE.images);
            const section = editorSectionForImageId(id);
            if (section) editorRerenderSection(section);
            editorToast('Изображение обновлено.');
        };

        fileInput.addEventListener('change', () => {
            const file = fileInput.files && fileInput.files[0];
            if (!file) return;
            if (!file.type || !file.type.startsWith('image/')) {
                editorToast('Можно загружать только изображения.', true);
                return;
            }
            if (file.size > EDITOR_CONFIG.maxImageSize) {
                editorToast(`Файл больше ${Math.round(EDITOR_CONFIG.maxImageSize / 1024 / 1024)} МБ — выберите меньший.`, true);
                return;
            }
            editorToast('Загружаю картинку на хост…');
            editorUploadImageFile(file, (src, uploaded) => {
                if (!src) {
                    editorToast('Не удалось прочитать изображение.', true);
                    return;
                }
                if (!uploaded) editorToast('Сервер недоступен — картинка сохранена локально.', true);
                apply(src);
            });
        });

        rootEl.querySelector('[data-ed-url-apply]').addEventListener('click', () => {
            const value = urlInput.value.trim();
            if (!value) {
                editorToast('Введите URL изображения.', true);
                return;
            }
            apply(value);
        });

        rootEl.querySelector('[data-ed-reset]').addEventListener('click', () => {
            delete EDITOR_STORE.images[id];
            editorSaveJSON('images', EDITOR_STORE.images);
            closeEditorModal();
            if (el) {
                const orig = el.dataset.editorOrig || '';
                el.src = orig;
                editorApplyImageToDom(id, orig);
            }
            const section = editorSectionForImageId(id);
            if (section) editorRerenderSection(section);
            editorToast('Изображение сброшено к оригиналу.');
        });

        rootEl.querySelector('[data-ed-cancel]').addEventListener('click', closeEditorModal);
    });
    void root;
}

function editorApplyImageToDom(id, src) {
    document.querySelectorAll('[data-editable="image"], [data-editor-img]').forEach(el => {
        if ((el.dataset.editableId === id) || (el.dataset.editorImg === id)) el.src = src;
    });
}

function editorSectionForImageId(id) {
    if (id && id.indexOf('svc_') === 0) return 'services';
    if (id && id.indexOf('gallery_') === 0) return 'portfolio';
    return null;
}

function editorImageLabel(id) {
    const staticMap = {
        hero_img_back: 'Главный экран · задний план',
        hero_img_mid: 'Главный экран · центральное фото',
        hero_img_front: 'Главный экран · передний план',
        about_image: 'О нас · фото'
    };
    if (staticMap[id]) return staticMap[id];
    if (id.indexOf('svc_') === 0) {
        const list = getServices();
        let match = null;
        let isMaster = id.indexOf('_master_') !== -1;
        list.some(s => {
            if (Array.isArray(s.images)) {
                for (let i = 0; i < s.images.length; i++) {
                    if (svcImageKey(s.id, i) === id) { match = { s, i }; return true; }
                }
            }
            if (Array.isArray(s.masters)) {
                for (let k = 0; k < s.masters.length; k++) {
                    if (svcMasterKey(s.id, k) === id) { match = { s, k }; return true; }
                }
            }
            return false;
        });
        if (match) {
            if (isMaster) {
                const m = (match.s.masters || [])[match.k];
                return match.s.title + ' · мастер' + (m && m.name ? ' (' + m.name.split(' ')[0] + ')' : '');
            }
            return match.s.title + ' · фото ' + (match.i + 1);
        }
    }
    if (id.indexOf('gallery_') === 0) return 'Портфолио · фото';
    return id;
}

function editorImageRegistry() {
    const items = [];
    const seen = {};
    const push = (id, src, el) => {
        if (!id || seen[id]) return;
        seen[id] = true;
        items.push({ id, src: src || '', el, label: editorImageLabel(id) });
    };
    document.querySelectorAll('[data-editable="image"], [data-editor-img]').forEach(el => {
        push(el.dataset.editableId || el.dataset.editorImg, el.getAttribute('src') || '', el);
    });
    getServices().forEach(s => {
        if (Array.isArray(s.images)) s.images.forEach((src, i) => push(svcImageKey(s.id, i), src));
        (Array.isArray(s.masters) ? s.masters : []).forEach((m, k) => {
            if (m.photo) push(svcMasterKey(s.id, k), m.photo);
        });
    });
    getPortfolioItems().forEach((it, i) => push(galleryImageKey(it.id), it.image || ''));
    return items;
}

/* --- Загрузка изображений с компьютера в формах менеджеров --------------- */

/* Разметка блока «файл + предпросмотр». initialSrc — текущая картинка (если есть). */
function editorUploadFieldHtml(initialSrc) {
    const mb = Math.round((EDITOR_CONFIG.maxImageSize || 3 * 1024 * 1024) / 1024 / 1024);
    return `
        <div class="ed-field">
            <span class="ed-field__label">Загрузить с компьютера (до ${mb} МБ)</span>
            <input type="file" class="ed-file" accept="image/*" data-ed-upload>
            <div class="ed-urlrow" data-ed-uploaded-row hidden>
                <span class="ed-note">Файл загружен — не забудьте сохранить.</span>
                <button type="button" class="ed-mini ed-mini--danger" data-ed-upload-clear>Убрать</button>
            </div>
        </div>
        <div class="ed-imgpreview" data-ed-preview ${initialSrc ? '' : 'hidden'}>
            <img src="${initialSrc ? editorEscapeHtml(initialSrc) : ''}" alt="Предпросмотр">
        </div>`;
}

/* Логика блока: выбор файла → сжатие → предпросмотр; ручной ввод URL
   отменяет загруженный файл («последнее действие выигрывает»).
   Возвращает { getValue(), reset() }. */
function editorSetupUploadField(rootEl, opts) {
    opts = opts || {};
    const fileInput = rootEl.querySelector('[data-ed-upload]');
    if (!fileInput) return null;
    const urlInput = rootEl.querySelector(opts.urlSelector || '[name="image"]');
    const previewBox = rootEl.querySelector('[data-ed-preview]');
    const previewImg = previewBox ? previewBox.querySelector('img') : null;
    const doneRow = rootEl.querySelector('[data-ed-uploaded-row]');
    let pending = null;

    const showPreview = src => {
        if (!previewBox || !previewImg) return;
        if (src) {
            previewImg.src = src;
            previewBox.hidden = false;
        } else {
            previewImg.removeAttribute('src');
            previewBox.hidden = true;
        }
    };
    const setDoneRow = on => { if (doneRow) doneRow.hidden = !on; };

    fileInput.addEventListener('change', () => {
        const file = fileInput.files && fileInput.files[0];
        if (!file) return;
        if (!file.type || !file.type.startsWith('image/')) {
            editorToast('Можно загружать только изображения.', true);
            fileInput.value = '';
            return;
        }
        if (file.size > EDITOR_CONFIG.maxImageSize) {
            editorToast(`Файл больше ${Math.round(EDITOR_CONFIG.maxImageSize / 1024 / 1024)} МБ — выберите меньший.`, true);
            fileInput.value = '';
            return;
        }
        editorToast('Загружаю картинку на хост…');
        editorUploadImageFile(file, (src, uploaded) => {
            if (!src) {
                editorToast('Не удалось прочитать изображение.', true);
                return;
            }
            if (!uploaded) editorToast('Сервер недоступен — картинка сохранена локально.', true);
            pending = src;
            if (urlInput) urlInput.value = '';
            showPreview(src);
            setDoneRow(true);
            editorToast('Изображение готово — нажмите «Сохранить».');
        });
    });

    if (urlInput) urlInput.addEventListener('input', () => {
        if (!pending) return;
        pending = null;
        setDoneRow(false);
        fileInput.value = '';
    });

    const clearBtn = rootEl.querySelector('[data-ed-upload-clear]');
    if (clearBtn) clearBtn.addEventListener('click', () => {
        pending = null;
        fileInput.value = '';
        setDoneRow(false);
        showPreview(opts.initialSrc || '');
        if (!opts.initialSrc && urlInput) urlInput.value = '';
    });

    return {
        getValue: () => pending || '',
        reset: () => { pending = null; fileInput.value = ''; setDoneRow(false); }
    };
}

/* Сжатая картинка → файл на хосте (img/u/…). Возвращает URL; при недоступности
   сервера (file://, оффлайн) — фолбэк на base64-датаURL как раньше.
   cb(src, uploaded) — uploaded=true, если картинка ушла файлом на хост. */
function editorUploadImageFile(file, cb) {
    editorDownscaleImage(file, dataUrl => {
        if (!dataUrl) { cb(null, false); return; }
        const url = editorSyncUrl();
        if (!url || location.protocol === 'file:') { cb(dataUrl, false); return; }
        fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'upload_image',
                key: (EDITOR_CONFIG.serverSync && EDITOR_CONFIG.serverSync.key) || '',
                image_base64: dataUrl
            })
        }).then(r => r.json()).then(j => {
            if (j && j.ok && j.url) cb(j.url, true);
            else cb(dataUrl, false);
        }).catch(() => cb(dataUrl, false));
    });
}

function editorDownscaleImage(file, callback) {
    const reader = new FileReader();
    reader.onload = () => {
        const img = new Image();
        img.onload = () => {
            let { width, height } = img;
            const edge = EDITOR_CONFIG.maxImageEdge;
            const longest = Math.max(width, height);
            const scale = longest > edge ? edge / longest : 1;
            if (scale < 1) {
                width = Math.round(width * scale);
                height = Math.round(height * scale);
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            /* WebP легче JPEG на ~30%; если браузер умеет кодировать — берём его */
            let type = 'image/jpeg';
            try {
                if (canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0) {
                    type = 'image/webp';
                }
            } catch (e) { /* остаёмся на jpeg */ }
            callback(canvas.toDataURL(type, 0.82));
        };
        img.onerror = () => callback(null);
        img.src = reader.result;
    };
    reader.onerror = () => callback(null);
    reader.readAsDataURL(file);
}

/* --- Панель управления (ТЗ раздел 5.1) ---------------------------------- */

function editorBuildPanel() {
    const panel = document.createElement('div');
    panel.className = 'ed-panel';
    panel.id = 'editor-panel';
    panel.innerHTML = `
        <div class="ed-panel__brand">✏️ Режим редактирования</div>
        <div class="ed-panel__quick">
            <button type="button" data-ed-show="text" title="Все тексты">💬 Тексты</button>
            <button type="button" data-ed-show="image" title="Все изображения">🖼️ Изображения</button>
            <button type="button" data-ed-section="promotions" title="Акции">🎯 Акции</button>
            <button type="button" data-ed-section="services" title="Услуги">🔧 Услуги</button>
            <button type="button" data-ed-section="portfolio" title="Портфолио">📁 Портфолио</button>
            <button type="button" data-ed-section="links" title="Ссылки и соцсети">🔗 Ссылки</button>
        </div>
        <div class="ed-panel__tools">
            <button type="button" data-ed-save title="Сохранить">💾 Сохранить</button>
            <button type="button" data-ed-history title="История версий на сервере (снапшоты правок)">🕘 История</button>
            <button type="button" data-ed-cleanup title="Удалить неиспользуемые картинки (img/u)">🧹 Чистка</button>
            <button type="button" data-ed-export title="Скачать JSON">📤 Экспорт</button>
            <button type="button" data-ed-import title="Загрузить JSON">📥 Импорт</button>
            <button type="button" data-ed-reset title="Сбросить всё">🗑️ Сбросить</button>
            <button type="button" class="ed-btn--exit" data-ed-exit title="Выйти из режима">Выйти</button>
        </div>
        <input type="file" accept="application/json" class="ed-hidden-file" data-ed-import-file hidden>`;
    document.body.appendChild(panel);

    const importFile = panel.querySelector('[data-ed-import-file]');

    panel.querySelector('[data-ed-show="text"]').addEventListener('click', () => openTextListModal());
    panel.querySelector('[data-ed-show="image"]').addEventListener('click', () => openImageListModal());
    panel.querySelectorAll('[data-ed-section]').forEach(btn => {
        btn.addEventListener('click', () => {
            const kind = btn.dataset.edSection;
            const opener = window.EDITOR_SECTIONS && window.EDITOR_SECTIONS[kind];
            if (opener) opener.open();
            else editorToast('Раздел недоступен на этой странице.', true);
        });
    });
    panel.querySelector('[data-ed-save]').addEventListener('click', () => {
        editorSaveJSON('texts', EDITOR_STORE.texts);
        editorSaveJSON('images', EDITOR_STORE.images);
        if (EDITOR_STORE.paths && Object.keys(EDITOR_STORE.paths).length) editorSaveJSON('paths', EDITOR_STORE.paths);
        if (EDITOR_STORE.promos) editorSaveJSON('promos', EDITOR_STORE.promos);
        if (EDITOR_STORE.services) editorSaveJSON('services', EDITOR_STORE.services);
        if (EDITOR_STORE.portfolio) editorSaveJSON('portfolio', EDITOR_STORE.portfolio);
        if (EDITOR_STORE.links && Object.keys(EDITOR_STORE.links).length) editorSaveJSON('links', EDITOR_STORE.links);
        if (editorSyncUrl()) {
            clearTimeout(editorSyncTimer);
            editorSyncPush().then(ok => {
                editorToast(ok ? 'Всё сохранено и опубликовано на сервере ✓' : 'Сохранено локально (сервер недоступен).');
            });
        } else {
            editorToast('Всё сохранено ✓');
        }
    });
    panel.querySelector('[data-ed-history]').addEventListener('click', openHistoryModal);
    panel.querySelector('[data-ed-cleanup]').addEventListener('click', openCleanupModal);
    panel.querySelector('[data-ed-export]').addEventListener('click', editorExportData);
    panel.querySelector('[data-ed-import]').addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', () => {
        const file = importFile.files && importFile.files[0];
        if (file) editorImportData(file);
        importFile.value = '';
    });
    panel.querySelector('[data-ed-reset]').addEventListener('click', editorResetAll);
    panel.querySelector('[data-ed-exit]').addEventListener('click', editorExit);
}

function editorExit() {
    try {
        const url = new URL(location.href);
        url.searchParams.delete('edit');
        /* голый ключ в имени параметра тоже убираем */
        for (const k of Array.from(url.searchParams.keys())) {
            if (k.length >= 12 && !url.searchParams.get(k)) url.searchParams.delete(k);
        }
        location.href = url.toString();
    } catch (e) {
        location.href = location.pathname + location.hash;
    }
}

function editorShowHint(el) {
    if (el.getAttribute('data-ed-hint') === '1') return;
    el.setAttribute('data-ed-hint', '1');
}

function openTextListModal() {
    const rows = EDITOR_ELEMENTS.texts.map(t => `
        <button type="button" class="ed-item" data-ed-id="${t.id}" data-ed-kind="text">
            <span class="ed-item__id">${t.id}</span>
            <span class="ed-item__preview">${editorEscapeHtml((t.el.textContent || '').slice(0, 80))}</span>
        </button>`).join('') || '<div class="ed-empty">На этой странице нет текстовых элементов</div>';

    const root = editorOpenModal('Все тексты', `
        <div class="ed-list">${rows}</div>
        <div class="ed-note">Нажмите на элемент — откроется редактирование. Или кликните прямо по тексту на странице.</div>`, rootEl => {
        rootEl.querySelectorAll('[data-ed-id]').forEach(btn => {
            btn.addEventListener('click', () => {
                const entry = editorFindTextEl(btn.dataset.edId);
                if (entry) openTextEditor(entry);
            });
        });
    });
    void root;
}

function openImageListModal() {
    editorScan();
    const all = editorImageRegistry();
    const rows = all.map(t => `
        <button type="button" class="ed-item" data-ed-id="${t.id}" data-ed-kind="image">
            <img class="ed-item__thumb" src="${editorEscapeHtml(t.src)}" alt="">
            <span class="ed-item__id">${t.id}</span>
            <span class="ed-item__sub">${editorEscapeHtml(t.label)}</span>
        </button>`).join('') || '<div class="ed-empty">На этой странице нет изображений</div>';

    const root = editorOpenModal(`Все изображения <span class="ed-modal__count">${all.length}</span>`, `
        <div class="ed-list">${rows}</div>
        <div class="ed-note">Нажмите на элемент — откроется замена. Или кликните прямо по изображению на странице (включая попапы и галерею).</div>`, rootEl => {
        rootEl.querySelectorAll('[data-ed-id]').forEach(btn => {
            btn.addEventListener('click', () => {
                const entry = all.find(t => t.id === btn.dataset.edId);
                if (entry) openImageEditor(entry);
            });
        });
    });
    void root;
}

function openHistoryModal() {
    if (!editorSyncUrl()) {
        editorToast('История версий доступна только на сервере (content-sync.php).', true);
        return;
    }
    editorToast('Загружаю историю версий…');
    editorSyncVersions().then(list => {
        if (!list || !Array.isArray(list.versions)) {
            editorToast('Не удалось получить историю версий.', true);
            return;
        }
        const versions = list.versions;
        const max = Number(list.max) || 0;
        const rows = versions.map(v => `
            <div class="ed-item ed-item--row">
                <span class="ed-item__id">${editorEscapeHtml(v.time)}</span>
                <span class="ed-item__preview">${editorEscapeHtml(v.id)}</span>
                <button type="button" class="ed-btn ed-btn--restore" data-ed-restore="${editorEscapeHtml(v.id)}" data-ed-time="${editorEscapeHtml(v.time)}">↩️ Откатить</button>
            </div>`).join('') || '<div class="ed-empty">Версий пока нет — они появятся при первом сохранении правок.</div>';

        const root = editorOpenModal(`История версий <span class="ed-modal__count">${versions.length}</span>`, `
            <div class="ed-list">${rows}</div>
            <div class="ed-note">Снапшот создаётся при каждом сохранении на сервере${max ? ` (хранятся последние ${max})` : ''}. Перед откатом текущее состояние тоже сохранится как версия — откат всегда можно отменить. Скачивайте «📤 Экспорт» для полного бэкапа на компьютер.</div>`, rootEl => {
            rootEl.querySelectorAll('[data-ed-restore]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.dataset.edRestore;
                    const time = btn.dataset.edTime;
                    if (!confirm('Откатить сайт к версии от ' + time + '?\nТекущее состояние сохранится как отдельная версия.')) return;
                    btn.disabled = true;
                    editorSyncRestore(id).then(ok => {
                        if (!ok) {
                            editorToast('Не удалось восстановить версию.', true);
                            btn.disabled = false;
                            return;
                        }
                        editorSyncPull().then(server => {
                            if (server) editorApplyServerData(server);
                            closeEditorModal();
                            editorToast('Версия от ' + time + ' восстановлена ✓');
                        });
                    });
                });
            });
        });
        void root;
    });
}

/* --- 🧹 Чистка неиспользуемых картинок (img/u) ---------------------------- */

function openCleanupModal() {
    if (!editorSyncUrl()) {
        editorToast('Чистка доступна только на сервере (content-sync.php).', true);
        return;
    }
    editorToast('Собираю список картинок…');
    editorSyncImagesInventory().then(inv => {
        if (!inv || !Array.isArray(inv.files)) {
            editorToast('Не удалось получить список картинок.', true);
            return;
        }
        const files = inv.files;
        const unused = files.filter(f => !f.current && !f.history);
        const fmt = b => b > 1024 * 1024 ? (b / 1024 / 1024).toFixed(1) + ' МБ' : Math.max(1, Math.round(b / 1024)) + ' КБ';
        const rows = files.map(f => {
            const status = f.current ? '<span class="ed-clean__tag ed-clean__tag--cur">текущая</span>'
                : f.history ? '<span class="ed-clean__tag">в истории</span>'
                : '<span class="ed-clean__tag ed-clean__tag--free">не используется</span>';
            return `
            <div class="ed-item ed-item--row">
                <img class="ed-item__thumb" src="${editorEscapeHtml(f.url)}" alt="" loading="lazy">
                <span class="ed-item__id">${editorEscapeHtml(f.url.replace('img/u/', ''))}</span>
                <span class="ed-item__sub">${fmt(Number(f.size) || 0)} · ${status}</span>
            </div>`;
        }).join('') || '<div class="ed-empty">Загруженных картинок пока нет.</div>';

        const total = Number(inv.bytes_total) || 0;
        const canClean = unused.length > 0;

        const root = editorOpenModal(`Чистка картинок <span class="ed-modal__count">${files.length}</span>`, `
            <div class="ed-list">${rows}</div>
            <div class="ed-note">Всего: ${files.length} шт., ${fmt(total)}. Удалить можно только картинки, на которые не ссылается ни текущий сайт, ни история версий — откатам они не понадобятся. «Не используется»: ${unused.length} шт.</div>
            <div class="ed-actions">
                <button type="button" class="ed-btn ed-btn--primary" data-ed-cleanup-run ${canClean ? '' : 'disabled'}>Удалить неиспользуемые (${unused.length})</button>
                <button type="button" class="ed-btn ed-btn--ghost" data-ed-cancel>Закрыть</button>
            </div>`, rootEl => {
            rootEl.querySelector('[data-ed-cancel]').addEventListener('click', closeEditorModal);
            const runBtn = rootEl.querySelector('[data-ed-cleanup-run]');
            runBtn.addEventListener('click', () => {
                if (!confirm(`Удалить ${unused.length} неиспользуемых картинок? Файлы, нужные текущему сайту или любой версии истории, останутся на месте.`)) return;
                runBtn.disabled = true;
                editorSyncCleanupUnused().then(res => {
                    if (!res || !res.ok) {
                        editorToast('Не удалось выполнить чистку.', true);
                        runBtn.disabled = false;
                        return;
                    }
                    const n = (res.deleted || []).length;
                    const mb = ((Number(res.freed_bytes) || 0) / 1024 / 1024).toFixed(1);
                    closeEditorModal();
                    editorToast(n ? `Удалено картинок: ${n}, освобождено ${mb} МБ ✓` : 'Неиспользуемых картинок нет.');
                });
            });
        });
        void root;
    });
}

/* --- Активация ----------------------------------------------------------- */

function editorApplyPanelOffset() {
    const panel = document.getElementById('editor-panel');
    if (!panel) return;
    const h = Math.ceil(panel.getBoundingClientRect().height);
    document.body.style.setProperty('--ed-panel-h', h + 'px');
}

function activateEditor() {
    EDITOR_ACTIVE = true;
    document.body.classList.add('editor-active');
    editorBuildPanel();
    editorApplyPanelOffset();
    window.addEventListener('resize', editorApplyPanelOffset);
    window.addEventListener('load', editorApplyPanelOffset);

    document.addEventListener('click', e => {
        if (!EDITOR_ACTIVE) return;
        const pathEl = e.target.closest('[data-ed-path]');
        if (pathEl) {
            e.preventDefault();
            e.stopPropagation();
            openPathTextEditor(pathEl);
            return;
        }
        const textEl = e.target.closest('[data-editable="text"]');
        if (textEl) {
            e.preventDefault();
            e.stopPropagation();
            const id = textEl.dataset.editableId;
            const entry = editorFindTextEl(id);
            if (entry) openTextEditor(entry);
            return;
        }
        const imgEl = e.target.closest('[data-editable="image"]');
        if (imgEl) {
            e.preventDefault();
            e.stopPropagation();
            const id = imgEl.dataset.editableId;
            const entry = editorFindImageEl(id);
            if (entry) openImageEditor(entry);
            return;
        }
        const dynImg = e.target.closest('[data-editor-img]');
        if (dynImg) {
            e.preventDefault();
            e.stopPropagation();
            openImageEditor({ id: dynImg.dataset.editorImg, el: dynImg });
            return;
        }
    }, true);

    editorToast('Режим редактирования включён. Наведите на текст или картинку и нажмите.');
}

/* --- Утилиты ------------------------------------------------------------- */

function editorFormValues(root) {
    const data = {};
    root.querySelectorAll('[name]').forEach(el => {
        if (el.type === 'checkbox') data[el.name] = el.checked;
        else data[el.name] = el.value.trim();
    });
    return data;
}

function editorGenerateId(prefix) {
    return (prefix || 'item') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function editorEscapeHtml(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function editorField(label, value, opts) {
    const name = opts && opts.name ? ` name="${opts.name}"` : '';
    const type = (opts && opts.type) || 'text';
    const placeholder = opts && opts.placeholder ? ` placeholder="${opts.placeholder}"` : '';
    const rows = opts && opts.rows ? ` rows="${opts.rows}"` : '';
    let control = '';
    if (type === 'textarea') {
        control = `<textarea class="ed-input ed-textarea"${rows}${name}>${editorEscapeHtml(value)}</textarea>`;
    } else if (type === 'date') {
        control = `<input type="date" class="ed-input"${name} value="${editorEscapeHtml(value)}">`;
    } else if (type === 'checkbox') {
        control = `<label class="ed-check"><input type="checkbox"${value ? ' checked' : ''}${name}> <span>${label}</span></label>`;
        return control;
    } else {
        control = `<input type="text" class="ed-input"${name}${placeholder} value="${editorEscapeHtml(value)}">`;
    }
    return `
        <div class="ed-field">
            <label class="ed-field__label">${label}</label>
            ${control}
        </div>`;
}

/* --- Пере-рендер секций после CRUD -------------------------------------- */

function editorRerenderSection(kind) {
    try {
        if (kind === 'promotions') {
            if (document.getElementById('promos-list')) renderPromos();
        } else if (kind === 'services') {
            if (document.getElementById('services-preview')) renderServicePreviews();
            if (document.getElementById('services-list')) renderServicesPage();
            editorRefreshServicePicker();
        } else if (kind === 'portfolio') {
            if (document.getElementById('gallery')) renderGallery();
        } else if (kind === 'links') {
            if (document.getElementById('footer')) renderFooter();
            renderContacts();
        }
    } catch (e) {
        console.warn('[editor] пере-рендер секции', kind, e);
    }
}

function editorRefreshServicePicker() {
    const wrap = document.querySelector('#service-picker-popup .msel__scroll--picker');
    if (!wrap) return;
    const serviceItems = getServices().map(s => `
        <label class="msel__option">
            <input type="checkbox" value="${editorEscapeHtml(s.title)}">
            <span>${editorEscapeHtml(s.title)}</span>
        </label>`).join('');
    wrap.innerHTML = serviceItems;
    const titles = getServices().map(s => s.title);
    leadFormState.services = leadFormState.services.filter(t => titles.includes(t));
    renderServiceBadges();
}

/* --- Инициализация ------------------------------------------------------- */

editorLoadStore();
window.MiEditorData = EDITOR_STORE;

/* Раннее применение правок к статическим элементам: скрипты стоят в конце
   body, элементы выше уже распарсены, а первой отрисовки ещё не было —
   картинки и тексты заменяются ДО показа, без «мигания». */
try { editorApplySaved(); } catch (e) { /* не критично */ }

document.addEventListener('DOMContentLoaded', () => {
    editorApplySaved();

    /* Авторизация редактора: ключ проверяет сервер */
    const candidate = editorCandidateFromUrl();
    if (candidate !== null) {
        if (editorSyncUrl()) {
            editorTryAuth(candidate);
        } else {
            editorToast('Админка работает только на хостинге (нужен content-sync.php).', true);
        }
    }

    editorSyncPull().then(server => {
        if (server) editorApplyServerData(server);
    });
});
