const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { pool, testConnection } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve file tĩnh của frontend (index.html, style.css, script.js, demo.jpg...)
app.use(express.static(path.join(__dirname)));

// Route kiểm tra trạng thái Server & Database
app.get('/api/health', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT 1 as status');
        res.json({
            status: 'ok',
            message: 'Server & MySQL đang hoạt động bình thường!',
            db: 'connected'
        });
    } catch (err) {
        res.status(500).json({
            status: 'error',
            message: 'Không thể kết nối MySQL: ' + err.message,
            db: 'disconnected'
        });
    }
});

// Khởi động server
app.listen(PORT, async () => {
    console.log(`🚀 [Server] Đang chạy tại http://localhost:${PORT}`);
    await testConnection();
});
