const CONFIG = {
    apiUrl: 'https://api.твой-домен.ру',       // заменить на реальный
    apiVersion: 'v1',                           // позже станет 'v2'
    pocketbaseUrl: 'http://localhost:8090',     // PocketBase (dev); на проде — реальный URL
    usePocketbase: false,                       // true = тянуть услуги из PocketBase (v2.0)
    leadWebhookUrl: 'https://script.google.com/macros/s/AKfycbyjXYR5F48MBAiOI8_SylaFKJmn_nB2QTD-_wBGlNbS6D0Jq-VDRhXEPMYN-LyEuwZmbQ/exec', // заявки → беседа VK + email (GAS-вебхук, корпоративная почта)
    // Заявки идут в беседу VK (webhook/vk-webhook.gs) + email-дубль на studiomi588@gmail.com.
    vkBotUrl: '',                               // задел, не используется
    dikidiUrl: 'https://dikidi.net/2049120?p=0.pi',
    phones: ['+79334372727', '+79877481787'],
    phonesDisplay: ['+7 (933) 437-27-27', '+7 (987) 748-17-87'],
    address: 'Н. Новгород, Пятигорская улица, 14',
    schedule: 'Ежедневно 10:00–21:00',
    vkUrl: 'https://vk.ru/club239375190',
    tgUrl: 'https://t.me/+O-PmXu8y27FkMDg6',
    mapEmbedUrl: 'https://yandex.ru/map-widget/v1/?um=constructor%3A7917f6eb3e7bb797317f281380a5a3f7e95bdb323b7377ff3a43e5c569ba7db4&source=constructor'
};

// Frontend-редактор: активация по ?edit=КЛЮЧ, хранение в localStorage.
// Ключ — затычка, задать настоящий позже. Хранится на клиенте: это НЕ защита,
// а просто "дверь с защёлкой" (см. ТЗ, раздел 8.3).
const EDITOR_CONFIG = {
    secretKey: 'sLQSSJCRpwRrsdYSNhQR',
    maxImageSize: 3 * 1024 * 1024,   // 3 МБ на файл
    maxImageEdge: 1600,              // автожатие: длинная сторона не больше 1600px (JPEG 0.82)
    storagePrefix: 'mistudio_editor_',
    serverSync: {
        enabled: true,               // сохранять правки на сервере (PHP, см. content-sync.php)
        url: 'content-sync.php',     // относительный путь к скрипту на хостинге
        key: 'xlfQKw6pD1h1cHwfaVwaxaCq'     // ключ записи — совпадает с CMS_KEY в content-sync.php
    },
    sections: {
        promotions: { label: 'Акции', icon: '🎯', selector: '#promos, .promos__hint', render: 'promos' },
        services:   { label: 'Услуги', icon: '🔧', selector: '#services, #services-list', render: 'services' },
        portfolio:  { label: 'Портфолио', icon: '📁', selector: '#portfolio, #gallery', render: 'portfolio' }
    }
};
