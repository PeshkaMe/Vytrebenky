var socket = window.socket || io('https://vytrebenky.onrender.com');
window.socket = socket;

// ==========================================
// 1. СОКЕТИ ТА ОБРОБКА СЕРВЕРА
// ==========================================
socket.on('chat_message', (data) => {
    addLog(`[${data.user}]: ${data.text}`, 'clear');
});

socket.on('player_loaded', (savedPlayer) => {
    if (savedPlayer) {
        player = savedPlayer;
        if (!player.theme) player.theme = 'original';
        applyTheme(player.theme);
        updateUI();
        addLog("Прогрес успішно завантажено з сервера!", "green");
    } else {
        addLog("Не вдалося завантажити дані персонажа.", "danger");
    }
});

socket.on('auth_success', (res) => {
    currentUser = res.username;
    localStorage.setItem('vanilla_rpg_currentUser', currentUser);
    
    player = res.data;
    if (!player.theme) player.theme = 'original';
    applyTheme(player.theme);
    closeAuthModal();
    addLog(res.message, "clear");
    updateUI();
});

socket.on('auth_error', (errorMsg) => {
    const errorElem = document.getElementById('auth-error');
    if (errorElem) errorElem.textContent = errorMsg;
});

function sendFakeChatMessage() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;

    const userName = (player && player.name) ? player.name : 'Гравець';

    socket.emit('send_chat_message', {
        user: userName,
        text: text
    });

    input.value = "";
}

// ==========================================
// 2. КОНСТАНТИ ТА БАЗОВІ ДАНІ ГРИ
// ==========================================
const REAL_PRODUCTS = {
    "baguette_01": { name: "🥖 Хрусткий Багет", goldCost: 15, realPrice: 45 },
    "coffee_01": { name: "☕ Епічна Кава", goldCost: 30, realPrice: 60 }
};

const EQUIPMENT_TEMPLATES = [
    { id: "sword_01", name: "🗡️ Іржавий меч", slot: "weapon", attack: 5, hp: 10, mp: 0, sp: 0, icon: "🗡️", sellPrice: 15 },
    { id: "armor_01", name: "🛡️ Шкіряна броня", slot: "armor", defense: 4, hp: 15, mp: 0, sp: 0, icon: "🛡️", sellPrice: 15 },
    { id: "helmet_01", name: "⛑️ Капюшон новачка", slot: "helmet", defense: 2, hp: 5, mp: 0, sp: 0, icon: "⛑️", sellPrice: 15 },
    { id: "ring_01",  name: "💍 Кільце удачі", slot: "accessory", attack: 2, sp: 20, hp: 0, mp: 0, icon: "💍", sellPrice: 15 }
];

const ARMOR_DATABASE = {
    // ВОЇН -> ТАНК (HP + Defense)
    tank_a1: { id: 'tank_a1', name: "Важкий щитовий панцир", icon: "🛡️", reqClass: "warrior", reqSubclass: "tank", reqLevel: 1, price: 120, hp: 60, mp: 0, sp: 0, def: 5, atk: 0, crit: 0 },
    tank_a2: { id: 'tank_a2', name: "Бастіонна кіраса", icon: "🥋", reqClass: "warrior", reqSubclass: "tank", reqLevel: 10, price: 1200, hp: 300, mp: 0, sp: 0, def: 22, atk: 0, crit: 0 },

    // ВОЇН -> ДД/БЕРСЕРК (HP + Attack + Crit)
    dd_a1: { id: 'dd_a1', name: "Шкури шаленого вовка", icon: "🐺", reqClass: "warrior", reqSubclass: "dd", reqLevel: 1, price: 120, hp: 35, mp: 0, sp: 0, def: 2, atk: 4, crit: 0.04 },
    dd_a2: { id: 'dd_a2', name: "Обладунок Кривавого Женця", icon: "🩸", reqClass: "warrior", reqSubclass: "dd", reqLevel: 10, price: 1200, hp: 180, mp: 0, sp: 0, def: 10, atk: 18, crit: 0.10 },

    // МАГ -> ВОГОНЬ (Pure Attack)
    fire_a1: { id: 'fire_a1', name: "Мантія Вогняного Спустошення", icon: "🔥", reqClass: "mage", reqSubclass: "fire", reqLevel: 1, price: 120, hp: 10, mp: 35, sp: 0, def: 1, atk: 6, crit: 0.02 },
    fire_a2: { id: 'fire_a2', name: "Ошатість Багряного Полум'я", icon: "🌋", reqClass: "mage", reqSubclass: "fire", reqLevel: 10, price: 1200, hp: 50, mp: 180, sp: 0, def: 3, atk: 28, crit: 0.08 },

    // МАГ -> ВОДА (HP + MP + Def)
    water_a1: { id: 'water_a1', name: "Роб Океанського Спокою", icon: "🌊", reqClass: "mage", reqSubclass: "water", reqLevel: 1, price: 120, hp: 25, mp: 40, sp: 0, def: 3, atk: 2, crit: 0 },
    water_a2: { id: 'water_a2', name: "Мантія Глибоководного Припливу", icon: "🥻", reqClass: "mage", reqSubclass: "water", reqLevel: 10, price: 1200, hp: 120, mp: 220, sp: 0, def: 12, atk: 12, crit: 0 },

    // МАГ -> ЕЛЕКТРИКА (Crit + Attack)
    light_a1: { id: 'light_a1', name: "Плащ Грозового Розряду", icon: "⚡", reqClass: "mage", reqSubclass: "lightning", reqLevel: 1, price: 120, hp: 10, mp: 30, sp: 0, def: 1, atk: 4, crit: 0.06 },
    light_a2: { id: 'light_a2', name: "Шати Володаря Блискавок", icon: "🌩️", reqClass: "mage", reqSubclass: "lightning", reqLevel: 10, price: 1200, hp: 40, mp: 160, sp: 0, def: 4, atk: 20, crit: 0.15 },

    // РЕНДЖЕР -> АСАСІН (Crit + SP + Attack)
    sin_a1: { id: 'sin_a1', name: "Обладунок Нічного Кроку", icon: "🥷", reqClass: "ranger", reqSubclass: "assassin", reqLevel: 1, price: 120, hp: 15, mp: 0, sp: 25, def: 1, atk: 3, crit: 0.08 },
    sin_a2: { id: 'sin_a2', name: "Костюм Тіньового Вбивці", icon: "👤", reqClass: "ranger", reqSubclass: "assassin", reqLevel: 10, price: 1200, hp: 70, mp: 0, sp: 120, def: 5, atk: 15, crit: 0.20 },

    // РЕНДЖЕР -> ЛУЧНИК (SP + Attack)
    arch_a1: { id: 'arch_a1', name: "Легка куртка Слідопита", icon: "🧥", reqClass: "ranger", reqSubclass: "archer", reqLevel: 1, price: 120, hp: 20, mp: 0, sp: 20, def: 2, atk: 4, crit: 0.03 },
    arch_a2: { id: 'arch_a2', name: "Обладунок Окуня Орла", icon: "🦅", reqClass: "ranger", reqSubclass: "archer", reqLevel: 10, price: 1200, hp: 90, mp: 0, sp: 100, def: 8, atk: 22, crit: 0.08 }
};

