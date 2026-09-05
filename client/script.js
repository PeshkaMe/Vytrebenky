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
        if (!player.currentLocationId) {
            player.currentLocationId = LOCATIONS[0].id;
        }
        const loc = LOCATIONS.find(l => l.id === player.currentLocationId) || LOCATIONS[0];
        setCurrentLocation(loc);
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
    if (!player.currentLocationId) {
        player.currentLocationId = LOCATIONS[0].id;
    }
    const loc = LOCATIONS.find(l => l.id === player.currentLocationId) || LOCATIONS[0];
    setCurrentLocation(loc);
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
    socket.emit('send_chat_message', { user: userName, text: text });
    input.value = "";
}

// ==========================================
// 2. КОНСТАНТИ ТА БАЗОВІ ДАНІ ГРИ
// ==========================================
const REAL_PRODUCTS = {
    "baguette_01": { name: "🥖 Хрусткий Багет", goldCost: 15, realPrice: 45 },
    "coffee_01": { name: "☕ Епічна Кава", goldCost: 30, realPrice: 60 }
};

// Броня
const ARMOR_DATABASE = {
    warrior: {
        tank: [
            { id: 'plate_basic', name: "🛡️ Залізна латова броня", def: 8, hpBonus: 20, rarity: "common" },
            { id: 'plate_heavy', name: "🏰 Обладунок Непорушності", def: 16, hpBonus: 50, rarity: "rare" }
        ],
        dd: [
            { id: 'scale_basic', name: "⚔️ Лускатий обладунок", def: 5, spBonus: 10, rarity: "common" },
            { id: 'berserk_mail', name: "🔥 Кольчуга Берсерка", def: 10, hpBonus: 20, spBonus: 20, rarity: "rare" }
        ]
    },
    mage: {
        fire: [{ id: 'robe_fire', name: "🔥 Мантія Багряного Полум'я", def: 3, mpBonus: 35, rarity: "common" }],
        water: [{ id: 'robe_water', name: "🌊 Освячений Океанський Одяг", def: 5, hpBonus: 25, mpBonus: 20, rarity: "common" }],
        lightning: [{ id: 'robe_light', name: "⚡ Одежа Грозового Медіума", def: 3, mpBonus: 40, rarity: "common" }],
        earth: [{ id: 'robe_earth', name: "🪨 Обруб Кам'яного Моноліта", def: 8, hpBonus: 30, mpBonus: 15, rarity: "common" }],
        air: [{ id: 'robe_air', name: "💨 Обладунок Легкого Вітру", def: 4, mpBonus: 25, spBonus: 15, rarity: "common" }]
    },
    ranger: {
        assassin: [
            { id: 'leather_shadow', name: "🗡️ Тіньова Шкіряна Броня", def: 5, spBonus: 25, rarity: "common" },
            { id: 'night_suit', name: "👤 Костюм Нічного Убивці", def: 9, spBonus: 40, rarity: "rare" }
        ],
        archer: [
            { id: 'scout_mail', name: "🏹 Обладунок Лісового Слідопита", def: 6, spBonus: 20, rarity: "common" },
            { id: 'windrunner_gear', name: "🎯 Броня Вітрокрила", def: 11, hpBonus: 15, spBonus: 25, rarity: "rare" }
        ]
    }
};

// Зброя
const WEAPON_DATABASE = {
    warrior: {
        tank: [
            { id: "w_t_sword", name: "Важкий меч вартівника", icon: "🗡️", stats: { str: 4, def: 3 } },
            { id: "w_t_mace", name: "Обух непохитності", icon: "🔨", stats: { def: 6, hp: 20 } }
        ],
        dd: [
            { id: "w_d_axe", name: "Дворучна сокира", icon: "🪓", stats: { str: 6, crit: 5 } },
            { id: "w_d_greatsword", name: "Великий меч Берсерка", icon: "⚔️", stats: { str: 8, crit: 8 } }
        ]
    },
    ranger: {
        assassin: [
            { id: "r_a_dagger1", name: "Кривавий кинджал", icon: "🗡️", stats: { agi: 5, crit: 7 } },
            { id: "r_a_dagger2", name: "Отруєний стилет", icon: "🗡️", stats: { agi: 6, crit: 10 } }
        ],
        archer: [
            { id: "r_ar_bow1", name: "Композитний лук", icon: "🏹", stats: { agi: 5, str: 2 } },
            { id: "r_ar_bow2", name: "Дрімучий довгий лук", icon: "🏹", stats: { agi: 7, crit: 5 } }
        ]
    },
    mage: {
        fire: [
            { id: "m_f_staff", name: "Попелястий посох", icon: "🦯", stats: { int: 6 } }
        ],
        water: [
            { id: "m_w_staff", name: "Жело Океану", icon: "🦯", stats: { int: 5, hp: 15 } }
        ],
        lightning: [
            { id: "m_l_orb", name: "Сфера громовиці", icon: "🔮", stats: { int: 5, crit: 4 } }
        ]
    }
};

