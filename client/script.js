var socket = window.socket || io('https://vytrebenky.onrender.com');
window.socket = socket;

// 2. Слухаємо повідомлення чату
socket.on('chat_message', (data) => {
    addLog(`[${data.user}]: ${data.text}`, 'clear');
});

// 3. Відповідь сервера із збереженими даними
socket.on('player_loaded', (savedPlayer) => {
    if (savedPlayer) {
        player = savedPlayer; // Відновлюємо збереженого персонажа
        if (typeof updateUI === 'function') updateUI();
        addLog("Прогрес успішно завантажено з сервера!", "green");
    } else {
        addLog("Створено нового персонажа.", "yellow");
    }
});

// 4. Функція відправки повідомлень
function sendFakeChatMessage() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;

    // Безпечна перевірка наявності об'єкта player
    const userName = (typeof player !== 'undefined' && player && player.name) ? player.name : 'Гість';

    socket.emit('send_chat_message', {
        user: userName,
        text: text
    });

    input.value = "";
}
// ==========================================
// 1. КОНСТАНТИ ТА БАЗОВІ ДАНІ ГРИ
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
// 2. АВТОРИЗАЦІЯ (з міграцією)
// ==========================================
let users = JSON.parse(localStorage.getItem('vanilla_rpg_users')) || {};
let currentUser = localStorage.getItem('vanilla_rpg_currentUser') || null;

let guestPlayer = {
    name: "Гість",
    gold: 5,
    xp: 0,
    level: 1,
    inventory: [],
    equipment: { weapon: null, armor: null, helmet: null, accessory: null },
    currentHP: 120,
    currentMP: 15,
    currentSP: 60,
    dailyQuests: { kills: 0, purchases: 0, skillsUsed: 0, lastReset: null }
};

let player;

function migrateItem(item) {
    if (!item) return null;
    // Якщо предмет не має типу або це старі дані
    if (!item.type) {
        const template = EQUIPMENT_TEMPLATES.find(t => t.id === item.id);
        if (template) {
            return {
                type: 'equip',
                id: template.id,
                instanceId: item.instanceId || (Date.now().toString() + Math.random()),
                status: item.status || 'DROPPED',
                attack: item.attack !== undefined ? item.attack : template.attack,
                defense: item.defense !== undefined ? item.defense : template.defense,
                hp: item.hp !== undefined ? item.hp : template.hp,
                mp: item.mp !== undefined ? item.mp : template.mp,
                sp: item.sp !== undefined ? item.sp : template.sp,
                icon: template.icon,
                name: template.name,
                slot: template.slot,
                sellPrice: template.sellPrice,
                upgradeLevel: item.upgradeLevel || 0
            };
        } else {
            return null; // невідомий предмет — видаляємо
        }
    }
    if (item.type === 'equip') {
        const template = EQUIPMENT_TEMPLATES.find(t => t.id === item.id);
        if (template) {
            return {
                ...item,
                attack: item.attack !== undefined ? item.attack : template.attack,
                defense: item.defense !== undefined ? item.defense : template.defense,
                hp: item.hp !== undefined ? item.hp : template.hp,
                mp: item.mp !== undefined ? item.mp : template.mp,
                sp: item.sp !== undefined ? item.sp : template.sp,
                icon: template.icon,
                name: template.name,
                slot: template.slot,
                sellPrice: item.sellPrice !== undefined ? item.sellPrice : template.sellPrice,
                upgradeLevel: item.upgradeLevel || 0
            };
        } else {
            return null;
        }
    }
    if (item.type === 'license' || item.type === 'consumable') {
        return item;
    }
    return null;
}

function loadPlayer() {
    if (currentUser && users[currentUser]) {
        player = users[currentUser].data;

        // Міграція інвентаря
        if (player.inventory) {
            player.inventory = player.inventory.map(migrateItem).filter(item => item !== null);
        } else {
            player.inventory = [];
        }

        // Міграція екіпіровки
        if (!player.equipment) {
            player.equipment = { weapon: null, armor: null, helmet: null, accessory: null };
        } else {
            for (let slot in player.equipment) {
                player.equipment[slot] = migrateItem(player.equipment[slot]);
            }
        }

        if (player.currentHP === undefined) player.currentHP = 120;
        if (player.currentMP === undefined) player.currentMP = 15;
        if (player.currentSP === undefined) player.currentSP = 60;
        if (!player.dailyQuests) player.dailyQuests = { kills: 0, purchases: 0, skillsUsed: 0, lastReset: null };
        checkDailyReset();
    } else {
        player = guestPlayer;
        checkDailyReset();
    }
}

function savePlayerData() {
    if (player && player.name) {
        // Відправляємо на сервер нікнейм та об'єкт персонажа
        socket.emit('save_player', {
            name: player.name,
            data: player
        });
    }
}

