// =========================================================
// sprites.js — дані про духів (Sprites) з Fortnite, Розділ 7.
// Джерело списку та картинок: Fortnite Wiki (fortnite.fandom.com/wiki/Sprites).
//
// rarity — рідкість (у грі залежить від ціни призову: 100 → звичайний ... 6750 → легендарний)
// bonus  — що дух робить на ЦЬОМУ сайті, коли його екіпіровано:
//   'rare'   — частіше випадають епічні, легендарні та серійні предмети
//   'luck'   — удача на карті росте вдвічі швидше
//   'token'  — шанс золотого токена ×1.5
//   'double' — 25% шанс отримати з скрині другий предмет
//   'keep'   — після відкриття скрині удача падає лише наполовину
//   null     — бонусу на сайті немає (дух для колекції)
// =========================================================

const SPRITES = [
    { id: 'water', name: 'Водяний дух', rarity: 'common', bonus: null,
      ability: 'Відновлює щит тобі й загону, поки ви у воді.' },
    { id: 'earth', name: 'Земляний дух', rarity: 'common', bonus: 'rare',
      ability: 'Більший шанс знайти рідкісні предмети у скринях.' },
    { id: 'fire', name: 'Вогняний дух', rarity: 'common', bonus: null,
      ability: 'Створює вибух вогню, коли завдаєш ворогу достатньо шкоди.' },
    { id: 'fishy', name: 'Рибний дух', rarity: 'uncommon', bonus: null,
      ability: 'Швидше плаваєш і отримуєш прискорення, коли тебе ранять.' },
    { id: 'air', name: 'Повітряний дух', rarity: 'uncommon', bonus: 'luck',
      ability: 'Збільшує швидкість бігу та висоту стрибка.' },
    { id: 'duck', name: 'Качиний дух', rarity: 'rare', bonus: null,
      ability: 'Емоції та джеми відновлюють щит.' },
    { id: 'ghost', name: 'Дух-привид', rarity: 'rare', bonus: null,
      ability: 'Після перезаряджання ненадовго робить тебе невидимим.' },
    { id: 'demon', name: 'Демонічний дух', rarity: 'rare', bonus: null,
      ability: 'Дає «Сифон» за кожне знищення суперника.' },
    { id: 'king', name: 'Королівський дух', rarity: 'rare', bonus: 'token',
      ability: 'Збільшує шкоду від кирки.' },
    { id: 'striker', name: 'Дух-нападник', rarity: 'rare', bonus: 'luck',
      ability: 'Дає прискорення «Овердрайв», коли перелазиш через перешкоди.' },
    { id: 'aura', name: 'Дух аури', rarity: 'rare', bonus: null,
      ability: 'Дає заряд Shock Rock за завдану ворогам шкоду.' },
    { id: 'dream', name: 'Дух мрії', rarity: 'epic', bonus: 'keep',
      ability: 'З кожним рівнем дає випадковий предмет, а на максимумі вибухає легендарним лутом.' },
    { id: 'punk', name: 'Панк-дух', rarity: 'epic', bonus: null,
      ability: 'Нічого не робить до 5 рівня, а потім дає нескінченні набої.' },
    { id: 'boss', name: 'Дух боса', rarity: 'epic', bonus: null,
      ability: 'Збільшує максимальне здоров\'я та щит.' },
    { id: 'seven', name: 'Дух Сімки', rarity: 'epic', bonus: null,
      ability: 'Показує загону сліди ворогів по всьому острову.' },
    { id: 'peely', name: 'Дух Піли', rarity: 'epic', bonus: null,
      ability: 'Позначає тебе на карті, коли поруч є рідкісні духи.' },
    { id: 'llama', name: 'Дух лами з лутом', rarity: 'epic', bonus: 'double',
      ability: 'Більший шанс безкоштовно покращити рідкість зі скриньки з набоями.' },
    { id: 'zeropoint', name: 'Дух Нульової точки', rarity: 'legendary', bonus: null,
      ability: 'Під час лікування створює навколо тебе маленький щит-бульбашку.' },
    { id: 'peanut', name: 'Burnt Peanut', rarity: 'legendary', bonus: 'token',
      ability: 'Невеликий шанс отримати додатковий лут за знищення, навіть МІФІЧНИЙ.' },
    { id: 'grim', name: 'Похмурий дух', rarity: 'legendary', bonus: null,
      ability: 'Суперники, які атакують тебе, ненадовго підсвічуються.' },
    { id: 'batman', name: 'Дух Бетмена', rarity: 'legendary', bonus: null,
      ability: 'Підкидає тебе вгору і розкриває плащ Бетмена.' },
    { id: 'vini', name: 'Дух Вінісіуса', rarity: 'legendary', bonus: null,
      ability: 'Після бігу посилює шкоду по будівлях, а підкат дає «Овердрайв».' },
    { id: 'pollo', name: 'Дух Полло', rarity: 'legendary', bonus: 'rare',
      ability: 'Після знищення ворога швидко відновлює щит тобі й загону.' },
    { id: 'johnwick', name: 'Дух Джона Віка', rarity: 'legendary', bonus: null,
      ability: 'Збиті суперники підсвічують ворогів поруч.' },
    { id: 'ironmouse', name: 'Дух Ironmouse', rarity: 'legendary', bonus: 'keep',
      ability: 'Відновлює здоров\'я, коли його мало, і дає невидимість та низьку гравітацію.' }
];

// Опис бонусів для інтерфейсу
const SPRITE_BONUS_TEXT = {
    rare: 'На сайті: частіше випадають епічні та легендарні предмети',
    luck: 'На сайті: удача росте вдвічі швидше',
    token: 'На сайті: шанс золотого токена ×1.5',
    double: 'На сайті: 25% шанс отримати другий предмет зі скрині',
    keep: 'На сайті: після скрині удача падає лише наполовину'
};
