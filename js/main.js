/* ==========================================================================
   Mi Studio — единый файл скриптов
   Общие компоненты (хедер, футер, попап, плавающие кнопки) рендерятся JS,
   чтобы не дублировать разметку на 4 страницах.
   ========================================================================== */

const WA_PHONE = CONFIG.phones[0].replace(/[^0-9]/g, '');

const FLAG_CDN = 'https://hatscripts.github.io/circle-flags/flags';

const PHONE_COUNTRIES = [
    { code: 'RU', iso: 'ru', dial: '7', name: 'Россия', mask: '(###) ###-##-##', len: 10 },
    { code: 'KZ', iso: 'kz', dial: '7', name: 'Казахстан', mask: '(###) ###-##-##', len: 10 },
    { code: 'BY', iso: 'by', dial: '375', name: 'Беларусь', mask: '## ###-##-##', len: 9 },
    { code: 'AM', iso: 'am', dial: '374', name: 'Армения', mask: '## ###-###', len: 8 },
    { code: 'KG', iso: 'kg', dial: '996', name: 'Кыргызстан', mask: '### ##-##-##', len: 9 },
    { code: 'TJ', iso: 'tj', dial: '992', name: 'Таджикистан', mask: '## ###-##-##', len: 9 },
    { code: 'UZ', iso: 'uz', dial: '998', name: 'Узбекистан', mask: '## ###-##-##', len: 9 }
];

const MONTHS_RU = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

const leadFormState = {
    contactType: 'phone',
    country: PHONE_COUNTRIES[0],
    services: [],
    promos: [],
    dates: [],
    viewYear: null,
    viewMonth: null
};

const spamGuard = {
    createdMs: Date.now(),
    lastSentMs: 0
};

function getSessionLeadCount() {
    const n = parseInt(sessionStorage.getItem('mi_lead_count') || '0', 10);
    return Number.isFinite(n) ? n : 0;
}

function bumpSessionLeadCount() {
    sessionStorage.setItem('mi_lead_count', String(getSessionLeadCount() + 1));
}

function flagUrl(iso) {
    return `${FLAG_CDN}/${String(iso).toLowerCase()}.svg`;
}

function flagImgHtml(iso, name, idAttr) {
    const id = idAttr ? ` id="${idAttr}"` : '';
    return `<img class="phone-flag"${id} src="${flagUrl(iso)}" width="30" height="30" alt="${name}" decoding="async">`;
}

/* --------------------------------------------------------------------------
   Рендер общих компонентов
   -------------------------------------------------------------------------- */

function renderHeader(activePage) {
    const navItems = [
        { href: 'index.html#services', label: 'Услуги', key: 'services' },
        { href: 'index.html#about', label: 'О нас', key: 'about' },
        { href: 'index.html#portfolio', label: 'Портфолио', key: 'portfolio' },
        { href: 'index.html#contacts', label: 'Контакты', key: 'contacts' }
    ];

    const navLinks = navItems.map(item => {
        const cls = item.key === activePage ? 'active' : '';
        return `<a href="${item.href}" class="${cls}">${item.label}</a>`;
    }).join('');

    const phones = CONFIG.phonesDisplay.map((p, i) =>
        `<a class="header__phone" href="tel:+${CONFIG.phones[i].replace(/[^0-9]/g, '')}">
            <span class="header__phone-label">${i === 0 ? 'Студия' : 'Запись'}</span>
            <span class="header__phone-num">${p}</span>
        </a>`).join('');

    const mobilePhones = CONFIG.phonesDisplay.map((p, i) =>
        `<a class="mobile-nav__phone" href="tel:+${CONFIG.phones[i].replace(/[^0-9]/g, '')}">${p}</a>`
    ).join('');

    document.getElementById('header').innerHTML = `
        <header class="header">
            <div class="container header__inner">
                <a href="index.html" class="logo">Mi<span>Studio</span></a>
                <nav class="nav nav--desktop" id="nav">${navLinks}</nav>
                <div class="header__right">
                    <div class="header__phones">${phones}</div>
                    <button class="btn btn--outline btn--sm header__cta" data-open-popup>Связаться</button>
                    <button class="burger" id="burger" type="button" aria-label="Меню" aria-expanded="false" aria-controls="mobile-nav">
                        <span></span><span></span><span></span>
                    </button>
                </div>
            </div>
        </header>
        <div class="mobile-nav" id="mobile-nav" hidden>
            <div class="mobile-nav__backdrop" data-close-nav></div>
            <div class="mobile-nav__panel" role="dialog" aria-modal="true" aria-label="Меню">
                <button type="button" class="mobile-nav__close" data-close-nav aria-label="Закрыть меню">&times;</button>
                <nav class="mobile-nav__links">${navLinks}</nav>
                <div class="mobile-nav__phones">${mobilePhones}</div>
                <button type="button" class="btn btn--accent mobile-nav__cta" data-open-popup data-close-nav>Записаться</button>
            </div>
        </div>`;

    const burger = document.getElementById('burger');
    const mobileNav = document.getElementById('mobile-nav');
    const panel = mobileNav.querySelector('.mobile-nav__panel');
    let navClosing = false;

    function setNavOpen(open) {
        if (open) {
            navClosing = false;
            mobileNav.hidden = false;
            // reflow, затем класс — чтобы сыграла CSS-анимация
            void mobileNav.offsetWidth;
            requestAnimationFrame(() => {
                burger.classList.add('is-open');
                burger.setAttribute('aria-expanded', 'true');
                mobileNav.classList.add('is-open');
                document.body.classList.add('nav-open');
            });
            return;
        }

        if (mobileNav.hidden && !mobileNav.classList.contains('is-open')) return;

        burger.classList.remove('is-open');
        burger.setAttribute('aria-expanded', 'false');
        mobileNav.classList.remove('is-open');
        document.body.classList.remove('nav-open');
        navClosing = true;

        const finish = () => {
            if (!navClosing) return;
            navClosing = false;
            mobileNav.hidden = true;
        };

        const onEnd = e => {
            if (e.target !== panel) return;
            panel.removeEventListener('transitionend', onEnd);
            finish();
        };
        panel.addEventListener('transitionend', onEnd);
        setTimeout(finish, 400);
    }

    burger.addEventListener('click', () => setNavOpen(!burger.classList.contains('is-open')));

    mobileNav.addEventListener('click', e => {
        if (e.target.closest('[data-close-nav]')) setNavOpen(false);
        if (e.target.closest('a')) setNavOpen(false);
    });

    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) setNavOpen(false);
    });
}

function socialLinksHtml(iconSize = 18) {
    return `
        <a href="${CONFIG.vkUrl}" target="_blank" rel="noopener" aria-label="ВКонтакте">
            <svg width="${iconSize}" height="${iconSize}" viewBox="0 0 576 512"><path fill="currentColor" d="M545 117.7c3.7-12.5 0-21.7-17.8-21.7h-58.9c-15 0-21.9 7.9-25.6 16.7 0 0-30 73.1-72.4 120.5-13.7 13.7-20 18.1-27.5 18.1-3.7 0-9.4-4.4-9.4-16.9V117.7c0-15-4.2-21.7-16.6-21.7h-92.6c-9.4 0-15 7-15 13.5 0 14.2 21.2 17.5 23.4 57.5v86.8c0 19-3.4 22.5-10.9 22.5-20 0-68.6-73.4-97.4-157.4-5.8-16.3-11.5-22.9-26.6-22.9H38.8c-16.8 0-20.2 7.9-20.2 16.7 0 15.6 20 93.1 93.1 195.5C160.4 378.1 229 416 291.4 416c37.5 0 42.1-8.4 42.1-22.9 0-66.8-3.4-73.1 15.4-73.1 8.7 0 23.7 4.4 58.7 38.1 40 40 46.6 57.9 69 57.9h58.9c16.8 0 25.3-8.4 20.4-25-11.2-34.9-86.9-106.7-90.3-111.5-8.7-11.2-6.2-16.2 0-26.2.1-.1 72-101.3 79.4-135.6z"/></svg>
        </a>
        <a href="${CONFIG.tgUrl}" target="_blank" rel="noopener" aria-label="Telegram">
            <svg width="${iconSize}" height="${iconSize}" viewBox="0 0 448 512"><path fill="currentColor" d="M446.7 98.6l-67.6 318.8c-5.1 22.5-18.4 28.1-37.3 17.5l-103-75.9-49.7 47.8c-5.5 5.5-10.1 10.1-20.7 10.1l7.4-104.9 190.9-172.5c8.3-7.4-1.8-11.5-12.9-4.1L117.8 284 16.2 252.2c-22.1-6.9-22.5-22.1 4.6-32.7L418.2 66.4c18.4-6.9 34.5 4.1 28.5 32.2z"/></svg>
        </a>
        <a class="socials__dikidi" href="${CONFIG.dikidiUrl}" target="_blank" rel="noopener" aria-label="Онлайн-запись в DiKiDi">
            <span class="socials__dikidi-mark" aria-hidden="true">D</span>
            <span class="socials__dikidi-text">DiKiDi</span>
        </a>`;
}

