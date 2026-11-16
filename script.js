// =========================================================
// script.js — скрині на карті, удача, колекція, духи та трекер Fortnite.
//
// Як це працює:
// 1. Сайт сам завантажує з fortnite-api.com сьогоднішній магазин,
//    найновіші предмети гри та новини (і перевіряє їх кожні 15 хвилин).
// 2. Ці предмети лежать у скринях на карті. Предмети не повторюються.
// 3. Іноді у скрині сидить дух (Sprite) або золотий токен Pirate Shop Access.
// 4. Усе знайдене зберігається в браузері: колекція, духи, лоадаут.
// =========================================================

// ---------- 1. Налаштування ----------
const API = {
    newItems: 'https://fortnite-api.com/v2/cosmetics/new',
    shop: 'https://fortnite-api.com/v2/shop',
    news: 'https://fortnite-api.com/v2/news/br'
};
const CHECK_EVERY = 15 * 60 * 1000;  // як часто перевіряти Fortnite (15 хв)
const CACHE_FRESH = 5 * 60 * 1000;   // свіжі дані з кешу не завантажуємо знову (5 хв)

const LUCK_MIN = 1;
const LUCK_MAX = 10;
const LUCK_PER_SECOND = 0.15;        // x1 → x10 приблизно за хвилину
const TOKEN_CHANCE = 1;              // базовий шанс токена, %
const SPRITE_CHANCE = 12;            // шанс, що у скрині дух, %

const SHAKE_TIME = 1200;             // звичайна скриня трясеться 1.2 с
const JACKPOT_SHAKE_TIME = 2600;     // скриня з чимось легендарним — 2.6 с
const CHEST_RESPAWN = 20000;         // скриня з'являється знову через 20 с

const SAVE_KEY = 'fortsite-v2';
const CACHE_KEY = 'fortsite-cache-v2';

// Рідкості: назва українською, порядок (для сортування) і вага (як часто випадає)
const RARITIES = {
    common:    { name: 'Звичайний',   order: 0, weight: 0 },
    uncommon:  { name: 'Незвичайний', order: 1, weight: 40 },
    rare:      { name: 'Рідкісний',   order: 2, weight: 30 },
    epic:      { name: 'Епічний',     order: 3, weight: 17 },
    legendary: { name: 'Легендарний', order: 4, weight: 8 },
    series:    { name: 'Серія',       order: 5, weight: 5 },
    mythic:    { name: 'Золотий токен', order: 6, weight: 0 }
};

// Ваги рідкості духів
const SPRITE_WEIGHTS = { common: 40, uncommon: 25, rare: 18, epic: 11, legendary: 6 };

// Типи предметів українською
const TYPE_NAMES = {
    outfit: 'Скін', backpack: 'Рюкзак', pickaxe: 'Кирка', glider: 'Дельтаплан',
    emote: 'Емоція', emoji: 'Смайлик', spray: 'Графіті', wrap: 'Обгортка',
    loadingscreen: 'Екран завантаження', contrail: 'Слід', music: 'Музика',
    shoe: 'Взуття', sidekick: 'Компаньйон', pet: 'Улюбленець', banner: 'Банер'
};

// Слоти лоадауту (що можна екіпірувати)
const SLOTS = [
    { key: 'outfit', name: 'Скін' },
    { key: 'backpack', name: 'Рюкзак' },
    { key: 'pickaxe', name: 'Кирка' },
    { key: 'glider', name: 'Дельтаплан' },
    { key: 'emote', name: 'Емоція' },
    { key: 'sprite', name: 'Дух' }
];

// Короткі назви бонусів духів для HUD
const BONUS_SHORT = {
    rare: 'рідкісні частіше', luck: 'удача росте ×2', token: 'токен ×1.5',
    double: 'шанс 2 предметів', keep: 'удача не згорає'
};

// Золотий токен — особливий предмет
const TOKEN = {
    kind: 'item', id: 'pirate-shop-access', name: 'Pirate Shop Access',
    rarity: 'mythic', rarityName: 'Золотий токен', type: 'token', typeName: 'Токен',
    image: 'images/pirate-shop-access.jpg', icon: 'images/pirate-shop-access.jpg',
    description: 'Неймовірно! У грі цей токен дає 14 днів безкоштовного магазину предметів.'
};

