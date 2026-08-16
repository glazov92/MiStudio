/* ==========================================================================
   Frontend-редактор: ядро
   Активация: https://site.com/?edit=КЛЮЧ (EDITOR_CONFIG.secretKey).
   Сохранение данных — localStorage (см. js/storage.js, ТЗ раздел 4).
   ========================================================================== */

let EDITOR_ACTIVE = false;
let EDITOR_ELEMENTS = { texts: [], images: [] };

function editorModeActive() {
    try {
        return new URLSearchParams(location.search).get('edit') === EDITOR_CONFIG.secretKey;
    } catch (e) {
        return false;
    }
}

function editorLoadStore() {
    EDITOR_STORE.texts = editorLoadJSON('texts', {}) || {};
    EDITOR_STORE.images = editorLoadJSON('images', {}) || {};
    EDITOR_STORE.paths = editorLoadJSON('paths', {}) || {};
    EDITOR_STORE.promos = editorLoadJSON('promos', null);
    EDITOR_STORE.services = editorLoadJSON('services', null);
    EDITOR_STORE.portfolio = editorLoadJSON('portfolio', null);
    EDITOR_STORE.links = editorLoadJSON('links', null);
    if (!editorStorageSupported()) {
        editorToast('localStorage недоступен (режим инкогнито) — изменения не сохранятся.', true);
    }
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
        ['promotions', 'services', 'portfolio'].forEach(k => {
            if (Array.isArray(server[k]) && JSON.stringify(server[k]) !== JSON.stringify(EDITOR_STORE[k])) {
                EDITOR_STORE[k] = server[k];
                changed = true;
            }
        });
        if (!changed) return;
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
            editorDownscaleImage(file, dataUrl => {
                if (!dataUrl) {
                    editorToast('Не удалось прочитать изображение.', true);
                    return;
                }
                apply(dataUrl);
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
            callback(canvas.toDataURL('image/jpeg', 0.82));
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

document.addEventListener('DOMContentLoaded', () => {
    editorApplySaved();
    if (editorModeActive()) {
        editorScan();
        activateEditor();
    }
    editorSyncPull().then(server => {
        if (server) editorApplyServerData(server);
    });
});
