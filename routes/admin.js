const express = require('express');
const router = express.Router();
const { connectDB } = require('../config/db');
const { requireAdmin, checkClassPermission } = require('../middlewares/authMiddleware');
const bcrypt = require('bcryptjs');

// Helper: chuyển chuỗi tiếng Việt thành slug
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

// Helper: Format Date YYYY-MM-DD -> DD/MM/YYYY
function formatDateVN(dateObj) {
    if (!dateObj) return '';
    const d = new Date(dateObj);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
}

// Helper: Add days to Date
function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

// Format YYYY-MM-DD
function toISODate(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// GET /admin - Tổng quan
router.get('/', async (req, res) => {
    try {
        const db = await connectDB();
        const user = req.session.user;

        let totalClasses = 0;
        let totalSchedules = 0;
        let totalUsers = 0;

        if (user.role === 'admin') {
            const cls = await db.get('SELECT COUNT(*) as cnt FROM classes');
            totalClasses = cls.cnt;
            const sch = await db.get('SELECT COUNT(*) as cnt FROM schedules WHERE is_deleted = 0');
            totalSchedules = sch.cnt;
            const usr = await db.get('SELECT COUNT(*) as cnt FROM users');
            totalUsers = usr.cnt;
        } else {
            const cls = await db.get('SELECT COUNT(*) as cnt FROM classes WHERE teacher_id = ?', [user.id]);
            totalClasses = cls.cnt;
            const sch = await db.get(`
                SELECT COUNT(*) as cnt FROM schedules s 
                JOIN classes c ON s.class_id = c.id 
                WHERE c.teacher_id = ? AND s.is_deleted = 0
            `, [user.id]);
            totalSchedules = sch.cnt;
        }

        res.render('admin', { 
            currentRoute: '/admin',
            stats: { totalClasses, totalSchedules, totalUsers }
        });
    } catch (e) {
        console.error("Lỗi get /admin:", e);
        res.status(500).send("Lỗi Server");
    }
});

// ==========================================
// 1. QUẢN LÝ LỚP HỌC (Chỉ Admin hoặc xem danh sách)
// ==========================================

// GET /admin/classes
router.get('/classes', async (req, res) => {
    try {
        const db = await connectDB();
        const user = req.session.user;

        let classes = [];
        if (user.role === 'admin') {
            classes = await db.all(`
                SELECT c.*, u.full_name as teacher_name 
                FROM classes c 
                LEFT JOIN users u ON c.teacher_id = u.id 
                ORDER BY c.order_index ASC, c.id ASC
            `);
        } else {
            classes = await db.all(`
                SELECT c.*, u.full_name as teacher_name 
                FROM classes c 
                LEFT JOIN users u ON c.teacher_id = u.id 
                WHERE c.teacher_id = ?
                ORDER BY c.order_index ASC, c.id ASC
            `, [user.id]);
        }

        // Lấy danh sách giáo viên để Admin phân quyền
        const teachers = await db.all(`
            SELECT id, full_name, username FROM users 
            ORDER BY full_name ASC
        `);

        res.render('admin_classes', { 
            currentRoute: '/admin/classes', 
            classes, 
            teachers 
        });
    } catch (e) {
        console.error("Lỗi get classes:", e);
        res.status(500).send("Lỗi Server");
    }
});

// POST /admin/classes/create (Chỉ Admin)
router.post('/classes/create', requireAdmin, async (req, res) => {
    try {
        const { name, order_index, teacher_id } = req.body;
        const code = generateSlug(name) + '_' + Math.floor(Math.random() * 1000);
        const db = await connectDB();
        await db.run(
            'INSERT INTO classes (name, code, order_index, teacher_id) VALUES (?, ?, ?, ?)',
            [name, code, order_index || 0, teacher_id || null]
        );
        res.redirect('/admin/classes');
    } catch (e) {
        console.error("Lỗi create class:", e);
        res.redirect('/admin/classes');
    }
});

// POST /admin/classes/edit/:id (Chỉ Admin)
router.post('/classes/edit/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, order_index, teacher_id } = req.body;
        const db = await connectDB();
        await db.run(
            'UPDATE classes SET name = ?, order_index = ?, teacher_id = ? WHERE id = ?',
            [name, order_index || 0, teacher_id || null, id]
        );
        res.redirect('/admin/classes');
    } catch (e) {
        console.error("Lỗi edit class:", e);
        res.redirect('/admin/classes');
    }
});

