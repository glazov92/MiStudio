/* ==========================================================================
   Frontend-редактор: раздел «Портфолио» (CRUD, сортировка, категории)
   ========================================================================== */

(function () {

function portfolioFormHtml(p) {
    p = p || {};
    return `
        ${editorField('Название работы', p.title || '', { name: 'title' })}
        ${editorField('Описание', p.desc || '', { name: 'desc', type: 'textarea', rows: 3 })}
        ${editorField('Изображение (URL)', p.image || '', { name: 'image', placeholder: 'img/... или https://...' })}
        ${editorField('Категория / тег', p.category || '', { name: 'category' })}
        ${editorField('Дата выполнения', p.date || '', { name: 'date', type: 'date' })}`;
}

function openPortfolioForm(existing) {
    const isNew = !existing;
    const item = existing || {};
    const root = editorOpenModal(isNew ? 'Добавить работу' : 'Редактировать работу', `
        <form class="ed-form" data-ed-form>
            ${portfolioFormHtml(item)}
            <div class="ed-actions">
                <button type="submit" class="ed-btn ed-btn--primary">${isNew ? 'Добавить' : 'Сохранить'}</button>
                <button type="button" class="ed-btn ed-btn--ghost" data-ed-cancel>Отмена</button>
            </div>
        </form>`, rootEl => {
        const form = rootEl.querySelector('[data-ed-form]');
        form.addEventListener('submit', e => {
            e.preventDefault();
            const data = editorFormValues(rootEl);
            if (!data.image) {
                editorToast('Укажите URL изображения.', true);
                return;
            }
            const list = editorPortfolioList();
            const base = {
                title: data.title || '',
                desc: data.desc || '',
                image: data.image,
                category: data.category || '',
                date: data.date || ''
            };
            if (isNew) {
                list.push(Object.assign({ id: editorGenerateId('work') }, base));
            } else {
                const idx = list.findIndex(x => x.id === item.id);
                if (idx === -1) list.push(Object.assign({}, item, base));
                else list[idx] = Object.assign({}, list[idx], base);
            }
            EDITOR_STORE.portfolio = list;
            editorSaveJSON('portfolio', list);
            openPortfolioManager();
            editorRerenderSection('portfolio');
            editorToast('Портфолио обновлено.');
        });
        rootEl.querySelector('[data-ed-cancel]').addEventListener('click', closeEditorModal);
    });
    void root;
}

function editorPortfolioList() {
    return Array.isArray(EDITOR_STORE.portfolio) ? EDITOR_STORE.portfolio.slice() : getPortfolioItems().slice();
}

function openPortfolioManager() {
    const list = editorPortfolioList();

    function renderList(rootEl) {
        const listEl = rootEl.querySelector('[data-ed-list]');
        if (!listEl) return;
        if (!list.length) {
            listEl.innerHTML = '<div class="ed-empty">Работ пока нет — добавьте первую.</div>';
            return;
        }
        listEl.innerHTML = list.map((p, i) => `
            <div class="ed-item ed-item--row" draggable="true" data-ed-id="${p.id}">
                ${p.image ? `<img class="ed-item__thumb" src="${editorEscapeHtml(p.image)}" alt="">` : ''}
                <span class="ed-item__title">${editorEscapeHtml(p.title || 'Без названия')}</span>
                <span class="ed-item__sub">${editorEscapeHtml(p.category || '')}</span>
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
                if (p) openPortfolioForm(p);
            });
        });
        listEl.querySelectorAll('[data-ed-del]').forEach(btn => {
            btn.addEventListener('click', () => {
                const p = list.find(x => x.id === btn.dataset.edDel);
                if (!p) return;
                if (!confirm(`Удалить работу «${p.title || 'Без названия'}»?`)) return;
                const idx = list.findIndex(x => x.id === p.id);
                if (idx !== -1) list.splice(idx, 1);
                EDITOR_STORE.portfolio = list.slice();
                editorSaveJSON('portfolio', list);
                renderList(rootEl);
                editorRerenderSection('portfolio');
                editorToast('Работа удалена.');
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
                EDITOR_STORE.portfolio = list.slice();
                editorSaveJSON('portfolio', list);
                renderList(rootEl);
                editorRerenderSection('portfolio');
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
                EDITOR_STORE.portfolio = list.slice();
                editorSaveJSON('portfolio', list);
                renderList(rootEl);
                editorRerenderSection('portfolio');
            });
        });
    }

    const root = editorOpenModal('Управление портфолио', `
        <button type="button" class="ed-btn ed-btn--primary ed-btn--block" data-ed-add>+ Добавить работу</button>
        <div class="ed-list ed-list--sortable" data-ed-list></div>
        <div class="ed-note">Сортировка: перетаскивайте карточки или используйте ↑ ↓.</div>`, rootEl => {
        renderList(rootEl);
        rootEl.querySelector('[data-ed-add]').addEventListener('click', () => openPortfolioForm(null));
    });
    void root;
}

window.EDITOR_SECTIONS = window.EDITOR_SECTIONS || {};
window.EDITOR_SECTIONS.portfolio = { open: openPortfolioManager };

})();
