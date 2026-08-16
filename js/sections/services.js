/* ==========================================================================
   Frontend-редактор: раздел «Услуги» (CRUD, сортировка, категории)
   Примечание: сложный прайс-аккордеон исходных данных не разбирается —
   правки идут по простым полям (название, описание, цена, картинка).
   ========================================================================== */

(function () {

function masterRowHtml(m, idx) {
    m = m || {};
    return `
        <div class="ed-master-row" data-ed-master>
            <input class="ed-input" data-f="name" placeholder="Имя мастера" value="${editorEscapeHtml(m.name || '')}" ${idx === 0 ? 'autofocus' : ''}>
            <input class="ed-input" data-f="photo" placeholder="Фото (URL)" value="${editorEscapeHtml(m.photo || '')}">
            <input class="ed-input" data-f="desc" placeholder="Кто мастер, опыт, образование" value="${editorEscapeHtml(m.desc || '')}">
            <button type="button" class="ed-mini ed-mini--danger" data-ed-master-del title="Удалить мастера">✕</button>
        </div>`;
}

function priceItemRowHtml(it) {
    it = it || {};
    return `
        <div class="ed-price-item" data-ed-price-item>
            <input class="ed-input" data-f="name" placeholder="Название процедуры" value="${editorEscapeHtml(it.name || '')}">
            <input class="ed-input" data-f="meta" placeholder="Примечание (длительность)" value="${editorEscapeHtml(it.meta || '')}">
            <input class="ed-input ed-price-item__price" data-f="price" placeholder="Цена" value="${editorEscapeHtml(it.price || '')}">
            <button type="button" class="ed-mini ed-mini--danger" data-ed-price-item-del title="Удалить позицию">✕</button>
        </div>`;
}

function priceSectionHtml(block) {
    block = block || {};
    const items = (Array.isArray(block.items) && block.items.length ? block.items : [{}]).map(priceItemRowHtml).join('');
    return `
        <div class="ed-price-sec" data-ed-price-sec>
            <div class="ed-price-sec__head">
                <input class="ed-input" data-f="section" placeholder="Название раздела (категория прайса)" value="${editorEscapeHtml(block.section || '')}">
                <button type="button" class="ed-mini ed-mini--danger" data-ed-price-sec-del title="Удалить раздел">✕</button>
            </div>
            <div class="ed-price-items" data-ed-price-items>${items}</div>
            <button type="button" class="ed-btn ed-btn--sm" data-ed-price-add-item>+ Позиция</button>
        </div>`;
}

function renderMastersBox(box, masters) {
    box.innerHTML = (Array.isArray(masters) && masters.length ? masters : [{}]).map(masterRowHtml).join('');
}

function renderPriceBox(box, price) {
    const sections = (Array.isArray(price) && price.length ? price : [{ section: '', items: [{}] }]);
    box.innerHTML = sections.map(priceSectionHtml).join('');
}

function parseMasters(root) {
    const out = [];
    root.querySelectorAll('[data-ed-master]').forEach(row => {
        const m = {};
        row.querySelectorAll('[data-f]').forEach(inp => { m[inp.dataset.f] = inp.value.trim(); });
        if (m.name || m.photo || m.desc) out.push(m);
    });
    return out;
}

function parsePrice(root) {
    const out = [];
    root.querySelectorAll('[data-ed-price-sec]').forEach(sec => {
        const sectionInput = sec.querySelector('[data-f="section"]');
        const items = [];
        sec.querySelectorAll('[data-ed-price-item]').forEach(row => {
            const it = {};
            row.querySelectorAll('[data-f]').forEach(inp => { it[inp.dataset.f] = inp.value.trim(); });
            if (it.name || it.meta || it.price) items.push(it);
        });
        if ((sectionInput && sectionInput.value.trim()) || items.length) {
            out.push({ section: sectionInput ? sectionInput.value.trim() : '', items });
        }
    });
    return out;
}

function wireServiceForm(root, mastersBox, priceBox) {
    root.addEventListener('click', e => {
        const delM = e.target.closest('[data-ed-master-del]');
        if (delM) { delM.closest('[data-ed-master]').remove(); return; }
        const delS = e.target.closest('[data-ed-price-sec-del]');
        if (delS) { delS.closest('[data-ed-price-sec]').remove(); return; }
        const delI = e.target.closest('[data-ed-price-item-del]');
        if (delI) { delI.closest('[data-ed-price-item]').remove(); return; }
        const addI = e.target.closest('[data-ed-price-add-item]');
        if (addI) {
            const itemsBox = addI.closest('[data-ed-price-sec]').querySelector('[data-ed-price-items]');
            itemsBox.insertAdjacentHTML('beforeend', priceItemRowHtml({}));
            return;
        }
        const addM = e.target.closest('[data-ed-add-master]');
        if (addM && mastersBox) {
            mastersBox.insertAdjacentHTML('beforeend', masterRowHtml({}, mastersBox.children.length));
            return;
        }
        const addS = e.target.closest('[data-ed-add-section]');
        if (addS && priceBox) {
            priceBox.insertAdjacentHTML('beforeend', priceSectionHtml({}));
        }
    });
}

function serviceFormHtml(s) {
    s = s || {};
    return `
        ${editorField('Название услуги', s.title || '', { name: 'title' })}
        ${editorField('Описание', s.shortDesc || '', { name: 'shortDesc', type: 'textarea', rows: 3 })}
        ${editorField('Категория (по желанию)', s.category || '', { name: 'category' })}
        ${editorField('Главная картинка (URL)', (s.images && s.images[0]) || s.image || '', { name: 'image', placeholder: 'img/... или https://...' })}
        ${editorField('Цена (строка для карточки, опционально)', s.priceText || '', { name: 'priceText', placeholder: 'от 1 500 ₽' })}
        <div class="ed-field">
            <div class="ed-field__label">Мастера</div>
            <div class="ed-masters" data-ed-masters></div>
            <button type="button" class="ed-btn ed-btn--sm" data-ed-add-master>+ Добавить мастера</button>
        </div>
        <div class="ed-field">
            <div class="ed-field__label">Прайс-лист (разделы и позиции)</div>
            <div class="ed-price" data-ed-price></div>
            <button type="button" class="ed-btn ed-btn--sm" data-ed-add-section>+ Добавить раздел</button>
        </div>
        ${editorField('Телефон', s.phone || '', { name: 'phone', placeholder: '+7...' })}
        ${editorField('Телефон (как показывать)', s.phoneDisplay || '', { name: 'phoneDisplay', placeholder: '+7 (___) ___-__-__' })}
        ${editorField('VK', s.vk || '', { name: 'vk' })}
        ${editorField('Telegram', s.tg || '', { name: 'tg' })}`;
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
        const mastersBox = rootEl.querySelector('[data-ed-masters]');
        const priceBox = rootEl.querySelector('[data-ed-price]');
        if (mastersBox) renderMastersBox(mastersBox, service.masters);
        if (priceBox) renderPriceBox(priceBox, service.price);
        wireServiceForm(rootEl, mastersBox, priceBox);
        const form = rootEl.querySelector('[data-ed-form]');
        form.addEventListener('submit', e => {
            e.preventDefault();
            const data = editorFormValues(rootEl);
            if (!data.title) {
                editorToast('Укажите название услуги.', true);
                return;
            }
            const images0 = data.image ? [data.image] : [];
            const list = editorServiceList();
            const existing = isNew ? null : (list.find(x => x.id === service.id) || service);
            const prevMasters = (existing && Array.isArray(existing.masters)) ? existing.masters : [];
            const prevImages = (existing && Array.isArray(existing.images)) ? existing.images : [];
            const prevPrice = (existing && Array.isArray(existing.price)) ? existing.price : [];

            let masters = parseMasters(rootEl);
            if (!masters.length && prevMasters.length) {
                masters = prevMasters;
            } else {
                masters = masters.map(m => {
                    const prev = prevMasters.find(p => p.name === m.name);
                    return prev ? Object.assign({}, m, { photo: prev.photo }) : m;
                });
            }

            let price = parsePrice(rootEl);
            if (!price.length && prevPrice.length) price = prevPrice;

            const images = images0.length
                ? images0.concat(prevImages.slice(1))
                : prevImages;

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
                list.push(Object.assign({ id: editorGenerateId('service') }, base, { price }));
            } else {
                const idx = list.findIndex(x => x.id === service.id);
                const merged = Object.assign({}, list[idx] || service, base, { price });
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

function editorServiceList() {
    return Array.isArray(EDITOR_STORE.services) ? EDITOR_STORE.services.slice() : getServices().slice();
}

function openServicesManager() {
    const list = editorServiceList();

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
window.EDITOR_SECTIONS.services = { open: openServicesManager, openForm: openServiceForm };

})();
