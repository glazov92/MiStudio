/* ==========================================================================
   Mi Studio — единый файл скриптов
   Общие компоненты (хедер, футер, попап, плавающие кнопки) рендерятся JS,
   чтобы не дублировать разметку на 4 страницах.
   ========================================================================== */

const WA_PHONE = CONFIG.phones[0].replace(/[^0-9]/g, '');

/* --------------------------------------------------------------------------
   Рендер общих компонентов
   -------------------------------------------------------------------------- */

function renderHeader(activePage) {
    const navItems = [
        { href: 'index.html', label: 'Главная', key: 'index' },
        { href: 'services.html', label: 'Услуги', key: 'services', dropdown: true },
        { href: 'portfolio.html', label: 'Портфолио', key: 'portfolio' },
        { href: 'contacts.html', label: 'Контакты', key: 'contacts' }
    ];

    const nav = navItems.map(item => {
        const cls = item.key === activePage ? 'active' : '';
        if (item.dropdown) {
            const links = SERVICES.map(s =>
                `<a href="services.html#${s.id}">${s.title}</a>`).join('');
            return `<div class="has-dropdown" data-dropdown>
                        <a href="${item.href}" class="${cls}">${item.label}</a>
                        <div class="dropdown">${links}</div>
                    </div>`;
        }
        return `<a href="${item.href}" class="${cls}">${item.label}</a>`;
    }).join('');

    document.getElementById('header').innerHTML = `
        <header class="header">
            <div class="container header__inner">
                <a href="index.html" class="logo">Mi<span>Studio</span></a>
                <nav class="nav" id="nav">${nav}</nav>
                <div class="header__right">
                    <div class="header__phones">
                        ${CONFIG.phonesDisplay.map(p => `<a href="tel:+${p.replace(/[^0-9]/g, '')}">${p}</a>`).join('')}
                    </div>
                    <button class="btn btn--outline btn--sm" data-open-popup>Связаться</button>
                    <button class="burger" id="burger" aria-label="Меню"><span></span><span></span><span></span></button>
                </div>
            </div>
        </header>`;

    const burger = document.getElementById('burger');
    const navEl = document.getElementById('nav');
    const dropdowns = document.querySelectorAll('[data-dropdown]');

    burger.addEventListener('click', () => {
        burger.classList.toggle('is-open');
        navEl.classList.toggle('is-open');
        document.body.classList.toggle('nav-open');
    });

    dropdowns.forEach(d => d.addEventListener('click', e => {
        if (window.innerWidth <= 768) d.classList.toggle('is-open');
    }));
}

