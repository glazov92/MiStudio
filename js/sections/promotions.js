/* ==========================================================================
   Frontend-редактор: раздел «Акции» (CRUD, сортировка, статусы)
   ========================================================================== */

(function () {

function promoFormHtml(p) {
    p = p || {};
    return `
        ${editorField('Бейдж (например −20%)', p.badge || '', { name: 'badge', placeholder: '−20%' })}
        ${editorField('Метка (например «Новым гостям»)', p.tag || '', { name: 'tag', placeholder: 'Новым гостям' })}
        ${editorField('Заголовок', p.title || '', { name: 'title' })}
        ${editorField('Описание', p.desc || '', { name: 'desc', type: 'textarea', rows: 3 })}
        ${editorField('Примечание', p.note || '', { name: 'note' })}
        ${editorField('Текст кнопки', p.cta || '', { name: 'cta', placeholder: 'Записаться со скидкой' })}
        <div class="ed-row">
            ${editorField('Начало', p.startDate || '', { name: 'startDate', type: 'date' })}
            ${editorField('Окончание', p.endDate || '', { name: 'endDate', type: 'date' })}
        </div>
        ${editorField('Акция активна (показывать на сайте)', p.isActive !== false, { name: 'isActive', type: 'checkbox' })}`;
}

function openPromoForm(existing) {
    const isNew = !existing;
    const promo = existing || {};
    const root = editorOpenModal(isNew ? 'Добавить акцию' : 'Редактировать акцию', `
        <form class="ed-form" data-ed-form>
            ${promoFormHtml(promo)}
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
                editorToast('Укажите заголовок акции.', true);
                return;
            }
            const list = editorPromoList();
            if (isNew) {
                list.push(Object.assign({
                    id: editorGenerateId('promo'),
                    badge: data.badge || 'Скидка',
                    tag: data.tag || '',
                    title: data.title,
                    desc: data.desc || '',
                    note: data.note || '',
                    cta: data.cta || 'Записаться',
                    startDate: data.startDate || '',
                    endDate: data.endDate || '',
                    isActive: !!data.isActive
                }));
            } else {
                const idx = list.findIndex(p => p.id === promo.id);
                if (idx === -1) list.push(Object.assign({}, promo, data));
                else list[idx] = Object.assign({}, list[idx], data);
            }
            EDITOR_STORE.promos = list;
            editorSaveJSON('promos', list);
            openPromotionsManager();
            editorRerenderSection('promotions');
            editorToast('Акции применены локально - опубликуйте кнопку Сохранить на панели.');
        });
        rootEl.querySelector('[data-ed-cancel]').addEventListener('click', closeEditorModal);
    });
    void root;
}

function editorPromoList() {
    const base = Array.isArray(EDITOR_STORE.promos) ? EDITOR_STORE.promos.slice() : getPromos().slice();
    return base.map(p => Object.assign({}, p, { id: p.id || editorGenerateId('promo') }));
}

function openPromotionsManager() {
    const list = editorPromoList();

    function renderList(rootEl) {
        const listEl = rootEl.querySelector('[data-ed-list]');
        if (!listEl) return;
        if (!list.length) {
            listEl.innerHTML = '<div class="ed-empty">Акций пока нет — добавьте первую.</div>';
            return;
        }
        listEl.innerHTML = list.map((p, i) => `
            <div class="ed-item ed-item--row" draggable="true" data-ed-id="${p.id}">
                <span class="ed-item__grip" title="Перетащите для сортировки">⠿</span>
                <span class="ed-item__title">${editorEscapeHtml(p.badge)} ${editorEscapeHtml(p.title)}</span>
                <span class="ed-item__status ${p.isActive === false ? 'is-off' : ''}">${p.isActive === false ? 'скрыта' : 'активна'}</span>
                <span class="ed-item__actions">
                    <button type="button" class="ed-mini" data-ed-up="${i}" title="Выше">↑</button>
                    <button type="button" class="ed-mini" data-ed-down="${i}" title="Ниже">↓</button>
                    <button type="button" class="ed-mini" data-ed-edit="${p.id}" title="Изменить">✎</button>
                    <button type="button" class="ed-mini ed-mini--danger" data-ed-del="${p.id}" title="Удалить">✕</button>
                </span>
            </div>`).join('');

        listEl.querySelectorAll('[data-ed-edit]').forEach(btn => {
            btn.addEventListener('click', () => {
                const p = list.find(x => x.id === btn.dataset.edEdit);
                if (p) openPromoForm(p);
            });
        });
        listEl.querySelectorAll('[data-ed-del]').forEach(btn => {
            btn.addEventListener('click', () => {
                const p = list.find(x => x.id === btn.dataset.edDel);
                if (!p) return;
                if (!confirm(`Удалить акцию «${p.title}»?`)) return;
                const idx = list.findIndex(x => x.id === p.id);
                if (idx !== -1) list.splice(idx, 1);
                EDITOR_STORE.promos = list.slice();
                editorSaveJSON('promos', list);
                renderList(rootEl);
                editorRerenderSection('promotions');
                editorToast('Акция удалена.');
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
                EDITOR_STORE.promos = list.slice();
                editorSaveJSON('promos', list);
                renderList(rootEl);
                editorRerenderSection('promotions');
            });
        });

        /* drag-and-drop сортировка */
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
                EDITOR_STORE.promos = list.slice();
                editorSaveJSON('promos', list);
                renderList(rootEl);
                editorRerenderSection('promotions');
            });
        });
    }

    const root = editorOpenModal('Управление акциями', `
        <button type="button" class="ed-btn ed-btn--primary ed-btn--block" data-ed-add>+ Добавить акцию</button>
        <div class="ed-list ed-list--sortable" data-ed-list></div>
        <div class="ed-note">Сортировка: перетаскивайте карточки или используйте ↑ ↓. Скрытые акции не показываются на сайте.</div>`, rootEl => {
        renderList(rootEl);
        rootEl.querySelector('[data-ed-add]').addEventListener('click', () => openPromoForm(null));
    });
    void root;
}

window.EDITOR_SECTIONS = window.EDITOR_SECTIONS || {};
window.EDITOR_SECTIONS.promotions = { open: openPromotionsManager, openForm: openPromoForm };

})();
