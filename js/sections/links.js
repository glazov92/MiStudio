/* ==========================================================================
   Frontend-редактор: раздел «Ссылки» (соцсети и онлайн-запись)
   Правки хранятся в EDITOR_STORE.links (localStorage) и применяются в
   renderFooter()/socialLinksHtml() через getLinks() в main.js.
   ========================================================================== */

(function () {

function openLinksManager() {
    const links = Object.assign({}, (window.MiEditorData && window.MiEditorData.links) || {});
    const root = editorOpenModal('Ссылки и соцсети', `
        <form class="ed-form" data-ed-form>
            ${editorField('ВКонтакте (URL)', links.vk || CONFIG.vkUrl, { name: 'vk', placeholder: 'https://vk.com/...' })}
            ${editorField('Telegram (URL)', links.tg || CONFIG.tgUrl, { name: 'tg', placeholder: 'https://t.me/...' })}
            ${editorField('DiKiDi — онлайн-запись (URL)', links.dikidi || CONFIG.dikidiUrl, { name: 'dikidi', placeholder: 'https://dikidi.net/...' })}
            <div class="ed-actions">
                <button type="submit" class="ed-btn ed-btn--primary">Применить</button>
                <button type="button" class="ed-btn ed-btn--ghost" data-ed-cancel>Отмена</button>
            </div>
        </form>
        <div class="ed-note">Телефоны, адрес и часы работы редактируются кликом прямо по тексту на странице. Ссылки в разделе «Разделы» футера ведут на страницы сайта.</div>`, rootEl => {
        const form = rootEl.querySelector('[data-ed-form]');
        form.addEventListener('submit', e => {
            e.preventDefault();
            const data = editorFormValues(rootEl);
            const saved = {};
            if (data.vk) saved.vk = data.vk;
            if (data.tg) saved.tg = data.tg;
            if (data.dikidi) saved.dikidi = data.dikidi;
            EDITOR_STORE.links = saved;
            editorSaveJSON('links', saved);
            editorRerenderSection('links');
            closeEditorModal();
            editorToast('Ссылки обновлены.');
        });
        rootEl.querySelector('[data-ed-cancel]').addEventListener('click', closeEditorModal);
    });
    void root;
}

window.EDITOR_SECTIONS = window.EDITOR_SECTIONS || {};
window.EDITOR_SECTIONS.links = { open: openLinksManager };

})();