// POST /admin/classes/delete/:id (Chỉ Admin)
router.post('/classes/delete/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const db = await connectDB();
        await db.run('DELETE FROM classes WHERE id = ?', [id]);
        res.redirect('/admin/classes');
    } catch (e) {
        console.error("Lỗi delete class:", e);
        res.redirect('/admin/classes');
    }
});

// ==========================================
// 2. QUẢN LÝ THỜI KHÓA BIỂU (EXCEL-LIKE & ĐA TUẦN)
// ==========================================

// GET /admin/schedules - Giao diện chính Quản lý TKB
router.get('/schedules', checkClassPermission, async (req, res) => {
    try {
        const db = await connectDB();
        const user = req.session.user;

        // 1. Lấy danh sách lớp được phân quyền
        let classes = [];
        if (user.role === 'admin') {
            classes = await db.all('SELECT * FROM classes ORDER BY order_index ASC, id ASC');
        } else {
            classes = await db.all('SELECT * FROM classes WHERE teacher_id = ? ORDER BY order_index ASC, id ASC', [user.id]);
        }

        let selectedClassId = req.query.class_id;
        if (!selectedClassId && classes.length > 0) {
            selectedClassId = classes[0].id;
        }

        let allSchedules = [];
        let schedule = null;
        let matrix = [];
        const timeSlots = [
            "07:00 - 08:20", "08:20 - 08:45", "08:50 - 09:00",
            "09:00 - 09:50", "09:50 - 10:25", "15:15 - 15:45", "16:00 - 18:00"
        ];

        if (selectedClassId) {
            // Lấy tất cả các tuần active của lớp này
            allSchedules = await db.all(`
                SELECT id, week_label, date_range, week_number, week_start, week_end, month_title, theme_title 
                FROM schedules 
                WHERE class_id = ? AND is_deleted = 0 
                ORDER BY week_start ASC, id ASC
            `, [selectedClassId]);

            const targetScheduleId = req.query.schedule_id;
            if (targetScheduleId) {
                schedule = await db.get(`
                    SELECT * FROM schedules 
                    WHERE id = ? AND class_id = ? AND is_deleted = 0
                `, [targetScheduleId, selectedClassId]);
            }

            if (!schedule && allSchedules.length > 0) {
                // Mặc định lấy tuần gần nhất
                schedule = allSchedules[allSchedules.length - 1];
            }

            if (schedule) {
                const cells = await db.all(`
                    SELECT * FROM schedule_cells 
                    WHERE schedule_id = ? 
                    ORDER BY slot_index, day_of_week
                `, [schedule.id]);

                // Khởi tạo ma trận [7 slots][6 days (T2-T7)]
                for (let s = 0; s < 7; s++) {
                    matrix[s] = [];
                    for (let d = 2; d <= 7; d++) {
                        const cell = cells.find(c => c.slot_index === s && c.day_of_week === d);
                        matrix[s].push(cell || null);
                    }
                }
            }
        }

        // Lấy Thư viện Hoạt động (Activity Library)
        const activities = await db.all('SELECT * FROM activity_library ORDER BY id ASC');

        res.render('admin_schedules', {
            currentRoute: '/admin/schedules',
            classes,
            selectedClassId: parseInt(selectedClassId),
            schedule,
            allSchedules,
            matrix,
            timeSlots,
            activities
        });
    } catch (e) {
        console.error("Lỗi get admin/schedules:", e);
        res.status(500).send("Lỗi Server");
    }
});

// POST /admin/schedules/create-week - Tạo 1 tuần mới
router.post('/schedules/create-week', checkClassPermission, async (req, res) => {
    try {
        const { class_id, week_start, week_number, month_title, theme_title, copy_from_id } = req.body;
        const db = await connectDB();

        const startDate = new Date(week_start);
        const endDate = addDays(startDate, 5); // T2 đến T7
        const date_range = `Từ ngày ${formatDateVN(startDate)} - ${formatDateVN(endDate)}`;
        const week_label = `Tuần ${week_number || 1}`;

        const result = await db.run(`
            INSERT INTO schedules (class_id, week_start, week_end, week_number, month_title, theme_title, week_label, date_range, is_active, is_deleted) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0)
        `, [class_id, toISODate(startDate), toISODate(endDate), week_number || 1, month_title || 'THÁNG', theme_title || '', week_label, date_range]);

        const newScheduleId = result.lastID;

        // Nếu chọn sao chép từ một tuần khác
        if (copy_from_id && parseInt(copy_from_id) > 0) {
            const sourceCells = await db.all('SELECT * FROM schedule_cells WHERE schedule_id = ?', [copy_from_id]);
            for (const cell of sourceCells) {
                await db.run(`
                    INSERT INTO schedule_cells (schedule_id, day_of_week, slot_index, content, bg_color, row_span, col_span, is_merged) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `, [newScheduleId, cell.day_of_week, cell.slot_index, cell.content, cell.bg_color, cell.row_span, cell.col_span, cell.is_merged]);
            }
        } else {
            // Tạo 42 ô trống mặc định
            for (let s = 0; s < 7; s++) {
                for (let d = 2; d <= 7; d++) {
                    await db.run(`
                        INSERT INTO schedule_cells (schedule_id, day_of_week, slot_index, content, bg_color, row_span, col_span, is_merged) 
                        VALUES (?, ?, ?, '', '#ffffff', 1, 1, 0)
                    `, [newScheduleId, d, s]);
                }
            }
        }

        res.redirect(`/admin/schedules?class_id=${class_id}&schedule_id=${newScheduleId}`);
    } catch (e) {
        console.error("Lỗi create-week:", e);
        res.status(500).send("Lỗi tạo tuần mới");
    }
});