function canEquip(player, item) {
    if (player.level < item.reqLevel) return false;
    if (item.reqClass !== "any" && player.class !== item.reqClass) return false;
    if (item.reqSubclass && player.subclass !== item.reqSubclass) return false; // Перевірка підкласу!
    return true;
}

const WEAPON_DATABASE = {
    // Воїн
    tank_w1: { id: 'tank_w1', name: "Геральдичний меч і щит", icon: "🛡️⚔️", reqClass: "warrior", reqSubclass: "tank", reqLevel: 1, price: 150, atk: 6, crit: 0, hp: 25, mp: 0, sp: 0, def: 3 },
    dd_w1:   { id: 'dd_w1',   name: "Окровавлена Сокира", icon: "🪓", reqClass: "warrior", reqSubclass: "dd", reqLevel: 1, price: 150, atk: 12, crit: 0.05, hp: 0, mp: 0, sp: 0, def: 0 },

    // Маг
    fire_w1:  { id: 'fire_w1',  name: "Посох Палаючого Вугілля", icon: "🧹🔥", reqClass: "mage", reqSubclass: "fire", reqLevel: 1, price: 150, atk: 14, crit: 0.03, hp: 0, mp: 15, sp: 0, def: 0 },
    water_w1: { id: 'water_w1', name: "Кристальна Крижана Палиця", icon: "🧊", reqClass: "mage", reqSubclass: "water", reqLevel: 1, price: 150, atk: 8, crit: 0, hp: 15, mp: 30, sp: 0, def: 2 },
    light_w1: { id: 'light_w1', name: "Іскровий Жезл", icon: "🪄⚡", reqClass: "mage", reqSubclass: "lightning", reqLevel: 1, price: 150, atk: 10, crit: 0.10, hp: 0, mp: 20, sp: 0, def: 0 },

    // Ренджер
    sin_w1:  { id: 'sin_w1',  name: "Парні Отруєні Клички", icon: "🗡️🧪", reqClass: "ranger", reqSubclass: "assassin", reqLevel: 1, price: 150, atk: 9, crit: 0.10, hp: 0, mp: 0, sp: 15, def: 0 },
    arch_w1: { id: 'arch_w1', name: "Важкий Довгий Лук", icon: "🏹", reqClass: "ranger", reqSubclass: "archer", reqLevel: 1, price: 150, atk: 11, crit: 0.04, hp: 0, mp: 0, sp: 20, def: 0 }
};

const MONSTERS = [
    { name: "🐗 Лютий Кабан", hp: 50, minDmg: 2, maxDmg: 5, level: 1, image: "boar.jpg" },
    { name: "🕷️ Печерний Павук", hp: 70, minDmg: 3, maxDmg: 8, level: 2, image: "spider.jpg" },
    { name: "🐊 Болотяний Гурк", hp: 100, minDmg: 5, maxDmg: 10, level: 3, image: "crocodile.jpg" }
];

const SHOP_ITEMS = [
    { id: "potion_hp_small", name: "🧪 Мале зілля здоров'я", description: "Відновлює 30 HP", price: 4, effect: { hp: 30, mp: 0, sp: 0 }, icon: "🧪" },
    { id: "potion_mp_small", name: "💧 Мале зілля мани", description: "Відновлює 10 MP", price: 6, effect: { hp: 0, mp: 10, sp: 0 }, icon: "💧" },
    { id: "energy_drink",   name: "⚡ Енергетик", description: "Відновлює 20 SP", price: 8, effect: { hp: 0, mp: 0, sp: 20 }, icon: "⚡" },
    { id: "elixir_hp", name: "🧪 Еліксир здоров'я", description: "Відновлює 1000 HP", price: 0, effect: { hp: 1000, mp: 0, sp: 0 }, icon: "🧪" },
    { id: "elixir_mp", name: "💧 Еліксир мани", description: "Відновлює 1000 MP", price: 0, effect: { hp: 0, mp: 1000, sp: 0 }, icon: "💧" },
    { id: "elixir_sp", name: "⚡ Еліксир енергії", description: "Відновлює 1000 SP", price: 0, effect: { hp: 0, mp: 0, sp: 1000 }, icon: "⚡" }
];

const DAILY_QUESTS = [
    { id: 'kills', description: "Вбити 5 монстрів", goal: 5, reward: 15 },
    { id: 'purchases', description: "Купити 1 предмет у магазині", goal: 1, reward: 10 },
    { id: 'skillsUsed', description: "Використати скіли 3 рази", goal: 3, reward: 12 }
];