// Шоломи / Шапки
const HELMET_DATABASE = {
    warrior: {
        tank: [
            { id: "h_w_t_1", name: "Важкий латний шолом", icon: "🪖", stats: { def: 5, hp: 25 } }
        ],
        dd: [
            { id: "h_w_d_1", name: "Шолом гладіатора", icon: "🪖", stats: { str: 3, crit: 3 } }
        ]
    },
    ranger: {
        assassin: [
            { id: "h_r_a_1", name: "Маска нічного мисливця", icon: "🎭", stats: { agi: 4, crit: 3 } }
        ],
        archer: [
            { id: "h_r_ar_1", name: "Капюшон слідопита", icon: "🥷", stats: { agi: 3, hp: 10 } }
        ]
    },
    mage: {
        fire: [
            { id: "h_m_f_1", name: "Капелюх полум'я", icon: "🧙‍♂️", stats: { int: 4 } }
        ],
        water: [
            { id: "h_m_w_1", name: "Водяна корона", icon: "👑", stats: { int: 3, def: 2 } }
        ],
        lightning: [
            { id: "h_m_l_1", name: "Аура шторму", icon: "⚡", stats: { int: 4, crit: 2 } }
        ]
    }
};

// Кільця (Універсальні)
const RING_DATABASE = [
    { id: "ring_str", name: "Перстень могутності", icon: "💍", stats: { str: 3 } },
    { id: "ring_int", name: "Перстень розуму", icon: "💍", stats: { int: 3 } },
    { id: "ring_agi", name: "Перстень спритності", icon: "💍", stats: { agi: 3 } },
    { id: "ring_hp", name: "Перстень життя", icon: "💍", stats: { hp: 30 } },
    { id: "ring_crit", name: "Кільце точного удару", icon: "💍", stats: { crit: 4 } }
];

function getRandomLootDrop(playerClass, playerSubclass) {
    const types = ['armor', 'weapon', 'helmet', 'ring'];
    const selectedType = types[Math.floor(Math.random() * types.length)];

    let pool = [];
    if (selectedType === 'ring') {
        pool = RING_DATABASE;
    } else {
        const dbMap = {
            armor: ARMOR_DATABASE,
            weapon: WEAPON_DATABASE,
            helmet: HELMET_DATABASE
        };
        pool = dbMap[selectedType]?.[playerClass]?.[playerSubclass] || [];
    }

    if (pool.length === 0) return null;

    const randomIndex = Math.floor(Math.random() * pool.length);
    const selectedItem = pool[randomIndex];

    return { 
        ...selectedItem, 
        slotType: selectedType, 
        type: 'equip' 
    };
}

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
                bonuses: { hp: 0, defense: 0, attack: 8, critChance: 0.20 },
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
                name: "Лучник",
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

