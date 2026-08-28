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

const DEFAULT_TIME_SLOTS = [
    "07:00 - 08:20", "08:20 - 08:45", "08:50 - 09:00",
    "09:00 - 09:50", "09:50 - 10:25", "15:15 - 15:45", "16:00 - 18:00"
];

function parseTimeSlots(schedule) {
    if (!schedule || !schedule.time_slots) return [...DEFAULT_TIME_SLOTS];
    try {
        const parsed = typeof schedule.time_slots === 'string' ? JSON.parse(schedule.time_slots) : schedule.time_slots;
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch (e) {}
    return [...DEFAULT_TIME_SLOTS];
}

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
        if (Array.isArray(selectedClassId)) selectedClassId = selectedClassId[0];
        if (selectedClassId) selectedClassId = parseInt(selectedClassId, 10);

        if (!selectedClassId && classes.length > 0) {
            selectedClassId = classes[0].id;
        }

        let allSchedules = [];
        let schedule = null;
        let matrix = [];
        let timeSlots = [...DEFAULT_TIME_SLOTS];

        if (selectedClassId) {
            // Lấy tất cả các tuần active của lớp này
            allSchedules = await db.all(`
                SELECT id, week_label, date_range, week_number, week_start, week_end, month_title, theme_title, time_slots 
                FROM schedules 
                WHERE class_id = ? AND is_deleted = 0 
                ORDER BY week_start ASC, id ASC
            `, [selectedClassId]);

            let targetScheduleId = req.query.schedule_id;
            if (Array.isArray(targetScheduleId)) targetScheduleId = targetScheduleId[0];
            if (targetScheduleId) targetScheduleId = parseInt(targetScheduleId, 10);

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
                timeSlots = parseTimeSlots(schedule);
                const cells = await db.all(`
                    SELECT * FROM schedule_cells 
                    WHERE schedule_id = ? 
                    ORDER BY slot_index, day_of_week
                `, [schedule.id]);

                // Tự động sửa lỗi (Self-healing): Khôi phục các ô bị kẹt is_merged = 1 mồ côi
                const masterCells = cells.filter(c => (c.row_span > 1 || c.col_span > 1) && c.is_merged === 0);
                const covered = new Set();
                for (const m of masterCells) {
                    for (let rs = 0; rs < m.row_span; rs++) {
                        for (let cs = 0; cs < m.col_span; cs++) {
                            if (rs === 0 && cs === 0) continue;
                            covered.add(`${m.slot_index + rs}_${m.day_of_week + cs}`);
                        }
                    }
                }
                for (const c of cells) {
                    if (c.is_merged === 1 && !covered.has(`${c.slot_index}_${c.day_of_week}`)) {
                        c.is_merged = 0;
                        c.row_span = 1;
                        c.col_span = 1;
                        await db.run('UPDATE schedule_cells SET is_merged = 0, row_span = 1, col_span = 1 WHERE id = ?', [c.id]);
                    }
                }

                // Khởi tạo ma trận [timeSlots.length][6 days (T2-T7)]
                for (let s = 0; s < timeSlots.length; s++) {
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

// Helper: Sanitize ID to single integer
function toId(val) {
    if (!val) return null;
    if (Array.isArray(val)) val = val[0];
    const n = parseInt(val, 10);
    return isNaN(n) ? null : n;
}

// POST /admin/schedules/create-week - Tạo 1 tuần mới
router.post('/schedules/create-week', checkClassPermission, async (req, res) => {
    try {
        const { class_id, week_start, week_number, month_title, theme_title, copy_from_id } = req.body;
        const cleanClassId = toId(class_id);
        const cleanCopyId = toId(copy_from_id);
        const db = await connectDB();

        const startDate = new Date(week_start);
        const endDate = addDays(startDate, 5); // T2 đến T7
        const date_range = `Từ ngày ${formatDateVN(startDate)} - ${formatDateVN(endDate)}`;
        const week_label = `Tuần ${week_number || 1}`;

        const result = await db.run(`
            INSERT INTO schedules (class_id, week_start, week_end, week_number, month_title, theme_title, week_label, date_range, is_active, is_deleted) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0)
        `, [cleanClassId, toISODate(startDate), toISODate(endDate), parseInt(week_number) || 1, month_title || 'THÁNG', theme_title || '', week_label, date_range]);

        const newScheduleId = result.lastID;

        // Nếu chọn sao chép từ một tuần khác
        if (cleanCopyId && cleanCopyId > 0) {
            const sourceCells = await db.all('SELECT * FROM schedule_cells WHERE schedule_id = ?', [cleanCopyId]);
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

        res.redirect(`/admin/schedules?class_id=${cleanClassId}&schedule_id=${newScheduleId}`);
    } catch (e) {
        console.error("Lỗi create-week:", e);
        res.status(500).send("Lỗi tạo tuần mới");
    }
});

// POST /admin/schedules/create-batch - Tạo nhiều tuần cùng lúc
router.post('/schedules/create-batch', checkClassPermission, async (req, res) => {
    try {
        const { class_id, start_date, num_weeks, start_week_number, month_title, theme_title, copy_from_previous } = req.body;
        const cleanClassId = toId(class_id);
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
            `, [cleanClassId]);
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
            `, [cleanClassId, toISODate(currentStart), toISODate(currentEnd), weekNum, month_title || 'THÁNG', theme_title || '', week_label, date_range]);

            const newScheduleId = result.lastID;
            if (!firstNewScheduleId) firstNewScheduleId = newScheduleId;

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

        res.redirect(`/admin/schedules?class_id=${cleanClassId}&schedule_id=${firstNewScheduleId || ''}`);
    } catch (e) {
        console.error("Lỗi create-batch:", e);
        res.status(500).send("Lỗi tạo nhiều tuần");
    }
});

// POST /admin/schedules/copy-week - Deep Copy tuần nguồn sang tuần đích
router.post('/schedules/copy-week', checkClassPermission, async (req, res) => {
    try {
        const { source_schedule_id, target_schedule_id, class_id } = req.body;
        const cleanClassId = toId(class_id);
        const cleanSourceId = toId(source_schedule_id);
        const cleanTargetId = toId(target_schedule_id);
        const db = await connectDB();

        if (!cleanSourceId || !cleanTargetId) {
            return res.status(400).send("Thiếu thông tin tuần nguồn hoặc tuần đích");
        }

        const sourceCells = await db.all('SELECT * FROM schedule_cells WHERE schedule_id = ?', [cleanSourceId]);

        for (const cell of sourceCells) {
            await db.run(`
                REPLACE INTO schedule_cells (schedule_id, day_of_week, slot_index, content, bg_color, row_span, col_span, is_merged) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [cleanTargetId, cell.day_of_week, cell.slot_index, cell.content, cell.bg_color, cell.row_span, cell.col_span, cell.is_merged]);
        }

        res.redirect(`/admin/schedules?class_id=${cleanClassId}&schedule_id=${cleanTargetId}`);
    } catch (e) {
        console.error("Lỗi copy-week:", e);
        res.status(500).send("Lỗi sao chép thời khóa biểu");
    }
});

// POST /admin/schedules/update-info - Cập nhật tiêu đề TKB
router.post('/schedules/update-info', checkClassPermission, async (req, res) => {
    try {
        const { schedule_id, month_title, theme_title, week_label, week_number, date_range, week_start, week_end, class_id } = req.body;
        const cleanScheduleId = toId(schedule_id);
        const cleanClassId = toId(class_id);
        const db = await connectDB();

        await db.run(`
            UPDATE schedules 
            SET month_title = ?, theme_title = ?, week_label = ?, week_number = ?, date_range = ?, week_start = ?, week_end = ? 
            WHERE id = ?
        `, [month_title, theme_title, week_label, parseInt(week_number) || 1, date_range, week_start || null, week_end || null, cleanScheduleId]);

        res.redirect(`/admin/schedules?class_id=${cleanClassId}&schedule_id=${cleanScheduleId}`);
    } catch (e) {
        console.error("Lỗi update info:", e);
        res.redirect('/admin/schedules');
    }
});

// POST /admin/schedules/delete-week - Soft Delete tuần
router.post('/schedules/delete-week', checkClassPermission, async (req, res) => {
    try {
        const { schedule_id, class_id } = req.body;
        const cleanScheduleId = toId(schedule_id);
        const cleanClassId = toId(class_id);
        const db = await connectDB();

        await db.run(`
            UPDATE schedules 
            SET is_deleted = 1, deleted_at = NOW() 
            WHERE id = ?
        `, [cleanScheduleId]);

        res.redirect(`/admin/schedules?class_id=${cleanClassId}`);
    } catch (e) {
        console.error("Lỗi delete-week:", e);
        res.redirect('/admin/schedules');
    }
});

// POST /admin/schedules/add-time-slot - Thêm 1 hàng (khung thời gian mới)
router.post('/schedules/add-time-slot', checkClassPermission, async (req, res) => {
    try {
        const { schedule_id, class_id, time_label } = req.body;
        const cleanScheduleId = toId(schedule_id);
        const cleanClassId = toId(class_id);
        const label = (time_label || '').trim() || 'Thời gian mới';
        const db = await connectDB();

        const schedule = await db.get('SELECT * FROM schedules WHERE id = ?', [cleanScheduleId]);
        if (!schedule) return res.status(404).send('Không tìm thấy thời khóa biểu');

        const slots = parseTimeSlots(schedule);
        slots.push(label);
        const newSlotIndex = slots.length - 1;

        await db.run('UPDATE schedules SET time_slots = ? WHERE id = ?', [JSON.stringify(slots), cleanScheduleId]);

        // Khởi tạo 6 ô trống mới cho slot này (Thứ 2 đến Thứ 7)
        for (let d = 2; d <= 7; d++) {
            await db.run(`
                INSERT INTO schedule_cells (schedule_id, day_of_week, slot_index, content, bg_color, row_span, col_span, is_merged) 
                VALUES (?, ?, ?, '', '#ffffff', 1, 1, 0)
            `, [cleanScheduleId, d, newSlotIndex]);
        }

        res.redirect(`/admin/schedules?class_id=${cleanClassId}&schedule_id=${cleanScheduleId}`);
    } catch (e) {
        console.error('Lỗi add-time-slot:', e);
        res.status(500).send('Lỗi thêm khung giờ');
    }
});

// POST /admin/schedules/update-time-slot - Đổi tên khung thời gian
router.post('/schedules/update-time-slot', checkClassPermission, async (req, res) => {
    try {
        const { schedule_id, class_id, slot_index, new_label } = req.body;
        const cleanScheduleId = toId(schedule_id);
        const cleanClassId = toId(class_id);
        const slotIdx = parseInt(slot_index);
        const label = (new_label || '').trim();
        const db = await connectDB();

        const schedule = await db.get('SELECT * FROM schedules WHERE id = ?', [cleanScheduleId]);
        if (!schedule) return res.status(404).send('Không tìm thấy thời khóa biểu');

        const slots = parseTimeSlots(schedule);
        if (slotIdx >= 0 && slotIdx < slots.length && label) {
            slots[slotIdx] = label;
            await db.run('UPDATE schedules SET time_slots = ? WHERE id = ?', [JSON.stringify(slots), cleanScheduleId]);
        }

        res.redirect(`/admin/schedules?class_id=${cleanClassId}&schedule_id=${cleanScheduleId}`);
    } catch (e) {
        console.error('Lỗi update-time-slot:', e);
        res.status(500).send('Lỗi sửa khung giờ');
    }
});

// POST /admin/schedules/delete-time-slot - Xóa 1 hàng (khung thời gian)
router.post('/schedules/delete-time-slot', checkClassPermission, async (req, res) => {
    try {
        const { schedule_id, class_id, slot_index } = req.body;
        const cleanScheduleId = toId(schedule_id);
        const cleanClassId = toId(class_id);
        const slotIdx = parseInt(slot_index);
        const db = await connectDB();

        const schedule = await db.get('SELECT * FROM schedules WHERE id = ?', [cleanScheduleId]);
        if (!schedule) return res.status(404).send('Không tìm thấy thời khóa biểu');

        const slots = parseTimeSlots(schedule);
        if (slots.length > 1 && slotIdx >= 0 && slotIdx < slots.length) {
            slots.splice(slotIdx, 1);
            await db.run('UPDATE schedules SET time_slots = ? WHERE id = ?', [JSON.stringify(slots), cleanScheduleId]);

            // Xóa các ô ở slot này
            await db.run('DELETE FROM schedule_cells WHERE schedule_id = ? AND slot_index = ?', [cleanScheduleId, slotIdx]);

            // Dồn slot_index của các ô sau đó lên 1 bậc
            await db.run('UPDATE schedule_cells SET slot_index = slot_index - 1 WHERE schedule_id = ? AND slot_index > ?', [cleanScheduleId, slotIdx]);
        }

        res.redirect(`/admin/schedules?class_id=${cleanClassId}&schedule_id=${cleanScheduleId}`);
    } catch (e) {
        console.error('Lỗi delete-time-slot:', e);
        res.status(500).send('Lỗi xóa khung giờ');
    }
});

// ==========================================
// 3. CÁC API THAO TÁC Ô GIỐNG EXCEL (AJAX)
// ==========================================

// Helper tự động lưu hoạt động mới vào Thư viện hoạt động nếu chưa có
async function autoSaveActivity(db, title, color, userId) {
    if (!title || typeof title !== 'string') return null;
    const cleanTitle = title.trim();
    if (cleanTitle.length < 2) return null;

    try {
        const existing = await db.get('SELECT id FROM activity_library WHERE LOWER(TRIM(title)) = LOWER(?)', [cleanTitle]);
        if (!existing) {
            const res = await db.run(
                'INSERT INTO activity_library (title, default_color, user_id) VALUES (?, ?, ?)',
                [cleanTitle, color || '#ffffff', userId || null]
            );
            return {
                id: res.lastID,
                title: cleanTitle,
                default_color: color || '#ffffff'
            };
        }
    } catch (e) {
        console.error('Lỗi autoSaveActivity:', e.message);
    }
    return null;
}

// POST /admin/schedules/update-cell - Sửa 1 ô
router.post('/schedules/update-cell', checkClassPermission, async (req, res) => {
    try {
        const { cell_id, content, bg_color } = req.body;
        const cleanCellId = toId(cell_id);
        const db = await connectDB();
        await db.run(
            `UPDATE schedule_cells SET content = ?, bg_color = ? WHERE id = ?`,
            [content, bg_color, cleanCellId]
        );

        let newActivity = null;
        if (content) {
            newActivity = await autoSaveActivity(db, content, bg_color, req.session.user?.id);
        }

        res.json({ success: true, newActivity });
    } catch (e) {
        console.error("Lỗi update cell:", e);
        res.status(500).json({ success: false, message: e.message });
    }
});

// POST /admin/schedules/merge-cells - Gộp ô 2 chiều (rowspan + colspan)
router.post('/schedules/merge-cells', checkClassPermission, async (req, res) => {
    try {
        const { schedule_id, min_slot, max_slot, min_day, max_day, master_content, master_color } = req.body;
        const cleanScheduleId = toId(schedule_id);
        const db = await connectDB();

        const row_span = parseInt(max_slot) - parseInt(min_slot) + 1;
        const col_span = parseInt(max_day) - parseInt(min_day) + 1;

        // 1. Cập nhật Master Cell (ô góc trên bên trái)
        await db.run(`
            UPDATE schedule_cells 
            SET content = ?, bg_color = ?, row_span = ?, col_span = ?, is_merged = 0 
            WHERE schedule_id = ? AND slot_index = ? AND day_of_week = ?
        `, [master_content || '', master_color || '#ffffff', row_span, col_span, cleanScheduleId, parseInt(min_slot), parseInt(min_day)]);

        // 2. Đánh dấu các ô còn lại trong khối chữ nhật là is_merged = 1
        for (let s = parseInt(min_slot); s <= parseInt(max_slot); s++) {
            for (let d = parseInt(min_day); d <= parseInt(max_day); d++) {
                if (s === parseInt(min_slot) && d === parseInt(min_day)) continue; // Bỏ qua ô master
                await db.run(`
                    UPDATE schedule_cells 
                    SET is_merged = 1, row_span = 1, col_span = 1 
                    WHERE schedule_id = ? AND slot_index = ? AND day_of_week = ?
                `, [cleanScheduleId, s, d]);
            }
        }

        let newActivity = null;
        if (master_content) {
            newActivity = await autoSaveActivity(db, master_content, master_color, req.session.user?.id);
        }

        res.json({ success: true, newActivity });
    } catch (e) {
        console.error("Lỗi merge cells:", e);
        res.status(500).json({ success: false, message: e.message });
    }
});

// POST /admin/schedules/unmerge-cells - Hủy gộp ô
router.post('/schedules/unmerge-cells', checkClassPermission, async (req, res) => {
    try {
        const { schedule_id, min_slot, max_slot, min_day, max_day } = req.body;
        const cleanScheduleId = toId(schedule_id);
        const db = await connectDB();

        let startS = parseInt(min_slot);
        let endS = parseInt(max_slot);
        let startD = parseInt(min_day);
        let endD = parseInt(max_day);

        // Tìm tất cả các ô trong vùng hoặc master cell có row_span/col_span bao phủ
        const cellsInArea = await db.all(`
            SELECT slot_index, day_of_week, row_span, col_span, is_merged 
            FROM schedule_cells 
            WHERE schedule_id = ? AND slot_index BETWEEN ? AND ? AND day_of_week BETWEEN ? AND ?
        `, [cleanScheduleId, startS, endS, startD, endD]);

        for (const c of cellsInArea) {
            if (c.row_span > 1) {
                endS = Math.max(endS, c.slot_index + c.row_span - 1);
            }
            if (c.col_span > 1) {
                endD = Math.max(endD, c.day_of_week + c.col_span - 1);
            }
        }

        // Khôi phục toàn bộ các ô trong vùng bao quát về trạng thái độc lập
        for (let s = startS; s <= endS; s++) {
            for (let d = startD; d <= endD; d++) {
                await db.run(`
                    UPDATE schedule_cells 
                    SET is_merged = 0, row_span = 1, col_span = 1 
                    WHERE schedule_id = ? AND slot_index = ? AND day_of_week = ?
                `, [cleanScheduleId, s, d]);
            }
        }

        res.json({ success: true });
    } catch (e) {
        console.error("Lỗi unmerge cells:", e);
        res.status(500).json({ success: false, message: e.message });
    }
});

// POST /admin/schedules/batch-update-cells - Cập nhật nhiều ô (Copy/Paste & Thư viện hoạt động)
router.post('/schedules/batch-update-cells', checkClassPermission, async (req, res) => {
    try {
        const { schedule_id, cells } = req.body;
        const cleanScheduleId = toId(schedule_id);
        const db = await connectDB();
        const newActivities = [];

        if (cells && Array.isArray(cells)) {
            for (const item of cells) {
                await db.run(`
                    UPDATE schedule_cells 
                    SET content = ?, bg_color = ? 
                    WHERE schedule_id = ? AND slot_index = ? AND day_of_week = ?
                `, [item.content, item.bg_color || '#ffffff', cleanScheduleId, parseInt(item.slot_index), parseInt(item.day_of_week)]);

                if (item.content) {
                    const newAct = await autoSaveActivity(db, item.content, item.bg_color, req.session.user?.id);
                    if (newAct) newActivities.push(newAct);
                }
            }
        }

        res.json({ success: true, newActivities });
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
