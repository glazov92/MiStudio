# MiStudio — сайт салона красоты

## СТАТУС (на 12.08.2026) — продолжение в новой сессии
**Готово (v1.0):**
- Лендинг: один index.html со всеми секциями (акции, услуги, о нас, портфолио, контакты) + единые css/style.css и js/main.js. Отдельные services.html/portfolio.html/contacts.html/404.html удалены (были осиротевшими).
- Общие компоненты рендерятся JS: хедер (sticky, бургер, дропдаун «Услуги»), футер, попапы (заявка, политика, услуга), плавающие кнопки WA/TG/звонок, sticky-CTA на мобильных.
- Услуги: 5 категорий из js/data.js; прайсы — аккордеоны (`details.price-acc`), карточки открывают попап с деталями категории (`data-open-service`).
- Карусели (стрелки + свайп), галерея с лайтбоксом, Яндекс-карта, форма заявки с полем visit_time.
- Фото: локальные в img/ (скачаны с mibeauty-studio.ru). Дизайн-токены ниже.
- Визуальный редактор контента: правки текстов и изображений + CRUD-менеджеры акций, услуг и портфолио (localStorage + PHP-синхронизация на сервере через content-sync.php) — см. раздел «Визуальный редактор».
- Развёртывание на AdminVPS (тариф Promo, виртуальный хостинг, панель ispmanager, PHP): пошаговый гайд `DEPLOY-ADMINVPS.md`. PHP-скрипт `content-sync.php` хранит правки админки в `data/editor-store.json` — изменения видны всем посетителям.
- Проверка: Edge headless `msedge.exe --headless --disable-gpu --dump-dom file:///...` рендерит все страницы без JS-ошибок.

**Осталось (открытые задачи):**
1. **Развернуть сайт на AdminVPS Promo** по `DEPLOY-ADMINVPS.md` (заказ хостинга, домен/DNS, загрузка файлов, SSL, заменить ключ CMS_KEY в config.js и content-sync.php).
2. **Telegram-вебхук** (`webhook/telegram-webhook.gs`): резерв — не используется (основной канал — VK-бот + email).
3. VK-бот — только задел (`CONFIG.vkBotUrl` пусто), в v1.0 не делать.