// ---------- 2. Елементи сторінки ----------
const $ = function (id) { return document.getElementById(id); };

const map = $('map');
const chests = document.querySelectorAll('.map-chest');
const luckBox = document.querySelector('.luck');

// ---------- 3. Стан ----------
let luck = LUCK_MIN;
let mapIsVisible = false;
let pool = [];          // предмети, які зараз можуть випасти зі скринь
let live = {};          // інформація трекера: версія, дати, новини
let rewardQueue = [];   // черга нагород (якщо зі скрині випало дві)
let shownReward = null; // нагорода, яку зараз показує вікно
let save = loadJson(SAVE_KEY) || { items: {}, sprites: {}, opened: 0, equipped: {} };

// ---------- 4. Збереження в браузері ----------
function loadJson(key) {
    try {
        return JSON.parse(localStorage.getItem(key));
    } catch (error) {
        return null; // сховище недоступне — почнемо з нуля
    }
}

function saveJson(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        // не вдалося зберегти — працюємо без збереження
    }
}

function saveProgress() {
    saveJson(SAVE_KEY, save);
}

// ---------- 5. Живі дані з Fortnite ----------
async function fetchJson(url) {
    const controller = new AbortController();
    const timer = setTimeout(function () { controller.abort(); }, 10000);
    try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) {
            throw new Error('HTTP ' + response.status);
        }
        return (await response.json()).data;
    } finally {
        clearTimeout(timer);
    }
}

// Перетворюємо предмет з API у простий об'єкт для сайту
function normalizeItem(raw, source) {
    const base = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
    const isSeries = !base.includes(raw.rarity.value);
    const type = raw.type.value;

    return {
        kind: 'item',
        id: raw.id,
        name: raw.name,
        description: raw.description || '',
        rarity: isSeries ? 'series' : raw.rarity.value,
        rarityName: isSeries ? raw.rarity.displayValue : RARITIES[raw.rarity.value].name,
        type: type,
        typeName: TYPE_NAMES[type] || raw.type.displayValue,
        image: raw.images.smallIcon || raw.images.icon,
        icon: raw.images.icon || raw.images.smallIcon,
        set: raw.set ? raw.set.value : '',
        source: source
    };
}

async function loadLiveData(force) {
    const cache = loadJson(CACHE_KEY);

    // Свіжий кеш — не турбуємо сервер зайвий раз
    if (!force && cache && Date.now() - cache.checkedAt < CACHE_FRESH) {
        applyLiveData(cache, false);
        return;
    }

    try {
        const results = await Promise.all([fetchJson(API.newItems), fetchJson(API.shop), fetchJson(API.news)]);
        const newData = results[0];
        const shopData = results[1];
        const newsData = results[2];

        // Збираємо предмети магазину та новинки без дублікатів
        const items = new Map();
        shopData.entries.forEach(function (entry) {
            (entry.brItems || []).forEach(function (raw) {
                if (raw.images && (raw.images.icon || raw.images.smallIcon)) {
                    items.set(raw.id, normalizeItem(raw, 'shop'));
                }
            });
        });
        newData.items.br.forEach(function (raw) {
            if (raw.images && (raw.images.icon || raw.images.smallIcon)) {
                items.set(raw.id, normalizeItem(raw, 'new'));
            }
        });

        const fresh = {
            pool: Array.from(items.values()),
            build: newData.build.replace('++Fortnite+Release-', '').split('-')[0],
            newDate: newData.date,
            shopDate: shopData.date,
            news: (newsData.motds || []).map(function (m) {
                return { title: m.title, body: m.body, image: m.tileImage || m.image };
            }),
            checkedAt: Date.now()
        };

        saveJson(CACHE_KEY, fresh);
        applyLiveData(fresh, true);
    } catch (error) {
        if (cache) {
            applyLiveData(cache, false);
            $('pool-info').textContent = 'Немає зв\'язку з Fortnite — показую збережені нагороди.';
        } else {
            $('pool-info').textContent = 'Не вдалося завантажити предмети Fortnite. У скринях поки лише духи та токен.';
        }
    }
}

