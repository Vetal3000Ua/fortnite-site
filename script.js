// =========================================================
// script.js — скрині на карті, шкала удачі та колекція скарбів.
// Ідея взята з івенту Fortnite «Treasure Hunters»: зі звичайних
// скринь випадає рідкісний золотий токен Pirate Shop Access.
// =========================================================

// ---------- 1. Список скарбів ----------
// chance — базовий шанс (%) при удачі x1.
// boost  — чи збільшує удача шанс цього скарбу (як «Treasure Hours» у грі).
const TREASURES = [
    { id: 'gizmo',    icon: '🔧', name: 'Гаджет',                 rarity: 'common',    rarityName: 'Звичайний',   chance: 0,  boost: false },
    { id: 'loading',  icon: '🖼️', name: 'Екран завантаження',    rarity: 'uncommon',  rarityName: 'Незвичайний', chance: 24, boost: false },
    { id: 'jam',      icon: '🎵', name: 'Музичний трек',          rarity: 'rare',      rarityName: 'Рідкісний',   chance: 16, boost: false },
    { id: 'pickaxe',  icon: '⛏️', name: 'Кирка або рюкзак',       rarity: 'epic',      rarityName: 'Епічний',     chance: 10, boost: false },
    { id: 'vehicle',  icon: '🚗', name: 'Транспорт і наліпка',    rarity: 'legendary', rarityName: 'Легендарний', chance: 5,  boost: true },
    { id: 'token',    icon: '🪙', name: 'Pirate Shop Access',     rarity: 'mythic',    rarityName: 'Золотий токен', chance: 1, boost: true },
    { id: 'outfit',   icon: '👑', name: 'Золотий костюм',         rarity: 'exotic',    rarityName: 'Унікальний',  chance: 0.3, boost: true }
];
// Гаджет — «все інше»: його шанс = 100% мінус шанси решти скарбів.

// ---------- 2. Налаштування механіки ----------
const LUCK_MIN = 1;            // удача на старті
const LUCK_MAX = 10;           // максимальна удача
const LUCK_PER_SECOND = 0.15;  // на скільки росте удача щосекунди (x1 → x10 за ~1 хв)
const SHAKE_TIME = 1200;       // скільки мс трясеться звичайна скриня
const JACKPOT_SHAKE_TIME = 2600; // скільки мс трясеться скриня з токеном
const CHEST_RESPAWN = 20000;   // через скільки мс відкрита скриня з'являється знову
const STORAGE_KEY = 'fortsite-collection';

// ---------- 3. Елементи сторінки ----------
const map = document.getElementById('map');
const chests = document.querySelectorAll('.map-chest');
const luckBox = document.querySelector('.luck');
const luckValue = document.getElementById('luck-value');
const luckFill = document.getElementById('luck-fill');
const tokenChance = document.getElementById('token-chance');
const chestsOpenedHud = document.getElementById('chests-opened');

const popup = document.getElementById('loot-popup');
const lootCard = document.getElementById('loot-card');
const lootIcon = document.getElementById('loot-icon');
const lootName = document.getElementById('loot-name');
const lootRarity = document.getElementById('loot-rarity');
const lootImage = document.getElementById('loot-image');
const lootText = document.getElementById('loot-text');
const lootClose = document.getElementById('loot-close');
const lootToCollection = document.getElementById('loot-to-collection');

const collectionGrid = document.getElementById('collection-grid');
const foundCount = document.getElementById('found-count');
const totalCount = document.getElementById('total-count');
const openedCount = document.getElementById('opened-count');
const resetButton = document.getElementById('reset-collection');

// ---------- 4. Стан гри ----------
let luck = LUCK_MIN;
let mapIsVisible = false;
let collection = loadCollection(); // { found: { token: 1, ... }, opened: 5 }

// ---------- 5. Збереження колекції в браузері ----------
function loadCollection() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
        if (saved && saved.found) {
            return saved;
        }
    } catch (error) {
        // Сховище недоступне (наприклад, приватний режим) — почнемо з нуля
    }
    return { found: {}, opened: 0 };
}

function saveCollection() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(collection));
    } catch (error) {
        // Не вдалося зберегти — колекція просто не переживе перезавантаження
    }
}

// ---------- 6. Шанси з урахуванням удачі ----------
function getChances() {
    const chances = {};
    let rest = 100;

    TREASURES.forEach(function (treasure) {
        if (treasure.id === 'gizmo') {
            return;
        }
        // Удача множить шанс рідкісних скарбів
        const value = treasure.boost ? treasure.chance * luck : treasure.chance;
        chances[treasure.id] = value;
        rest -= value;
    });

    chances.gizmo = rest; // залишок — гаджет
    return chances;
}

// Випадково обираємо скарб за шансами
function rollTreasure() {
    const chances = getChances();
    let random = Math.random() * 100;

    for (const treasure of TREASURES) {
        random -= chances[treasure.id];
        if (random < 0) {
            return treasure;
        }
    }
    return TREASURES[0];
}

// Гарний вигляд відсотка: 1% / 0.3% / 12.5%
function formatPercent(value) {
    return (Math.round(value * 10) / 10) + '%';
}