function renderFooter() {
    const phones = CONFIG.phonesDisplay.map(p =>
        `<a href="tel:+${p.replace(/[^0-9]/g, '')}">${p}</a>`).join('');

    document.getElementById('footer').innerHTML = `
        <footer class="footer">
            <div class="container">
                <div class="footer__grid">
                    <div class="footer__col">
                        <a href="index.html" class="footer__logo">Mi<span>Studio</span></a>
                        <p class="footer__desc">Студия красоты «Mi Studio» в Нижнем Новгороде.
                        Уютная атмосфера, профессиональный уход, заметный результат.</p>
                    </div>
                    <div class="footer__col">
                        <div class="footer__title">Разделы</div>
                        <ul class="footer__links">
                            <li><a href="index.html">Главная</a></li>
                            <li><a href="services.html">Услуги</a></li>
                            <li><a href="portfolio.html">Портфолио</a></li>
                            <li><a href="contacts.html">Контакты</a></li>
                        </ul>
                    </div>
                    <div class="footer__col">
                        <div class="footer__title">Контакты</div>
                        <div class="footer__contact">
                            <span>${CONFIG.address}</span>
                            ${phones}
                            <span>${CONFIG.schedule}</span>
                        </div>
                    </div>
                    <div class="footer__col">
                        <div class="footer__title">Мы на связи</div>
                        <div class="socials">
                            <a href="${CONFIG.vkUrl}" target="_blank" rel="noopener" aria-label="ВКонтакте">
                                <svg width="18" height="18" viewBox="0 0 576 512"><path fill="currentColor" d="M545 117.7c3.7-12.5 0-21.7-17.8-21.7h-58.9c-15 0-21.9 7.9-25.6 16.7 0 0-30 73.1-72.4 120.5-13.7 13.7-20 18.1-27.5 18.1-3.7 0-9.4-4.4-9.4-16.9V117.7c0-15-4.2-21.7-16.6-21.7h-92.6c-9.4 0-15 7-15 13.5 0 14.2 21.2 17.5 23.4 57.5v86.8c0 19-3.4 22.5-10.9 22.5-20 0-68.6-73.4-97.4-157.4-5.8-16.3-11.5-22.9-26.6-22.9H38.8c-16.8 0-20.2 7.9-20.2 16.7 0 15.6 20 93.1 93.1 195.5C160.4 378.1 229 416 291.4 416c37.5 0 42.1-8.4 42.1-22.9 0-66.8-3.4-73.1 15.4-73.1 8.7 0 23.7 4.4 58.7 38.1 40 40 46.6 57.9 69 57.9h58.9c16.8 0 25.3-8.4 20.4-25-11.2-34.9-86.9-106.7-90.3-111.5-8.7-11.2-6.2-16.2 0-26.2.1-.1 72-101.3 79.4-135.6z"/></svg>
                            </a>
                            <a href="${CONFIG.tgUrl}" target="_blank" rel="noopener" aria-label="Telegram">
                                <svg width="18" height="18" viewBox="0 0 448 512"><path fill="currentColor" d="M446.7 98.6l-67.6 318.8c-5.1 22.5-18.4 28.1-37.3 17.5l-103-75.9-49.7 47.8c-5.5 5.5-10.1 10.1-20.7 10.1l7.4-104.9 190.9-172.5c8.3-7.4-1.8-11.5-12.9-4.1L117.8 284 16.2 252.2c-22.1-6.9-22.5-22.1 4.6-32.7L418.2 66.4c18.4-6.9 34.5 4.1 28.5 32.2z"/></svg>
                            </a>
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
    const serviceOptions = SERVICES.map(s => `<option value="${s.title}">${s.title}</option>`).join('');

    document.getElementById('popup-root').innerHTML = `
        <div class="popup" id="lead-popup">
            <div class="popup__overlay" data-close-popup></div>
            <div class="popup__container">
                <button class="popup__close" data-close-popup aria-label="Закрыть">&times;</button>
                <div class="popup__title">Запись на визит</div>
                <p class="popup__subtitle">Оставьте контакты — мы свяжемся и подтвердим запись</p>
                <form class="form" id="lead-form" novalidate>
                    <div class="form__field">
                        <label class="form__label" for="lead-name">Имя</label>
                        <input class="form__input" id="lead-name" name="name" type="text" required placeholder="Как к вам обращаться">
                    </div>
                    <div class="form__field">
                        <label class="form__label" for="lead-phone">Телефон</label>
                        <input class="form__input" id="lead-phone" name="phone" type="tel" required placeholder="+7 (___) ___-__-__">
                    </div>
                    <div class="form__field">
                        <label class="form__label" for="lead-service">Услуга</label>
                        <select class="form__select" id="lead-service" name="service">
                            <option value="">Не выбрано</option>
                            ${serviceOptions}
                        </select>
                    </div>
                    <div class="form__field">
                        <label class="form__label" for="lead-time">Желаемое время</label>
                        <input class="form__input" id="lead-time" name="visit_time" type="datetime-local">
                    </div>
                    <div class="form__field">
                        <label class="form__label" for="lead-comment">Комментарий</label>
                        <textarea class="form__textarea" id="lead-comment" name="comment" placeholder="Пожелания, вопросы..."></textarea>
                    </div>
                    <button type="submit" class="btn btn--accent btn--block">Отправить заявку</button>
                    <div class="form__status" id="lead-status"></div>
                    <p class="form__note">Оставляя заявку, вы принимаете условия пользовательского соглашения и даёте согласие на обработку персональных данных.</p>
                </form>
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
            <div class="popup__container popup__container--wide">
                <button class="popup__close" data-close-service aria-label="Закрыть">&times;</button>
                <div id="service-popup-content"></div>
            </div>
        </div>`;

    document.getElementById('lead-form').addEventListener('submit', onLeadSubmit);
}

function renderFloats() {
    const wa = `https://wa.me/${WA_PHONE}`;
    const tg = CONFIG.tgUrl;
    const tel = `tel:+${WA_PHONE}`;
    const msg = encodeURIComponent('Здравствуйте! Хочу записаться в Mi Studio');

    document.getElementById('float-root').innerHTML = `
        <div class="float-buttons">
            <a class="float-btn float-btn--wa" href="${wa}?text=${msg}" target="_blank" rel="noopener" aria-label="WhatsApp">
                <svg width="24" height="24" viewBox="0 0 448 512"><path fill="currentColor" d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z"/></svg>
            </a>
            <a class="float-btn float-btn--tg" href="${tg}" target="_blank" rel="noopener" aria-label="Telegram">
                <svg width="24" height="24" viewBox="0 0 448 512"><path fill="currentColor" d="M446.7 98.6l-67.6 318.8c-5.1 22.5-18.4 28.1-37.3 17.5l-103-75.9-49.7 47.8c-5.5 5.5-10.1 10.1-20.7 10.1l7.4-104.9 190.9-172.5c8.3-7.4-1.8-11.5-12.9-4.1L117.8 284 16.2 252.2c-22.1-6.9-22.5-22.1 4.6-32.7L418.2 66.4c18.4-6.9 34.5 4.1 28.5 32.2z"/></svg>
            </a>
            <a class="float-btn float-btn--call" href="${tel}" aria-label="Позвонить">
                <svg width="24" height="24" viewBox="0 0 512 512"><path fill="currentColor" d="M497 39.2L479.7 8.2c-3.2-4.5-8.2-7.1-13.6-7.2-5.3-.1-10.4 2.2-13.8 6.5l-70.6 88.9c-4.4 5.5-5.8 12.7-3.6 19.5l38 92.3c-16.2 82-76.4 141.4-157.4 157.3l-91.5-37.9c-6.8-2.8-14.3-1.4-19.7 3.6l-89.4 70.9c-4.3 3.4-6.7 8.5-6.7 13.9-.1 5.3 2.2 10.4 6.4 13.9L78 481c4.7 4 42 34.7 92.9 34.7 6 0 12.1-.3 18.2-.9 69.4-6.7 152.8-43.2 226.2-116.6 81.5-81.6 120.7-183.2 104.9-264.9L497.3 54c3.5-8.3 3.2-13.3-.3-14.8z"/></svg>
            </a>
        </div>
        <div class="mobile-cta">
            <button class="btn btn--accent" data-open-popup>Записаться</button>
        </div>`;

    if (window.innerWidth <= 768) document.body.classList.add('has-mobile-cta');
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
        const sBtn = e.target.closest('[data-open-service]');
        if (sBtn) {
            const service = SERVICES.find(s => s.id === sBtn.dataset.openService);
            if (service) openServicePopup(service);
            return;
        }

        const openBtn = e.target.closest('[data-open-popup]');
        if (openBtn) {
            closePopup();
            const service = openBtn.dataset.service;
            const select = document.getElementById('lead-service');
            if (service && select) select.value = service;
            openPopup(popup);
            return;
        }
        if (e.target.closest('[data-open-policy]')) openPopup(policy);
        if (e.target.closest('[data-close-popup]')) closePopup();
        if (e.target.closest('[data-close-policy]')) closePopup();
        if (e.target.closest('[data-close-service]')) closePopup();
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') closePopup();
    });
}

