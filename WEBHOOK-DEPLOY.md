# Развёртывание VK-вебхука (Google Apps Script)

## Что делает вебхук
1. Принимает POST-заявки с сайта (`submitLead()` в `js/main.js`)
2. Отправляет сообщение в беседу VK (Studiomi.bot → peer_id 2000000001)
3. Дублирует заявку на `studiomi588@gmail.com`

## Защита (уже в коде)
| Угроза | Мера | Ошибка |
|--------|------|--------|
| Бот заполняет скрытое поле | Honeypot (`_hp`) | `error: honeypot` |
| Replay-атака (старый POST) | Timestamp (`_ts` > 5 мин) | `error: expired` |
| Спам-волнами | Rate limit 6/мин | `error: rate` |
| Долгосрочный спам | 150 заявок/день (Properties) | `error: daily` |
| Запросы с чужих доменов | Origin check (studiomi.ru + GitHub Pages) | `error: forbidden` |

---

## Пошаговая инструкция

### 1. Открой редактор Google Apps Script
- Перейди на https://script.google.com
- Найди проект **Mi Studio VK webhook**

### 2. Замени код
- Открой файл `Code.gs` (или `vk-webhook.gs`)
- **Ctrl+A** → **Delete** → **Ctrl+V** (вставить весь код из `webhook/vk-webhook.gs`)

### 3. Origin-проверка
Origin-проверка **уже включена** — блокирует запросы с `file://` и чужих доменов.
`ALLOWED_DOMAINS` содержит `studiomi.ru` и `glazov92.github.io` (GitHub Pages для отладки).

### 4. Сохрани
- **Ctrl+S**
- Если «Authorization required» — нажми «Review permissions» и подтверди

### 5. Разверни
1. **«Deploy»** → **«New deployment»**
2. Тип: **Web app**
3. Execute as: **Me**
4. Who has access: **Anyone**
5. **«Deploy»**
6. Скопируй URL (вставь в `config.js` → `leadWebhookUrl`)

Если уже был деплой — **«Manage deployments»** → ✏️ (Edit) → **«New version»** → **«Deploy»**.

### 6. Проверь
1. Открой URL в браузере: `https://<твой-URL>?test` → должно отобразить «OK: сообщение отправлено в беседу.»
2. Отправь тестовую заявку с сайта → VK-беседа + email должны прийти

### 7. Обнови URL в config.js (если изменился)
```javascript
leadWebhookUrl: 'https://script.google.com/macros/s/<DEPLOY_ID>/exec'
```

---

## Тестирование из консоли браузера
Открой сайт → F12 → Console:
```javascript
submitLead({
  name: 'Тест',
  phone: '+79991234567',
  service: 'Тестовая услуга',
  comment: 'Проверка вебхука'
}).then(r => console.log(r));
```
Должен прийти `ok: true` и сообщение в VK + email.

## Частые ошибки

**`error: bad_request`** — пришёл невалидный JSON или нет `name`/`phone`.

**Нет ответа / `Failed to fetch`** — URL вебхука неверный или GAS ещё не задеплоен.

**VK ошибка 917** — бот-группа не состоит в беседе.
Добавьте бота (Studiomi.bot) в беседу через VK → Участники → Добавить.

**Email не приходит** — проверь, что `EMAIL_TO` совпадает с ящиком Google Workspace студии.