function applyLiveData(data, isFresh) {
    // Чи вийшло оновлення Fortnite з минулого візиту?
    if (isFresh) {
        const gameUpdated = save.lastBuild && save.lastBuild !== data.build;
        const shopUpdated = save.lastShopDate && save.lastShopDate !== data.shopDate;
        if (gameUpdated) {
            showToast('🆕 Вийшло оновлення Fortnite ' + data.build + '! Нові предмети вже у скринях.');
        } else if (shopUpdated) {
            showToast('🛒 Магазин Fortnite оновився — у скринях нові нагороди!');
        }
        save.lastBuild = data.build;
        save.lastShopDate = data.shopDate;
        saveProgress();
    }

    pool = data.pool;
    live = data;
    renderAll();
}

// Автоматична перевірка оновлень
setInterval(function () { loadLiveData(true); }, CHECK_EVERY);

// ---------- 6. Бонус екіпірованого духа ----------
function spriteBonus() {
    const sprite = SPRITES.find(function (s) { return s.id === save.equipped.sprite; });
    return sprite ? sprite.bonus : null;
}

function tokenChance() {
    const multiplier = spriteBonus() === 'token' ? 1.5 : 1;
    return Math.min(50, TOKEN_CHANCE * luck * multiplier);
}

// ---------- 7. Що випаде зі скрині ----------
function randomFrom(list) {
    return list[Math.floor(Math.random() * list.length)];
}

// Вибір за вагами: [{value, weight}] → value
function pickWeighted(options) {
    const total = options.reduce(function (sum, o) { return sum + o.weight; }, 0);
    let random = Math.random() * total;
    for (const option of options) {
        random -= option.weight;
        if (random < 0) {
            return option.value;
        }
    }
    return options[options.length - 1].value;
}

// Вага рідкості з урахуванням удачі та духа
function tierWeight(tier) {
    let weight = RARITIES[tier].weight;
    if (tier === 'epic') { weight *= 1 + (luck - 1) * 0.15; }
    if (tier === 'legendary' || tier === 'series') { weight *= 1 + (luck - 1) * 0.3; }
    if (spriteBonus() === 'rare' && ['epic', 'legendary', 'series'].includes(tier)) { weight *= 1.5; }
    return weight;
}

function pickItem() {
    // Лише предмети, яких ще немає в колекції — без повторів
    const free = pool.filter(function (item) { return !save.items[item.id]; });
    const byTier = {};
    free.forEach(function (item) {
        const tier = item.rarity === 'common' ? 'uncommon' : item.rarity;
        (byTier[tier] = byTier[tier] || []).push(item);
    });

    const options = Object.keys(byTier).map(function (tier) {
        return { value: tier, weight: tierWeight(tier) };
    });
    if (options.length === 0) {
        return null;
    }
    return randomFrom(byTier[pickWeighted(options)]);
}

function makeSpriteReward(sprite) {
    const bonus = sprite.bonus ? ' ' + SPRITE_BONUS_TEXT[sprite.bonus] + '.' : '';
    return {
        kind: 'sprite', id: sprite.id, name: sprite.name,
        rarity: sprite.rarity, rarityName: RARITIES[sprite.rarity].name + ' дух',
        type: 'sprite', typeName: 'Дух',
        image: 'images/sprites/' + sprite.id + '.webp', icon: 'images/sprites/' + sprite.id + '.webp',
        description: sprite.ability + bonus
    };
}

function pickSprite() {
    const free = SPRITES.filter(function (s) { return !save.sprites[s.id]; });
    if (free.length === 0) {
        return null;
    }
    const sprite = pickWeighted(free.map(function (s) {
        return { value: s, weight: SPRITE_WEIGHTS[s.rarity] };
    }));
    return makeSpriteReward(sprite);
}

function rollReward() {
    // 1) Золотий токен (лише один раз)
    if (!save.items[TOKEN.id] && Math.random() * 100 < tokenChance()) {
        return TOKEN;
    }
    // 2) Дух
    if (Math.random() * 100 < SPRITE_CHANCE) {
        const sprite = pickSprite();
        if (sprite) { return sprite; }
    }
    // 3) Предмет з Fortnite, а якщо їх немає — дух
    return pickItem() || pickSprite();
}