// При вході чи виборі нікнейму викликаємо завантаження:
function loadPlayerData(name) {
    socket.emit('load_player', name);
}

function updateAuthButton() {
    const btn = document.getElementById('auth-button');
    if (currentUser) {
        btn.textContent = currentUser;
        btn.onclick = logout;
    } else {
        btn.textContent = 'Увійти / Зареєструватися';
        btn.onclick = openAuthModal;
    }
}

function openAuthModal() {
    document.getElementById('auth-modal').classList.remove('hidden');
    document.getElementById('auth-error').textContent = '';
    switchAuthTab('login');
}

function closeAuthModal() { document.getElementById('auth-modal').classList.add('hidden'); }

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
    if (!username || !password) { document.getElementById('auth-error').textContent = 'Заповніть всі поля'; return; }
    if (users[username]) { document.getElementById('auth-error').textContent = 'Користувач з таким логіном вже існує'; return; }
    users[username] = {
        password: password,
        data: {
            name: username,
            gold: 5,
            xp: 0,
            level: 1,
            inventory: [],
            equipment: { weapon: null, armor: null, helmet: null, accessory: null },
            currentHP: 120,
            currentMP: 15,
            currentSP: 60,
            dailyQuests: { kills: 0, purchases: 0, skillsUsed: 0, lastReset: null }
        }
    };
    localStorage.setItem('vanilla_rpg_users', JSON.stringify(users));
    currentUser = username;
    localStorage.setItem('vanilla_rpg_currentUser', currentUser);
    loadPlayer();
    closeAuthModal();
    updateAuthButton();
    addLog(`Ласкаво просимо, ${username}! Ваш персонаж готовий до пригод.`, 'clear');
    updateUI();
}

function login() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value.trim();
    if (!username || !password) { document.getElementById('auth-error').textContent = 'Заповніть всі поля'; return; }
    if (!users[username] || users[username].password !== password) { document.getElementById('auth-error').textContent = 'Невірний логін або пароль'; return; }
    currentUser = username;
    localStorage.setItem('vanilla_rpg_currentUser', currentUser);
    loadPlayer();
    closeAuthModal();
    updateAuthButton();
    addLog(`З поверненням, ${username}!`, 'clear');
    updateUI();
}

function logout() {
    if (confirm('Вийти з акаунта? Не збережені дані гостя будуть втрачені.')) {
        currentUser = null;
        localStorage.removeItem('vanilla_rpg_currentUser');
        player = guestPlayer;
        updateAuthButton();
        updateUI();
        addLog('Ви вийшли з акаунта.', 'default');
    }
}

// ==========================================
// 3. ЗМІННІ СТАНУ ГРИ
// ==========================================
let currentMonster = null;
let monsterHP = 0;
let selectedItemDetail = null;
let playerBlocking = false;

// ==========================================
// 4. ІНТЕРФЕЙС
// ==========================================
function updateUI() {
    document.getElementById('p-name').innerText = player.name;
    document.getElementById('p-level').innerText = player.level;
    document.getElementById('p-gold').innerText = player.gold;
    document.getElementById('p-xp').innerText = player.xp;
    document.getElementById('p-inv-count').innerText = player.inventory.length;
    
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
    const baseHP = 120 + player.level * 20;
    const baseMP = 10 + player.level * 5;
    const baseSP = 60 + player.level * 10;
    let bonusHP = 0, bonusMP = 0, bonusSP = 0, attack = 0, defense = 0;
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
    return { maxHP: baseHP + bonusHP, maxMP: baseMP + bonusMP, maxSP: baseSP + bonusSP, attack, defense };
}