function renderFooter() {
    const phones = CONFIG.phonesDisplay.map((p, i) =>
        `<a class="footer__phone" href="tel:+${CONFIG.phones[i].replace(/[^0-9]/g, '')}">${p}</a>`).join('');

    document.getElementById('footer').innerHTML = `
        <footer class="footer">
            <div class="container">
                <div class="footer__top">
                    <div class="footer__brand">
                        <a href="index.html" class="footer__logo">Mi<span>Studio</span></a>
                        <div class="grotesk-rule footer__rule" aria-hidden="true"></div>
                        <p class="footer__desc">Студия красоты в Нижнем Новгороде — уютная атмосфера, профессиональный уход и заметный результат.</p>
                    </div>
                    <div class="footer__cols">
                        <div class="footer__col">
                            <div class="footer__title">Разделы</div>
                            <ul class="footer__links">
                                <li><a href="index.html#services">Услуги</a></li>
                                <li><a href="index.html#about">О нас</a></li>
                                <li><a href="index.html#portfolio">Портфолио</a></li>
                                <li><a href="index.html#contacts">Контакты</a></li>
                            </ul>
                        </div>
                        <div class="footer__col">
                            <div class="footer__title">Контакты</div>
                            <div class="footer__contact">
                                <span class="footer__meta">${CONFIG.address}</span>
                                <div class="footer__phones">${phones}</div>
                                <span class="footer__meta">${CONFIG.schedule}</span>
                            </div>
                        </div>
                        <div class="footer__col">
                            <div class="footer__title">Мы на связи</div>
                            <div class="socials">
                                ${socialLinksHtml(18)}
                            </div>
                        </div>
                    </div>
                </div>
                <div class="footer__bottom">
                    <span>© ${new Date().getFullYear()} Студия красоты «Mi Studio»</span>
                    <button class="footer__policy" data-open-policy>Политика обработки персональных данных</button>
                </div>
            </div>
        </footer>`;
}

function renderPopup() {
    const serviceItems = SERVICES.map(s => `
        <label class="msel__option">
            <input type="checkbox" value="${s.title}">
            <span>${s.title}</span>
        </label>`).join('');

    const countryItems = PHONE_COUNTRIES.map((c, i) => `
        <button type="button" class="phone-dd__item${i === 0 ? ' is-active' : ''}" data-country="${c.code}" title="${c.name}" aria-label="${c.name} +${c.dial}" role="option">
            ${flagImgHtml(c.iso, c.name)}
            <span class="phone-dd__dial">+${c.dial}</span>
        </button>`).join('');

    document.getElementById('popup-root').innerHTML = `
        <div class="popup" id="lead-popup">
            <div class="popup__overlay" data-close-popup></div>
            <div class="popup__container">
                <button class="popup__close" data-close-popup aria-label="Закрыть">&times;</button>
                <div class="popup__title">Запись на визит</div>
                <p class="popup__subtitle">Оставьте контакты — мы свяжемся и подтвердим запись</p>
                <form class="form" id="lead-form" novalidate>
                    <div class="form__field">
                        <label class="form__label" for="lead-name">Имя <span class="form__req">*</span></label>
                        <input class="form__input" id="lead-name" name="name" type="text" required autocomplete="name" placeholder="Как к вам обращаться">
                    </div>

                    <div class="form__field">
                        <span class="form__label">Как связаться</span>
                        <div class="contact-tabs" role="tablist">
                            <button type="button" class="contact-tabs__btn is-active" data-contact-type="phone" role="tab" aria-selected="true">Телефон <span class="form__req">*</span></button>
                            <button type="button" class="contact-tabs__btn" data-contact-type="email" role="tab" aria-selected="false">Почта</button>
                            <button type="button" class="contact-tabs__btn" data-contact-type="telegram" role="tab" aria-selected="false">Telegram</button>
                        </div>

                        <div class="contact-pane is-active" data-pane="phone">
                            <div class="phone-field">
                                <div class="phone-country">
                                    <button type="button" class="phone-country__btn" id="phone-country-btn" aria-haspopup="listbox" aria-expanded="false" aria-label="Страна номера">
                                        ${flagImgHtml('ru', 'Россия', 'phone-flag')}
                                        <span class="phone-dial" id="phone-dial">+7</span>
                                        <span class="phone-country__caret" aria-hidden="true"></span>
                                    </button>
                                    <div class="phone-dd" id="phone-country-dd" hidden role="listbox">
                                        <div class="phone-dd__scroll" id="phone-country-scroll">
                                            ${countryItems}
                                        </div>
                                    </div>
                                </div>
                                <input class="form__input phone-field__input" id="lead-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="(___) ___-__-__" aria-label="Номер телефона">
                            </div>
                        </div>

                        <div class="contact-pane" data-pane="email" hidden>
                            <input class="form__input" id="lead-email" name="email" type="email" inputmode="email" autocomplete="email" placeholder="name@example.com" aria-label="Электронная почта">
                        </div>

                        <div class="contact-pane" data-pane="telegram" hidden>
                            <div class="tg-field">
                                <span class="tg-field__at" aria-hidden="true">@</span>
                                <input class="form__input tg-field__input" id="lead-telegram" name="telegram" type="text" inputmode="text" autocomplete="username" placeholder="username" aria-label="Telegram username" maxlength="32">
                            </div>
                        </div>
                    </div>

                    <div class="form__field" id="lead-promos-field" hidden>
                        <span class="form__label">Акции</span>
                        <div class="msel msel--promos" id="lead-promos">
                            <div class="msel__badges" id="promo-badges"></div>
                            <p class="msel__hint">Выбранные акции попадут в заявку</p>
                        </div>
                    </div>

                    <div class="form__field">
                        <span class="form__label">Услуги <span class="form__req">*</span></span>
                        <div class="msel" id="lead-services">
                            <div class="msel__badges" id="msel-badges"></div>
                            <button type="button" class="msel__trigger form__input" id="msel-trigger" aria-haspopup="listbox" aria-expanded="false">
                                <span id="msel-placeholder">Выберите услуги</span>
                                <span class="msel__caret" aria-hidden="true"></span>
                            </button>
                            <div class="msel__dropdown" id="msel-dropdown" hidden role="listbox">
                                ${serviceItems}
                                <button type="button" class="btn btn--accent btn--block msel__done" id="msel-done">Добавить</button>
                            </div>
                        </div>
                    </div>

                    <div class="form__field">
                        <span class="form__label">Желаемые даты <span class="form__req">*</span></span>
                        <div class="dtp" id="lead-datetime">
                            <div class="dtp__badges" id="dtp-badges"></div>
                            <button type="button" class="dtp__trigger form__input" id="dtp-trigger" aria-haspopup="dialog" aria-expanded="false">
                                <span id="dtp-display">Выберите даты</span>
                                <span class="dtp__icon" aria-hidden="true">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>
                                </span>
                            </button>
                        </div>
                    </div>

                    <div class="form__field">
                        <label class="form__label" for="lead-comment">Комментарий</label>
                        <textarea class="form__textarea" id="lead-comment" name="comment" placeholder="Пожелания, вопросы..."></textarea>
                    </div>
                    <div class="hp-wrap" style="position:absolute;left:-9999px;top:auto;width:1px;height:1px;overflow:hidden" aria-hidden="true">
                        <label for="lead-hp">Оставьте это поле пустым</label>
                        <input type="text" id="lead-hp" name="website" tabindex="-1" autocomplete="off">
                    </div>
                    <div class="form__actions">
                        <button type="submit" class="btn btn--accent btn--block">Отправить заявку</button>
                        <a class="btn btn--outline btn--block" href="${CONFIG.dikidiUrl}" target="_blank" rel="noopener">Онлайн-запись</a>
                    </div>
                    <div class="form__status" id="lead-status"></div>
                    <p class="form__note">Оставляя заявку, вы принимаете условия <a href="#" data-open-policy>пользовательского соглашения</a> и даёте согласие на обработку персональных данных.</p>
                </form>
            </div>
        </div>

        <div class="popup popup--calendar" id="calendar-popup">
            <div class="popup__overlay" data-close-calendar></div>
            <div class="popup__container popup__container--calendar">
                <button class="popup__close" data-close-calendar aria-label="Закрыть">&times;</button>
                <div class="popup__title">Желаемые даты</div>
                <p class="popup__subtitle">Можно выбрать несколько дней</p>
                <div class="dtp-mini">
                    <div class="dtp__nav">
                        <button type="button" class="dtp__nav-btn" id="dtp-prev" aria-label="Предыдущий месяц">&#10094;</button>
                        <div class="dtp__month" id="dtp-month"></div>
                        <button type="button" class="dtp__nav-btn" id="dtp-next" aria-label="Следующий месяц">&#10095;</button>
                    </div>
                    <div class="dtp__weekdays">
                        <span>Пн</span><span>Вт</span><span>Ср</span><span>Чт</span><span>Пт</span><span>Сб</span><span>Вс</span>
                    </div>
                    <div class="dtp__days" id="dtp-days"></div>
                </div>
                <button type="button" class="btn btn--accent btn--block" data-close-calendar style="margin-top:14px">Готово</button>
            </div>
        </div>

        <div class="lightbox" id="lightbox">
            <button class="lightbox__close" data-close-lightbox>&times;</button>
            <button class="lightbox__btn lightbox__btn--prev" data-lb-prev>&#10094;</button>
            <img class="lightbox__img" src="" alt="Портфолио">
            <button class="lightbox__btn lightbox__btn--next" data-lb-next>&#10095;</button>
        </div>
        <div class="popup" id="policy-popup">
            <div class="popup__overlay" data-close-policy></div>
            <div class="popup__container">
                <button class="popup__close" data-close-policy aria-label="Закрыть">&times;</button>
                <div class="popup__title">Политика обработки персональных данных</div>
                <div class="form__note" style="margin-top:16px">
                    <p style="margin-bottom:10px">Настоящая Политика определяет порядок обработки и защиты информации о физических лицах, пользующихся услугами студии красоты «Mi Studio».</p>
                    <p style="margin-bottom:10px">Мы собираем и обрабатываем следующие персональные данные: имя, номер телефона, которые вы предоставляете при заполнении формы записи.</p>
                    <p style="margin-bottom:10px">Данные используются исключительно для связи с вами, подтверждения записи и информирования об услугах. Мы не передаём ваши данные третьим лицам.</p>
                    <p>Вы имеете право в любой момент отозвать согласие на обработку данных, написав нам на почту.</p>
                </div>
            </div>
        </div>
        <div class="popup" id="service-popup">
            <div class="popup__overlay" data-close-service></div>
            <div class="popup__container popup__container--service">
                <button class="popup__close" data-close-service aria-label="Закрыть">&times;</button>
                <div id="service-popup-content"></div>
            </div>
        </div>`;

    document.getElementById('lead-form').addEventListener('submit', onLeadSubmit);
    initLeadForm();
}