// ---------- ЛОКАЦІЇ (5 локацій, без Підземелля) ----------
const LOCATIONS = [
    {
        id: 'forest',
        name: '🌲 Ліс',
        image: 'forest.jpg',
        minLevel: 1,
        maxLevel: 3,
        monsters: [
            { name: "🐗 Дикий Кабан", hp: 50, minDmg: 2, maxDmg: 5, level: 1, image: "boar.jpg" },
            { name: "🕷️ Лісовий Павук", hp: 65, minDmg: 3, maxDmg: 7, level: 2, image: "spider.jpg" },
            { name: "🐺 Сірий Вовк", hp: 80, minDmg: 4, maxDmg: 9, level: 3, image: "wolf.jpg" },
            { name: "🌿 Лісовий Елементаль", hp: 95, minDmg: 5, maxDmg: 11, level: 3, image: "elemental.jpg" },
            { name: "🦌 Лісовий Олень", hp: 60, minDmg: 2, maxDmg: 6, level: 1, image: "deer.jpg" }
        ]
    },
    {
        id: 'mountains',
        name: '🏔️ Гори',
        image: 'mountains.jpg',
        minLevel: 3,
        maxLevel: 5,
        monsters: [
            { name: "🦅 Гірський Орел", hp: 90, minDmg: 5, maxDmg: 10, level: 3, image: "eagle.jpg" },
            { name: "🗿 Гірський Голем", hp: 130, minDmg: 6, maxDmg: 13, level: 4, image: "golem.jpg" },
            { name: "🐉 Кам'яний Дракон", hp: 160, minDmg: 8, maxDmg: 16, level: 5, image: "dragon.jpg" },
            { name: "🐐 Гірський Козел", hp: 75, minDmg: 4, maxDmg: 8, level: 3, image: "goat.jpg" },
            { name: "🧙 Гірський Шаман", hp: 110, minDmg: 7, maxDmg: 14, level: 4, image: "shaman.jpg" }
        ]
    },
    {
        id: 'desert',
        name: '🏜️ Пустеля',
        image: 'desert.jpg',
        minLevel: 5,
        maxLevel: 8,
        monsters: [
            { name: "🦂 Гігантський Скорпіон", hp: 130, minDmg: 6, maxDmg: 13, level: 5, image: "scorpion.jpg" },
            { name: "🐍 Піщана Змія", hp: 160, minDmg: 8, maxDmg: 16, level: 6, image: "snake.jpg" },
            { name: "👹 Пустельний Джин", hp: 200, minDmg: 10, maxDmg: 20, level: 8, image: "genie.jpg" },
            { name: "🐪 Жорстокий Верблюд", hp: 110, minDmg: 5, maxDmg: 12, level: 5, image: "camel.jpg" },
            { name: "🌪️ Піщаний Елементаль", hp: 180, minDmg: 9, maxDmg: 18, level: 7, image: "sand_elemental.jpg" }
        ]
    },
    {
        id: 'swamp',
        name: '🌿 Болото',
        image: 'swamp.jpg',
        minLevel: 2,
        maxLevel: 5,
        monsters: [
            { name: "🐊 Болотяний Крокодил", hp: 100, minDmg: 5, maxDmg: 10, level: 3, image: "crocodile.jpg" },
            { name: "🧟 Болотяний Зомбі", hp: 80, minDmg: 4, maxDmg: 9, level: 2, image: "zombie.jpg" },
            { name: "🐍 Отруйна Змія", hp: 70, minDmg: 3, maxDmg: 8, level: 2, image: "poison_snake.jpg" },
            { name: "🌿 Болотяний Дух", hp: 120, minDmg: 6, maxDmg: 13, level: 4, image: "swamp_spirit.jpg" },
            { name: "🕷️ Болотяний Павук", hp: 90, minDmg: 4, maxDmg: 9, level: 3, image: "swamp_spider.jpg" }
        ]
    },
    {
        id: 'volcano',
        name: '🌋 Вулкан',
        image: 'volcano.jpg',
        minLevel: 6,
        maxLevel: 10,
        monsters: [
            { name: "🔥 Вогняний Елементаль", hp: 150, minDmg: 8, maxDmg: 16, level: 6, image: "fire_elemental.jpg" },
            { name: "🐉 Вогняний Дракон", hp: 220, minDmg: 12, maxDmg: 24, level: 9, image: "fire_dragon.jpg" },
            { name: "🗿 Лавовий Голем", hp: 180, minDmg: 9, maxDmg: 18, level: 7, image: "lava_golem.jpg" },
            { name: "🦂 Вогняний Скорпіон", hp: 130, minDmg: 7, maxDmg: 14, level: 6, image: "fire_scorpion.jpg" },
            { name: "👹 Демон Вогню", hp: 200, minDmg: 11, maxDmg: 22, level: 8, image: "fire_demon.jpg" }
        ]
    }
];

