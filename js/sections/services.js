/* ==========================================================================
   Frontend-редактор: раздел «Услуги» (CRUD, сортировка, категории)
   Примечание: сложный прайс-аккордеон исходных данных не разбирается —
   правки идут по простым полям (название, описание, цена, картинка).
   ========================================================================== */

(function () {

function serviceFormHtml(s) {
    s = s || {};
    return `
        ${editorField('Название услуги', s.title || '', { name: 'title' })}
        ${editorField('Описание', s.shortDesc || '', { name: 'shortDesc', type: 'textarea', rows: 3 })}
        ${editorField('Цена (строка, например «от 1 500 ₽»)', s.priceText || '', { name: 'priceText' })}
        ${editorField('Категория (по желанию)', s.category || '', { name: 'category' })}
        ${editorField('Картинка (URL)', (s.images && s.images[0]) || s.image || '', { name: 'image', placeholder: 'img/... или https://...' })}
        ${editorField('Телефон', s.phone || '', { name: 'phone', placeholder: '+7...' })}
        ${editorField('Телефон (как показывать)', s.phoneDisplay || '', { name: 'phoneDisplay', placeholder: '+7 (___) ___-__-__' })}
        ${editorField('VK', s.vk || '', { name: 'vk' })}
        ${editorField('Telegram', s.tg || '', { name: 'tg' })}
        ${editorField('Мастера (каждый с новой строки: Имя | описание)', Array.isArray(s.masters) ? s.masters.map(m => m.name + (m.desc ? ' | ' + m.desc : '')).join('\n') : '', { name: 'masters', type: 'textarea', rows: 3 })}`;
}

function parseMasters(raw) {
    return String(raw || '').split('\n').map(line => line.trim()).filter(Boolean).map(line => {
        const sep = line.indexOf('|');
        if (sep !== -1) {
            return { name: line.slice(0, sep).trim(), desc: line.slice(sep + 1).trim(), photo: '' };
        }
        return { name: line, desc: '', photo: '' };
    });
}

function openServiceForm(existing) {
    const isNew = !existing;
    const service = existing || {};
    const root = editorOpenModal(isNew ? 'Добавить услугу' : 'Редактировать услугу', `
        <form class="ed-form" data-ed-form>
            ${serviceFormHtml(service)}
            <div class="ed-actions">
                <button type="submit" class="ed-btn ed-btn--primary">${isNew ? 'Добавить' : 'Сохранить'}</button>
                <button type="button" class="ed-btn ed-btn--ghost" data-ed-cancel>Отмена</button>
            </div>
        </form>`, rootEl => {
        const form = rootEl.querySelector('[data-ed-form]');
        form.addEventListener('submit', e => {
            e.preventDefault();
            const data = editorFormValues(rootEl);
            if (!data.title) {
                editorToast('Укажите название услуги.', true);
                return;
            }
            const images = data.image ? [data.image] : [];
            const masters = parseMasters(data.masters);
            const list = Array.isArray(EDITOR_STORE.services) ? EDITOR_STORE.services.slice() : [];

            const base = {
                title: data.title,
                shortDesc: data.shortDesc || '',
                priceText: data.priceText || '',
                category: data.category || '',
                images,
                phone: data.phone || '',
                phoneDisplay: data.phoneDisplay || data.phone || '',
                vk: data.vk || service.vk || 'https://vk.ru/club239375190',
                tg: data.tg || service.tg || 'https://t.me/+O-PmXu8y27FkMDg6',
                masters
            };

            if (isNew) {
                list.push(Object.assign({ id: editorGenerateId('service') }, base, { price: [] }));
            } else {
                const idx = list.findIndex(x => x.id === service.id);
                const merged = Object.assign({}, list[idx] || service, base);
                if (idx === -1) list.push(merged);
                else list[idx] = merged;
            }
            EDITOR_STORE.services = list;
            editorSaveJSON('services', list);
            openServicesManager();
            editorRerenderSection('services');
            editorToast('Услуги обновлены.');
        });
        rootEl.querySelector('[data-ed-cancel]').addEventListener('click', closeEditorModal);
    });
    void root;
}

function openServicesManager() {
    const list = Array.isArray(EDITOR_STORE.services) ? EDITOR_STORE.services : [];

    function renderList(rootEl) {
        const listEl = rootEl.querySelector('[data-ed-list]');
        if (!listEl) return;
        if (!list.length) {
            listEl.innerHTML = '<div class="ed-empty">Услуг пока нет — добавьте первую.</div>';
            return;
        }
        listEl.innerHTML = list.map((s, i) => `
            <div class="ed-item ed-item--row" draggable="true" data-ed-id="${s.id}">
                <span class="ed-item__grip" title="Перетащите для сортировки">⠿</span>
                <span class="ed-item__title">${editorEscapeHtml(s.title)}</span>
                <span class="ed-item__sub">${editorEscapeHtml(s.category || '')}</span>
                <span class="ed-item__actions">
                    <button type="button" class="ed-mini" data-ed-up="${i}" title="Выше">↑</button>
                    <button type="button" class="ed-mini" data-ed-down="${i}" title="Ниже">↓</button>
                    <button type="button" class="ed-mini" data-ed-edit="${s.id}" title="Изменить">✎</button>
                    <button type="button" class="ed-mini ed-mini--danger" data-ed-del="${s.id}" title="Удалить">✕</button>
                </span>
            </div>`).join('');

        listEl.querySelectorAll('[data-ed-edit]').forEach(btn => {
            btn.addEventListener('click', () => {
                const s = list.find(x => x.id === btn.dataset.edEdit);
                if (s) openServiceForm(s);
            });
        });
        listEl.querySelectorAll('[data-ed-del]').forEach(btn => {
            btn.addEventListener('click', () => {
                const s = list.find(x => x.id === btn.dataset.edDel);
                if (!s) return;
                if (!confirm(`Удалить услугу «${s.title}»?`)) return;
                const idx = list.findIndex(x => x.id === s.id);
                if (idx !== -1) list.splice(idx, 1);
                EDITOR_STORE.services = list.slice();
                editorSaveJSON('services', list);
                renderList(rootEl);
                editorRerenderSection('services');
                editorToast('Услуга удалена.');
            });
        });
        listEl.querySelectorAll('[data-ed-up], [data-ed-down]').forEach(btn => {
            btn.addEventListener('click', () => {
                const i = parseInt(btn.dataset.edUp != null ? btn.dataset.edUp : btn.dataset.edDown, 10);
                const j = btn.dataset.edUp != null ? i - 1 : i + 1;
                if (j < 0 || j >= list.length) return;
                const tmp = list[i];
                list[i] = list[j];
                list[j] = tmp;
                EDITOR_STORE.services = list.slice();
                editorSaveJSON('services', list);
                renderList(rootEl);
                editorRerenderSection('services');
            });
        });

        let dragId = null;
        listEl.querySelectorAll('[draggable="true"]').forEach(row => {
            row.addEventListener('dragstart', () => { dragId = row.dataset.edId; row.classList.add('is-drag'); });
            row.addEventListener('dragend', () => { dragId = null; row.classList.remove('is-drag'); });
            row.addEventListener('dragover', e => {
                e.preventDefault();
                if (!dragId || dragId === row.dataset.edId) return;
                const from = list.findIndex(x => x.id === dragId);
                const to = list.findIndex(x => x.id === row.dataset.edId);
                if (from === -1 || to === -1) return;
                const item = list.splice(from, 1)[0];
                list.splice(to, 0, item);
                EDITOR_STORE.services = list.slice();
                editorSaveJSON('services', list);
                renderList(rootEl);
                editorRerenderSection('services');
            });
        });
    }

    const root = editorOpenModal('Управление услугами', `
        <button type="button" class="ed-btn ed-btn--primary ed-btn--block" data-ed-add>+ Добавить услугу</button>
        <div class="ed-list ed-list--sortable" data-ed-list></div>
        <div class="ed-note">Сортировка: перетаскивайте карточки или используйте ↑ ↓.</div>`, rootEl => {
        renderList(rootEl);
        rootEl.querySelector('[data-ed-add]').addEventListener('click', () => openServiceForm(null));
    });
    void root;
}

window.EDITOR_SECTIONS = window.EDITOR_SECTIONS || {};
window.EDITOR_SECTIONS.services = { open: openServicesManager };

})();