// ---------- 7. Шкала удачі ----------
function updateLuckHud() {
    const percent = (luck - LUCK_MIN) / (LUCK_MAX - LUCK_MIN) * 100;

    luckValue.textContent = 'x' + luck.toFixed(1);
    luckFill.style.width = percent + '%';
    tokenChance.textContent = formatPercent(getChances().token);
    luckBox.classList.toggle('is-max', luck >= LUCK_MAX);
}

// Удача росте лише тоді, коли карта на екрані («ти обираєш точку висадки»)
const observer = new IntersectionObserver(function (entries) {
    mapIsVisible = entries[0].isIntersecting;
}, { threshold: 0.4 });
observer.observe(map);

setInterval(function () {
    if (mapIsVisible && !document.hidden && luck < LUCK_MAX) {
        luck = Math.min(LUCK_MAX, luck + LUCK_PER_SECOND);
        updateLuckHud();
        renderCollection(); // оновлюємо шанси в картках колекції
    }
}, 1000);

// ---------- 8. Відкриття скрині ----------
function openChest(chest) {
    if (chest.classList.contains('is-shaking') || chest.classList.contains('is-opened')) {
        return;
    }

    // Результат визначаємо одразу, щоб скриня з токеном трусилась довше і сяяла
    const treasure = rollTreasure();
    const isJackpot = treasure.boost;

    chest.classList.add('is-shaking');
    chest.classList.toggle('is-jackpot', isJackpot);

    setTimeout(function () {
        chest.classList.remove('is-shaking', 'is-jackpot');
        chest.classList.add('is-opened');
        chest.setAttribute('aria-label', 'Скриня вже відкрита');

        // Зберігаємо знахідку
        collection.found[treasure.id] = (collection.found[treasure.id] || 0) + 1;
        collection.opened += 1;
        saveCollection();

        // Відкрили скриню — удача скидається
        luck = LUCK_MIN;
        updateLuckHud();
        renderCollection();
        showLoot(treasure);

        // Скриня з'являється знову через деякий час
        setTimeout(function () {
            chest.classList.remove('is-opened');
            chest.setAttribute('aria-label', 'Відкрити скриню');
        }, CHEST_RESPAWN);
    }, isJackpot ? JACKPOT_SHAKE_TIME : SHAKE_TIME);
}

chests.forEach(function (chest) {
    chest.addEventListener('click', function () {
        openChest(chest);
    });
});

// ---------- 9. Вікно знахідки ----------
function showLoot(treasure) {
    lootCard.className = 'loot-card r-' + treasure.rarity;
    lootIcon.textContent = treasure.icon;
    lootName.textContent = treasure.name;
    lootRarity.textContent = treasure.rarityName;

    const isToken = treasure.id === 'token';
    lootImage.hidden = !isToken;

    if (isToken) {
        lootText.textContent = 'Неймовірно! У грі цей токен дає 14 днів безкоштовного магазину предметів.';
    } else if (collection.found[treasure.id] === 1) {
        lootText.textContent = 'Новий скарб у твоїй колекції!';
    } else {
        lootText.textContent = 'У тебе вже є таких: ' + collection.found[treasure.id] + '.';
    }

    popup.hidden = false;
    lootClose.focus();
}

function hideLoot() {
    popup.hidden = true;
}

lootClose.addEventListener('click', hideLoot);
lootToCollection.addEventListener('click', hideLoot);

// Закриття кліком по темному фону або клавішею Escape
popup.addEventListener('click', function (event) {
    if (event.target === popup) {
        hideLoot();
    }
});

document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && !popup.hidden) {
        hideLoot();
    }
});

// ---------- 10. Колекція ----------
function renderCollection() {
    const chances = getChances();
    let found = 0;

    collectionGrid.innerHTML = '';

    TREASURES.forEach(function (treasure) {
        const count = collection.found[treasure.id] || 0;
        const card = document.createElement('article');
        card.className = 'treasure-card r-' + treasure.rarity;

        if (count > 0) {
            found += 1;
            card.innerHTML =
                '<span class="treasure-count">×' + count + '</span>' +
                '<span class="treasure-icon" aria-hidden="true">' + treasure.icon + '</span>' +
                '<h3 class="treasure-name">' + treasure.name + '</h3>' +
                '<p class="treasure-rarity">' + treasure.rarityName + '</p>';
        } else {
            card.classList.add('is-locked');
            card.innerHTML =
                '<span class="treasure-icon" aria-hidden="true">' + treasure.icon + '</span>' +
                '<h3 class="treasure-name">???</h3>' +
                '<p class="treasure-rarity">' + treasure.rarityName + '</p>';
        }

        card.innerHTML += '<p class="treasure-chance">Шанс зараз: ' + formatPercent(chances[treasure.id]) + '</p>';
        collectionGrid.appendChild(card);
    });

    foundCount.textContent = found;
    totalCount.textContent = TREASURES.length;
    openedCount.textContent = collection.opened;
    chestsOpenedHud.textContent = collection.opened;
}

resetButton.addEventListener('click', function () {
    if (confirm('Точно скинути всю колекцію?')) {
        collection = { found: {}, opened: 0 };
        saveCollection();
        renderCollection();
    }
});

// ---------- 11. Старт ----------
updateLuckHud();
renderCollection();