function renderFloats() {
    const root = document.getElementById('float-root') || (() => {
        const el = document.createElement('div');
        el.id = 'float-root';
        document.body.appendChild(el);
        return el;
    })();

    root.innerHTML = `
        <div class="float-dock" id="float-dock" hidden>
            <button type="button" class="float-book" data-open-popup>Записаться</button>
            <button type="button" class="scroll-top" id="scroll-top" aria-label="Наверх">
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="currentColor" d="M12 4.5l7 7-1.4 1.4L13 8.3V20h-2V8.3L6.4 12.9 5 11.5l7-7z"/>
                </svg>
            </button>
        </div>
        <div class="mobile-cta">
            <button type="button" class="btn btn--accent" data-open-popup>Записаться</button>
        </div>`;

    if (window.innerWidth <= 768) document.body.classList.add('has-mobile-cta');
    initScrollTop();
}

function initScrollTop() {
    const dock = document.getElementById('float-dock');
    const btn = document.getElementById('scroll-top');
    if (!dock || !btn) return;

    const toggle = () => {
        const show = window.scrollY > 400;
        dock.hidden = !show;
        dock.classList.toggle('is-visible', show);
    };

    btn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    window.addEventListener('scroll', toggle, { passive: true });
    toggle();
}

/* --------------------------------------------------------------------------
   Попапы
   -------------------------------------------------------------------------- */

let currentOpenPopup = null;

function bindPopup() {
    const popup = document.getElementById('lead-popup');
    const policy = document.getElementById('policy-popup');
    const servicePopup = document.getElementById('service-popup');

    document.addEventListener('click', e => {
        const expandNav = e.target.closest('[data-expand-service]');
        if (expandNav) {
            const id = expandNav.dataset.expandService;
            const onIndex = document.body.dataset.page === 'index';
            if (onIndex) {
                e.preventDefault();
                openServiceById(id);
                const burger = document.getElementById('burger');
                const navEl = document.getElementById('nav');
                if (burger?.classList.contains('is-open')) {
                    burger.classList.remove('is-open');
                    navEl?.classList.remove('is-open');
                    document.body.classList.remove('nav-open');
                }
            }
            return;
        }

        const openServiceBtn = e.target.closest('[data-toggle-service], [data-open-service]');
        if (openServiceBtn) {
            e.preventDefault();
            const id = openServiceBtn.getAttribute('data-toggle-service')
                || openServiceBtn.getAttribute('data-open-service');
            openServiceById(id);
            return;
        }

        const openBtn = e.target.closest('[data-open-popup]');
        if (openBtn) {
            closeCalendarPopup();
            closePopup();
            const promo = openBtn.dataset.promo;
            const service = openBtn.dataset.service;
            if (promo) selectLeadPromo(promo);
            if (service) selectLeadService(service);
            openPopup(document.getElementById('lead-popup'));
            return;
        }
        if (e.target.closest('[data-open-policy]')) {
            closeCalendarPopup();
            openPopup(document.getElementById('policy-popup'));
        }
        if (e.target.closest('[data-close-calendar]')) {
            closeCalendarPopup();
            return;
        }
        if (e.target.closest('[data-close-popup]')) {
            closeCalendarPopup();
            closePopup();
        }
        if (e.target.closest('[data-close-policy]')) closePopup();
        if (e.target.closest('[data-close-service]')) closePopup();
    });

    document.addEventListener('keydown', e => {
        if (e.key !== 'Escape') return;
        const calendar = document.getElementById('calendar-popup');
        if (calendar?.classList.contains('is-open')) {
            closeCalendarPopup();
            return;
        }
        closePopup();
    });
}

function openServicePopup(service) {
    const content = document.getElementById('service-popup-content');
    const popup = document.getElementById('service-popup');
    if (!content || !popup || !service) return;

    content.innerHTML = `
        <div class="service-popup">
            <header class="service-popup__head">
                <p class="service-popup__eyebrow">Услуга</p>
                <h2 class="popup__title service-popup__title">${service.title}</h2>
                <div class="grotesk-rule service-popup__rule" aria-hidden="true"></div>
                <p class="popup__subtitle service-popup__desc">${service.shortDesc}</p>
            </header>
            <div class="service-popup__body">
                ${renderServicePopupBody(service)}
            </div>
            <footer class="service-popup__actions">
                <button type="button" class="btn btn--accent service-popup__cta" data-open-popup data-service="${service.title}">Записаться</button>
            </footer>
        </div>`;

    initServicePopupScroll(content);
    openPopup(popup);
}

function initServicePopupScroll(root) {
    const api = window.OverlayScrollbarsGlobal;
    if (!api?.OverlayScrollbars || !root) return;

    root.querySelectorAll('[data-os-scroll]').forEach(el => {
        api.OverlayScrollbars(el, {
            overflow: { x: 'hidden', y: 'scroll' },
            scrollbars: {
                theme: 'os-theme-mistudio',
                autoHide: 'leave',
                autoHideDelay: 600
            }
        });
    });
}

function openServiceById(id) {
    const service = SERVICES.find(s => s.id === id);
    if (service) openServicePopup(service);
}

function openPopup(popup) {
    currentOpenPopup = popup;
    popup.classList.add('is-open');
    document.body.style.overflow = 'hidden';
}

function closePopup() {
    if (!currentOpenPopup) return;
    currentOpenPopup.classList.remove('is-open');
    currentOpenPopup = null;
    document.body.style.overflow = '';
}