// ==========================================
// 3. АВТОРИЗАЦІЯ ТА ПРОФІЛЬ
// ==========================================
let currentUser = localStorage.getItem('vanilla_rpg_currentUser') || null;
let player = null;

function changeTheme(themeName) {
    if (!player) return;
    player.theme = themeName;
    localStorage.setItem('vanilla_rpg_theme', themeName);
    applyTheme(themeName);
    savePlayerData();
}

function applyTheme(themeName) {
    const validTheme = ['original', 'light', 'dark'].includes(themeName) ? themeName : 'original';
    document.body.className = `theme-${validTheme}`;
    
    const radioBtn = document.querySelector(`input[name="theme-choice"][value="${validTheme}"]`);
    if (radioBtn) radioBtn.checked = true;
}

function loadPlayer() {
    const localTheme = localStorage.getItem('vanilla_rpg_theme') || 'original';
    applyTheme(localTheme);

    if (currentUser) {
        socket.emit('load_player', currentUser);
        closeAuthModal();
    } else {
        openAuthModal();
    }
}

function savePlayerData() {
    if (player && player.name && currentUser) {
        socket.emit('save_player', {
            name: player.name,
            data: player
        });
    }
}

function openAuthModal() {
    document.getElementById('auth-modal').classList.remove('hidden');
    document.getElementById('main-game-wrapper').classList.add('hidden');
    document.getElementById('auth-error').textContent = '';
    switchAuthTab('login');
}

function closeAuthModal() { 
    document.getElementById('auth-modal').classList.add('hidden'); 
    document.getElementById('main-game-wrapper').classList.remove('hidden');
}

function switchAuthTab(tab) {
    document.getElementById('tab-login').classList.toggle('active', tab === 'login');
    document.getElementById('tab-register').classList.toggle('active', tab === 'register');
    document.getElementById('auth-form-login').classList.toggle('hidden', tab !== 'login');
    document.getElementById('auth-form-register').classList.toggle('hidden', tab !== 'register');
    document.getElementById('auth-error').textContent = '';
}

function register() {
    const username = document.getElementById('reg-username').value.trim();
    const password = document.getElementById('reg-password').value.trim();
    if (!username || !password) { 
        document.getElementById('auth-error').textContent = 'Заповніть всі поля'; 
        return; 
    }

    const localTheme = localStorage.getItem('vanilla_rpg_theme') || 'original';

    const newPlayerData = {
        name: username,
        heroClass: document.getElementById('reg-class').value,
        subClass: document.getElementById('reg-subclass').value,
        gold: 5,
        xp: 0,
        level: 1,
        theme: localTheme,
        inventory: [],
        equipment: { weapon: null, armor: null, helmet: null, accessory: null },
        currentHP: 120,
        currentMP: 15,
        currentSP: 60,
        dailyQuests: { kills: 0, purchases: 0, skillsUsed: 0, lastReset: null }
    };

    socket.emit('register', {
        username: username,
        password: password,
        initialData: newPlayerData
    });
}

function login() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value.trim();
    if (!username || !password) { 
        document.getElementById('auth-error').textContent = 'Заповніть всі поля'; 
        return; 
    }

    socket.emit('login', {
        username: username,
        password: password
    });
}

function logout() {
    if (confirm('Вийти з акаунта?')) {
        currentUser = null;
        player = null;
        localStorage.removeItem('vanilla_rpg_currentUser');
        openAuthModal();
        addLog('Ви вийшли з акаунта.', 'default');
    }
}

// ==========================================
// 4. ЗМІННІ СТАНУ ГРИ
// ==========================================
let currentMonster = null;
let monsterHP = 0;
let selectedItemDetail = null;
let playerBlocking = false;

// ==========================================
// 5. ІНТЕРФЕЙС
// ==========================================
function updateUI() {
    if (!player) return;

    document.getElementById('p-name').innerText = player.name;
    document.getElementById('p-level').innerText = player.level;
    document.getElementById('p-gold').innerText = player.gold;
    document.getElementById('p-xp').innerText = player.xp;
    document.getElementById('p-inv-count').innerText = player.inventory.length;
    
    applyTheme(player.theme || 'original');

    const stats = getStatsWithBonuses();
    document.getElementById('val-hp').innerText = `${player.currentHP}/${stats.maxHP}`;
    document.getElementById('val-mp').innerText = `${player.currentMP}/${stats.maxMP}`;
    document.getElementById('val-sp').innerText = `${player.currentSP}/${stats.maxSP}`;
    
    const statsBox = document.getElementById('stats-box');
    if (statsBox) {
        statsBox.innerHTML = `Сила: ${stats.attack}<br>Захист: ${stats.defense}<br>HP: ${player.currentHP}/${stats.maxHP}<br>MP: ${player.currentMP}/${stats.maxMP}<br>SP: ${player.currentSP}/${stats.maxSP}`;
    }
    
    updateEquipmentSlots();
    savePlayerData();
    renderInventory();
    renderShopIfActive();
    renderQuestsIfActive();
    renderBlacksmithIfActive();
}

