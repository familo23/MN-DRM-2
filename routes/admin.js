const express = require('express');
const router = express.Router();
const { connectDB } = require('../config/db');

// GET /admin (Tổng quan)
router.get('/', (req, res) => {
    res.render('admin', { currentRoute: '/admin' });
});

// GET /admin/classes (Quản lý Lớp học)
router.get('/classes', async (req, res) => {
    try {
        const db = await connectDB();
        const classes = await db.all('SELECT * FROM classes ORDER BY order_index ASC');
        res.render('admin_classes', { currentRoute: '/admin/classes', classes });
    } catch (e) {
        console.error("Lỗi get classes:", e);
        res.status(500).send("Lỗi Server");
    }
});

// POST /admin/classes/create (Thêm lớp mới)
router.post('/classes/create', async (req, res) => {
    try {
        const { name, code, order_index } = req.body;
        const db = await connectDB();
        await db.run('INSERT INTO classes (name, code, order_index) VALUES (?, ?, ?)', [name, code, order_index || 0]);
        res.redirect('/admin/classes');
    } catch (e) {
        console.error("Lỗi create class:", e);
        // Bỏ qua lỗi UNIQUE bằng cách redirect về trang cũ nếu code trùng
        res.redirect('/admin/classes');
    }
});

// POST /admin/classes/edit/:id (Sửa lớp)
router.post('/classes/edit/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, code, order_index } = req.body;
        const db = await connectDB();
        await db.run('UPDATE classes SET name = ?, code = ?, order_index = ? WHERE id = ?', [name, code, order_index || 0, id]);
        res.redirect('/admin/classes');
    } catch (e) {
        console.error("Lỗi edit class:", e);
        res.redirect('/admin/classes');
    }
});

// POST /admin/classes/delete/:id (Xóa lớp)
router.post('/classes/delete/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const db = await connectDB();
        // Sẽ tự động xóa dữ liệu liên quan trong bảng schedules và schedule_cells nhờ ON DELETE CASCADE
        await db.run('DELETE FROM classes WHERE id = ?', [id]);
        res.redirect('/admin/classes');
    } catch (e) {
        console.error("Lỗi delete class:", e);
        res.redirect('/admin/classes');
    }
});

module.exports = router;