/* --------------------------------------------------------------------------
   Форма записи: контакты, услуги, календарь, маски
   -------------------------------------------------------------------------- */

function applyMask(digits, mask) {
    let out = '';
    let di = 0;
    for (let i = 0; i < mask.length && di < digits.length; i++) {
        if (mask[i] === '#') {
            out += digits[di++];
        } else {
            out += mask[i];
            if (digits[di] === mask[i]) di++;
        }
    }
    return out;
}

function maskPlaceholder(mask) {
    return mask.replace(/#/g, '_');
}

function onlyDigits(value) {
    return String(value || '').replace(/\D/g, '');
}

function setPhoneCountry(code) {
    const country = PHONE_COUNTRIES.find(c => c.code === code) || PHONE_COUNTRIES[0];
    leadFormState.country = country;
    const flag = document.getElementById('phone-flag');
    const dial = document.getElementById('phone-dial');
    const btn = document.getElementById('phone-country-btn');
    const input = document.getElementById('lead-phone');
    if (flag) {
        flag.src = flagUrl(country.iso);
        flag.alt = country.name;
    }
    if (dial) dial.textContent = '+' + country.dial;
    if (btn) btn.setAttribute('aria-label', `${country.name} +${country.dial}`);
    document.querySelectorAll('.phone-dd__item').forEach(el => {
        el.classList.toggle('is-active', el.dataset.country === country.code);
    });
    if (input) {
        input.placeholder = maskPlaceholder(country.mask);
        const digits = onlyDigits(input.value).slice(0, country.len);
        input.value = applyMask(digits, country.mask);
    }
    closePhoneCountryDd();
}

function openPhoneCountryDd() {
    const dd = document.getElementById('phone-country-dd');
    const btn = document.getElementById('phone-country-btn');
    if (!dd || !btn) return;
    dd.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
}

function closePhoneCountryDd() {
    const dd = document.getElementById('phone-country-dd');
    const btn = document.getElementById('phone-country-btn');
    if (!dd || !btn) return;
    dd.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
}

function setContactType(type) {
    leadFormState.contactType = type;
    document.querySelectorAll('.contact-tabs__btn').forEach(btn => {
        const active = btn.dataset.contactType === type;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    document.querySelectorAll('.contact-pane').forEach(pane => {
        const active = pane.dataset.pane === type;
        pane.classList.toggle('is-active', active);
        pane.hidden = !active;
    });
}

function formatEmailInput(raw) {
    let value = String(raw || '').replace(/\s+/g, '').toLowerCase();
    value = value.replace(/[^a-z0-9.@_+-]/g, '');
    const at = value.indexOf('@');
    if (at !== -1) {
        const local = value.slice(0, at).replace(/@/g, '');
        let domain = value.slice(at + 1).replace(/@/g, '');
        domain = domain.replace(/^\.+/, '');
        value = local + '@' + domain;
    }
    return value.slice(0, 80);
}

function formatTelegramInput(raw) {
    let value = String(raw || '').replace(/^@+/, '');
    value = value.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 32);
    return value;
}

function isValidEmail(value) {
    return /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(value);
}

function isValidTelegram(value) {
    return /^[a-zA-Z][a-zA-Z0-9_]{4,31}$/.test(value);
}

function isValidPhone() {
    const digits = onlyDigits(document.getElementById('lead-phone')?.value);
    return digits.length === leadFormState.country.len;
}

function getFullPhone() {
    const local = onlyDigits(document.getElementById('lead-phone')?.value);
    const formatted = document.getElementById('lead-phone')?.value || '';
    return {
        value: '+' + leadFormState.country.dial + local,
        display: '+' + leadFormState.country.dial + ' ' + formatted
    };
}

function getContactsPayload() {
    const phone = getFullPhone();
    const emailRaw = (document.getElementById('lead-email')?.value || '').trim();
    const tgRaw = formatTelegramInput(document.getElementById('lead-telegram')?.value || '');

    const parts = [phone.display];
    const email = emailRaw || '';
    const telegram = tgRaw ? '@' + tgRaw : '';

    if (email) parts.push(email);
    if (telegram) parts.push(telegram);

    return {
        phone: phone.value,
        phone_display: phone.display,
        email,
        telegram,
        contacts: parts.join(', ')
    };
}

function renderServiceBadges() {
    const wrap = document.getElementById('msel-badges');
    const placeholder = document.getElementById('msel-placeholder');
    if (!wrap || !placeholder) return;
    wrap.innerHTML = leadFormState.services.map(title => `
        <span class="msel__badge">
            <span>${title}</span>
            <button type="button" class="msel__badge-x" data-remove-service="${title}" aria-label="Убрать ${title}">&times;</button>
        </span>`).join('');
    placeholder.textContent = leadFormState.services.length
        ? `Выбрано: ${leadFormState.services.length}`
        : 'Выберите услуги';
    document.querySelectorAll('#msel-dropdown input[type="checkbox"]').forEach(cb => {
        cb.checked = leadFormState.services.includes(cb.value);
    });
}

function promoLabel(title) {
    const promo = PROMOS.find(p => p.title === title);
    return promo ? `${promo.badge} · ${promo.title}` : title;
}

function syncPromosField() {
    const field = document.getElementById('lead-promos-field');
    if (!field) return;
    field.hidden = leadFormState.promos.length === 0;
}

function renderPromoBadges() {
    const wrap = document.getElementById('promo-badges');
    if (!wrap) return;
    wrap.innerHTML = leadFormState.promos.map(title => `
        <span class="msel__badge msel__badge--promo">
            <span>${promoLabel(title)}</span>
            <button type="button" class="msel__badge-x" data-remove-promo="${title}" aria-label="Убрать акцию ${title}">&times;</button>
        </span>`).join('');
    syncPromosField();
}

function toggleLeadService(title, force) {
    const set = new Set(leadFormState.services);
    const on = force === undefined ? !set.has(title) : !!force;
    if (on) set.add(title);
    else set.delete(title);
    leadFormState.services = Array.from(set);
    renderServiceBadges();
}

function selectLeadService(title) {
    if (!title) return;
    toggleLeadService(title, true);
}

function toggleLeadPromo(title, force) {
    if (!title) return;
    const set = new Set(leadFormState.promos);
    const on = force === undefined ? !set.has(title) : !!force;
    if (on) set.add(title);
    else set.delete(title);
    leadFormState.promos = Array.from(set);
    renderPromoBadges();
}

function selectLeadPromo(title) {
    if (!title) return;
    toggleLeadPromo(title, true);
}

function openMsel() {
    const dd = document.getElementById('msel-dropdown');
    const trigger = document.getElementById('msel-trigger');
    if (!dd || !trigger) return;
    dd.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    trigger.classList.add('is-open');
}

function closeMsel() {
    const dd = document.getElementById('msel-dropdown');
    const trigger = document.getElementById('msel-trigger');
    if (!dd || !trigger) return;
    dd.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    trigger.classList.remove('is-open');
}

function pad2(n) {
    return String(n).padStart(2, '0');
}

function toDateKey(date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function formatDateRu(date) {
    return `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}.${date.getFullYear()}`;
}

function parseDateKey(key) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d);
}

function sortDateKeys(keys) {
    return [...keys].sort();
}

function renderDateBadges() {
    const wrap = document.getElementById('dtp-badges');
    const display = document.getElementById('dtp-display');
    if (!wrap || !display) return;

    const sorted = sortDateKeys(leadFormState.dates);
    wrap.innerHTML = sorted.map(key => {
        const label = formatDateRu(parseDateKey(key));
        return `
        <span class="dtp__badge">
            <span>${label}</span>
            <button type="button" class="dtp__badge-x" data-remove-date="${key}" aria-label="Убрать ${label}">&times;</button>
        </span>`;
    }).join('');

    display.textContent = sorted.length
        ? `Выбрано: ${sorted.length}`
        : 'Выберите даты';
    display.classList.toggle('is-filled', sorted.length > 0);
}

function toggleLeadDate(key, force) {
    const set = new Set(leadFormState.dates);
    const on = force === undefined ? !set.has(key) : !!force;
    if (on) set.add(key);
    else set.delete(key);
    leadFormState.dates = sortDateKeys(Array.from(set));
    renderDateBadges();
    renderDatePicker();
}

function isSameDay(a, b) {
    return a && b &&
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate();
}

function startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function renderDatePicker() {
    const now = new Date();
    if (leadFormState.viewYear == null) {
        leadFormState.viewYear = now.getFullYear();
        leadFormState.viewMonth = now.getMonth();
    }

    const monthEl = document.getElementById('dtp-month');
    const daysEl = document.getElementById('dtp-days');
    if (!monthEl || !daysEl) return;

    monthEl.textContent = `${MONTHS_RU[leadFormState.viewMonth]} ${leadFormState.viewYear}`;

    const first = new Date(leadFormState.viewYear, leadFormState.viewMonth, 1);
    let startWeekday = first.getDay() - 1;
    if (startWeekday < 0) startWeekday = 6;
    const daysInMonth = new Date(leadFormState.viewYear, leadFormState.viewMonth + 1, 0).getDate();
    const today = startOfDay(now);
    const selected = new Set(leadFormState.dates);

    let html = '';
    for (let i = 0; i < startWeekday; i++) html += '<span class="dtp__day is-empty"></span>';
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(leadFormState.viewYear, leadFormState.viewMonth, day);
        const key = toDateKey(date);
        const disabled = startOfDay(date) < today;
        const isSelected = selected.has(key);
        const isToday = isSameDay(date, today);
        html += `<button type="button" class="dtp__day${isSelected ? ' is-selected' : ''}${isToday ? ' is-today' : ''}" data-date="${key}" ${disabled ? 'disabled' : ''}>${day}</button>`;
    }
    daysEl.innerHTML = html;
}