function getStatsWithBonuses() {
    if (!player) return { maxHP: 0, maxMP: 0, maxSP: 0, attack: 0, defense: 0, critChance: 0 };
    
    let baseHP = 120 + player.level * 20;
    let baseMP = 10 + player.level * 5;
    let baseSP = 60 + player.level * 10;
    
    let bonusHP = 0, bonusMP = 0, bonusSP = 0, attack = 0, defense = 0, critChance = 0.05; // базовий кріт 5%

    // 1. Бонуси від класу/підкласу
    if (player.heroClass && player.subClass && CLASSES_CONFIG[player.heroClass]) {
        const subData = CLASSES_CONFIG[player.heroClass].subclasses[player.subClass];
        if (subData && subData.bonuses) {
            bonusHP += subData.bonuses.hp || 0;
            bonusMP += subData.bonuses.mp || 0;
            bonusSP += subData.bonuses.sp || 0;
            attack += subData.bonuses.attack || 0;
            defense += subData.bonuses.defense || 0;
            critChance += subData.bonuses.critChance || 0;
        }
    }

    // 2. Бонуси від предметів
    for (let slot in player.equipment) {
        const item = player.equipment[slot];
        if (item) {
            attack += item.attack || 0;
            defense += item.defense || 0;
            bonusHP += item.hp || 0;
            bonusMP += item.mp || 0;
            bonusSP += item.sp || 0;
        }
    }

    return { 
        maxHP: baseHP + bonusHP, 
        maxMP: baseMP + bonusMP, 
        maxSP: baseSP + bonusSP, 
        attack, 
        defense, 
        critChance 
    };
}

function updateEquipmentSlots() {
    if (!player) return;
    const slots = document.querySelectorAll('.equip-slot');
    slots.forEach(slot => {
        const slotType = slot.dataset.slot;
        const item = player.equipment[slotType];
        if (item) {
            slot.textContent = item.icon || '?';
            slot.classList.add('filled');
        } else {
            switch(slotType) {
                case 'weapon': slot.textContent = '⚔️'; break;
                case 'armor': slot.textContent = '🛡️'; break;
                case 'helmet': slot.textContent = '⛑️'; break;
                case 'accessory': slot.textContent = '💍'; break;
            }
            slot.classList.remove('filled');
        }
    });
}

function addLog(message, type = "default") {
    const logBox = document.getElementById('log-box');
    if (!logBox) return;
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    if (type === "clear" || type === true) entry.innerHTML = `<span class="chat-highlight">${message}</span>`;
    else if (type === "danger") entry.innerHTML = `<span class="chat-danger">${message}</span>`;
    else entry.innerHTML = `<span class="chat-system">Система:</span> ${message}`;
    logBox.insertBefore(entry, logBox.firstChild);
    logBox.scrollTop = logBox.scrollHeight;
}

function switchTab(tab) {
    document.getElementById('btn-arena').classList.toggle('active', tab === 'arena');
    document.getElementById('btn-shop').classList.toggle('active', tab === 'shop');
    document.getElementById('btn-guild').classList.toggle('active', tab === 'guild');
    document.getElementById('btn-quests').classList.toggle('active', tab === 'quests');
    document.getElementById('btn-blacksmith').classList.toggle('active', tab === 'blacksmith');
    document.getElementById('btn-settings').classList.toggle('active', tab === 'settings');
    document.getElementById('zone-arena').classList.toggle('hidden', tab !== 'arena');
    document.getElementById('zone-shop').classList.toggle('hidden', tab !== 'shop');
    document.getElementById('zone-guild').classList.toggle('hidden', tab !== 'guild');
    document.getElementById('zone-quests').classList.toggle('hidden', tab !== 'quests');
    document.getElementById('zone-blacksmith').classList.toggle('hidden', tab !== 'blacksmith');
    document.getElementById('zone-settings').classList.toggle('hidden', tab !== 'settings');
    if (tab === 'shop') renderShop();
    if (tab === 'quests') renderQuests();
    if (tab === 'blacksmith') renderBlacksmith();
}

// ==========================================
// 6. БОЙОВА СИСТЕМА
// ==========================================
function searchMonster() {
    if (!player) return;
    if (player.currentHP <= 0) { addLog("Ви надто слабкі, щоб битися.", "danger"); return; }
    if (player.currentSP < 10) { addLog("Недостатньо стаміни (потрібно 10).", "danger"); return; }
    player.currentSP -= 10;
    const monster = MONSTERS[Math.floor(Math.random() * MONSTERS.length)];
    currentMonster = monster;
    monsterHP = monster.hp;
    playerBlocking = false;
    document.getElementById('arena-idle').classList.add('hidden');
    document.getElementById('arena-battle').classList.remove('hidden');
    document.getElementById('bf-p-name').innerText = player.name;
    document.getElementById('bf-p-level').innerText = player.level;
    document.getElementById('bf-p-hp').innerText = `${player.currentHP}/${getStatsWithBonuses().maxHP}`;
    const monsterSprite = document.getElementById('monster-sprite');
    monsterSprite.style.backgroundImage = `url('${monster.image}')`;
    monsterSprite.style.backgroundSize = 'cover';
    monsterSprite.style.backgroundPosition = 'center';
    monsterSprite.style.backgroundRepeat = 'no-repeat';
    monsterSprite.textContent = '';
    document.getElementById('bf-m-name').innerText = monster.name;
    document.getElementById('bf-m-hp').innerText = `${monsterHP}/${monster.hp}`;
    document.getElementById('battle-log').innerHTML = '';
    addBattleLog(`Ви натрапили на ${monster.name}! (витрачено 10 SP)`);
    updateBattleHP();
}

function attackMonster() {
    if (!currentMonster || !player) return;
    const stats = getStatsWithBonuses();
    
    const minDmg = 5 + player.level + stats.attack;
    const maxDmg = 10 + player.level + stats.attack;
    let playerDmg = Math.floor(Math.random() * (maxDmg - minDmg + 1)) + minDmg;

    // Перевірка на критичний удар
    const isCrit = Math.random() < stats.critChance;
    if (isCrit) {
        playerDmg = Math.floor(playerDmg * 1.8); // +80% шкоди при кріті
        addBattleLog(`💥 КРИТИЧНИЙ УДАР! Ви завдали ${playerDmg} шкоди!`);
    } else {
        addBattleLog(`Ви завдали ${playerDmg} шкоди ${currentMonster.name}.`);
    }

    monsterHP -= playerDmg;
    if (monsterHP < 0) monsterHP = 0;
    
    updateBattleHP();
    if (monsterHP <= 0) { endBattle(true); return; }
    monsterAttack();
}