// POST /admin/schedules/create-batch - Tạo nhiều tuần cùng lúc
router.post('/schedules/create-batch', checkClassPermission, async (req, res) => {
    try {
        const { class_id, start_date, num_weeks, start_week_number, month_title, theme_title, copy_from_previous } = req.body;
        const db = await connectDB();

        const count = parseInt(num_weeks) || 1;
        const initialWeekNum = parseInt(start_week_number) || 1;
        let baseDate = new Date(start_date);
        let firstNewScheduleId = null;
        let lastCreatedScheduleId = null;

        // Nếu chọn copy từ tuần trước đó của lớp
        let sourceScheduleId = null;
        if (copy_from_previous === '1' || copy_from_previous === 'true') {
            const prev = await db.get(`
                SELECT id FROM schedules 
                WHERE class_id = ? AND is_deleted = 0 
                ORDER BY week_start DESC, id DESC LIMIT 1
            `, [class_id]);
            if (prev) sourceScheduleId = prev.id;
        }

        for (let i = 0; i < count; i++) {
            const currentStart = addDays(baseDate, i * 7);
            const currentEnd = addDays(currentStart, 5); // T2 đến T7
            const weekNum = initialWeekNum + i;
            const week_label = `Tuần ${weekNum}`;
            const date_range = `Từ ngày ${formatDateVN(currentStart)} - ${formatDateVN(currentEnd)}`;

            const result = await db.run(`
                INSERT INTO schedules (class_id, week_start, week_end, week_number, month_title, theme_title, week_label, date_range, is_active, is_deleted) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0)
            `, [class_id, toISODate(currentStart), toISODate(currentEnd), weekNum, month_title || 'THÁNG', theme_title || '', week_label, date_range]);

            const newScheduleId = result.lastID;
            if (!firstNewScheduleId) firstNewScheduleId = newScheduleId;

            // Nguồn để copy: nếu có sourceScheduleId hoặc lấy tuần vừa tạo trước đó
            const copySourceId = sourceScheduleId || (i > 0 ? lastCreatedScheduleId : null);

            if (copySourceId) {
                const sourceCells = await db.all('SELECT * FROM schedule_cells WHERE schedule_id = ?', [copySourceId]);
                for (const cell of sourceCells) {
                    await db.run(`
                        INSERT INTO schedule_cells (schedule_id, day_of_week, slot_index, content, bg_color, row_span, col_span, is_merged) 
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    `, [newScheduleId, cell.day_of_week, cell.slot_index, cell.content, cell.bg_color, cell.row_span, cell.col_span, cell.is_merged]);
                }
            } else {
                for (let s = 0; s < 7; s++) {
                    for (let d = 2; d <= 7; d++) {
                        await db.run(`
                            INSERT INTO schedule_cells (schedule_id, day_of_week, slot_index, content, bg_color, row_span, col_span, is_merged) 
                            VALUES (?, ?, ?, '', '#ffffff', 1, 1, 0)
                        `, [newScheduleId, d, s]);
                    }
                }
            }

            lastCreatedScheduleId = newScheduleId;
        }

        res.redirect(`/admin/schedules?class_id=${class_id}&schedule_id=${firstNewScheduleId || ''}`);
    } catch (e) {
        console.error("Lỗi create-batch:", e);
        res.status(500).send("Lỗi tạo nhiều tuần");
    }
});