function openCalendarPopup() {
    const calendar = document.getElementById('calendar-popup');
    const trigger = document.getElementById('dtp-trigger');
    if (!calendar) return;
    renderDatePicker();
    calendar.classList.add('is-open');
    trigger?.setAttribute('aria-expanded', 'true');
    trigger?.classList.add('is-open');
}

function closeCalendarPopup() {
    const calendar = document.getElementById('calendar-popup');
    const trigger = document.getElementById('dtp-trigger');
    if (!calendar) return;
    calendar.classList.remove('is-open');
    trigger?.setAttribute('aria-expanded', 'false');
    trigger?.classList.remove('is-open');
    renderDateBadges();
}

function initLeadForm() {
    const phoneInput = document.getElementById('lead-phone');
    const emailInput = document.getElementById('lead-email');
    const tgInput = document.getElementById('lead-telegram');

    setPhoneCountry('RU');
    setContactType('phone');
    renderServiceBadges();
    renderPromoBadges();
    renderDateBadges();
    closeCalendarPopup();

    document.querySelectorAll('.contact-tabs__btn').forEach(btn => {
        btn.addEventListener('click', () => setContactType(btn.dataset.contactType));
    });

    document.getElementById('phone-country-btn')?.addEventListener('click', e => {
        e.stopPropagation();
        const dd = document.getElementById('phone-country-dd');
        if (dd?.hidden) openPhoneCountryDd();
        else closePhoneCountryDd();
    });

    document.querySelectorAll('.phone-dd__item').forEach(item => {
        item.addEventListener('click', () => setPhoneCountry(item.dataset.country));
    });

    phoneInput?.addEventListener('input', () => {
        const digits = onlyDigits(phoneInput.value).slice(0, leadFormState.country.len);
        phoneInput.value = applyMask(digits, leadFormState.country.mask);
    });

    emailInput?.addEventListener('input', () => {
        emailInput.value = formatEmailInput(emailInput.value);
    });

    tgInput?.addEventListener('input', () => {
        tgInput.value = formatTelegramInput(tgInput.value);
    });

    document.getElementById('msel-trigger')?.addEventListener('click', e => {
        e.stopPropagation();
        const dd = document.getElementById('msel-dropdown');
        if (dd?.hidden) openMsel();
        else closeMsel();
    });

    document.getElementById('msel-done')?.addEventListener('click', e => {
        e.stopPropagation();
        closeMsel();
    });

    document.getElementById('msel-dropdown')?.addEventListener('change', e => {
        const cb = e.target.closest('input[type="checkbox"]');
        if (!cb) return;
        toggleLeadService(cb.value, cb.checked);
    });

    document.getElementById('msel-badges')?.addEventListener('click', e => {
        const btn = e.target.closest('[data-remove-service]');
        if (!btn) return;
        toggleLeadService(btn.dataset.removeService, false);
    });

    document.getElementById('promo-badges')?.addEventListener('click', e => {
        const btn = e.target.closest('[data-remove-promo]');
        if (!btn) return;
        toggleLeadPromo(btn.dataset.removePromo, false);
    });

    document.getElementById('dtp-trigger')?.addEventListener('click', e => {
        e.stopPropagation();
        closePhoneCountryDd();
        closeMsel();
        const calendar = document.getElementById('calendar-popup');
        if (calendar?.classList.contains('is-open')) closeCalendarPopup();
        else openCalendarPopup();
    });

    document.getElementById('dtp-prev')?.addEventListener('click', e => {
        e.stopPropagation();
        leadFormState.viewMonth -= 1;
        if (leadFormState.viewMonth < 0) {
            leadFormState.viewMonth = 11;
            leadFormState.viewYear -= 1;
        }
        renderDatePicker();
    });

    document.getElementById('dtp-next')?.addEventListener('click', e => {
        e.stopPropagation();
        leadFormState.viewMonth += 1;
        if (leadFormState.viewMonth > 11) {
            leadFormState.viewMonth = 0;
            leadFormState.viewYear += 1;
        }
        renderDatePicker();
    });

    document.getElementById('dtp-days')?.addEventListener('click', e => {
        e.stopPropagation();
        const btn = e.target.closest('[data-date]');
        if (!btn || btn.disabled) return;
        toggleLeadDate(btn.dataset.date);
    });

    document.getElementById('dtp-badges')?.addEventListener('click', e => {
        const btn = e.target.closest('[data-remove-date]');
        if (!btn) return;
        toggleLeadDate(btn.dataset.removeDate, false);
    });

    document.addEventListener('click', e => {
        if (!e.target.closest('.phone-country')) closePhoneCountryDd();
        if (!e.target.closest('.msel')) closeMsel();
    });
}

function resetLeadForm() {
    const form = document.getElementById('lead-form');
    form?.reset();
    leadFormState.contactType = 'phone';
    leadFormState.country = PHONE_COUNTRIES[0];
    leadFormState.services = [];
    leadFormState.promos = [];
    leadFormState.dates = [];
    setPhoneCountry('RU');
    setContactType('phone');
    renderServiceBadges();
    renderPromoBadges();
    renderDateBadges();
    closeMsel();
    closeCalendarPopup();
    closePhoneCountryDd();
}

/* --------------------------------------------------------------------------
   Заявки: единая точка входа (задел на v2.0)
   -------------------------------------------------------------------------- */

