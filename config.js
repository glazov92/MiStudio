const CONFIG = {
    apiUrl: 'https://api.твой-домен.ру',       // заменить на реальный
    apiVersion: 'v1',                           // позже станет 'v2'
    pocketbaseUrl: 'http://localhost:8090',     // PocketBase (dev); на проде — реальный URL
    usePocketbase: false,                       // true = тянуть услуги из PocketBase (v2.0)
    leadWebhookUrl: 'https://script.google.com/macros/s/AKfycby4dzAKGTirf6NIA3UEzbrQmNnrKvJT61Cd34Mz0yTzn3lPOt0dIxjrE8TUQW63uYxVAw/exec', // заявки → беседа VK + email (GAS-вебхук, корпоративная почта)
    // Заявки идут в беседу VK (webhook/vk-webhook.gs) + email-дубль на studiomi588@gmail.com.
    vkBotUrl: '',                               // задел, не используется
    dikidiUrl: 'https://dikidi.net/2049120?p=0.pi',
    phones: ['+79334304777'],
    phonesDisplay: ['+7 (933) 430-47-77'],
    address: 'Н. Новгород, Пятигорская улица, 14',
    schedule: 'Ежедневно 10:00–21:00',
    vkUrl: 'https://vk.ru/club239375190',
    tgUrl: 'https://t.me/+O-PmXu8y27FkMDg6',
    mapEmbedUrl: 'https://yandex.ru/map-widget/v1/?um=constructor%3A7917f6eb3e7bb797317f281380a5a3f7e95bdb323b7377ff3a43e5c569ba7db4&source=constructor'
};

// Frontend-редактор: активация по ?edit=КЛЮЧ, хранение в localStorage.
// Ключ не хранится в явном виде (собирается на лету из base64-обрывка), чтобы
// его нельзя было вытащить через Ctrl+F / F12 в исходниках страницы. Это НЕ
// защита, а просто "дверь с защёлкой" (см. ТЗ, раздел 8.3): любой, кто решит
// разобраться, всё равно найдёт ключ. Полную защиту даёт только серверный вход.
const EDITOR_CONFIG = {
    maxImageSize: 3 * 1024 * 1024,   // 3 МБ на файл
    maxImageEdge: 1600,              // автожатие: длинная сторона не больше 1600px (JPEG 0.82)
    storagePrefix: 'mistudio_editor_',
    serverSync: {
        enabled: true,               // сохранять правки на сервере (PHP, см. content-sync.php)
        url: 'content-sync.php',     // относительный путь к скрипту на хостинге
        key: ''                      // ключ записи — совпадает с CMS_KEY в content-sync.php; заполняется ниже
    },
    sections: {
        promotions: { label: 'Акции', icon: '🎯', selector: '#promos, .promos__hint', render: 'promos' },
        services:   { label: 'Услуги', icon: '🔧', selector: '#services, #services-list', render: 'services' },
        portfolio:  { label: 'Портфолио', icon: '📁', selector: '#portfolio, #gallery', render: 'portfolio' }
    }
};

(function () {
    function editorUnlock(s) {
        try {
            return atob(s).split('').reverse().join('');
        } catch (e) {
            return '';
        }
    }
    EDITOR_CONFIG.secretKey = editorUnlock('UlFoTlNZZHNyUndwUkNKU1NRTHM=');
    EDITOR_CONFIG.serverSync.key = editorUnlock('cUNheGF3VmFmd0hjMWgxRHA2d0tRZmx4');
})();
