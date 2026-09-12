const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, '../client')));

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

// ==========================================
// ПІДКЛЮЧЕННЯ ДО NEON
// ==========================================
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// ==========================================
// НАЛАШТУВАННЯ NODEMAILER (Mailjet SMTP)
// ==========================================
const transporter = nodemailer.createTransport({
    host: 'in-v3.mailjet.com',
    port: 2525,              // ← було 587
    secure: false,
    auth: {
        user: process.env.MJ_APIKEY_PUBLIC,
        pass: process.env.MJ_APIKEY_PRIVATE
    }
});

// ==========================================
// ІНІЦІАЛІЗАЦІЯ ТАБЛИЦЬ
// ==========================================
async function initDB() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                username VARCHAR(16) PRIMARY KEY,
                password_hash TEXT NOT NULL,
                email VARCHAR(255),
                email_verified BOOLEAN DEFAULT FALSE,
                verification_code VARCHAR(6),
                code_expires_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        // Міграція: додаємо нові стовпці, якщо їх немає (для старих таблиць)
        await pool.query(`
            ALTER TABLE users
                ADD COLUMN IF NOT EXISTS email VARCHAR(255),
                ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
                ADD COLUMN IF NOT EXISTS verification_code VARCHAR(6),
                ADD COLUMN IF NOT EXISTS code_expires_at TIMESTAMP;
        `);
        
        await pool.query(`
            ALTER TABLE users
                ADD COLUMN IF NOT EXISTS reset_code VARCHAR(6),
                ADD COLUMN IF NOT EXISTS reset_code_expires_at TIMESTAMP,
                ADD COLUMN IF NOT EXISTS new_email VARCHAR(255),
                ADD COLUMN IF NOT EXISTS new_email_code VARCHAR(6),
                ADD COLUMN IF NOT EXISTS new_email_expires_at TIMESTAMP;
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

async function sendVerificationEmail(toEmail, code, subject = 'Код підтвердження') {
    try {
        await mailjet.post('send', { version: 'v3.1' }).request({
            Messages: [{
                From: {
                    Email: process.env.MJ_SENDER_EMAIL,
                    Name: 'Витрибенька'
                },
                To: [{ Email: toEmail }],
                Subject: subject,
                HTMLPart: `<h2>Ваш код: ${code}</h2><p>Введіть його в грі протягом 15 хвилин.</p>`
            }]
        });
        console.log(`✅ Лист "${subject}" надіслано на ${toEmail}`);
    } catch (err) {
        console.error('❌ Помилка Mailjet API:', err.statusCode, err.message);
        throw err;
    }
}

// ==========================================
// ВАЛІДАЦІЯ
// ==========================================
function validateCredentials(username, password) {
    if (!username || !password) return 'Заповніть всі поля';
    if (username.length < 3 || username.length > 16) return 'Нік має бути від 3 до 16 символів';
    if (!/^[a-zA-Zа-яА-Я0-9_]+$/.test(username)) return 'Нік може містити лише букви, цифри та _';
    if (password.length < 6) return 'Пароль має бути мінімум 6 символів';
    return null;
}

// ==========================================
// ГЕНЕРАЦІЯ КОДУ
// ==========================================
function generateCode() {
    return String(Math.floor(100000 + Math.random() * 900000)); // 6 цифр
}

// ==========================================
// SOCKET.IO
// ==========================================
io.on('connection', (socket) => {
    console.log('Гравець підключився:', socket.id);

    // ---------- ЧАТ ----------
    socket.on('send_chat_message', (data) => {
        io.emit('chat_message', { user: data.user, text: data.text });
    });

    // ---------- РЕЄСТРАЦІЯ (з email) ----------
    socket.on('register', async ({ username, password, email, initialData }) => {
        const err = validateCredentials(username, password);
        if (err) return socket.emit('auth_error', err);
        if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
            return socket.emit('auth_error', 'Введіть коректний email');
        }

        try {
            const existing = await pool.query(
                'SELECT username FROM users WHERE LOWER(username) = LOWER($1)',
                [username]
            );
            if (existing.rows.length > 0) {
                return socket.emit('auth_error', 'Користувач з таким логіном вже існує!');
            }

            const hash = await bcrypt.hash(password, 10);
            const code = generateCode();
            const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 хв

            await pool.query(
                `INSERT INTO users (username, password_hash, email, verification_code, code_expires_at, email_verified)
                 VALUES ($1, $2, $3, $4, $5, FALSE)`,
                [username, hash, email, code, expiresAt]
            );
            await pool.query(
                'INSERT INTO player_data (username, data) VALUES ($1, $2)',
                [username, JSON.stringify(initialData)]
            );

            // Надсилаємо лист
            await transporter.sendMail({
                from: `"Витрибенька" <${process.env.MJ_SENDER_EMAIL}>`,
                to: email,
                subject: 'Код підтвердження',
                html: `<h2>Ваш код: ${code}</h2><p>Введіть його в грі протягом 15 хвилин.</p>`
            });

            socket.emit('auth_success', {
                username: username,
                data: initialData,
                verified: false,
                message: `Код підтвердження надіслано на ${email}. Введіть його.`
            });
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
                'SELECT username, password_hash, email_verified FROM users WHERE LOWER(username) = LOWER($1)',
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

            // Якщо email не підтверджено — надсилаємо новий код
            if (!user.email_verified) {
                const code = generateCode();
                const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
                await pool.query(
                    'UPDATE users SET verification_code = $1, code_expires_at = $2 WHERE username = $3',
                    [code, expiresAt, user.username]
                );
                // (потрібно отримати email, але він у нас є; надсилаємо)
                const emailResult = await pool.query('SELECT email FROM users WHERE username = $1', [user.username]);
                const email = emailResult.rows[0].email;
                await transporter.sendMail({
                    from: `"Витрибенька" <${process.env.MJ_SENDER_EMAIL}>`,
                    to: email,
                    subject: 'Код підтвердження',
                    html: `<h2>Ваш код: ${code}</h2><p>Введіть його в грі протягом 15 хвилин.</p>`
                });
                return socket.emit('auth_success', {
                    username: user.username,
                    data: null,
                    verified: false,
                    message: `Акаунт не підтверджено. Новий код надіслано на ${email}.`
                });
            }

            const dataResult = await pool.query(
                'SELECT data FROM player_data WHERE username = $1',
                [user.username]
            );
            const data = dataResult.rows[0]?.data || null;

            socket.emit('auth_success', {
                username: user.username,
                data: data,
                verified: true,
                message: `З поверненням, ${user.username}!`
            });
        } catch (err) {
            console.error('Помилка входу:', err);
            socket.emit('auth_error', 'Помилка сервера при вході');
        }
    });

        // ---------- ЗАПИТ НА СКИДАННЯ ПАРОЛЮ ----------
    socket.on('request_password_reset', async ({ identifier }) => {
        if (!identifier) return socket.emit('auth_error', 'Введіть логін або email');

        try {
            // identifier може бути логіном або email
            const result = await pool.query(
                `SELECT username, email FROM users 
                WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1)`,
                [identifier]
            );

            if (result.rows.length === 0) {
                // Не розкриваємо, чи існує акаунт (безпека)
                return socket.emit('auth_error', 'Якщо акаунт існує — код надіслано на email');
            }

            const user = result.rows[0];
            if (!user.email) {
                return socket.emit('auth_error', 'До цього акаунта не прив\'язано email');
            }

            const code = generateCode();
            const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

            await pool.query(
                'UPDATE users SET reset_code = $1, reset_code_expires_at = $2 WHERE username = $3',
                [code, expiresAt, user.username]
            );

            await sendVerificationEmail(user.email, code, 'Скидання паролю');
            socket.emit('reset_code_sent', { username: user.username, message: 'Код надіслано на email' });
        } catch (err) {
            console.error('Помилка запиту скидання паролю:', err);
            socket.emit('auth_error', 'Помилка сервера');
        }
    });

        // ---------- СКИДАННЯ ПАРОЛЮ ----------
    socket.on('reset_password', async ({ username, code, newPassword }) => {
        if (!username || !code || !newPassword) {
            return socket.emit('auth_error', 'Заповніть всі поля');
        }
        if (newPassword.length < 6) {
            return socket.emit('auth_error', 'Пароль має бути мінімум 6 символів');
        }

        try {
            const result = await pool.query(
                'SELECT reset_code, reset_code_expires_at FROM users WHERE username = $1',
                [username]
            );
            if (result.rows.length === 0) {
                return socket.emit('auth_error', 'Користувача не знайдено');
            }

            const { reset_code, reset_code_expires_at } = result.rows[0];
            if (!reset_code || reset_code !== code) {
                return socket.emit('auth_error', 'Невірний код');
            }
            if (new Date() > new Date(reset_code_expires_at)) {
                return socket.emit('auth_error', 'Код прострочено');
            }

            const hash = await bcrypt.hash(newPassword, 10);
            await pool.query(
                'UPDATE users SET password_hash = $1, reset_code = NULL, reset_code_expires_at = NULL WHERE username = $2',
                [hash, username]
            );

            socket.emit('password_reset_success', { message: 'Пароль успішно змінено! Тепер увійдіть.' });
        } catch (err) {
            console.error('Помилка скидання паролю:', err);
            socket.emit('auth_error', 'Помилка сервера');
        }
    });
    
        // ---------- ЗАПИТ НА ЗМІНУ EMAIL ----------
    socket.on('request_email_change', async ({ username, password, newEmail }) => {
        if (!username || !password || !newEmail) {
            return socket.emit('auth_error', 'Заповніть всі поля');
        }
        if (!/^\S+@\S+\.\S+$/.test(newEmail)) {
            return socket.emit('auth_error', 'Некоректний email');
        }

        try {
            const result = await pool.query(
                'SELECT password_hash, email FROM users WHERE username = $1',
                [username]
            );
            if (result.rows.length === 0) {
                return socket.emit('auth_error', 'Користувача не знайдено');
            }

            const user = result.rows[0];
            const ok = await bcrypt.compare(password, user.password_hash);
            if (!ok) {
                return socket.emit('auth_error', 'Невірний пароль');
            }

            if (user.email && user.email.toLowerCase() === newEmail.toLowerCase()) {
                return socket.emit('auth_error', 'Це вже ваш поточний email');
            }

            // Перевірка, чи новий email не зайнятий
            const busy = await pool.query(
                'SELECT username FROM users WHERE LOWER(email) = LOWER($1) AND username != $2',
                [newEmail, username]
            );
            if (busy.rows.length > 0) {
                return socket.emit('auth_error', 'Цей email вже використовується');
            }

            const code = generateCode();
            const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

            await pool.query(
                'UPDATE users SET new_email = $1, new_email_code = $2, new_email_expires_at = $3 WHERE username = $4',
                [newEmail, code, expiresAt, username]
            );

            await sendVerificationEmail(newEmail, code, 'Підтвердження нового email');
            socket.emit('email_change_code_sent', { message: 'Код надіслано на новий email' });
        } catch (err) {
            console.error('Помилка запиту зміни email:', err);
            socket.emit('auth_error', 'Помилка сервера');
        }
    });
    
        // ---------- ПІДТВЕРДЖЕННЯ ЗМІНИ EMAIL ----------
    socket.on('confirm_email_change', async ({ username, code }) => {
        if (!username || !code) {
            return socket.emit('auth_error', 'Введіть код');
        }

        try {
            const result = await pool.query(
                'SELECT new_email, new_email_code, new_email_expires_at FROM users WHERE username = $1',
                [username]
            );
            if (result.rows.length === 0) {
                return socket.emit('auth_error', 'Користувача не знайдено');
            }

            const { new_email, new_email_code, new_email_expires_at } = result.rows[0];
            if (!new_email || !new_email_code || new_email_code !== code) {
                return socket.emit('auth_error', 'Невірний код');
            }
            if (new Date() > new Date(new_email_expires_at)) {
                return socket.emit('auth_error', 'Код прострочено');
            }

            await pool.query(
                `UPDATE users 
                SET email = $1, email_verified = TRUE, 
                    new_email = NULL, new_email_code = NULL, new_email_expires_at = NULL 
                WHERE username = $2`,
                [new_email, username]
            );

            socket.emit('email_change_success', { message: 'Email успішно змінено!' });
        } catch (err) {
            console.error('Помилка підтвердження зміни email:', err);
            socket.emit('auth_error', 'Помилка сервера');
        }
    });

    // ---------- ПІДТВЕРДЖЕННЯ КОДУ ----------
    socket.on('verify_code', async ({ username, code }) => {
        try {
            const result = await pool.query(
                'SELECT verification_code, code_expires_at FROM users WHERE username = $1',
                [username]
            );
            if (result.rows.length === 0) {
                return socket.emit('auth_error', 'Користувача не знайдено');
            }
            const { verification_code, code_expires_at } = result.rows[0];
            if (!verification_code || verification_code !== code) {
                return socket.emit('auth_error', 'Невірний код');
            }
            if (new Date() > new Date(code_expires_at)) {
                return socket.emit('auth_error', 'Код прострочено. Запросіть новий.');
            }

            await pool.query(
                'UPDATE users SET email_verified = TRUE, verification_code = NULL, code_expires_at = NULL WHERE username = $1',
                [username]
            );

            // Завантажуємо дані гравця
            const dataResult = await pool.query(
                'SELECT data FROM player_data WHERE username = $1',
                [username]
            );
            const data = dataResult.rows[0]?.data || null;

            socket.emit('auth_success', {
                username: username,
                data: data,
                verified: true,
                message: 'Email успішно підтверджено!'
            });
        } catch (err) {
            console.error('Помилка верифікації:', err);
            socket.emit('auth_error', 'Помилка сервера при підтвердженні');
        }
    });

        // ---------- ПОВТОРНА ВІДПРАВКА КОДУ ----------
    socket.on('resend_code', async ({ username }) => {
        try {
            const result = await pool.query(
                'SELECT email, email_verified FROM users WHERE username = $1',
                [username]
            );
            if (result.rows.length === 0) {
                return socket.emit('auth_error', 'Користувача не знайдено');
            }
            if (result.rows[0].email_verified) {
                return socket.emit('auth_error', 'Email вже підтверджено');
            }

            const code = generateCode();
            const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
            await pool.query(
                'UPDATE users SET verification_code = $1, code_expires_at = $2 WHERE username = $3',
                [code, expiresAt, username]
            );

            await transporter.sendMail({
                from: `"Витрибенька" <${process.env.MJ_SENDER_EMAIL}>`,
                to: result.rows[0].email,
                subject: 'Новий код підтвердження',
                html: `<h2>Ваш код: ${code}</h2><p>Введіть його в грі протягом 15 хвилин.</p>`
            });

            socket.emit('auth_error', 'Новий код надіслано на вашу пошту');
        } catch (err) {
            console.error('Помилка повторної відправки:', err);
            socket.emit('auth_error', 'Помилка сервера при відправці коду');
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