function monsterAttack() {
    if (!currentMonster || !player) return;
    const monster = currentMonster;
    let dmg = Math.floor(Math.random() * (monster.maxDmg - monster.minDmg + 1)) + monster.minDmg;
    if (playerBlocking) { dmg = Math.floor(dmg / 2); addBattleLog(`Ви заблокували частину шкоди!`); playerBlocking = false; }
    player.currentHP -= dmg;
    if (player.currentHP < 0) player.currentHP = 0;
    addBattleLog(`${monster.name} завдав вам ${dmg} шкоди.`);
    updateBattleHP();
    if (player.currentHP <= 0) endBattle(false);
}

function updateBattleHP() {
    if (!player || !currentMonster) return;
    const stats = getStatsWithBonuses();
    document.getElementById('bf-p-hp').innerText = `${player.currentHP}/${stats.maxHP}`;
    const playerBar = document.querySelector('.player-side .hp-bar');
    if (playerBar) playerBar.style.width = `${(player.currentHP / stats.maxHP) * 100}%`;
    document.getElementById('bf-m-hp').innerText = `${monsterHP}/${currentMonster.hp}`;
    const monsterBar = document.querySelector('.monster-side .hp-bar');
    if (monsterBar) monsterBar.style.width = `${(monsterHP / currentMonster.hp) * 100}%`;
}

function addBattleLog(msg) {
    const log = document.getElementById('battle-log');
    if (!log) return;
    const div = document.createElement('div');
    div.className = 'log-entry';
    div.textContent = msg;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
}

function endBattle(victory) {
    if (!player) return;
    playerBlocking = false;
    if (victory) {
        player.dailyQuests.kills = (player.dailyQuests.kills || 0) + 1;
        checkDailyReset();
        const goldGained = Math.floor(Math.random() * 4) + 3;
        player.gold += goldGained;
        player.xp += 15;
        if (player.xp >= 100) { player.level += 1; player.xp -= 100; addLog(`Вітаємо! Рівень ${player.level}!`, "clear"); }
        let dropMessage = "";
        if (Math.random() < 0.20) {
            const template = EQUIPMENT_TEMPLATES[Math.floor(Math.random() * EQUIPMENT_TEMPLATES.length)];
            const newEquip = {
                type: 'equip',
                id: template.id,
                instanceId: Date.now().toString() + Math.random(),
                status: 'DROPPED',
                attack: template.attack,
                defense: template.defense,
                hp: template.hp,
                mp: template.mp,
                sp: template.sp,
                icon: template.icon,
                name: template.name,
                slot: template.slot,
                sellPrice: template.sellPrice,
                upgradeLevel: 0
            };
            player.inventory.push(newEquip);
            dropMessage = `🎒 Ви знайшли предмет: ${template.name}!`;
            addBattleLog(dropMessage);
            addLog(dropMessage, "clear");
        }
        addBattleLog(`Перемога! +${goldGained} золота.${dropMessage ? ' ' + dropMessage : ''}`);
    } else {
        const goldLost = Math.floor(Math.random() * 2) + 1;
        player.gold = Math.max(0, player.gold - goldLost);
        addBattleLog(`Поразка... Втрачено ${goldLost} золота.`);
        addLog(`Ви програли битву. Втрачено ${goldLost} золота.`, "danger");
        player.currentHP = Math.max(10, Math.floor(getStatsWithBonuses().maxHP * 0.1));
    }
    document.getElementById('arena-idle').classList.remove('hidden');
    document.getElementById('arena-battle').classList.add('hidden');
    currentMonster = null;
    updateUI();
}

function fleeBattle() {
    addBattleLog("Ви втекли з бою!");
    addLog("Ви втекли з поля бою.", "danger");
    document.getElementById('arena-idle').classList.remove('hidden');
    document.getElementById('arena-battle').classList.add('hidden');
    currentMonster = null;
    playerBlocking = false;
    updateUI();
}

function skillPowerAttack() {
    if (!currentMonster || !player) return;
    if (player.currentSP < 15) { addBattleLog("Недостатньо SP (потрібно 15)."); return; }
    player.currentSP -= 15;
    player.dailyQuests.skillsUsed = (player.dailyQuests.skillsUsed || 0) + 1;
    const stats = getStatsWithBonuses();
    const minDmg = 5 + player.level + stats.attack;
    const maxDmg = 10 + player.level + stats.attack;
    const baseDmg = Math.floor(Math.random() * (maxDmg - minDmg + 1)) + minDmg;
    const playerDmg = baseDmg * 2;
    monsterHP -= playerDmg;
    if (monsterHP < 0) monsterHP = 0;
    addBattleLog(`⚡ Сильний удар! Завдано ${playerDmg} шкоди.`);
    updateBattleHP();
    if (monsterHP <= 0) { endBattle(true); return; }
    monsterAttack();
}

function skillHeal() {
    if (!currentMonster || !player) return;
    if (player.currentMP < 10) { addBattleLog("Недостатньо MP (потрібно 10)."); return; }
    player.currentMP -= 10;
    player.dailyQuests.skillsUsed = (player.dailyQuests.skillsUsed || 0) + 1;
    const stats = getStatsWithBonuses();
    const healAmount = Math.floor(Math.random() * 11) + 20;
    player.currentHP = Math.min(player.currentHP + healAmount, stats.maxHP);
    addBattleLog(`💚 Вилікувано ${healAmount} HP.`);
    updateBattleHP();
    monsterAttack();
}

function skillBlock() {
    if (!currentMonster || !player) return;
    if (player.currentSP < 10) { addBattleLog("Недостатньо SP (потрібно 10)."); return; }
    player.currentSP -= 10;
    player.dailyQuests.skillsUsed = (player.dailyQuests.skillsUsed || 0) + 1;
    playerBlocking = true;
    addBattleLog("🛡️ Блок активовано!");
    monsterAttack();
}