function isJackpot(reward) {
    return ['legendary', 'series', 'mythic'].includes(reward.rarity);
}

// ---------- 8. Відкриття скрині ----------
function openChest(chest) {
    if (chest.classList.contains('is-shaking') || chest.classList.contains('is-opened')) {
        return;
    }

    // Нагороду визначаємо одразу: скриня з чимось крутим трясеться довше і сяє
    const rewards = [];
    const first = rollReward();
    if (first) {
        rewards.push(first);
        addToCollection(first); // одразу, щоб другий предмет не повторив перший
    }
    if (spriteBonus() === 'double' && Math.random() < 0.25) {
        const second = rollReward();
        if (second) {
            rewards.push(second);
            addToCollection(second);
        }
    }

    const jackpot = rewards.some(isJackpot);
    chest.classList.add('is-shaking');
    chest.classList.toggle('is-jackpot', jackpot);

    setTimeout(function () {
        chest.classList.remove('is-shaking', 'is-jackpot');
        chest.classList.add('is-opened');
        chest.setAttribute('aria-label', 'Скриня вже відкрита');

        save.opened += 1;
        saveProgress();

        // Відкрили скриню — удача скидається (дух «keep» зберігає половину)
        luck = spriteBonus() === 'keep' ? Math.max(LUCK_MIN, luck / 2) : LUCK_MIN;
        updateLuckHud();
        renderAll();

        if (rewards.length === 0) {
            showToast('Скриня порожня — ти вже зібрав усе, що є зараз у Fortnite! 🏆');
        } else {
            rewardQueue = rewards;
            showNextReward();
        }

        setTimeout(function () {
            chest.classList.remove('is-opened');
            chest.setAttribute('aria-label', 'Відкрити скриню');
        }, CHEST_RESPAWN);
    }, jackpot ? JACKPOT_SHAKE_TIME : SHAKE_TIME);
}

function addToCollection(reward) {
    if (reward.kind === 'sprite') {
        save.sprites[reward.id] = Date.now();
    } else {
        save.items[reward.id] = Object.assign({}, reward, { foundAt: Date.now() });
    }
    saveProgress();
}

chests.forEach(function (chest) {
    chest.addEventListener('click', function () { openChest(chest); });
});

// ---------- 9. Удача ----------
function updateLuckHud() {
    const percent = (luck - LUCK_MIN) / (LUCK_MAX - LUCK_MIN) * 100;
    $('luck-value').textContent = 'x' + luck.toFixed(1);
    $('luck-fill').style.width = percent + '%';
    $('token-chance').textContent = save.items[TOKEN.id] ? 'вже знайдено ✓' : formatPercent(tokenChance());
    luckBox.classList.toggle('is-max', luck >= LUCK_MAX);

    const sprite = SPRITES.find(function (s) { return s.id === save.equipped.sprite; });
    $('luck-sprite').textContent = sprite
        ? 'Дух: ' + sprite.name + (sprite.bonus ? ' — ' + BONUS_SHORT[sprite.bonus] : '')
        : 'Дух: не екіпіровано';
}

// Удача росте, поки карта на екрані («ти обираєш точку висадки»)
const observer = new IntersectionObserver(function (entries) {
    mapIsVisible = entries[0].isIntersecting;
}, { threshold: 0.4 });
observer.observe(map);

setInterval(function () {
    if (mapIsVisible && !document.hidden && luck < LUCK_MAX) {
        const speed = spriteBonus() === 'luck' ? 2 : 1;
        luck = Math.min(LUCK_MAX, luck + LUCK_PER_SECOND * speed);
        updateLuckHud();
    }
}, 1000);

// ---------- 10. Вікно предмета ----------
function showNextReward() {
    const next = rewardQueue.shift();
    if (next) {
        showReward(next, 'found');
    }
}

