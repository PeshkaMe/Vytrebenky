const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, '../client')));

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

// ==========================================
// ПІДКЛЮЧЕННЯ ДО NEON (PostgreSQL)
// ==========================================
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Neon вимагає SSL
});

// Ініціалізація таблиць при старті
async function initDB() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                username VARCHAR(16) PRIMARY KEY,
                password_hash TEXT NOT NULL,
                email VARCHAR(255),
                email_verified BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS player_data (
                username VARCHAR(16) PRIMARY KEY REFERENCES users(username) ON DELETE CASCADE,
                data JSONB NOT NULL,
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log('✅ База даних готова');
    } catch (err) {
        console.error('❌ Помилка ініціалізації БД:', err);
    }
}
initDB();

// ==========================================
// ВАЛІДАЦІЯ
// ==========================================
function validateCredentials(username, password) {
    if (!username || !password) return 'Заповніть всі поля';
    if (username.length < 3 || username.length > 16) return 'Нік має бути від 3 до 16 символів';
    if (!/^[a-zA-Zа-яА-Я0-9_]+$/.test(username)) return 'Нік може містити лише букви, цифри та _';
    if (password.length < 6) return 'Пароль має бути мінімум 6 символів';
    if (password.length > 72) return 'Пароль занадто довгий';
    return null;
}

// ==========================================
// SOCKET.IO
// ==========================================
io.on('connection', (socket) => {
    console.log('Гравець підключився:', socket.id);

    // ---------- ЧАТ ----------
    socket.on('send_chat_message', (data) => {
        io.emit('chat_message', {
            user: data.user,
            text: data.text
        });
    });

    // ---------- РЕЄСТРАЦІЯ ----------
    socket.on('register', async ({ username, password, initialData }) => {
        const err = validateCredentials(username, password);
        if (err) return socket.emit('auth_error', err);

        try {
            const existing = await pool.query(
                'SELECT username FROM users WHERE LOWER(username) = LOWER($1)',
                [username]
            );
            if (existing.rows.length > 0) {
                return socket.emit('auth_error', 'Користувач з таким логіном вже існує!');
            }

            const hash = await bcrypt.hash(password, 10);

            await pool.query(
                'INSERT INTO users (username, password_hash) VALUES ($1, $2)',
                [username, hash]
            );
            await pool.query(
                'INSERT INTO player_data (username, data) VALUES ($1, $2)',
                [username, JSON.stringify(initialData)]
            );

            socket.emit('auth_success', {
                username: username,
                data: initialData,
                message: `Вітаємо, ${username}! Акаунт успішно створено.`
            });
            console.log(`✅ Новий акаунт: ${username}`);
        } catch (err) {
            console.error('Помилка реєстрації:', err);
            socket.emit('auth_error', 'Помилка сервера при реєстрації');
        }
    });

    // ---------- ВХІД ----------
    socket.on('login', async ({ username, password }) => {
        const err = validateCredentials(username, password);
        if (err) return socket.emit('auth_error', err);

        try {
            const result = await pool.query(
                'SELECT username, password_hash FROM users WHERE LOWER(username) = LOWER($1)',
                [username]
            );
            if (result.rows.length === 0) {
                return socket.emit('auth_error', 'Невірний логін або пароль!');
            }

            const user = result.rows[0];
            const ok = await bcrypt.compare(password, user.password_hash);
            if (!ok) {
                return socket.emit('auth_error', 'Невірний логін або пароль!');
            }

            const dataResult = await pool.query(
                'SELECT data FROM player_data WHERE username = $1',
                [user.username]
            );
            const data = dataResult.rows[0]?.data || null;

            socket.emit('auth_success', {
                username: user.username,
                data: data,
                message: `З поверненням, ${user.username}!`
            });
            console.log(`✅ Вхід: ${user.username}`);
        } catch (err) {
            console.error('Помилка входу:', err);
            socket.emit('auth_error', 'Помилка сервера при вході');
        }
    });

    // ---------- ЗАВАНТАЖЕННЯ ГРАВЦЯ ----------
    socket.on('load_player', async (playerName) => {
        if (!playerName) return socket.emit('player_loaded', null);
        try {
            const result = await pool.query(
                'SELECT data FROM player_data WHERE username = $1',
                [playerName]
            );
            socket.emit('player_loaded', result.rows[0]?.data || null);
        } catch (err) {
            console.error('Помилка завантаження:', err);
            socket.emit('player_loaded', null);
        }
    });

    // ---------- ЗБЕРЕЖЕННЯ ГРАВЦЯ ----------
    socket.on('save_player', async ({ name, data }) => {
        if (!name || !data) return;
        try {
            await pool.query(
                `INSERT INTO player_data (username, data, updated_at)
                 VALUES ($1, $2, NOW())
                 ON CONFLICT (username)
                 DO UPDATE SET data = $2, updated_at = NOW()`,
                [name, JSON.stringify(data)]
            );
        } catch (err) {
            console.error('Помилка збереження:', err);
        }
    });

    socket.on('disconnect', () => {
        console.log('Гравець відключився:', socket.id);
    });
});

// ==========================================
// ЗАПУСК
// ==========================================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер працює на порту ${PORT}`);
});