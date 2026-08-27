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
        const { name, order_index } = req.body;
        const code = generateSlug(name);
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
        const { name, order_index } = req.body;
        const code = generateSlug(name);
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

// ==========================================
// QUẢN LÝ THỜI KHÓA BIỂU
// ==========================================

function generateSlug(text) {
    return text.toString().toLowerCase()
        .replace(/á|à|ả|ạ|ã|ă|ắ|ằ|ẳ|ẵ|ặ|â|ấ|ầ|ẩ|ẫ|ậ/gi, 'a')
        .replace(/é|è|ẻ|ẽ|ẹ|ê|ế|ề|ể|ễ|ệ/gi, 'e')
        .replace(/i|í|ì|ỉ|ĩ|ị/gi, 'i')
        .replace(/ó|ò|ỏ|õ|ọ|ô|ố|ồ|ổ|ỗ|ộ|ơ|ớ|ờ|ở|ỡ|ợ/gi, 'o')
        .replace(/ú|ù|ủ|ũ|ụ|ư|ứ|ừ|ử|ữ|ự/gi, 'u')
        .replace(/ý|ỳ|ỷ|ỹ|ỵ/gi, 'y')
        .replace(/đ/gi, 'd')
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '');
}

// GET /admin/schedules - Giao diện chính
router.get('/schedules', async (req, res) => {
    try {
        const db = await connectDB();
        const classes = await db.all('SELECT * FROM classes ORDER BY order_index ASC');
        
        let selectedClassId = req.query.class_id;
        if (!selectedClassId && classes.length > 0) {
            selectedClassId = classes[0].id;
        }

        let schedule = null;
        let matrix = [];
        const timeSlots = [
            "07:00 - 08:20", "08:20 - 08:45", "08:50 - 09:00",
            "09:00 - 09:50", "09:50 - 10:25", "15:15 - 15:45", "16:00 - 18:00"
        ];

        if (selectedClassId) {
            schedule = await db.get('SELECT * FROM schedules WHERE class_id = ? AND is_active = 1', [selectedClassId]);
            if (schedule) {
                const cells = await db.all('SELECT * FROM schedule_cells WHERE schedule_id = ? ORDER BY slot_index, day_of_week', [schedule.id]);
                for (let s = 0; s < 7; s++) {
                    matrix[s] = [];
                    for (let d = 2; d <= 7; d++) {
                        const cell = cells.find(c => c.slot_index === s && c.day_of_week === d);
                        matrix[s].push(cell || null);
                    }
                }
            }
        }

        res.render('admin_schedules', {
            currentRoute: '/admin/schedules',
            classes,
            selectedClassId: parseInt(selectedClassId),
            schedule,
            matrix,
            timeSlots
        });
    } catch (e) {
        console.error("Lỗi get schedules:", e);
        res.status(500).send("Lỗi Server");
    }
});

// POST /admin/schedules/init - Khởi tạo TKB trống
router.post('/schedules/init', async (req, res) => {
    try {
        const { class_id } = req.body;
        const db = await connectDB();
        
        const result = await db.run(`INSERT INTO schedules (class_id) VALUES (?)`, [class_id]);
        const schedule_id = result.lastID;
        
        // Tạo 42 ô trống
        for (let s = 0; s < 7; s++) {
            for (let d = 2; d <= 7; d++) {
                await db.run(
                    `INSERT INTO schedule_cells (schedule_id, day_of_week, slot_index, content, bg_color) VALUES (?, ?, ?, ?, ?)`,
                    [schedule_id, d, s, '', '#ffffff']
                );
            }
        }
        res.redirect('/admin/schedules?class_id=' + class_id);
    } catch (e) {
        console.error("Lỗi init schedule:", e);
        res.status(500).send("Lỗi Server");
    }
});

// POST /admin/schedules/update-info - Cập nhật tiêu đề TKB
router.post('/schedules/update-info', async (req, res) => {
    try {
        const { schedule_id, month_title, theme_title, week_label, date_range, class_id } = req.body;
        const db = await connectDB();
        await db.run(
            `UPDATE schedules SET month_title = ?, theme_title = ?, week_label = ?, date_range = ? WHERE id = ?`,
            [month_title, theme_title, week_label, date_range, schedule_id]
        );
        res.redirect('/admin/schedules?class_id=' + class_id);
    } catch (e) {
        console.error("Lỗi update info:", e);
        res.redirect('/admin/schedules');
    }
});

// POST /admin/schedules/update-cell - Cập nhật 1 ô (Dùng AJAX)
router.post('/schedules/update-cell', async (req, res) => {
    try {
        const { cell_id, content, bg_color } = req.body;
        const db = await connectDB();
        await db.run(
            `UPDATE schedule_cells SET content = ?, bg_color = ? WHERE id = ?`,
            [content, bg_color, cell_id]
        );
        res.json({ success: true });
    } catch (e) {
        console.error("Lỗi update cell:", e);
        res.status(500).json({ success: false, message: e.message });
    }
});

// POST /admin/schedules/delete - Xóa toàn bộ lịch
router.post('/schedules/delete', async (req, res) => {
    try {
        const { schedule_id, class_id } = req.body;
        const db = await connectDB();
        await db.run(`DELETE FROM schedules WHERE id = ?`, [schedule_id]);
        res.redirect('/admin/schedules?class_id=' + class_id);
    } catch (e) {
        console.error("Lỗi delete schedule:", e);
        res.redirect('/admin/schedules');
    }
});

module.exports = router;