function showReward(reward, mode) {
    shownReward = reward;
    $('loot-card').className = 'loot-card r-' + reward.rarity;
    $('loot-found').textContent = mode === 'found' ? 'Ти знайшов' : 'Твоя колекція';
    $('loot-picture').src = reward.icon;
    $('loot-picture').alt = reward.name;
    $('loot-picture').classList.toggle('is-wide', reward.id === TOKEN.id);
    $('loot-name').textContent = reward.name;
    $('loot-rarity').textContent = reward.rarityName + ' · ' + reward.typeName;

    let text = reward.description;
    if (reward.source === 'shop') { text += ' Зараз у магазині Fortnite.'; }
    if (reward.source === 'new') { text += ' Новинка останнього оновлення.'; }
    $('loot-text').textContent = text;

    $('loot-close').textContent = mode === 'found' ? 'Забрати' : 'Закрити';
    updateEquipButton();

    $('loot-popup').hidden = false;
    $('loot-close').focus();
}

function slotOf(reward) {
    return SLOTS.some(function (s) { return s.key === reward.type; }) ? reward.type : null;
}

function updateEquipButton() {
    const slot = shownReward ? slotOf(shownReward) : null;
    const button = $('loot-equip');
    button.hidden = !slot;
    if (slot) {
        button.textContent = save.equipped[slot] === shownReward.id ? 'Зняти' : 'Екіпірувати';
    }
}

function toggleEquip(reward) {
    const slot = slotOf(reward);
    if (!slot) { return; }
    if (save.equipped[slot] === reward.id) {
        delete save.equipped[slot];
    } else {
        save.equipped[slot] = reward.id;
        showToast('✓ ' + reward.name + ' екіпіровано');
    }
    saveProgress();
    updateEquipButton();
    updateLuckHud();
    renderAll();
}

function hideReward() {
    $('loot-popup').hidden = true;
    shownReward = null;
    showNextReward(); // якщо випало два предмети — показуємо другий
}

$('loot-close').addEventListener('click', hideReward);
$('loot-equip').addEventListener('click', function () { toggleEquip(shownReward); });
$('loot-to-collection').addEventListener('click', function () {
    rewardQueue = [];
    hideReward();
});
$('loot-popup').addEventListener('click', function (event) {
    if (event.target === $('loot-popup')) { hideReward(); }
});
document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && !$('loot-popup').hidden) { hideReward(); }
});

// ---------- 11. Малювання колекції ----------
function formatPercent(value) {
    return (Math.round(value * 10) / 10) + '%';
}