function updateEquipmentSlots() {
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
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    if (type === "clear" || type === true) entry.innerHTML = `<span class="chat-highlight">${message}</span>`;
    else if (type === "danger") entry.innerHTML = `<span class="chat-danger">${message}</span>`;
    else entry.innerHTML = `<span class="chat-system">Доглядач:</span> ${message}`;
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
// 5. БОЙОВА СИСТЕМА
// ==========================================
function searchMonster() {
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
    if (!currentMonster) return;
    const stats = getStatsWithBonuses();
    const minDmg = 5 + player.level + stats.attack;
    const maxDmg = 10 + player.level + stats.attack;
    const playerDmg = Math.floor(Math.random() * (maxDmg - minDmg + 1)) + minDmg;
    monsterHP -= playerDmg;
    if (monsterHP < 0) monsterHP = 0;
    addBattleLog(`Ви завдали ${playerDmg} шкоди ${currentMonster.name}.`);
    updateBattleHP();
    if (monsterHP <= 0) { endBattle(true); return; }
    monsterAttack();
}

function monsterAttack() {
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
    const div = document.createElement('div');
    div.className = 'log-entry';
    div.textContent = msg;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
}

function endBattle(victory) {
    playerBlocking = false;
    if (victory) {
        player.dailyQuests.kills = (player.dailyQuests.kills || 0) + 1;
        checkDailyReset();
        const goldGained = Math.floor(Math.random() * 4) + 3;
        player.gold += goldGained;
        player.xp += 15;
        if (player.xp >= 100) { player.level += 1; player.xp -= 100; addLog(`Вітаємо! Рівень ${player.level}!`, "clear"); }
        let dropMessage = "";
        if (Math.random() < 0.001) {
            const keys = Object.keys(REAL_PRODUCTS);
            const randomKey = keys[Math.floor(Math.random() * keys.length)];
            player.inventory.push({ type: 'license', id: randomKey, instanceId: Date.now().toString() + Math.random(), status: 'DROPPED' });
            dropMessage = `✨ НЕЙМОВІРНО! Випала ліцензія на "${REAL_PRODUCTS[randomKey].name}"!`;
            addBattleLog(dropMessage);
            addLog(dropMessage, "clear");
        } else if (Math.random() < 0.20) {
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

// Скіли
function skillPowerAttack() {
    if (!currentMonster) return;
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
    if (!currentMonster) return;
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
    if (!currentMonster) return;
    if (player.currentSP < 10) { addBattleLog("Недостатньо SP (потрібно 10)."); return; }
    player.currentSP -= 10;
    player.dailyQuests.skillsUsed = (player.dailyQuests.skillsUsed || 0) + 1;
    playerBlocking = true;
    addBattleLog("🛡️ Блок активовано!");
    monsterAttack();
}

// Пасивне відновлення SP
setInterval(() => {
    if (!currentMonster && player && player.currentSP < getStatsWithBonuses().maxSP) {
        player.currentSP = Math.min(player.currentSP + 1, getStatsWithBonuses().maxSP);
        updateUI();
    }
}, 10000);

// ==========================================
// 6. ЗАВДАННЯ
// ==========================================
function checkDailyReset() {
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
    const quest = DAILY_QUESTS.find(q => q.id === questId);
    if (!quest) return;
    if ((player.dailyQuests[questId] || 0) < quest.goal) return;
    player.gold += quest.reward;
    player.dailyQuests[questId] = 0;
    addLog(`Завдання "${quest.description}" виконано! +${quest.reward} золота.`, "clear");
    updateUI();
}

// ==========================================
// 7. МАГАЗИН
// ==========================================
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

// ==========================================
// 8. КОВАЛЬ
// ==========================================
function renderBlacksmith() {
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
// 9. ІНВЕНТАР
// ==========================================
function renderInventory() {
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
        } else if (item.type === 'license') {
            const prod = REAL_PRODUCTS[item.id];
            if (!prod) return;
            icon = prod.name.charAt(0); name = prod.name;
            cell.classList.add('license');
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
    } else if (item.type === 'license') {
        const lic = REAL_PRODUCTS[item.id];
        document.getElementById('detail-title').innerText = lic.name;
        document.getElementById('detail-stats').innerHTML = `<p>📦 Статус: ${item.status==='UNLOCKED'?'✅ Доступно':'🔒 Заблоковано'}</p><p>💰 Анлок: ${lic.goldCost} золота</p><p>💳 Реальна ціна: ${lic.realPrice} грн</p><p>💰 Продаж: ${Math.floor(lic.goldCost/2)} золота</p>`;
        if (item.status === 'DROPPED') {
            document.getElementById('detail-primary-btn').innerText = '🔓 Анлок';
            document.getElementById('detail-primary-btn').onclick = () => { handleUnlock(selectedItemDetail, lic.goldCost); closeItemDetail(); };
        } else {
            document.getElementById('detail-primary-btn').innerText = '💳 Купити за грн';
            document.getElementById('detail-primary-btn').onclick = () => { openModal(selectedItemDetail); closeItemDetail(); };
        }
    } else if (item.type === 'consumable') {
        const cons = SHOP_ITEMS.find(c => c.id === item.id);
        document.getElementById('detail-title').innerText = cons.name;
        document.getElementById('detail-stats').innerHTML = `<p>${cons.description}</p><p>💰 Продаж: ${Math.floor(cons.price/2)} золота</p>`;
        document.getElementById('detail-primary-btn').innerText = '🧪 Використати';
        document.getElementById('detail-primary-btn').onclick = () => { useConsumable(selectedItemDetail); closeItemDetail(); };
    }
    document.getElementById('detail-sell-btn').onclick = () => { sellItem(selectedItemDetail); closeItemDetail(); };
    document.getElementById('detail-discard-btn').onclick = () => { discardItem(selectedItemDetail); closeItemDetail(); };
    modal.classList.remove('hidden');
}

function closeItemDetail() { document.getElementById('item-detail-modal').classList.add('hidden'); selectedItemDetail = null; }

function useConsumable(instanceId) {
    const idx = player.inventory.findIndex(i => i.instanceId === instanceId);
    if (idx === -1) return;
    const item = player.inventory[idx];
    if (item.type !== 'consumable') return;
    const cons = SHOP_ITEMS.find(c => c.id === item.id);
    if (!cons) return;
    const stats = getStatsWithBonuses();
    if (cons.effect.hp) player.currentHP = Math.min(player.currentHP + cons.effect.hp, stats.maxHP);
    if (cons.effect.mp) player.currentMP = Math.min(player.currentMP + cons.effect.mp, stats.maxMP);
    if (cons.effect.sp) player.currentSP = Math.min(player.currentSP + cons.effect.sp, stats.maxSP);
    player.inventory.splice(idx, 1);
    addLog(`Використано ${cons.name}.`, "clear");
    updateUI();
}

function sellItem(instanceId) {
    const idx = player.inventory.findIndex(i => i.instanceId === instanceId);
    if (idx === -1) return;
    const item = player.inventory[idx];
    let price = 0;
    if (item.type === 'equip') price = item.sellPrice || 15;
    else if (item.type === 'license') { const lic = REAL_PRODUCTS[item.id]; price = lic ? Math.floor(lic.goldCost/2) : 5; }
    else if (item.type === 'consumable') { const cons = SHOP_ITEMS.find(c => c.id === item.id); price = cons ? Math.floor(cons.price/2) : 2; }
    player.gold += price;
    player.inventory.splice(idx, 1);
    addLog(`Продано за ${price} золота.`, "clear");
    updateUI();
}

function discardItem(instanceId) {
    const idx = player.inventory.findIndex(i => i.instanceId === instanceId);
    if (idx === -1) return;
    player.inventory.splice(idx, 1);
    addLog("Предмет викинуто.", "default");
    updateUI();
}

function equipItem(instanceId) {
    const idx = player.inventory.findIndex(i => i.instanceId === instanceId);
    if (idx === -1) return;
    const item = player.inventory[idx];
    if (item.type !== 'equip') return;
    const slot = item.slot;
    if (player.equipment[slot]) player.inventory.push(player.equipment[slot]);
    player.equipment[slot] = item;
    player.inventory.splice(idx, 1);
    addLog(`Екіпіровано: ${item.name}`, "clear");
    updateUI();
}

function unequipItem(slot) {
    const item = player.equipment[slot];
    if (!item) return;
    player.inventory.push(item);
    player.equipment[slot] = null;
    addLog(`Знято: ${item.name}`, "default");
    updateUI();
}

function handleUnlock(instanceId, goldCost) {
    if (player.gold < goldCost) { addLog("Недостатньо золота!", "danger"); return; }
    player.gold -= goldCost;
    const item = player.inventory.find(i => i.instanceId === instanceId);
    if (item) { item.status = 'UNLOCKED'; addLog("Ліцензію розкодовано!", "clear"); }
    updateUI();
}

// Модалка оплати
let activeCheckoutInstanceId = null;
function openModal(instanceId) {
    activeCheckoutInstanceId = instanceId;
    const item = player.inventory.find(i => i.instanceId === instanceId);
    if (!item) return;
    const prod = REAL_PRODUCTS[item.id];
    document.getElementById('modal-item-name').innerText = `Товар: ${prod.name}`;
    document.getElementById('modal-item-price').innerText = prod.realPrice;
    document.getElementById('payment-modal').classList.remove('hidden');
}
function closeModal() { document.getElementById('payment-modal').classList.add('hidden'); activeCheckoutInstanceId = null; }
function confirmPayment() {
    const item = player.inventory.find(i => i.instanceId === activeCheckoutInstanceId);
    if (!item) return;
    player.inventory = player.inventory.filter(i => i.instanceId !== activeCheckoutInstanceId);
    player.gold += 10;
    addLog(`Оплата пройшла! Товар відправлено. Бонус: +10 золота.`, "clear");
    closeModal();
    updateUI();
}

function resetGame() {
    if(confirm("Скинути прогрес?")) {
        player = {
            name: currentUser || "Гість",
            gold: 5, xp: 0, level: 1,
            inventory: [],
            equipment: { weapon: null, armor: null, helmet: null, accessory: null },
            currentHP: 120, currentMP: 15, currentSP: 60,
            dailyQuests: { kills: 0, purchases: 0, skillsUsed: 0, lastReset: null }
        };
        addLog("Прогрес скинуто.", "danger");
        updateUI();
    }
}

// Ініціалізація
loadPlayer();
updateAuthButton();
updateUI();