function openServicePopup(service) {
    const content = document.getElementById('service-popup-content');
    const popup = document.getElementById('service-popup');
    content.innerHTML = renderServiceCard(service).replace(/^<article/, '<article style="margin:0;box-shadow:none"');
    const carousel = content.querySelector('.carousel');
    if (carousel) initCarousel(carousel);
    openPopup(popup);
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
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return { ok: true };
        } catch (e) {
            console.error('submitLead:', e);
            return { ok: false, error: e };
        }
    }

    // Вебхук не настроен — имитируем успех (dev-режим).
    console.log('[submitLead] webhook не настроен, заявка:', payload);
    return { ok: true, dev: true };
}

function onLeadSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const status = document.getElementById('lead-status');
    const data = Object.fromEntries(new FormData(form).entries());

    if (!data.name.trim() || !data.phone.trim()) {
        status.className = 'form__status is-show form__status--err';
        status.textContent = 'Заполните имя и телефон.';
        return;
    }

    status.className = 'form__status is-show form__status--ok';
    status.textContent = 'Отправляем...';

    submitLead(data).then(res => {
        if (res.ok) {
            status.className = 'form__status is-show form__status--ok';
            status.textContent = res.dev
                ? 'Форма работает (вебхук ещё не подключён). Заявка сохранена в консоли.'
                : 'Спасибо! Заявка отправлена — мы свяжемся с вами.';
            form.reset();
        } else {
            status.className = 'form__status is-show form__status--err';
            status.textContent = 'Не удалось отправить. Попробуйте ещё раз или позвоните нам.';
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
    wrap.innerHTML = PROMOS.map(p => `
        <button class="promo-card" data-open-popup>
            <span class="promo-card__badge">${p.badge}</span>
            <div class="promo-card__title">${p.title}</div>
            <div class="promo-card__desc">${p.desc}</div>
            <span class="promo-card__link">Записаться &rarr;</span>
        </button>`).join('');
}

function renderServicePreviews() {
    const wrap = document.getElementById('services-preview');
    if (!wrap) return;
    wrap.innerHTML = SERVICES.map(s => `
        <button class="service-card" data-open-service="${s.id}">
            <div class="service-card__media">
                <img src="${s.images[0]}" alt="${s.title}" loading="lazy">
            </div>
            <div class="service-card__body">
                <div class="service-card__title">${s.title}</div>
                <div class="service-card__desc">${s.shortDesc}</div>
                <span class="service-card__more">Подробнее &rarr;</span>
            </div>
        </button>`).join('');
}

/* --------------------------------------------------------------------------
   Портфолио
   -------------------------------------------------------------------------- */

function renderGallery() {
    const wrap = document.getElementById('gallery');
    if (!wrap) return;

    wrap.innerHTML = PORTFOLIO_IMAGES.map((src, i) => `
        <div class="gallery-item" data-index="${i}">
            <img src="${src}" alt="Работа ${i + 1}" loading="lazy">
        </div>`).join('');

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

    if (address) address.innerHTML = CONFIG.address;
    if (schedule) schedule.innerHTML = CONFIG.schedule;
    if (phone1) phone1.innerHTML = CONFIG.phonesDisplay[0];
    if (phone2) phone2.innerHTML = CONFIG.phonesDisplay[1];
    if (phone1 && phone1.parentElement) phone1.parentElement.href = 'tel:+' + CONFIG.phones[0];
    if (phone2 && phone2.parentElement) phone2.parentElement.href = 'tel:+' + CONFIG.phones[1];
    if (map) map.src = CONFIG.mapEmbedUrl;
}

/* --------------------------------------------------------------------------
   Якорь #id после загрузки
   -------------------------------------------------------------------------- */

function scrollToHash() {
    if (location.hash) {
        const el = document.querySelector(location.hash);
        if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    }
}

/* --------------------------------------------------------------------------
   Инициализация
   -------------------------------------------------------------------------- */

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
});
