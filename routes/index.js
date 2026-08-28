const express = require('express');
const router = express.Router();
const { connectDB } = require('../config/db');
const bcrypt = require('bcryptjs');

// Route hiển thị trang chủ
router.get('/', (req, res) => {
    res.render('index', { currentRoute: '/' });
});

// Helper định dạng ngày DD/MM/YYYY
function formatDateVN(d) {
    if (!d) return '';
    const date = new Date(d);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

// Route hiển thị Thời khóa biểu cho Phụ huynh & Khách
router.get('/tkb', async (req, res) => {
    try {
        const db = await connectDB();
        
        // 1. Lấy danh sách các lớp học
        const classes = await db.all('SELECT * FROM classes ORDER BY order_index ASC, id ASC');
        
        let selectedClassId = req.query.class_id;
        if (!selectedClassId && classes.length > 0) {
            selectedClassId = classes[0].id;
        }
        
        let schedule = null;
        let prevSchedule = null;
        let nextSchedule = null;
        let allSchedules = [];
        let matrix = [];
        
        const timeSlots = [
            "07:00 - 08:20",
            "08:20 - 08:45",
            "08:50 - 09:00",
            "09:00 - 09:50",
            "09:50 - 10:25",
            "15:15 - 15:45",
            "16:00 - 18:00"
        ];
        
        if (selectedClassId) {
            // Lấy toàn bộ danh sách các tuần đang hoạt động (chưa bị soft delete) của lớp
            allSchedules = await db.all(`
                SELECT id, week_label, date_range, week_number, week_start, week_end, month_title, theme_title 
                FROM schedules 
                WHERE class_id = ? AND is_deleted = 0 
                ORDER BY week_start ASC, id ASC
            `, [selectedClassId]);

            const targetScheduleId = req.query.schedule_id;

            if (targetScheduleId) {
                // 2A. Phụ huynh chọn tuần cụ thể
                schedule = await db.get(`
                    SELECT * FROM schedules 
                    WHERE id = ? AND class_id = ? AND is_deleted = 0
                `, [targetScheduleId, selectedClassId]);
            }

            if (!schedule && allSchedules.length > 0) {
                // 2B. TỰ ĐỘNG TÌM TUẦN HIỆN TẠI DỰA TRÊN NGÀY THỰC TẾ
                const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
                
                // Tìm tuần chứa ngày hôm nay
                schedule = await db.get(`
                    SELECT * FROM schedules 
                    WHERE class_id = ? AND is_deleted = 0 
                      AND week_start <= ? AND week_end >= ?
                    ORDER BY id ASC LIMIT 1
                `, [selectedClassId, today, today]);

                // Nếu hôm nay không rơi vào tuần nào (nghỉ hè/chưa tới ngày/đã qua) -> Lấy tuần gần nhất
                if (!schedule) {
                    schedule = await db.get(`
                        SELECT * FROM schedules 
                        WHERE class_id = ? AND is_deleted = 0 
                        ORDER BY ABS(DATEDIFF(IFNULL(week_start, NOW()), NOW())) ASC, id ASC 
                        LIMIT 1
                    `, [selectedClassId]);
                }
            }
            
            // 3. Nếu tìm thấy tuần, xác định tuần trước và tuần sau
            if (schedule) {
                // Tìm tuần trước đó
                prevSchedule = await db.get(`
                    SELECT id, week_label, date_range, week_number 
                    FROM schedules 
                    WHERE class_id = ? AND is_deleted = 0 
                      AND (week_start < ? OR (week_start = ? AND id < ?))
                    ORDER BY week_start DESC, id DESC LIMIT 1
                `, [selectedClassId, schedule.week_start, schedule.week_start, schedule.id]);

                // Tìm tuần sau đó
                nextSchedule = await db.get(`
                    SELECT id, week_label, date_range, week_number 
                    FROM schedules 
                    WHERE class_id = ? AND is_deleted = 0 
                      AND (week_start > ? OR (week_start = ? AND id > ?))
                    ORDER BY week_start ASC, id ASC LIMIT 1
                `, [selectedClassId, schedule.week_start, schedule.week_start, schedule.id]);

                // 4. Lấy ma trận 42 ô của tuần
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

        res.render('tkb', { 
            currentRoute: '/tkb',
            classes,
            selectedClassId: parseInt(selectedClassId),
            schedule,
            prevSchedule,
            nextSchedule,
            allSchedules,
            matrix,
            timeSlots
        });
        
    } catch (error) {
        console.error("Lỗi khi lấy dữ liệu TKB:", error);
        res.status(500).send("Đã xảy ra lỗi trên server khi tải Thời Khóa Biểu");
    }
});

// Route Đăng nhập
router.get('/login', (req, res) => {
    if (req.session && req.session.user) {
        return res.redirect('/admin');
    }
    const error = req.query.error;
    res.render('login', { currentRoute: '/login', error });
});

// Xử lý Đăng nhập
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const db = await connectDB();
        
        const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
        
        if (user) {
            const isMatch = await bcrypt.compare(password, user.password);
            if (isMatch) {
                req.session.user = {
                    id: user.id,
                    username: user.username,
                    full_name: user.full_name,
                    role: user.role
                };
                return res.redirect('/admin');
            }
        }
        
        res.redirect('/login?error=1');
    } catch (error) {
        console.error("Lỗi đăng nhập:", error);
        res.status(500).send("Đã xảy ra lỗi trên server");
    }
});

// Đăng xuất
router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

module.exports = router;
