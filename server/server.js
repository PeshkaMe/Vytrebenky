const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());

// Роздаємо статичні файли сайту з папки client
app.use(express.static(path.join(__dirname, '../client')));

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

// База даних у оперативній пам'яті (хранище персонажів)
const playersDB = {};

io.on('connection', (socket) => {
    console.log('Гравець підключився:', socket.id);

    // 1. Обробка чату
    socket.on('send_chat_message', (data) => {
        io.emit('chat_message', {
            user: data.user,
            text: data.text
        });
    });

    // 2. Отримання/завантаження даних гравця
    socket.on('load_player', (playerName) => {
        if (!playerName) return;
        
        // Якщо такий гравець є в базі — відправляємо його дані, якщо немає — повертаємо null
        const savedData = playersDB[playerName] || null;
        socket.emit('player_loaded', savedData);
    });

    // 3. Збереження даних гравця
    socket.on('save_player', (payload) => {
        if (payload && payload.name) {
            playersDB[payload.name] = payload.data;
            console.log(`Прогрес гравця ${payload.name} збережено на сервері.`);
        }
    });

    socket.on('disconnect', () => {
        console.log('Гравець відключився:', socket.id);
    });
});

// Port підтримка для Render.com (через process.env.PORT)
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер працює на порту ${PORT}`);
});