setInterval(() => {
    if (!currentMonster && player && player.currentSP < getStatsWithBonuses().maxSP) {
        player.currentSP = Math.min(player.currentSP + 1, getStatsWithBonuses().maxSP);
        updateUI();
    }
}, 10000);

function renderBattleSkills() {
    const container = document.getElementById('battle-skills-container');
    if (!container || !player) return;

    container.innerHTML = '';

    if (!player.heroClass || !player.subClass) return;

    const subData = CLASSES_CONFIG[player.heroClass]?.subclasses[player.subClass];
    if (!subData) return;

    subData.skills.forEach(skill => {
        const btn = document.createElement('button');
        btn.className = 'skill-btn power-btn';
        
        let costText = "";
        if (skill.spCost > 0) costText += `${skill.spCost} SP`;
        if (skill.mpCost > 0) costText += `${skill.mpCost} MP`;

        btn.innerText = `${skill.name} (${costText})`;
        btn.onclick = () => useClassSkill(skill);
        container.appendChild(btn);
    });
}

// ==========================================
// 7. ЗАВДАННЯ, МАГАЗИН, КОВАЛЬ
// ==========================================
function checkDailyReset() {
    if (!player) return;
    if (!player.dailyQuests) player.dailyQuests = { kills: 0, purchases: 0, skillsUsed: 0, lastReset: null };
    const today = new Date().toDateString();
    if (player.dailyQuests.lastReset !== today) {
        player.dailyQuests.kills = 0;
        player.dailyQuests.purchases = 0;
        player.dailyQuests.skillsUsed = 0;
        player.dailyQuests.lastReset = today;
    }
}

function renderQuests() {
    if (!player) return;
    checkDailyReset();
    const container = document.getElementById('quests-container');
    if (!container) return;
    container.innerHTML = '';
    DAILY_QUESTS.forEach(quest => {
        const progress = player.dailyQuests[quest.id] || 0;
        const completed = progress >= quest.goal;
        const card = document.createElement('div');
        card.className = `quest-card${completed ? ' completed' : ''}`;
        card.innerHTML = `
            <div class="quest-info">
                <div class="quest-title">${quest.description}</div>
                <div class="quest-progress">${progress}/${quest.goal}</div>
            </div>
            <button class="quest-reward" ${completed ? '' : 'disabled'} onclick="claimQuestReward('${quest.id}')">🎁 ${quest.reward} золота</button>
        `;
        container.appendChild(card);
    });
}

function claimQuestReward(questId) {
    if (!player) return;
    const quest = DAILY_QUESTS.find(q => q.id === questId);
    if (!quest) return;
    if ((player.dailyQuests[questId] || 0) < quest.goal) return;
    player.gold += quest.reward;
    player.dailyQuests[questId] = 0;
    addLog(`Завдання "${quest.description}" виконано! +${quest.reward} золота.`, "clear");
    updateUI();
}

function renderShopIfActive() {
    if (document.getElementById('zone-shop') && !document.getElementById('zone-shop').classList.contains('hidden')) renderShop();
}
function renderQuestsIfActive() {
    if (document.getElementById('zone-quests') && !document.getElementById('zone-quests').classList.contains('hidden')) renderQuests();
}
function renderBlacksmithIfActive() {
    if (document.getElementById('zone-blacksmith') && !document.getElementById('zone-blacksmith').classList.contains('hidden')) renderBlacksmith();
}

function renderShop() {
    const grid = document.getElementById('shop-grid');
    if (!grid) return;
    grid.innerHTML = '';
    SHOP_ITEMS.forEach(item => {
        const card = document.createElement('div');
        card.className = 'shop-item';
        card.innerHTML = `
            <h4>${item.icon} ${item.name}</h4>
            <p>${item.description}</p>
            <p><strong>${item.price} золота</strong></p>
            <button onclick="buyItem('${item.id}')">Купити</button>
        `;
        grid.appendChild(card);
    });
}

function buyItem(itemId) {
    if (!player) return;
    const shopItem = SHOP_ITEMS.find(i => i.id === itemId);
    if (!shopItem) return;
    if (player.gold < shopItem.price) { addLog("Недостатньо золота!", "danger"); return; }
    player.gold -= shopItem.price;
    player.inventory.push({ type: 'consumable', id: shopItem.id, instanceId: Date.now().toString() + Math.random(), status: 'AVAILABLE' });
    player.dailyQuests.purchases = (player.dailyQuests.purchases || 0) + 1;
    checkDailyReset();
    addLog(`Придбано ${shopItem.name}.`, "clear");
    updateUI();
}

function renderBlacksmith() {
    if (!player) return;
    const container = document.getElementById('blacksmith-list');
    if (!container) return;
    container.innerHTML = '';
    
    const allEquip = [];
    for (let slot in player.equipment) {
        const item = player.equipment[slot];
        if (item) allEquip.push({ ...item, source: 'equipped', slot });
    }
    player.inventory.forEach(item => {
        if (item.type === 'equip') allEquip.push({ ...item, source: 'inventory', index: player.inventory.indexOf(item) });
    });

    if (allEquip.length === 0) {
        container.innerHTML = '<p>Немає предметів для покращення.</p>';
        return;
    }

    allEquip.forEach(item => {
        const nextLevel = (item.upgradeLevel || 0) + 1;
        const maxLevel = 5;
        const canUpgrade = nextLevel <= maxLevel;
        const cost = nextLevel * 50;
        const card = document.createElement('div');
        card.className = 'blacksmith-item';
        card.innerHTML = `
            <div class="blacksmith-info">
                <strong>${item.icon} ${item.name}</strong> (Рівень ${item.upgradeLevel || 0})
                <div class="blacksmith-stats">
                    Атака: ${item.attack || 0}, Захист: ${item.defense || 0}, HP: +${item.hp || 0}, MP: +${item.mp || 0}, SP: +${item.sp || 0}
                </div>
            </div>
            <button class="blacksmith-upgrade" ${canUpgrade ? '' : 'disabled'} onclick="upgradeItem('${item.instanceId}', '${item.source}', '${item.slot || ''}', ${item.index || -1})">
                ${canUpgrade ? `Покращити (${cost} зол.)` : 'Макс. рівень'}
            </button>
        `;
        container.appendChild(card);
    });
}