**Важно:** на этой машине НЕТ node. Проверять JS можно через Edge headless или Python. Сайт живёт в `C:\Users\user\Desktop\MiStudio\`, контент-донор — `Desktop\Mi studio 2\`, живой референс — https://mibeauty-studio.ru/.

## Визуальный редактор (?edit=sLQSSJCRpwRrsdYSNhQR)
- Пользовательский гайд для владельца сайта: `ADMIN.md` (как войти, править тексты/картинки, менеджеры, сохранение, экспорт/импорт, откат, как изменения попадают на хостинг).
- Включение: добавить к URL страницы `?edit=sLQSSJCRpwRrsdYSNhQR` (ключ пароля — sLQSSJCRpwRrsdYSNhQR, при неверном ключе панель не показывается; с 16.08.2026 работает и голый `?КЛЮЧ`). Ветка: `feature/admin-cms`. Ключ в `config.js` хранится замаскированным (base64 перевёрнутой строки + `editorUnlock`) — в исходниках сайта открытого текста нет; открытый ключ только в док. (ADMIN.md, AGENTS.md — для доверенных) и в `content-sync.php` (сервер, в браузер не попадает).
- Правка текста: в режиме редактирования клик по тексту → модальное окно → Сохранить / Сбросить к оригиналу. Правка картинки: клик по `<img data-editable="image">` → загрузка файла, превью, автожаттие до 1600px, сохранение в base64.
- Секции: панель внизу страницы → «Акции», «Услуги», «Портфолио» → менеджер (добавить/редактировать/удалить/перетаскивать для сортировки). После сохранения секция пере-рендерится без перезагрузки (функции `renderPromos`/`renderServicePreviews`/`renderGallery` и т.д. — пере-инициализация каруселей/лайтбокса идемпотентна через `__*Cleanup`).
- Данные хранятся в localStorage (ключи `miedit_texts`, `miedit_images`, `miedit_promos`, `miedit_services`, `miedit_portfolio`), применяются при загрузке страницы. Импорт/экспорт JSON и сброс — в панели. Ограничения: правки локальны для браузера и привязаны к `data-editable-id` (не менять эти id в HTML без причины).
- **PHP-синхронизация (v1.1):** при `EDITOR_CONFIG.serverSync.enabled=true` каждое сохранение дополнительно отправляет полный снимок правок на `content-sync.php` (POST `{key, data}`), а при загрузке страницы правки подтягиваются (GET) и применяются (`editorApplyServerData` — для карт тексты/картинки/paths/links серверные значения побеждают по ключу, локальные не затираются; для списков акции/услуги/портфолио сервер полностью побеждает). Кнопка «💾 Сохранить» показывает «опубликовано на сервере ✓» либо «сохранено локально». «🗑️ Сбросить» очищает и сервер. Ключ записи — `serverSync.key` в config.js = `CMS_KEY` в content-sync.php. Скрипт пишет в `data/editor-store.json` (папка защищена .htaccess, в git не идёт). Offline/без сервера (file://, старый деплой) — всё работает только на localStorage.
- **Версии правок (v1.2, «🕘 История»):** при каждом успешном POST-сохранении `content-sync.php` делает снапшот в `data/versions/v-<Ymd>-<His>[-N].json` (последние `MAX_VERSIONS`=15, файлы до `MAX_SNAPSHOT_BYTES`=1,5 МБ; папка создаётся со своим `.htaccess`). Эндпоинты: GET `?action=versions&key=` → `{ok, versions:[{id,time}], max}`; POST `{action:'restore', key, version}` — перед откатом текущее состояние тоже сохраняется как версия (откат отменяем). `safeVersionId` валидирует id (`v-\d{8}-\d{6}(-\d+)?`), путь за пределы versions исключён. Фронт: `editorSyncVersions()`/`editorSyncRestore()` (js/storage.js), кнопка `data-ed-history` + `openHistoryModal()` (js/editor.js), стили `.ed-btn--restore` (css/editor.css). Бэкап-гайд (3 уровня: История → Экспорт JSON → модуль ispmanager) — раздел 9 в DEPLOY-ADMINVPS.md, ADMIN.md раздел 11.
- Изображения: редактируются ВСЕ — hero, «О нас», карточки услуг, слайды каруселей, фото мастеров в попапах, галерея. Разметка динамических: атрибут `data-editor-img="<ключ>"`, ключи `svc_<id>_img_<i>` / `svc_<id>_master_<k>` / `gallery_<id>` (см. `svcImageKey`/`galleryImageKey` в js/main.js). Полный список — кнопка «🖼️ Изображения» в панели (работает и когда открыт попап: клик по любому `<img>` в режиме редактирования открывает замену). Оверрайды применяются в `getServices()`/`getPortfolioItems()`.
- Менеджеры акций/услуг/портфолио по умолчанию показывают исходные данные (не пустоту) и сохраняют весь список при первом изменении.
- Точечные правки структуры услуг: `data-ed-path="svc.<id>.<path>"` (title, shortDesc, price.<i>.section / items.<j>.name / meta / price, masters.<k>.name / desc). Хранятся в `EDITOR_STORE.paths` (localStorage `miedit_service_paths`), применяются в `getServices()` через `applyServicePaths`/`applyDeepPath`. Клик по тексту в попапе/карточке/прайс-аккордеоне открывает редактор. Путь с одним сегментом-массивом (items/masters/images/price) как лист блокируется.
- Единые телефоны `site_phone_0/1` во всех местах (хедер, мобильное меню, футер, контакты): правка одного обновляет `tel:` во всех ссылках через `editorUpdateTelHrefs`.
- Полный конструктор услуги («Добавить услугу» / «Редактировать»): мастера и прайс-разделы/позиции. Функции: `serviceFormHtml`, `renderMastersBox`/`renderPriceBox` (только рендер), `parseMasters`/`parsePrice` (сбор с фоллбэком на прежние данные), `wireServiceForm` (делегированный клик: добавить/удалить мастера, раздел, позицию). При добавлении новой услуги прайс и мастера из формы сохраняются. Наружу: `EDITOR_SECTIONS.services.openForm(existing)`.
- Кеш-версия в HTML: `?v=20260816-15`. Вход в админку: `?edit=КЛЮЧ` или голый `?КЛЮЧ` (слэш в конце адреса не важен). Smoke-тест `C:\Users\user\AppData\Local\Temp\opencode\editor_test.html` (65 проверок): геттеры, тексты/изображения, rerender, реестр изображений, оверрайды, менеджеры, paths (данные+DOM), телефоны (текст+tel:), конструктор (шаблон, добавление строк, сохранение), история (модалка, офлайн-null), editorModeActive (?edit=, голый ключ, ?x=, пусто, неверный ключ). Запуск: Edge headless по `file://` (скрипты в харнессе подключены по file:// — через HTTP не запускать).
- Код: `js/editor.js` (ядро), `js/storage.js` (localStorage/JSON/экспорт), `js/sections/{promotions,services,portfolio}.js`, `css/editor.css`. Разметка правок — атрибуты `data-editable` в HTML страниц (на index 27 элементов: hero, секции, контакты; hero-изображения `hero_img_{back,mid,front}` редактируются). Логотип `hero__brand` (разметка со `<span>`) — не редактируется намеренно.