function formatDate(value) {
    return value ? new Date(value).toLocaleString('uk-UA', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
}

// Створює картку предмета або духа
function makeCard(reward, options) {
    const card = document.createElement(options.locked ? 'div' : 'button');
    card.className = 'item-card r-' + reward.rarity + (options.locked ? ' is-locked' : '');
    if (!options.locked) {
        card.type = 'button';
        card.addEventListener('click', function () { showReward(reward, 'view'); });
    }

    const img = document.createElement('img');
    img.src = reward.image;
    img.alt = options.locked ? 'Ще не знайдений дух' : reward.name;
    img.loading = 'lazy';

    const name = document.createElement('h3');
    name.className = 'item-name';
    name.textContent = options.locked ? '???' : reward.name;

    const rarity = document.createElement('p');
    rarity.className = 'item-rarity';
    rarity.textContent = reward.rarityName;

    card.append(img, name, rarity);

    if (options.note) {
        const note = document.createElement('p');
        note.className = 'item-note';
        note.textContent = options.note;
        card.append(note);
    }
    if (options.equipped) {
        const badge = document.createElement('span');
        badge.className = 'item-equipped';
        badge.textContent = '✓ Екіпіровано';
        card.append(badge);
    }
    return card;
}

function renderItems() {
    const filter = $('rarity-filter').value;
    const grid = $('items-grid');
    const owned = Object.values(save.items)
        .filter(function (item) { return filter === 'all' || item.rarity === filter; })
        .sort(function (a, b) {
            return RARITIES[b.rarity].order - RARITIES[a.rarity].order || b.foundAt - a.foundAt;
        });

    grid.replaceChildren.apply(grid, owned.map(function (item) {
        return makeCard(item, {
            note: item.typeName,
            equipped: save.equipped[item.type] === item.id
        });
    }));
    $('items-empty').hidden = owned.length > 0;

    const left = pool.filter(function (item) { return !save.items[item.id]; }).length;
    if (pool.length > 0) {
        $('pool-info').textContent = 'У скринях зараз: ' + left + ' з ' + pool.length + ' предметів Fortnite';
    }
}

function renderSprites() {
    const grid = $('sprites-grid');
    grid.replaceChildren.apply(grid, SPRITES.map(function (sprite) {
        const found = Boolean(save.sprites[sprite.id]);
        return makeCard(makeSpriteReward(sprite), {
            locked: !found,
            note: sprite.bonus ? '⚡ ' + BONUS_SHORT[sprite.bonus] : 'Дух для колекції',
            equipped: save.equipped.sprite === sprite.id
        });
    }));
}

function findEquipped(slot) {
    const id = save.equipped[slot];
    if (!id) { return null; }
    if (slot === 'sprite') {
        const sprite = SPRITES.find(function (s) { return s.id === id; });
        return sprite ? makeSpriteReward(sprite) : null;
    }
    return save.items[id] || null;
}

function renderLoadout() {
    const box = $('loadout');
    box.replaceChildren.apply(box, SLOTS.map(function (slot) {
        const item = findEquipped(slot.key);
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'loadout-slot' + (item ? ' r-' + item.rarity : '');
        button.disabled = !item;

        if (item) {
            const img = document.createElement('img');
            img.src = item.image;
            img.alt = item.name;
            button.append(img);
            button.addEventListener('click', function () { showReward(item, 'view'); });
        } else {
            const plus = document.createElement('span');
            plus.className = 'loadout-empty';
            plus.textContent = '+';
            button.append(plus);
        }

        const label = document.createElement('span');
        label.className = 'loadout-label';
        label.textContent = slot.name;
        button.append(label);
        return button;
    }));
}

function renderTracker() {
    $('tracker-build').textContent = live.build || '—';
    $('tracker-new').textContent = formatDate(live.newDate);
    $('tracker-shop').textContent = formatDate(live.shopDate);
    $('tracker-checked').textContent = formatDate(live.checkedAt);

    const grid = $('news-grid');
    grid.replaceChildren.apply(grid, (live.news || []).map(function (item) {
        const card = document.createElement('article');
        card.className = 'news-card';
        const img = document.createElement('img');
        img.src = item.image;
        img.alt = item.title;
        img.loading = 'lazy';
        const title = document.createElement('h3');
        title.textContent = item.title;
        const body = document.createElement('p');
        body.textContent = item.body;
        card.append(img, title, body);
        return card;
    }));
}

function renderAll() {
    renderItems();
    renderSprites();
    renderLoadout();
    renderTracker();
    $('items-count').textContent = Object.keys(save.items).length;
    $('sprites-count').textContent = Object.keys(save.sprites).length;
    $('sprites-total').textContent = SPRITES.length;
    $('opened-count').textContent = save.opened;
    $('chests-opened').textContent = save.opened;
}

$('rarity-filter').addEventListener('change', renderItems);

// ---------- 12. Вкладки ----------
document.querySelectorAll('.tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
        document.querySelectorAll('.tab').forEach(function (t) {
            const active = t === tab;
            t.classList.toggle('is-active', active);
            t.setAttribute('aria-selected', active);
            $('panel-' + t.dataset.tab).hidden = !active;
        });
    });
});

// ---------- 13. Сповіщення ----------
let toastTimer = null;
function showToast(text) {
    const toast = $('toast');
    toast.textContent = text;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.hidden = true; }, 5000);
}

// ---------- 14. Скидання колекції ----------
$('reset-collection').addEventListener('click', function () {
    if (confirm('Точно скинути всю колекцію, духів і лоадаут?')) {
        save = { items: {}, sprites: {}, opened: 0, equipped: {}, lastBuild: save.lastBuild, lastShopDate: save.lastShopDate };
        saveProgress();
        updateLuckHud();
        renderAll();
    }
});

// ---------- 15. Старт ----------
updateLuckHud();
renderAll();
loadLiveData(false);