function upgradeItem(instanceId, source, slot, index) {
    if (!player) return;
    let item = null;
    if (source === 'equipped') {
        item = player.equipment[slot];
    } else if (source === 'inventory') {
        item = player.inventory[index];
    }
    if (!item) return;

    const nextLevel = (item.upgradeLevel || 0) + 1;
    const cost = nextLevel * 50;
    if (player.gold < cost) {
        addLog("Недостатньо золота для покращення!", "danger");
        return;
    }
    
    player.gold -= cost;
    item.upgradeLevel = nextLevel;
    if (item.attack) item.attack += 2;
    if (item.defense) item.defense += 1;
    if (item.hp) item.hp += 5;
    if (item.sp) item.sp += 2;
    
    addLog(`${item.name} покращено до рівня ${nextLevel}!`, "clear");
    updateUI();
}

// ==========================================
// 8. ІНВЕНТАР ТА ПРЕДМЕТИ
// ==========================================
function renderInventory() {
    if (!player) return;
    const grid = document.getElementById('inventory-grid');
    if (!grid) return;
    grid.innerHTML = '';
    if (player.inventory.length === 0) {
        grid.innerHTML = '<p style="grid-column: 1 / -1; text-align: center;">Порожньо</p>';
        return;
    }
    player.inventory.forEach(item => {
        let cell = document.createElement('div');
        cell.className = 'inv-cell';
        let icon = '', name = '';
        if (item.type === 'equip') {
            icon = item.icon || '?';
            name = item.name;
            cell.classList.add('equip');
        } else if (item.type === 'consumable') {
            const cons = SHOP_ITEMS.find(c => c.id === item.id);
            if (!cons) return;
            icon = cons.icon; name = cons.name;
            cell.classList.add('consumable');
        } else return;
        cell.innerHTML = `<div class="item-icon">${icon}</div><div class="item-name">${name}</div>`;
        cell.addEventListener('click', () => showItemDetail(item));
        grid.appendChild(cell);
    });
}

function showItemDetail(item) {
    selectedItemDetail = item.instanceId;
    const modal = document.getElementById('item-detail-modal');
    document.getElementById('detail-stats').innerHTML = '';
    
    if (item.type === 'equip') {
        document.getElementById('detail-title').innerText = `${item.name} (Рівень ${item.upgradeLevel || 0})`;
        document.getElementById('detail-stats').innerHTML = `<p>🗡️ Атака: ${item.attack||0}</p><p>🛡️ Захист: ${item.defense||0}</p><p>❤️ HP: +${item.hp||0}</p><p>💧 MP: +${item.mp||0}</p><p>⚡ SP: +${item.sp||0}</p><p>💰 Ціна продажу: ${item.sellPrice || 15} золота</p>`;
        document.getElementById('detail-primary-btn').innerText = '⚔️ Екіпірувати';
        document.getElementById('detail-primary-btn').onclick = () => { equipItem(selectedItemDetail); closeItemDetail(); };
    } else if (item.type === 'consumable') {
        const cons = SHOP_ITEMS.find(c => c.id === item.id);
        document.getElementById('detail-title').innerText = cons ? cons.name : item.id;
        document.getElementById('detail-stats').innerHTML = `<p>${cons ? cons.description : ''}</p>`;
        document.getElementById('detail-primary-btn').innerText = '🧪 Використати';
        document.getElementById('detail-primary-btn').onclick = () => { useConsumable(selectedItemDetail); closeItemDetail(); };
    }

    document.getElementById('detail-sell-btn').onclick = () => { sellItem(selectedItemDetail); closeItemDetail(); };
    document.getElementById('detail-discard-btn').onclick = () => { discardItem(selectedItemDetail); closeItemDetail(); };

    modal.classList.remove('hidden');
}

function closeItemDetail() {
    document.getElementById('item-detail-modal').classList.add('hidden');
    selectedItemDetail = null;
}

function equipItem(instanceId) {
    if (!player) return;
    const index = player.inventory.findIndex(i => i.instanceId === instanceId);
    if (index === -1) return;
    const item = player.inventory[index];
    const slot = item.slot;

    if (player.equipment[slot]) {
        player.inventory.push(player.equipment[slot]);
    }

    player.equipment[slot] = item;
    player.inventory.splice(index, 1);
    addLog(`Екіпіровано: ${item.name}`, "clear");
    updateUI();
}

function unequipItem(slot) {
    if (!player) return;
    const item = player.equipment[slot];
    if (!item) return;
    player.equipment[slot] = null;
    player.inventory.push(item);
    addLog(`Знято: ${item.name}`, "clear");
    updateUI();
}

function useConsumable(instanceId) {
    if (!player) return;
    const index = player.inventory.findIndex(i => i.instanceId === instanceId);
    if (index === -1) return;
    const item = player.inventory[index];
    const cons = SHOP_ITEMS.find(c => c.id === item.id);
    if (!cons) return;

    const stats = getStatsWithBonuses();
    if (cons.effect.hp) player.currentHP = Math.min(player.currentHP + cons.effect.hp, stats.maxHP);
    if (cons.effect.mp) player.currentMP = Math.min(player.currentMP + cons.effect.mp, stats.maxMP);
    if (cons.effect.sp) player.currentSP = Math.min(player.currentSP + cons.effect.sp, stats.maxSP);

    player.inventory.splice(index, 1);
    addLog(`Використано: ${cons.name}`, "clear");
    updateUI();
}