// ---------- ІНШІ КОНСТАНТИ ----------
const RANDOM_EVENTS = [
    "🌿 Ви натрапили на стародавнє капище, але там нікого немає.",
    "🍄 Ви знайшли галявину з дивними грибами. Вони світяться в темряві.",
    "🌧️ Почалася злива. Ви сховалися під деревом і перечекали.",
    "🦉 Нічний вітер приніс звуки далекої битви. Ви вирішили не втручатися.",
    "📜 Ви знайшли обгорілий сувій, але текст уже не прочитати.",
    "💨 Раптовий порив вітру збив вас з ніг, але ви швидко підвелися.",
    "🐺 Здалеку почувся вовчий вий. Ви прискорили крок.",
    "🌟 Ви побачили падаючу зірку. Загадали бажання.",
    "🕯️ Старий мандрівник розповів вам історію про загублене місто.",
    "🌊 Ви вийшли до берега підземного озера. Вода була прозорою, як скло."
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
let currentLocation = LOCATIONS[0];

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
    if (player) {
        const loc = LOCATIONS.find(l => l.id === player.currentLocationId) || LOCATIONS[0];
        setCurrentLocation(loc);
        updateUI();
    }
}

function switchAuthTab(tab) {
    document.getElementById('tab-login').classList.toggle('active', tab === 'login');
    document.getElementById('tab-register').classList.toggle('active', tab === 'register');
    document.getElementById('auth-form-login').classList.toggle('hidden', tab !== 'login');
    document.getElementById('auth-form-register').classList.toggle('hidden', tab !== 'register');
    document.getElementById('auth-error').textContent = '';
}