// POST /admin/schedules/copy-week - Deep Copy tuần nguồn sang tuần đích
router.post('/schedules/copy-week', checkClassPermission, async (req, res) => {
    try {
        const { source_schedule_id, target_schedule_id, class_id } = req.body;
        const db = await connectDB();

        if (!source_schedule_id || !target_schedule_id) {
            return res.status(400).send("Thiếu thông tin tuần nguồn hoặc tuần đích");
        }

        // Lấy tất cả các ô từ tuần nguồn
        const sourceCells = await db.all('SELECT * FROM schedule_cells WHERE schedule_id = ?', [source_schedule_id]);

        // Cập nhật đè lên tuần đích
        for (const cell of sourceCells) {
            await db.run(`
                REPLACE INTO schedule_cells (schedule_id, day_of_week, slot_index, content, bg_color, row_span, col_span, is_merged) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [target_schedule_id, cell.day_of_week, cell.slot_index, cell.content, cell.bg_color, cell.row_span, cell.col_span, cell.is_merged]);
        }

        res.redirect(`/admin/schedules?class_id=${class_id}&schedule_id=${target_schedule_id}`);
    } catch (e) {
        console.error("Lỗi copy-week:", e);
        res.status(500).send("Lỗi sao chép thời khóa biểu");
    }
});

// POST /admin/schedules/update-info - Cập nhật tiêu đề TKB
router.post('/schedules/update-info', checkClassPermission, async (req, res) => {
    try {
        const { schedule_id, month_title, theme_title, week_label, week_number, date_range, week_start, week_end, class_id } = req.body;
        const db = await connectDB();

        await db.run(`
            UPDATE schedules 
            SET month_title = ?, theme_title = ?, week_label = ?, week_number = ?, date_range = ?, week_start = ?, week_end = ? 
            WHERE id = ?
        `, [month_title, theme_title, week_label, week_number || 1, date_range, week_start || null, week_end || null, schedule_id]);

        res.redirect(`/admin/schedules?class_id=${class_id}&schedule_id=${schedule_id}`);
    } catch (e) {
        console.error("Lỗi update info:", e);
        res.redirect('/admin/schedules');
    }
});

// POST /admin/schedules/delete-week - Soft Delete tuần
router.post('/schedules/delete-week', checkClassPermission, async (req, res) => {
    try {
        const { schedule_id, class_id } = req.body;
        const db = await connectDB();

        await db.run(`
            UPDATE schedules 
            SET is_deleted = 1, deleted_at = NOW() 
            WHERE id = ?
        `, [schedule_id]);

        res.redirect(`/admin/schedules?class_id=${class_id}`);
    } catch (e) {
        console.error("Lỗi delete-week:", e);
        res.redirect('/admin/schedules');
    }
});

// ==========================================
// 3. CÁC API THAO TÁC Ô GIỐNG EXCEL (AJAX)
// ==========================================

// POST /admin/schedules/update-cell - Sửa 1 ô
router.post('/schedules/update-cell', checkClassPermission, async (req, res) => {
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

// POST /admin/schedules/merge-cells - Gộp ô 2 chiều (rowspan + colspan)
router.post('/admin/schedules/merge-cells', checkClassPermission, async (req, res) => {
    try {
        const { schedule_id, min_slot, max_slot, min_day, max_day, master_content, master_color } = req.body;
        const db = await connectDB();

        const row_span = max_slot - min_slot + 1;
        const col_span = max_day - min_day + 1;

        // 1. Cập nhật Master Cell (ô góc trên bên trái)
        await db.run(`
            UPDATE schedule_cells 
            SET content = ?, bg_color = ?, row_span = ?, col_span = ?, is_merged = 0 
            WHERE schedule_id = ? AND slot_index = ? AND day_of_week = ?
        `, [master_content || '', master_color || '#ffffff', row_span, col_span, schedule_id, min_slot, min_day]);

        // 2. Đánh dấu các ô còn lại trong khối chữ nhật là is_merged = 1
        for (let s = min_slot; s <= max_slot; s++) {
            for (let d = min_day; d <= max_day; d++) {
                if (s === min_slot && d === min_day) continue; // Bỏ qua ô master
                await db.run(`
                    UPDATE schedule_cells 
                    SET is_merged = 1, row_span = 1, col_span = 1 
                    WHERE schedule_id = ? AND slot_index = ? AND day_of_week = ?
                `, [schedule_id, s, d]);
            }
        }

        res.json({ success: true });
    } catch (e) {
        console.error("Lỗi merge cells:", e);
        res.status(500).json({ success: false, message: e.message });
    }
});

// POST /admin/schedules/unmerge-cells - Hủy gộp ô
router.post('/admin/schedules/unmerge-cells', checkClassPermission, async (req, res) => {
    try {
        const { schedule_id, min_slot, max_slot, min_day, max_day } = req.body;
        const db = await connectDB();

        // Khôi phục toàn bộ các ô trong vùng về trạng thái độc lập
        for (let s = min_slot; s <= max_slot; s++) {
            for (let d = min_day; d <= max_day; d++) {
                await db.run(`
                    UPDATE schedule_cells 
                    SET is_merged = 0, row_span = 1, col_span = 1 
                    WHERE schedule_id = ? AND slot_index = ? AND day_of_week = ?
                `, [schedule_id, s, d]);
            }
        }

        res.json({ success: true });
    } catch (e) {
        console.error("Lỗi unmerge cells:", e);
        res.status(500).json({ success: false, message: e.message });
    }
});

// POST /admin/schedules/batch-update-cells - Cập nhật nhiều ô (Copy/Paste & Thư viện hoạt động)
router.post('/admin/schedules/batch-update-cells', checkClassPermission, async (req, res) => {
    try {
        const { schedule_id, cells } = req.body;
        const db = await connectDB();

        if (cells && Array.isArray(cells)) {
            for (const item of cells) {
                await db.run(`
                    UPDATE schedule_cells 
                    SET content = ?, bg_color = ? 
                    WHERE schedule_id = ? AND slot_index = ? AND day_of_week = ?
                `, [item.content, item.bg_color || '#ffffff', schedule_id, item.slot_index, item.day_of_week]);
            }
        }

        res.json({ success: true });
    } catch (e) {
        console.error("Lỗi batch update cells:", e);
        res.status(500).json({ success: false, message: e.message });
    }
});

// ==========================================
// 4. THƯ VIỆN HOẠT ĐỘNG (ACTIVITY LIBRARY)
// ==========================================

// POST /admin/activities/create
router.post('/activities/create', async (req, res) => {
    try {
        const { title, default_color } = req.body;
        const user = req.session.user;
        const db = await connectDB();

        await db.run(
            'INSERT INTO activity_library (title, default_color, user_id) VALUES (?, ?, ?)',
            [title, default_color || '#ffffff', user.id]
        );
        res.json({ success: true });
    } catch (e) {
        console.error("Lỗi create activity:", e);
        res.status(500).json({ success: false, message: e.message });
    }
});

// POST /admin/activities/delete/:id
router.post('/activities/delete/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const db = await connectDB();
        await db.run('DELETE FROM activity_library WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (e) {
        console.error("Lỗi delete activity:", e);
        res.status(500).json({ success: false, message: e.message });
    }
});

// ==========================================
// 5. QUẢN LÝ TÀI KHOẢN (Chỉ Admin)
// ==========================================

// GET /admin/users
router.get('/users', requireAdmin, async (req, res) => {
    try {
        const db = await connectDB();
        const users = await db.all('SELECT id, username, full_name, role FROM users ORDER BY id ASC');
        res.render('admin_users', { currentRoute: '/admin/users', users });
    } catch (e) {
        console.error("Lỗi get users:", e);
        res.status(500).send("Lỗi Server");
    }
});

// POST /admin/users/create
router.post('/users/create', requireAdmin, async (req, res) => {
    try {
        const { username, password, full_name, role } = req.body;
        const db = await connectDB();
        const hash = await bcrypt.hash(password, 10);
        await db.run(
            'INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)',
            [username, hash, full_name, role || 'teacher']
        );
        res.redirect('/admin/users');
    } catch (e) {
        console.error("Lỗi create user:", e);
        res.redirect('/admin/users');
    }
});

// POST /admin/users/edit/:id
router.post('/users/edit/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { username, password, full_name, role } = req.body;
        const db = await connectDB();
        
        if (password && password.trim() !== '') {
            const hash = await bcrypt.hash(password, 10);
            await db.run(
                'UPDATE users SET username = ?, password = ?, full_name = ?, role = ? WHERE id = ?',
                [username, hash, full_name, role, id]
            );
        } else {
            await db.run(
                'UPDATE users SET username = ?, full_name = ?, role = ? WHERE id = ?',
                [username, full_name, role, id]
            );
        }
        res.redirect('/admin/users');
    } catch (e) {
        console.error("Lỗi edit user:", e);
        res.redirect('/admin/users');
    }
});

// POST /admin/users/delete/:id
router.post('/users/delete/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        if (req.session.user && req.session.user.id == id) {
            console.error("Không thể tự xóa tài khoản đang đăng nhập");
            return res.redirect('/admin/users');
        }
        const db = await connectDB();
        await db.run('DELETE FROM users WHERE id = ?', [id]);
        res.redirect('/admin/users');
    } catch (e) {
        console.error("Lỗi delete user:", e);
        res.redirect('/admin/users');
    }
});

module.exports = router;