function sellItem(instanceId) {
    if (!player) return;
    const index = player.inventory.findIndex(i => i.instanceId === instanceId);
    if (index === -1) return;
    const item = player.inventory[index];
    const price = item.sellPrice || 10;
    player.gold += price;
    player.inventory.splice(index, 1);
    addLog(`Продано ${item.name} за ${price} золота.`, "clear");
    updateUI();
}

function discardItem(instanceId) {
    if (!player) return;
    const index = player.inventory.findIndex(i => i.instanceId === instanceId);
    if (index === -1) return;
    const item = player.inventory[index];
    player.inventory.splice(index, 1);
    addLog(`Викинуто: ${item.name}`, "danger");
    updateUI();
}

function resetGame() {
    if (!player) return;
    if (confirm("Ви впевнені, що хочете скинути персонажа? Всі дані будуть втрачені.")) {
        player.gold = 5;
        player.xp = 0;
        player.level = 1;
        player.inventory = [];
        player.equipment = { weapon: null, armor: null, helmet: null, accessory: null };
        player.currentHP = 120;
        player.currentMP = 15;
        player.currentSP = 60;
        savePlayerData();
        updateUI();
        addLog("Персонажа скинуто.", "danger");
    }
}
//============================
//Класи
//============================

const CLASSES_CONFIG = {
    warrior: {
        name: "Воїн",
        subclasses: {
            tank: {
                name: "Танк",
                desc: "Високий запас HP та броня",
                bonuses: { hp: 50, defense: 5, attack: 0, critChance: 0 },
                skills: [
                    { id: 'shield_bash', name: "🛡️ Удар щитом", spCost: 10, mpCost: 0, desc: "Шкода + засліплення/блокування" },
                    { id: 'taunt', name: "🧱 Захисна стійка", spCost: 15, mpCost: 0, desc: "Збільшує захист на декілька ходів" }
                ]
            },
            dd: {
                name: "ДД (Берсерк)",
                desc: "Великий урон та високий шанс критичного удару",
                bonuses: { hp: 0, defense: 0, attack: 8, critChance: 0.20 }, // 20% кріту
                skills: [
                    { id: 'heavy_slash', name: "⚔️ Важкий розруб", spCost: 15, mpCost: 0, desc: "Потрійна шкода" },
                    { id: 'frenzy', name: "🔥 Лють", spCost: 20, mpCost: 0, desc: "Збільшує урон на наступний ход" }
                ]
            }
        }
    },
    mage: {
        name: "Маг",
        subclasses: {
            fire: {
                name: "Маг Вогню",
                desc: "Величезний урон по площі та горіння",
                bonuses: { mp: 30, attack: 6, critChance: 0.10 },
                skills: [
                    { id: 'fireball', name: "🔥 Вогняна куля", spCost: 0, mpCost: 12, desc: "Сильний магічний урон" },
                    { id: 'burn', name: "🌋 Підпал", spCost: 0, mpCost: 15, desc: "Періодичний урон" }
                ]
            },
            water: {
                name: "Маг Води",
                desc: "Самолікування та контроль",
                bonuses: { mp: 40, hp: 20, defense: 2 },
                skills: [
                    { id: 'heal_wave', name: "🌊 Хвиля зцілення", spCost: 0, mpCost: 10, desc: "Відновлює 40 HP" },
                    { id: 'ice_shield', name: "🧊 Крижана броня", spCost: 0, mpCost: 12, desc: "Дає +10 до захисту" }
                ]
            },
            lightning: {
                name: "Маг Електрики",
                desc: "Критичні розряди та висока швидкість",
                bonuses: { mp: 25, attack: 4, critChance: 0.25 },
                skills: [
                    { id: 'lightning_bolt', name: "⚡ Блискавка", spCost: 0, mpCost: 10, desc: "Швидка шкода з високим крітом" },
                    { id: 'chain_light', name: "🌩️ Ланцюгова блискавка", spCost: 0, mpCost: 18, desc: "Масований розряд" }
                ]
            }
        }
    },
    ranger: {
        name: "Ренджер",
        subclasses: {
            assassin: {
                name: "Асасін (2 кинджали)",
                desc: "Швидкі подвійні удари та критична шкода",
                bonuses: { sp: 30, attack: 5, critChance: 0.30 },
                skills: [
                    { id: 'double_stab', name: "🗡️🗡️ Подвійний укол", spCost: 12, mpCost: 0, desc: "2 швидкі атаки" },
                    { id: 'poison_blade', name: "🧪 Отруєне лезо", spCost: 15, mpCost: 0, desc: "Шкода + отрута" }
                ]
            },
            archer: {
                name: " Лучник",
                desc: "Далекий бій, точність та виснаження",
                bonuses: { sp: 20, attack: 7, critChance: 0.15 },
                skills: [
                    { id: 'aimed_shot', name: "🎯 Прицільний постріл", spCost: 10, mpCost: 0, desc: "Ігнорує броню" },
                    { id: 'arrow_rain', name: "🏹 Град стріл", spCost: 20, mpCost: 0, desc: "Потрійний постріл" }
                ]
            }
        }
    }
};

function updateSubclassDropdown() {
    const classVal = document.getElementById('reg-class').value;
    const subSelect = document.getElementById('reg-subclass');
    subSelect.innerHTML = '';

    const subClasses = CLASSES_CONFIG[classVal].subclasses;
    for (let key in subClasses) {
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = `${subClasses[key].name} (${subClasses[key].desc})`;
        subSelect.appendChild(opt);
    }

}



// Ініціалізація при завантаженні
window.onload = () => {
    loadPlayer();
    if (typeof updateSubclassDropdown === 'function') {
        updateSubclassDropdown(); // заповнює підкласи для першого завантаження формочки
    }
};