async function submitLead(formData) {
    const payload = {
        ...formData,
        source: 'website',
        version: '1.0'
    };

    if (CONFIG.leadWebhookUrl) {
        try {
            const res = await fetch(CONFIG.leadWebhookUrl, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const j = await res.json().catch(() => null);
            if (j && j.ok === false) return { ok: false, reason: j.error || 'server' };
            return { ok: true };
        } catch (e) {
            console.error('submitLead:', e);
            return { ok: false, reason: 'network' };
        }
    }

    console.log('[submitLead] webhook не настроен, заявка:', payload);
    return { ok: true, dev: true };
}

function onLeadSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const status = document.getElementById('lead-status');

    const hp = document.getElementById('lead-hp');
    if (hp && hp.value.trim() !== '') {
        status.className = 'form__status is-show form__status--ok';
        status.textContent = 'Спасибо! Заявка отправлена — мы свяжемся с вами.';
        resetLeadForm();
        return;
    }
    if (Date.now() - spamGuard.createdMs < 2500) {
        status.className = 'form__status is-show form__status--err';
        status.textContent = 'Форма ещё загружается. Попробуйте ещё раз.';
        return;
    }
    if (Date.now() - spamGuard.lastSentMs < 30000) {
        status.className = 'form__status is-show form__status--err';
        status.textContent = 'Слишком много заявок подряд — подождите полминуты.';
        return;
    }
    if (getSessionLeadCount() >= 5) {
        status.className = 'form__status is-show form__status--err';
        status.textContent = 'Достигнут лимит заявок в этой сессии. Позвоните нам.';
        return;
    }

    const name = (form.name?.value || '').trim();
    const comment = (form.comment?.value || '').trim();
    const contacts = getContactsPayload();
    const emailRaw = (document.getElementById('lead-email')?.value || '').trim();
    const tgRaw = formatTelegramInput(document.getElementById('lead-telegram')?.value || '');

    if (!name) {
        status.className = 'form__status is-show form__status--err';
        status.textContent = 'Укажите имя.';
        return;
    }

    if (!isValidPhone()) {
        status.className = 'form__status is-show form__status--err';
        status.textContent = 'Введите корректный номер телефона.';
        return;
    }

    if (emailRaw && !isValidEmail(emailRaw)) {
        status.className = 'form__status is-show form__status--err';
        status.textContent = 'Проверьте адрес почты или очистите поле.';
        return;
    }

    if (tgRaw && !isValidTelegram(tgRaw)) {
        status.className = 'form__status is-show form__status--err';
        status.textContent = 'Проверьте Telegram (@username, от 5 символов) или очистите поле.';
        return;
    }

    if (!leadFormState.services.length) {
        status.className = 'form__status is-show form__status--err';
        status.textContent = 'Выберите хотя бы одну услугу.';
        return;
    }

    if (!leadFormState.dates.length) {
        status.className = 'form__status is-show form__status--err';
        status.textContent = 'Выберите хотя бы одну дату.';
        return;
    }

    const datesDisplay = sortDateKeys(leadFormState.dates)
        .map(key => formatDateRu(parseDateKey(key)))
        .join(', ');

    const data = {
        name,
        contacts: contacts.contacts,
        phone: contacts.phone,
        email: contacts.email,
        telegram: contacts.telegram,
        services: [...leadFormState.services],
        service: leadFormState.services.join(', '),
        promos: [...leadFormState.promos],
        promo: leadFormState.promos.join(', '),
        visit_dates: [...leadFormState.dates],
        visit_dates_display: datesDisplay,
        comment
    };

    status.className = 'form__status is-show form__status--ok';
    status.textContent = 'Отправляем...';

    submitLead(data).then(res => {
        if (res.ok) {
            spamGuard.lastSentMs = Date.now();
            bumpSessionLeadCount();
            status.className = 'form__status is-show form__status--ok';
            status.textContent = res.dev
                ? 'Заявка сформирована (debug — вебхук не настроен).'
                : 'Спасибо! Заявка отправлена — мы свяжемся с вами.';
            resetLeadForm();
        } else {
            status.className = 'form__status is-show form__status--err';
            if (res.reason === 'rate' || res.reason === 'daily') {
                status.textContent = 'На сервере перебор заявок. Попробуйте через несколько минут.';
            } else {
                status.textContent = 'Не удалось отправить. Попробуйте ещё раз или позвоните нам.';
            }
        }
    });
}

/* --------------------------------------------------------------------------
   Карусель
   -------------------------------------------------------------------------- */

function initCarousel(root) {
    const track = root.querySelector('.carousel__track');
    const slides = root.querySelectorAll('.carousel__slide');
    const dotsWrap = root.querySelector('.carousel__dots');
    if (!track || slides.length < 2) return;

    let index = 0;
    const count = slides.length;

    slides.forEach((_, i) => {
        const dot = document.createElement('button');
        dot.className = 'carousel__dot' + (i === 0 ? ' is-active' : '');
        dot.setAttribute('aria-label', 'Слайд ' + (i + 1));
        dot.addEventListener('click', () => go(i));
        dotsWrap.appendChild(dot);
    });

    const dots = dotsWrap.querySelectorAll('.carousel__dot');

    function go(i) {
        index = (i + count) % count;
        track.style.transform = `translateX(-${index * 100}%)`;
        dots.forEach((d, j) => d.classList.toggle('is-active', j === index));
    }

    const prev = root.querySelector('.carousel__btn--prev');
    const next = root.querySelector('.carousel__btn--next');
    if (prev) prev.addEventListener('click', e => { e.stopPropagation(); go(index - 1); });
    if (next) next.addEventListener('click', e => { e.stopPropagation(); go(index + 1); });

    let touchX = null;
    root.addEventListener('touchstart', e => { touchX = e.touches[0].clientX; }, { passive: true });
    root.addEventListener('touchend', e => {
        if (touchX === null) return;
        const dx = e.changedTouches[0].clientX - touchX;
        if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
        touchX = null;
    }, { passive: true });
}

/* --------------------------------------------------------------------------
   Страница «Услуги»
   -------------------------------------------------------------------------- */

function renderServiceCard(service) {
    const slides = service.images.map(src =>
        `<div class="carousel__slide"><img src="${src}" alt="${service.title}" loading="lazy"></div>`).join('');

    const masters = service.masters.map(m =>
        `<div class="master-pill"><strong>${m.name}</strong><span>${m.desc}</span></div>`).join('');

    const price = service.price.map((block, bi) => `
        <details class="price-acc" ${bi === 0 ? 'open' : ''}>
            <summary class="price-acc__head">${block.section}</summary>
            <div class="price-acc__body">
                ${block.items.map(it => `
                    <div class="price-row">
                        <div class="price-row__info">
                            <span class="price-row__name">${it.name}</span>
                            ${it.meta ? `<span class="price-row__meta">${it.meta}</span>` : ''}
                        </div>
                        <div class="price-row__dots"></div>
                        <span class="price-row__price">${it.price}</span>
                    </div>`).join('')}
            </div>
        </details>`).join('');

    const contacts = [
        service.phone ? `<a href="tel:+${service.phone.replace(/[^0-9]/g, '')}">${service.phoneDisplay}</a>` : '',
        `<a href="${service.vk}" target="_blank" rel="noopener">VK</a>`,
        `<a href="${service.tg}" target="_blank" rel="noopener">Telegram</a>`
    ].filter(Boolean).join('');

    return `
        <article class="detail-card" id="${service.id}">
            <div class="carousel">
                <div class="carousel__track">${slides}</div>
                <button class="carousel__btn carousel__btn--prev" aria-label="Предыдущий">&#10094;</button>
                <button class="carousel__btn carousel__btn--next" aria-label="Следующий">&#10095;</button>
                <div class="carousel__dots"></div>
            </div>
            <div class="detail-card__head">
                <h2 class="detail-card__title">${service.title}</h2>
                <div class="masters">${masters}</div>
            </div>
            <div class="detail-card__price">${price}</div>
            <div class="detail-card__actions">
                <button class="btn btn--accent" data-open-popup data-service="${service.title}">Оставить заявку</button>
                <a class="btn btn--outline" href="${CONFIG.dikidiUrl}" target="_blank" rel="noopener">Записаться онлайн</a>
            </div>
            <div class="detail-card__contacts">${contacts}</div>
        </article>`;
}

function renderServicesPage() {
    const wrap = document.getElementById('services-list');
    if (!wrap) return;
    wrap.innerHTML = SERVICES.map(renderServiceCard).join('');
    document.querySelectorAll('.carousel').forEach(initCarousel);
    scrollToHash();
}

/* --------------------------------------------------------------------------
   Главная
   -------------------------------------------------------------------------- */

function renderPromos() {
    const wrap = document.getElementById('promos-list');
    if (!wrap) return;

    const pieces = PROMOS.flatMap(p => {
        const item = `
            <article class="promo-card">
                <span class="promo-card__shine" aria-hidden="true"></span>
                <span class="promo-card__top">
                    <span class="promo-card__badge">${p.badge}</span>
                    <span class="promo-card__tag">${p.tag}</span>
                </span>
                <span class="promo-card__title">${p.title}</span>
                <span class="promo-card__desc">${p.desc}</span>
                <span class="promo-card__footer">
                    <span class="promo-card__note">${p.note}</span>
                    <button type="button" class="promo-card__cta" data-open-popup data-promo="${p.title}">ДОБАВИТЬ</button>
                </span>
            </article>`;
        return [item];
    }).join('');

    wrap.innerHTML = `
        <div class="promo-marquee__track">
            ${pieces}
            ${pieces}
        </div>`;

    initPromoMarquee(wrap);
}

