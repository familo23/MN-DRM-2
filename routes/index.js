const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');

// Route hiển thị giao diện trang chủ
router.get('/', (req, res) => {
    res.render('index');
});

// Route API kiểm tra trạng thái Server & Database
router.get('/api/health', async (req, res) => {
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

module.exports = router;