function updateSubclassDropdown() {
    const classVal = document.getElementById('reg-class').value;
    const subSelect = document.getElementById('reg-subclass');
    if (!subSelect) return;
    subSelect.innerHTML = '';
    const subClasses = CLASSES_CONFIG[classVal].subclasses;
    for (let key in subClasses) {
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = `${subClasses[key].name} (${subClasses[key].desc})`;
        subSelect.appendChild(opt);
    }
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
        currentLocationId: LOCATIONS[0].id,
        inventory: [],
        equipment: { weapon: null, armor: null, helmet: null, accessory: null },
        currentHP: 120,
        currentMP: 15,
        currentSP: 60,
        dailyQuests: {
            kills: 0, kills_claimed: false,
            purchases: 0, purchases_claimed: false,
            skillsUsed: 0, skillsUsed_claimed: false,
            lastReset: null
        }
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

function getXpForLevel(level) {
    return 100 + (level - 1) * 50;
}

// --- ЛОКАЦІЇ ---
function updateLocationDisplay() {
    const img = document.getElementById('location-image');
    const nameEl = document.getElementById('location-name');
    const levelsEl = document.getElementById('location-levels');
    if (img) img.src = currentLocation.image;
    if (nameEl) nameEl.textContent = currentLocation.name;
    if (levelsEl) levelsEl.textContent = `рівні ${currentLocation.minLevel}–${currentLocation.maxLevel}`;
}

function setCurrentLocation(loc) {
    if (!loc) return;
    currentLocation = loc;
    if (player) {
        player.currentLocationId = loc.id;
        savePlayerData();
    }
    updateLocationDisplay();
    if (!document.getElementById('location-modal').classList.contains('hidden')) {
        renderLocationList();
    }
}

function openLocationModal() {
    document.getElementById('location-modal').classList.remove('hidden');
    renderLocationList();
}

function closeLocationModal() {
    document.getElementById('location-modal').classList.add('hidden');
}

function renderLocationList() {
    const list = document.getElementById('location-list');
    if (!list) return;
    list.innerHTML = '';
    LOCATIONS.forEach(loc => {
        const isLocked = player && player.level < loc.minLevel;
        const isActive = currentLocation && currentLocation.id === loc.id;
        const div = document.createElement('div');
        div.className = `location-option${isLocked ? ' locked' : ''}${isActive ? ' active' : ''}`;
        div.innerHTML = `
            <img src="${loc.image}" alt="${loc.name}" class="loc-image">
            <div class="loc-info">
                <div class="loc-name">${loc.name}</div>
                <div class="loc-levels">рівні ${loc.minLevel}–${loc.maxLevel}</div>
            </div>
            <div class="loc-status">${isLocked ? '🔒' : (isActive ? '✅' : '')}</div>
        `;
        if (!isLocked) {
            div.onclick = () => {
                setCurrentLocation(loc);
                closeLocationModal();
                updateUI();
            };
        }
        list.appendChild(div);
    });
}

// --- ОСНОВНИЙ UI ---
function updateUI() {
    if (!player) return;
    document.getElementById('p-name').innerText = player.name;
    document.getElementById('p-level').innerText = player.level;
    document.getElementById('p-gold').innerText = player.gold;
    const xpNeeded = getXpForLevel(player.level);
    document.getElementById('p-xp').innerText = `${player.xp}/${xpNeeded}`;
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
    renderBattleSkills();
    updateLocationDisplay();
}

function getStatsWithBonuses() {
    if (!player) return { maxHP: 0, maxMP: 0, maxSP: 0, attack: 0, defense: 0, critChance: 0 };
    let baseHP = 120 + player.level * 20;
    let baseMP = 10 + player.level * 5;
    let baseSP = 60 + player.level * 10;
    let bonusHP = 0, bonusMP = 0, bonusSP = 0, attack = 0, defense = 0, critChance = 0.05;
    const heroClass = player.heroClass || player.class;
    const subClass = player.subClass || player.subclass;
    if (heroClass && subClass && CLASSES_CONFIG[heroClass]) {
        const subData = CLASSES_CONFIG[heroClass].subclasses[subClass];
        if (subData && subData.bonuses) {
            bonusHP += subData.bonuses.hp || 0;
            bonusMP += subData.bonuses.mp || 0;
            bonusSP += subData.bonuses.sp || 0;
            attack += subData.bonuses.attack || 0;
            defense += subData.bonuses.defense || 0;
            critChance += subData.bonuses.critChance || 0;
        }
    }
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
// 6. СИСТЕМА ПОДОРОЖЕЙ І БІЙ
// ==========================================

function explore() {
    console.log("🔍 explore() викликано");
    if (!player) {
        console.error("❌ player = null");
        return;
    }
    if (player.currentHP <= 0) {
        addLog("Ви надто слабкі, щоб мандрувати.", "danger");
        return;
    }
    if (player.currentSP < 5) {
        addLog("Недостатньо стаміни (потрібно 5).", "danger");
        return;
    }
    if (player.level < currentLocation.minLevel) {
        addLog(`Ця локація вимагає мінімальний рівень ${currentLocation.minLevel}.`, "danger");
        return;
    }

    player.currentSP -= 5;
    updateUI();

    const roll = Math.random();
    console.log(`🎲 roll = ${roll.toFixed(2)}`);

    try {
        if (roll < 0.45) {
            const monsters = currentLocation.monsters;
            const monster = monsters[Math.floor(Math.random() * monsters.length)];
            console.log("⚔️ Зустріч з монстром:", monster.name);
            startBattle(monster);
        } else if (roll < 0.80) {
            console.log("🎁 Винагорода");
            giveReward();
        } else {
            console.log("📖 Текстова подія");
            showRandomEvent();
        }
    } catch (err) {
        console.error("❌ Помилка в explore():", err);
        addLog("Сталася помилка під час дослідження. Перевірте консоль.", "danger");
        document.getElementById('arena-idle').classList.remove('hidden');
        document.getElementById('arena-battle').classList.add('hidden');
        currentMonster = null;
        updateUI();
    }
}

function startBattle(monster) {
    console.log("⚔️ startBattle() викликано для", monster.name);
    if (!player) return;
    currentMonster = monster;
    monsterHP = monster.hp;
    playerBlocking = false;

    const idle = document.getElementById('arena-idle');
    const battle = document.getElementById('arena-battle');
    if (!idle || !battle) {
        console.error("❌ Не знайдено елементи arena-idle або arena-battle");
        return;
    }
    idle.classList.add('hidden');
    battle.classList.remove('hidden');

    document.getElementById('bf-p-name').innerText = player.name;
    document.getElementById('bf-p-level').innerText = player.level;
    const stats = getStatsWithBonuses();
    document.getElementById('bf-p-hp').innerText = `${player.currentHP}/${stats.maxHP}`;

    const monsterSprite = document.getElementById('monster-sprite');
    if (monsterSprite) {
        monsterSprite.style.backgroundImage = `url('${monster.image}')`;
        monsterSprite.style.backgroundSize = 'cover';
        monsterSprite.style.backgroundPosition = 'center';
        monsterSprite.style.backgroundRepeat = 'no-repeat';
        monsterSprite.textContent = '';
    }
    document.getElementById('bf-m-name').innerText = `${monster.name} [рівень ${monster.level}]`;
    document.getElementById('bf-m-hp').innerText = `${monsterHP}/${monster.hp}`;

    const battleLog = document.getElementById('battle-log');
    if (battleLog) battleLog.innerHTML = '';
    addBattleLog(`Ви зустріли ${monster.name} (рівень ${monster.level})!`);

    renderBattleSkills();
    updateBattleHP();
    updateUI();
}

function giveReward() {
    console.log("🎁 giveReward() викликано");
    if (!player) return;
    try {
        const goldGain = Math.floor(5 + player.level * 3 + Math.random() * 6);
        const xpGain = Math.floor(5 + player.level * 4 + Math.random() * 9);
        player.gold += goldGain;
        player.xp += xpGain;
        let msg = `🎁 Ви знайшли скарб у ${currentLocation.name}! +${goldGain} золота, +${xpGain} досвіду.`;

        if (Math.random() < 0.20) {
            const heroClass = player.heroClass || player.class;
            const subClass = player.subClass || player.subclass;
            const droppedItem = getRandomLootDrop(heroClass, subClass);
            if (droppedItem) {
                const slotMap = { armor: 'armor', weapon: 'weapon', helmet: 'helmet', ring: 'accessory' };
                const stats = droppedItem.stats || {};
                const newEquip = {
                    type: 'equip',
                    id: droppedItem.id,
                    instanceId: Date.now().toString() + Math.random(),
                    status: 'DROPPED',
                    attack: stats.str || stats.attack || 0,
                    defense: droppedItem.def || stats.def || stats.defense || 0,
                    hp: droppedItem.hpBonus || stats.hp || 0,
                    mp: droppedItem.mpBonus || stats.mp || stats.int || 0,
                    sp: droppedItem.spBonus || stats.sp || stats.agi || 0,
                    icon: droppedItem.icon || '🛡️',
                    name: droppedItem.name,
                    slot: slotMap[droppedItem.slotType] || 'armor',
                    sellPrice: 20,
                    upgradeLevel: 0
                };
                player.inventory.push(newEquip);
                msg += ` Також ви знайшли: ${newEquip.icon} ${newEquip.name}!`;
            }
        }

        const xpNeeded = getXpForLevel(player.level);
        while (player.xp >= xpNeeded) {
            player.xp -= xpNeeded;
            player.level += 1;
            msg += ` Вітаємо! Рівень ${player.level}!`;
            const newNeeded = getXpForLevel(player.level);
            if (player.xp >= newNeeded) continue;
        }

        addBattleLog(msg);
        addLog(msg, "clear");
        document.getElementById('arena-idle').classList.remove('hidden');
        document.getElementById('arena-battle').classList.add('hidden');
        currentMonster = null;
        updateUI();
        savePlayerData();
    } catch (err) {
        console.error("❌ Помилка в giveReward():", err);
        addLog("Помилка при видачі нагороди.", "danger");
        document.getElementById('arena-idle').classList.remove('hidden');
        document.getElementById('arena-battle').classList.add('hidden');
        currentMonster = null;
        updateUI();
    }
}

function showRandomEvent() {
    console.log("📖 showRandomEvent() викликано");
    if (!player) return;
    try {
        const eventText = RANDOM_EVENTS[Math.floor(Math.random() * RANDOM_EVENTS.length)];
        addBattleLog(`📜 ${eventText}`);
        addLog(eventText, "default");
        document.getElementById('arena-idle').classList.remove('hidden');
        document.getElementById('arena-battle').classList.add('hidden');
        currentMonster = null;
        updateUI();
    } catch (err) {
        console.error("❌ Помилка в showRandomEvent():", err);
        addLog("Помилка при випадковій події.", "danger");
        document.getElementById('arena-idle').classList.remove('hidden');
        document.getElementById('arena-battle').classList.add('hidden');
        currentMonster = null;
        updateUI();
    }
}

function addBattleLog(msg) {
    const log = document.getElementById('battle-log');
    if (!log) {
        console.warn("⚠️ #battle-log не знайдено, повідомлення:", msg);
        return;
    }
    const div = document.createElement('div');
    div.className = 'log-entry';
    div.textContent = msg;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
}

function attackMonster() {
    if (!currentMonster || !player) return;
    const stats = getStatsWithBonuses();
    const minDmg = 5 + player.level + stats.attack;
    const maxDmg = 10 + player.level + stats.attack;
    let playerDmg = Math.floor(Math.random() * (maxDmg - minDmg + 1)) + minDmg;
    const isCrit = Math.random() < stats.critChance;
    if (isCrit) {
        playerDmg = Math.floor(playerDmg * 1.8);
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

function endBattle(victory) {
    if (!player) return;
    playerBlocking = false;
    if (victory) {
        player.dailyQuests.kills = (player.dailyQuests.kills || 0) + 1;
        checkDailyReset();

        const monster = currentMonster;
        const diff = player.level - monster.level;
        const baseGold = monster.level * 3 + Math.floor(Math.random() * 5) + 1;
        const baseXP = monster.level * 10 + 5;
        let multiplier = 1.0;
        if (diff > 0) multiplier = Math.max(0.2, 1 - diff * 0.1);
        else if (diff < 0) multiplier = Math.min(2.5, 1 + Math.abs(diff) * 0.15);
        const goldGained = Math.floor(baseGold * multiplier);
        const xpGained = Math.floor(baseXP * multiplier);

        let lootChance = 0.20;
        if (diff > 0) lootChance = Math.max(0.05, 0.20 - diff * 0.02);
        else if (diff < 0) lootChance = Math.min(0.40, 0.20 + Math.abs(diff) * 0.03);

        player.gold += goldGained;
        player.xp += xpGained;
        let msg = `Перемога! +${goldGained} золота, +${xpGained} досвіду.`;

        if (Math.random() <= lootChance) {
            const heroClass = player.heroClass || player.class;
            const subClass = player.subClass || player.subclass;
            const droppedItem = getRandomLootDrop(heroClass, subClass);
            if (droppedItem) {
                const slotMap = { armor: 'armor', weapon: 'weapon', helmet: 'helmet', ring: 'accessory' };
                const stats = droppedItem.stats || {};
                const newEquip = {
                    type: 'equip',
                    id: droppedItem.id,
                    instanceId: Date.now().toString() + Math.random(),
                    status: 'DROPPED',
                    attack: stats.str || stats.attack || 0,
                    defense: droppedItem.def || stats.def || stats.defense || 0,
                    hp: droppedItem.hpBonus || stats.hp || 0,
                    mp: droppedItem.mpBonus || stats.mp || stats.int || 0,
                    sp: droppedItem.spBonus || stats.sp || stats.agi || 0,
                    icon: droppedItem.icon || '🛡️',
                    name: droppedItem.name,
                    slot: slotMap[droppedItem.slotType] || 'armor',
                    sellPrice: 20,
                    upgradeLevel: 0
                };
                player.inventory.push(newEquip);
                msg += ` 🎒 Ви знайшли: ${newEquip.icon} ${newEquip.name}!`;
            }
        }

        const xpNeeded = getXpForLevel(player.level);
        while (player.xp >= xpNeeded) {
            player.xp -= xpNeeded;
            player.level += 1;
            msg += ` Вітаємо! Рівень ${player.level}!`;
            const newNeeded = getXpForLevel(player.level);
            if (player.xp >= newNeeded) continue;
        }

        addBattleLog(msg);
        addLog(msg, "clear");
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
    if (!player || !currentMonster) return;
    const spLost = 5;
    const goldLost = 2;
    player.currentSP = Math.max(0, player.currentSP - spLost);
    player.gold = Math.max(0, player.gold - goldLost);
    addBattleLog(`Ви втекли з бою! Втрачено ${spLost} SP та ${goldLost} золота.`);
    addLog(`Ви втекли від ${currentMonster.name}.`, "danger");
    document.getElementById('arena-idle').classList.remove('hidden');
    document.getElementById('arena-battle').classList.add('hidden');
    currentMonster = null;
    playerBlocking = false;
    updateUI();
    savePlayerData();
}

// ==========================================
// 6.2 СКІЛИ
// ==========================================
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

function useClassSkill(skill) {
    if (!currentMonster || !player) return;
    if (skill.spCost && player.currentSP < skill.spCost) {
        addBattleLog(`Недостатньо SP (потрібно ${skill.spCost}).`);
        return;
    }
    if (skill.mpCost && player.currentMP < skill.mpCost) {
        addBattleLog(`Недостатньо MP (потрібно ${skill.mpCost}).`);
        return;
    }
    if (skill.spCost) player.currentSP -= skill.spCost;
    if (skill.mpCost) player.currentMP -= skill.mpCost;
    player.dailyQuests.skillsUsed = (player.dailyQuests.skillsUsed || 0) + 1;
    const stats = getStatsWithBonuses();
    const baseDmg = 10 + player.level * 2 + stats.attack;
    monsterHP -= baseDmg;
    if (monsterHP < 0) monsterHP = 0;
    addBattleLog(`✨ Використано ${skill.name}! Завдано ${baseDmg} шкоди.`);
    updateBattleHP();
    if (monsterHP <= 0) { endBattle(true); return; }
    monsterAttack();
}

function renderBattleSkills() {
    const container = document.getElementById('battle-skills-container');
    if (!container || !player) return;
    container.innerHTML = '';
    const heroClass = player.heroClass || player.class;
    const subClass = player.subClass || player.subclass;
    if (!heroClass || !subClass || !CLASSES_CONFIG[heroClass]) return;
    const subData = CLASSES_CONFIG[heroClass].subclasses[subClass];
    if (!subData || !subData.skills) return;
    subData.skills.forEach(skill => {
        const btn = document.createElement('button');
        btn.className = 'skill-btn power-btn';
        let costText = "";
        if (skill.spCost > 0) costText += `${skill.spCost} SP`;
        if (skill.mpCost > 0) costText += `${costText ? ' ' : ''}${skill.mpCost} MP`;
        btn.innerText = `${skill.name} (${costText})`;
        btn.onclick = () => useClassSkill(skill);
        container.appendChild(btn);
    });
}

setInterval(() => {
    if (!currentMonster && player && player.currentSP < getStatsWithBonuses().maxSP) {
        player.currentSP = Math.min(player.currentSP + 1, getStatsWithBonuses().maxSP);
        updateUI();
    }
}, 10000);

// ==========================================
// 7. ЗАВДАННЯ, МАГАЗИН, КОВАЛЬ
// ==========================================
function checkDailyReset() {
    if (!player) return;
    if (!player.dailyQuests) {
        player.dailyQuests = {
            kills: 0, kills_claimed: false,
            purchases: 0, purchases_claimed: false,
            skillsUsed: 0, skillsUsed_claimed: false,
            lastReset: null
        };
    }
    const today = new Date().toDateString();
    if (player.dailyQuests.lastReset !== today) {
        player.dailyQuests.kills = 0;
        player.dailyQuests.kills_claimed = false;
        player.dailyQuests.purchases = 0;
        player.dailyQuests.purchases_claimed = false;
        player.dailyQuests.skillsUsed = 0;
        player.dailyQuests.skillsUsed_claimed = false;
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
        const claimed = player.dailyQuests[quest.id + '_claimed'] || false;
        const completed = progress >= quest.goal && !claimed;
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
    const progress = player.dailyQuests[questId] || 0;
    const claimed = player.dailyQuests[questId + '_claimed'] || false;
    if (progress < quest.goal || claimed) return;
    player.gold += quest.reward;
    player.dailyQuests[questId + '_claimed'] = true;
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
        player.currentLocationId = LOCATIONS[0].id;
        setCurrentLocation(LOCATIONS[0]);
        savePlayerData();
        updateUI();
        addLog("Персонажа скинуто.", "danger");
    }
}

// Ініціалізація
window.onload = () => {
    loadPlayer();
    if (typeof updateSubclassDropdown === 'function') {
        updateSubclassDropdown();
    }
};