function initPromoMarquee(viewport) {
    const track = viewport.querySelector('.promo-marquee__track');
    if (!track) return;

    let offset = 0;
    let paused = false;
    let dragging = false;
    let pointerActive = false;
    let startX = 0;
    let startOffset = 0;
    let moved = false;
    let raf = 0;
    const speed = 0.45;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function halfWidth() {
        return track.scrollWidth / 2;
    }

    function apply() {
        const half = halfWidth() || 1;
        offset = ((offset % half) + half) % half;
        track.style.transform = `translateX(${-offset}px)`;
    }

    function tick() {
        if (!paused && !dragging && !reduceMotion) {
            offset += speed;
            apply();
        }
        raf = requestAnimationFrame(tick);
    }

    viewport.addEventListener('pointerdown', e => {
        if (e.button !== 0) return;
        pointerActive = true;
        dragging = false;
        moved = false;
        paused = true;
        startX = e.clientX;
        startOffset = offset;
    });

    viewport.addEventListener('pointermove', e => {
        if (!pointerActive) return;
        const dx = e.clientX - startX;
        if (!dragging && Math.abs(dx) > 8) {
            dragging = true;
            moved = true;
            viewport.classList.add('is-grabbing');
            try { viewport.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
        }
        if (!dragging) return;
        e.preventDefault();
        offset = startOffset - dx;
        apply();
    });

    function endDrag(e) {
        if (!pointerActive) return;
        pointerActive = false;
        const wasDrag = moved;
        dragging = false;
        viewport.classList.remove('is-grabbing');
        try { viewport.releasePointerCapture(e.pointerId); } catch (_) { /* ignore */ }

        if (wasDrag) {
            const blocker = ev => {
                ev.preventDefault();
                ev.stopPropagation();
                track.removeEventListener('click', blocker, true);
            };
            track.addEventListener('click', blocker, true);
        }

        setTimeout(() => { paused = false; }, 900);
    }

    viewport.addEventListener('pointerup', endDrag);
    viewport.addEventListener('pointercancel', endDrag);
    viewport.addEventListener('pointerleave', () => {
        if (!pointerActive) paused = false;
    });
    viewport.addEventListener('mouseenter', () => { if (!dragging) paused = true; });
    viewport.addEventListener('mouseleave', () => { if (!pointerActive) paused = false; });

    if (!reduceMotion) raf = requestAnimationFrame(tick);
    else apply();

    window.addEventListener('beforeunload', () => cancelAnimationFrame(raf), { once: true });
}

function renderServicePreviews() {
    const wrap = document.getElementById('services-preview');
    if (!wrap) return;

    wrap.innerHTML = SERVICES.map(s => `
        <button type="button" class="service-card card-3d-host" data-toggle-service="${s.id}">
            <div class="card-3d__face">
                <div class="card-3d__shine" aria-hidden="true"></div>
                <div class="service-card__media">
                    <img src="${s.images[0]}" alt="${s.title}" loading="lazy" draggable="false">
                </div>
                <div class="service-card__body">
                    <div class="service-card__title">${s.title}</div>
                    <div class="service-card__desc">${s.shortDesc}</div>
                    <span class="service-card__more">Подробнее &rarr;</span>
                </div>
            </div>
        </button>`).join('');

    wrap.querySelectorAll('[data-toggle-service]').forEach(btn => {
        btn.addEventListener('click', e => {
            e.preventDefault();
            e.stopPropagation();
            openServiceById(btn.getAttribute('data-toggle-service'));
        });
    });

    initArrowRail('services-rail', 'services-preview', '.service-card');
    initCardTilt(wrap, '.card-3d-host');
}

function splitMasterName(fullName) {
    const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 3) {
        return { surname: parts[0], given: parts.slice(1).join(' ') };
    }
    if (parts.length === 2) {
        return { surname: parts[0], given: parts[1] };
    }
    return { surname: '', given: parts[0] || '' };
}

function masterInitials(fullName) {
    const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return (parts[0] || '?').slice(0, 2).toUpperCase();
}

function renderServicePopupBody(service) {
    const masters = service.masters.map(m => {
        const { surname, given } = splitMasterName(m.name);
        const photo = m.photo
            ? `<img class="master-card__img" src="${m.photo}" alt="${m.name}" loading="lazy">`
            : `<span class="master-card__initials">${masterInitials(m.name)}</span>`;

        return `
            <article class="master-card">
                <div class="master-card__photo">${photo}</div>
                <div class="master-card__body">
                    ${surname ? `<p class="master-card__surname">${surname}</p>` : ''}
                    <h4 class="master-card__name">${given || m.name}</h4>
                    <p class="master-card__desc">${m.desc}</p>
                </div>
            </article>`;
    }).join('');

    const price = service.price.map((block, bi) => `
        <details class="price-sheet" ${bi === 0 ? 'open' : ''}>
            <summary class="price-sheet__head">
                <span>${block.section}</span>
                <span class="price-sheet__count">${block.items.length}</span>
            </summary>
            <div class="price-sheet__body">
                ${block.items.map(it => `
                    <div class="price-sheet__row">
                        <div class="price-sheet__info">
                            <span class="price-sheet__name">${it.name}</span>
                            ${it.meta ? `<span class="price-sheet__meta">${it.meta}</span>` : ''}
                        </div>
                        <span class="price-sheet__price">${it.price}</span>
                    </div>`).join('')}
            </div>
        </details>`).join('');

    return `
        <div class="service-popup__grid">
            <div class="service-popup__col service-popup__col--masters">
                <h4 class="service-popup__label">Мастера</h4>
                <div class="master-cards" data-os-scroll>${masters}</div>
            </div>
            <div class="service-popup__col service-popup__col--price">
                <h4 class="service-popup__label">Прайс-лист</h4>
                <div class="price-sheets" data-os-scroll>${price}</div>
            </div>
        </div>`;
}

function expandHomeService(id) {
    openServiceById(id);
}

function initCardTilt(root, selector) {
    if (!root) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;

    function resetTilt(face) {
        face.style.setProperty('--tilt-x', '0deg');
        face.style.setProperty('--tilt-y', '0deg');
        face.style.setProperty('--tilt-lift', '0px');
        face.classList.remove('is-tilting');
    }

    root.querySelectorAll(selector).forEach(host => {
        const face = host.querySelector('.card-3d__face');
        if (!face) return;

        host.addEventListener('pointerenter', () => {
            host._tiltRect = host.getBoundingClientRect();
        });

        host.addEventListener('pointermove', e => {
            const rail = host.closest('[id$="-rail"]');
            if (rail?.dataset.dragged === '1') return;

            const rect = host._tiltRect || host.getBoundingClientRect();
            if (!host._tiltRect) host._tiltRect = rect;

            const x = Math.max(-0.5, Math.min(0.5, (e.clientX - rect.left) / rect.width - 0.5));
            const y = Math.max(-0.5, Math.min(0.5, (e.clientY - rect.top) / rect.height - 0.5));

            face.style.setProperty('--tilt-x', `${(-y * 6).toFixed(2)}deg`);
            face.style.setProperty('--tilt-y', `${(x * 8).toFixed(2)}deg`);
            face.style.setProperty('--tilt-lift', '-4px');
            face.style.setProperty('--shine-x', `${(x + 0.5) * 100}%`);
            face.style.setProperty('--shine-y', `${(y + 0.5) * 100}%`);
            face.classList.add('is-tilting');
        });

        host.addEventListener('pointerleave', () => {
            host._tiltRect = null;
            resetTilt(face);
        });
    });
}

