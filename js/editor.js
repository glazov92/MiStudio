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
    EDITOR_STORE.promos = editorLoadJSON('promos', null);
    EDITOR_STORE.services = editorLoadJSON('services', null);
    EDITOR_STORE.portfolio = editorLoadJSON('portfolio', null);
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
        EDITOR_ELEMENTS.texts.push({ id, el });
    });
    document.querySelectorAll('[data-editable="image"]').forEach((el, i) => {
        const id = el.dataset.editableId || `image_${i}`;
        el.dataset.editableId = id;
        if (el.dataset.editorOrig == null) el.dataset.editorOrig = el.getAttribute('src') || '';
        EDITOR_ELEMENTS.images.push({ id, el });
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
            closeEditorModal();
            editorToast('Текст сохранён.');
        });

        rootEl.querySelector('[data-ed-reset]').addEventListener('click', () => {
            delete EDITOR_STORE.texts[id];
            el.textContent = el.dataset.editorTextOrig || '';
            editorSaveJSON('texts', EDITOR_STORE.texts);
            closeEditorModal();
            editorToast('Текст сброшен к оригиналу.');
        });

        rootEl.querySelector('[data-ed-cancel]').addEventListener('click', closeEditorModal);
    });
    void root;
}

/* --- Замена изображений (Функция Б) ------------------------------------- */

function openImageEditor(entry) {
    const el = entry.el;
    const id = entry.id;
    const current = el.src;

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
            el.src = src;
            EDITOR_STORE.images[id] = src;
            editorSaveJSON('images', EDITOR_STORE.images);
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
            el.src = el.dataset.editorOrig || '';
            editorSaveJSON('images', EDITOR_STORE.images);
            closeEditorModal();
            editorToast('Изображение сброшено к оригиналу.');
        });

        rootEl.querySelector('[data-ed-cancel]').addEventListener('click', closeEditorModal);
    });
    void root;
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
        </div>
        <div class="ed-panel__tools">
            <button type="button" data-ed-save title="Сохранить">💾 Сохранить</button>
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
        if (EDITOR_STORE.promos) editorSaveJSON('promos', EDITOR_STORE.promos);
        if (EDITOR_STORE.services) editorSaveJSON('services', EDITOR_STORE.services);
        if (EDITOR_STORE.portfolio) editorSaveJSON('portfolio', EDITOR_STORE.portfolio);
        editorToast('Всё сохранено ✓');
    });
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
    const rows = EDITOR_ELEMENTS.images.map(t => `
        <button type="button" class="ed-item" data-ed-id="${t.id}" data-ed-kind="image">
            <img class="ed-item__thumb" src="${t.el.src}" alt="">
            <span class="ed-item__id">${t.id}</span>
        </button>`).join('') || '<div class="ed-empty">На этой странице нет изображений</div>';

    const root = editorOpenModal('Все изображения', `
        <div class="ed-list">${rows}</div>
        <div class="ed-note">Нажмите на элемент — откроется замена. Или кликните прямо по изображению на странице.</div>`, rootEl => {
        rootEl.querySelectorAll('[data-ed-id]').forEach(btn => {
            btn.addEventListener('click', () => {
                const entry = editorFindImageEl(btn.dataset.edId);
                if (entry) openImageEditor(entry);
            });
        });
    });
    void root;
}

/* --- Активация ----------------------------------------------------------- */

function activateEditor() {
    EDITOR_ACTIVE = true;
    document.body.classList.add('editor-active');
    editorBuildPanel();

    document.addEventListener('click', e => {
        if (!EDITOR_ACTIVE) return;
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
});
