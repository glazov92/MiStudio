const CONFIG = {
    apiUrl: 'https://api.твой-домен.ру',       // заменить на реальный
    apiVersion: 'v1',                           // позже станет 'v2'
    pocketbaseUrl: 'http://localhost:8090',     // PocketBase (dev); на проде — реальный URL
    usePocketbase: false,                       // true = тянуть услуги из PocketBase (v2.0)
    leadWebhookUrl: '',                         // Telegram-вебхук (заполнить после создания)
    // v1.0: заявки идут в Telegram + email-дубль (через вебхук GAS).
    // v2.0-задел: VK-бот сообщества — здесь появится vkBotUrl (токен/ключ доступа).
    vkBotUrl: '',                               // задел на VK-бота, в v1.0 не используется
    dikidiUrl: 'https://dikidi.net/2049120?p=0.pi',
    phones: ['+79334372727', '+79877481787'],
    phonesDisplay: ['+7 (933) 437-27-27', '+7 (987) 748-17-87'],
    address: 'Н. Новгород, Пятигорская улица, 14',
    schedule: 'Ежедневно 10:00–21:00',
    vkUrl: 'https://vk.ru/club239375190',
    tgUrl: 'https://t.me/+O-PmXu8y27FkMDg6',
    mapEmbedUrl: 'https://yandex.ru/map-widget/v1/?um=constructor%3A7917f6eb3e7bb797317f281380a5a3f7e95bdb323b7377ff3a43e5c569ba7db4&source=constructor'
};
