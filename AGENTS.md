# MiStudio — сайт салона красоты

## СТАТУС (на 12.08.2026) — продолжение в новой сессии
**Готово (v1.0):**
- 4 страницы (index, services, portfolio, contacts) + единые css/style.css и js/main.js.
- Общие компоненты рендерятся JS: хедер (sticky, бургер, дропдаун «Услуги»), футер, попапы (заявка, политика, услуга), плавающие кнопки WA/TG/звонок, sticky-CTA на мобильных.
- Услуги: 5 категорий из js/data.js; на services.html прайсы — аккордеоны (`details.price-acc`); на главной карточки открывают попап с деталями категории (`data-open-service`).
- Карусели (стрелки + свайп), галерея с лайтбоксом, Яндекс-карта, форма заявки с полем visit_time.
- Фото: локальные в img/ (скачаны с mibeauty-studio.ru). Дизайн-токены ниже.
- Проверка: Edge headless `msedge.exe --headless --disable-gpu --dump-dom file:///...` рендерит все страницы без JS-ошибок.

**Осталось (открытые задачи):**
1. **Telegram-вебхук** (`webhook/telegram-webhook.gs`): заполнить `EMAIL_TO`, задеплоить как Web App в script.google.com (Доступ: Все), открыть `<url>?debug` → `<url>?setchat=ID`, затем URL вписать в `CONFIG.leadWebhookUrl` в config.js. Бот создан в личном аккаунте владельца (позже передать: токен или @BotFather → Transfer ownership).
2. **PocketBase** (локально, порт 8090): коллекции `services`, `promos`, `leads`; наполнить services из js/data.js; `CONFIG.usePocketbase` сейчас false — включать осторожно (рендер ждёт полей коллекций).
3. VK-бот — только задел (`CONFIG.vkBotUrl` пусто), в v1.0 не делать.

**Важно:** на этой машине НЕТ node. Проверять JS можно через Edge headless или Python. Сайт живёт в `C:\Users\user\Desktop\MiStudio\`, контент-донор — `Desktop\Mi studio 2\`, живой референс — https://mibeauty-studio.ru/.

## Стек
- Чистый HTML/CSS/JS (без фреймворков, без сборщиков).
- Шрифт: Onest (Google Fonts), 300–700.
- Сетки: Flexbox. Брейкпоинт мобильной адаптации: 768px.
- Админка: PocketBase (внешняя, порт 8090).
- Обратная связь v1.0: вебхук → Telegram + email-дубль.

## Структура
```
MiStudio/
├── index.html           — Главная
├── services.html        — Услуги (5 категорий с прайсом)
├── portfolio.html       — Портфолио
├── contacts.html        — Контакты
├── config.js            — Конфигурация (URL, телефоны, адрес)
├── css/style.css        — Единый файл стилей
├── js/main.js           — Единый файл скриптов
├── js/data.js           — Локальный контент (5 категорий, прайс)
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