function initArrowRail(railId, trackId, cardSelector) {
    const rail = document.getElementById(railId);
    const viewport = rail?.querySelector('[class*="__viewport"]');
    const track = document.getElementById(trackId);
    const prevBtn = rail?.querySelector('[data-rail-prev]');
    const nextBtn = rail?.querySelector('[data-rail-next]');
    if (!rail || !viewport || !track || !prevBtn || !nextBtn) return;

    let offset = 0;
    let dragging = false;
    let pointerActive = false;
    let startX = 0;
    let startOffset = 0;
    let pointerId = null;
    const DRAG_THRESHOLD = 10;

    function cardStep() {
        const card = track.querySelector(cardSelector);
        if (!card) return 300;
        const gap = parseFloat(getComputedStyle(track).gap) || 20;
        return card.getBoundingClientRect().width + gap;
    }

    function maxOffset() {
        return Math.max(0, track.scrollWidth - viewport.clientWidth);
    }

    function updateButtons() {
        const max = maxOffset();
        prevBtn.disabled = offset <= 2;
        nextBtn.disabled = offset >= max - 2;
        prevBtn.classList.toggle('is-disabled', prevBtn.disabled);
        nextBtn.classList.toggle('is-disabled', nextBtn.disabled);
    }

    function apply(instant) {
        offset = Math.max(0, Math.min(offset, maxOffset()));
        track.classList.toggle('is-instant', !!instant);
        track.style.transform = `translateX(${-offset}px)`;
        updateButtons();
    }

    function move(dir) {
        offset += dir * cardStep();
        apply(false);
    }

    prevBtn.addEventListener('click', e => {
        e.stopPropagation();
        move(-1);
    });
    nextBtn.addEventListener('click', e => {
        e.stopPropagation();
        move(1);
    });

    viewport.addEventListener('pointerdown', e => {
        if (e.button !== 0) return;
        if (e.target.closest('.rail-arrow')) return;
        pointerActive = true;
        dragging = false;
        pointerId = e.pointerId;
        startX = e.clientX;
        startOffset = offset;
        rail.dataset.dragged = '0';
    });

    viewport.addEventListener('pointermove', e => {
        if (!pointerActive || e.pointerId !== pointerId) return;
        const dx = e.clientX - startX;

        if (!dragging) {
            if (Math.abs(dx) < DRAG_THRESHOLD) return;
            dragging = true;
            rail.dataset.dragged = '1';
            viewport.classList.add('is-dragging');
            try { viewport.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
        }

        offset = startOffset - dx;
        apply(true);
    });

    function endDrag(e) {
        if (!pointerActive || (e && e.pointerId !== pointerId)) return;
        pointerActive = false;

        if (dragging) {
            dragging = false;
            viewport.classList.remove('is-dragging');
            try { viewport.releasePointerCapture(pointerId); } catch (_) { /* ignore */ }
            const step = cardStep();
            offset = Math.round(offset / step) * step;
            apply(false);

            const blocker = ev => {
                ev.preventDefault();
                ev.stopPropagation();
                track.removeEventListener('click', blocker, true);
            };
            track.addEventListener('click', blocker, true);
            setTimeout(() => { rail.dataset.dragged = '0'; }, 0);
        }

        pointerId = null;
    }

    viewport.addEventListener('pointerup', endDrag);
    viewport.addEventListener('pointercancel', endDrag);
    window.addEventListener('resize', () => apply(true));
    apply(true);
}

/* --------------------------------------------------------------------------
   Портфолио
   -------------------------------------------------------------------------- */

function renderGallery() {
    const wrap = document.getElementById('gallery');
    if (!wrap) return;

    wrap.innerHTML = PORTFOLIO_IMAGES.map((src, i) => `
        <div class="gallery-item card-3d-host" data-index="${i}">
            <div class="card-3d__face">
                <div class="card-3d__shine" aria-hidden="true"></div>
                <img src="${src}" alt="Работа ${i + 1}" loading="lazy" draggable="false">
            </div>
        </div>`).join('');

    if (document.getElementById('portfolio-rail')) {
        initArrowRail('portfolio-rail', 'gallery', '.gallery-item');
    }

    initCardTilt(wrap, '.card-3d-host');
    initLightbox(wrap);
}

function initLightbox(wrap) {
    const lightbox = document.getElementById('lightbox');
    if (!lightbox) return;
    const img = lightbox.querySelector('.lightbox__img');
    let current = 0;

    const show = i => {
        current = (i + PORTFOLIO_IMAGES.length) % PORTFOLIO_IMAGES.length;
        img.src = PORTFOLIO_IMAGES[current];
        img.alt = 'Работа ' + (current + 1);
        lightbox.classList.add('is-open');
        document.body.style.overflow = 'hidden';
    };

    const hide = () => {
        lightbox.classList.remove('is-open');
        document.body.style.overflow = '';
    };

    wrap.querySelectorAll('.gallery-item').forEach(item => {
        item.addEventListener('click', () => show(parseInt(item.dataset.index, 10)));
    });

    lightbox.querySelector('[data-close-lightbox]').addEventListener('click', hide);
    lightbox.addEventListener('click', e => { if (e.target === lightbox) hide(); });
    lightbox.querySelector('[data-lb-prev]').addEventListener('click', e => { e.stopPropagation(); show(current - 1); });
    lightbox.querySelector('[data-lb-next]').addEventListener('click', e => { e.stopPropagation(); show(current + 1); });
    document.addEventListener('keydown', e => {
        if (!lightbox.classList.contains('is-open')) return;
        if (e.key === 'Escape') hide();
        if (e.key === 'ArrowLeft') show(current - 1);
        if (e.key === 'ArrowRight') show(current + 1);
    });
}

/* --------------------------------------------------------------------------
   Контакты: наполнение из config
   -------------------------------------------------------------------------- */

function renderContacts() {
    const address = document.getElementById('c-address');
    const phone1 = document.getElementById('c-phone1');
    const phone2 = document.getElementById('c-phone2');
    const schedule = document.getElementById('c-schedule');
    const map = document.getElementById('c-map');
    const homeSocials = document.getElementById('home-socials');

    if (address) address.textContent = CONFIG.address;
    if (schedule) schedule.textContent = CONFIG.schedule;
    if (phone1) {
        phone1.textContent = CONFIG.phonesDisplay[0];
        phone1.href = 'tel:+' + CONFIG.phones[0].replace(/[^0-9]/g, '');
    }
    if (phone2) {
        phone2.textContent = CONFIG.phonesDisplay[1];
        phone2.href = 'tel:+' + CONFIG.phones[1].replace(/[^0-9]/g, '');
    }
    if (map) map.src = CONFIG.mapEmbedUrl;

    if (homeSocials) {
        homeSocials.innerHTML = socialLinksHtml(18);
    }
}

/* --------------------------------------------------------------------------
   Якорь #id после загрузки
   -------------------------------------------------------------------------- */

function scrollToHash() {
    const hash = location.hash.slice(1);
    if (!hash) return;
    const el = document.getElementById(hash);
    if (!el) return;
    if (document.body.dataset.page === 'index') {
        const allowed = ['services', 'about', 'portfolio', 'contacts'];
        if (!allowed.includes(hash)) return;
    }
    setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
}

/* --------------------------------------------------------------------------
   Инициализация
   -------------------------------------------------------------------------- */

if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
}

document.addEventListener('DOMContentLoaded', () => {
    renderHeader(document.body.dataset.page || '');
    renderFooter();
    renderPopup();
    renderFloats();
    renderPromos();
    renderServicePreviews();
    renderServicesPage();
    renderGallery();
    renderContacts();
    bindPopup();
    initScrollbars();
    initHeroStage();

    const hash = location.hash.slice(1);
    const sectionIds = ['services', 'about', 'portfolio', 'contacts'];

    if (hash && sectionIds.includes(hash)) {
        scrollToHash();
    } else if (document.body.dataset.page === 'index' && SERVICES.some(s => s.id === hash)) {
        // попап услуги по #id — без прыжка к середине страницы
        window.scrollTo(0, 0);
        openServiceById(hash);
    } else {
        window.scrollTo(0, 0);
    }
});

function initHeroStage() {
    const stage = document.querySelector('[data-hero-stage]');
    const orbit = document.querySelector('[data-hero-orbit]');
    if (!stage || !orbit) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;

    let raf = 0;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    function tick() {
        currentX += (targetX - currentX) * 0.08;
        currentY += (targetY - currentY) * 0.08;
        orbit.style.transform = `rotateY(${currentX * 10}deg) rotateX(${currentY * -7}deg)`;
        raf = requestAnimationFrame(tick);
    }

    stage.addEventListener('pointermove', e => {
        const rect = stage.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        targetX = Math.max(-0.5, Math.min(0.5, x));
        targetY = Math.max(-0.5, Math.min(0.5, y));
    });

    stage.addEventListener('pointerleave', () => {
        targetX = 0;
        targetY = 0;
    });

    raf = requestAnimationFrame(tick);
    window.addEventListener('beforeunload', () => cancelAnimationFrame(raf), { once: true });
}

function initScrollbars() {
    const api = window.OverlayScrollbarsGlobal;
    if (!api?.OverlayScrollbars) return;

    const options = {
        overflow: { x: 'hidden', y: 'scroll' },
        scrollbars: {
            theme: 'os-theme-mistudio',
            autoHide: 'leave',
            autoHideDelay: 600
        }
    };

    api.OverlayScrollbars(document.body, options);
    document.querySelectorAll('.popup__container').forEach(el => {
        api.OverlayScrollbars(el, options);
    });

    const phoneScroll = document.getElementById('phone-country-scroll');
    if (phoneScroll) {
        api.OverlayScrollbars(phoneScroll, {
            ...options,
            overflow: { x: 'hidden', y: 'scroll' },
            scrollbars: {
                theme: 'os-theme-mistudio',
                autoHide: 'never'
            }
        });
    }
}