## Стек
- Чистый HTML/CSS/JS (без фреймворков, без сборщиков).
- Шрифт: Onest (Google Fonts), 300–700.
- Сетки: Flexbox. Брейкпоинт мобильной адаптации: 768px.
- Админка: PHP-синхронизация на хостинге (content-sync.php + JSON-файл). PocketBase как серверный слой — отменён (shared-хостинг, избыточен).
- Обратная связь v1.0: вебхук → Telegram + email-дубль.

## Структура
```
MiStudio/
├── index.html           — Лендинг (все секции: акции, услуги, о нас, портфолио, контакты)
├── config.js            — Конфигурация (URL, телефоны, адрес)
├── content-sync.php     — PHP-синхронизация правок админки (data/editor-store.json)
├── css/style.css        — Единый файл стилей
├── css/editor.css       — Стили панели и модалок редактора
├── js/main.js           — Единый файл скриптов
├── js/data.js           — Локальный контент (5 категорий, прайс)
├── js/storage.js        — localStorage/JSON/импорт-экспорт для редактора
├── js/editor.js         — Ядро визуального редактора (?edit=sLQSSJCRpwRrsdYSNhQR)
├── js/sections/         — Менеджеры секций редактора (promotions, services, portfolio)
├── data/                — Защищённая папка с правками админки (в git не идёт)
└── img/                 — Изображения
```

## Дизайн-токены
- Фон: #FAF9F6 (off-white)
- Заголовки/текст: #1A1A1A (глубокий чёрный)
- Акцент: #B8975A (золото/бронза)
- border-radius: 12px; тени лёгкие
- Кнопки: accent (золотая заливка), outline (чёрная рамка)
- Интерактив: transition 0.3s
- Контейнер: max-width 1200px, padding 0 20px

## Архитектурные решения (задел на v2.0)
1. `submitLead(formData)` — единая точка отправки заявок в `js/main.js`.
   - v1.0: POST на Telegram-вебхук (URL в `config.js`).
   - v2.0: тот же вызов пойдёт на `/api/v2/leads` (FastAPI) — фронт не переписывается.
2. Поле `visit_time` обязательно в форме уже в v1.0.
3. JSON заявки совместим с будущей БД:
   `{ name, phone, service, visit_time, comment, source: "website", version: "1.0" }`
4. PocketBase коллекция `leads` — статусы: v1.0 `new`, в v2.0 добавятся `processing`, `pending_confirmation`, `confirmed`, `cancelled`.
5. URL-структура API: `/api/v1/leads` (сейчас), `/api/v2/leads` (потом).
6. Контент услуг лежит в `js/data.js`. В v2.0 подтягивается с PocketBase через REST (fetch), кэш в localStorage. Переключение источника — через `CONFIG.pocketbaseUrl` в `config.js`, рендер тот же.
   - Уточнение (16.08.2026): вместо PocketBase на хостинге используется лёгкая PHP-синхронизация правок админки (`content-sync.php`); PocketBase остаётся опцией v2.0, но по текущему стеку не требуется.

## Обратная связь: VK-бот сообщества + Email (с 16.08.2026 — основной канал)
- Группа-бот: Studiomi.bot (club240886388). Токен с правом messages хранится ТОЛЬКО в `webhook/vk-webhook.gs` (не в репозитории/не в config.js).
- Беседа для заявок: `VK_PEER_ID = 2000000001` (владелец сайта — админ, участников добавляет сам через VK, скрипт не трогаем).
- `webhook/vk-webhook.gs`: POST от `submitLead()` → `messages.send` в беседу + email-дубль на `studiomi588@gmail.com`. GET `<url>?test` — пробная отправка.
- Важно: бот-группа шлёт ТОЛЬКО в беседы, где она состоит (ошибка 917 — бот не участник/выгнан). Callback API не нужен — Long Poll.
- Статус: ЗАДЕПЛОЕН на корпоративный Google-аккаунт студии (16.08.2026). URL вписан в `CONFIG.leadWebhookUrl` в config.js. Проверено тестовой заявкой: сообщение в беседу + email — ок.
- Telegram-вебхук (`webhook/telegram-webhook.gs`) остался как задел/резерв — не используется.
- PocketBase коллекция `leads` — статусы: v1.0 `new`, в v2.0 добавятся `processing`, `pending_confirmation`, `confirmed`, `cancelled`.

## Не делать в v1.0
FastAPI, SQLite, AI-агенты, планировщик, автоответчик, VK-интеграция, сложная обработка заявок.

## Ссылки
- DiKiDi (онлайн-запись): https://dikidi.net/2049120?p=0
- Референс-донор: Desktop/Mi studio 2/Index.html
- Живой референс: https://mibeauty-studio.ru/
- Контакты: +7 (933) 437-27-27, +7 (987) 748-17-87; Н. Новгород, Пятигорская ул., 14
- Соцсети: VK https://vk.ru/club239375190, TG https://t.me/+O-PmXu8y27FkMDg6
