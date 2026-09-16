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
        if (Array.isArray(selectedClassId)) selectedClassId = selectedClassId[0];
        if (selectedClassId) selectedClassId = parseInt(selectedClassId, 10);

        if (!selectedClassId && classes.length > 0) {
            selectedClassId = classes[0].id;
        }
        
        let schedule = null;
        let prevSchedule = null;
        let nextSchedule = null;
        let allSchedules = [];
        let matrix = [];
        
        let timeSlots = [
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
                SELECT id, week_label, date_range, week_number, week_start, week_end, month_title, theme_title, time_slots 
                FROM schedules 
                WHERE class_id = ? AND is_deleted = 0 
                ORDER BY week_start ASC, id ASC
            `, [selectedClassId]);

            let targetScheduleId = req.query.schedule_id;
            if (Array.isArray(targetScheduleId)) targetScheduleId = targetScheduleId[0];
            if (targetScheduleId) targetScheduleId = parseInt(targetScheduleId, 10);

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
                // Parse dynamic time slots
                if (schedule.time_slots) {
                    try {
                        const parsed = typeof schedule.time_slots === 'string' ? JSON.parse(schedule.time_slots) : schedule.time_slots;
                        if (Array.isArray(parsed) && parsed.length > 0) {
                            timeSlots = parsed;
                        }
                    } catch (e) {}
                }

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

                // 4. Lấy ma trận các ô của tuần
                const cells = await db.all(`
                    SELECT * FROM schedule_cells 
                    WHERE schedule_id = ? 
                    ORDER BY slot_index, day_of_week
                `, [schedule.id]);
                
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
    const isAjax = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json')) || (req.headers['content-type'] && req.headers['content-type'].includes('application/json'));
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
                if (isAjax) {
                    return res.json({ success: true, redirect: '/admin' });
                }
                return res.redirect('/admin');
            }
        }
        
        if (isAjax) {
            return res.status(401).json({ success: false, message: 'Tài khoản hoặc mật khẩu không chính xác!' });
        }
        res.redirect('/login?error=1');
    } catch (error) {
        console.error("Lỗi đăng nhập:", error);
        if (isAjax) {
            return res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trên server' });
        }
        res.status(500).send("Đã xảy ra lỗi trên server");
    }
});

// Đăng ký tài khoản mới
router.post('/register', async (req, res) => {
    const isAjax = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json')) || (req.headers['content-type'] && req.headers['content-type'].includes('application/json'));
    try {
        const { full_name, username, password, confirm_password } = req.body;

        if (!full_name || !username || !password) {
            if (isAjax) return res.status(400).json({ success: false, message: 'Vui lòng điền đầy đủ các thông tin!' });
            return res.redirect('/login?tab=register&error=missing');
        }

        if (password !== confirm_password) {
            if (isAjax) return res.status(400).json({ success: false, message: 'Mật khẩu xác nhận không khớp!' });
            return res.redirect('/login?tab=register&error=mismatch');
        }

        if (password.length < 6) {
            if (isAjax) return res.status(400).json({ success: false, message: 'Mật khẩu phải có ít nhất 6 ký tự!' });
            return res.redirect('/login?tab=register&error=short');
        }

        const db = await connectDB();
        const existingUser = await db.get('SELECT id FROM users WHERE username = ?', [username.trim()]);
        if (existingUser) {
            if (isAjax) return res.status(400).json({ success: false, message: 'Tên đăng nhập này đã tồn tại, vui lòng chọn tên khác!' });
            return res.redirect('/login?tab=register&error=exists');
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await db.run(
            'INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)',
            [username.trim(), hashedPassword, full_name.trim(), 'teacher']
        );

        // Đăng nhập tự động sau khi đăng ký
        req.session.user = {
            id: result.lastID || result.insertId,
            username: username.trim(),
            full_name: full_name.trim(),
            role: 'teacher'
        };

        if (isAjax) {
            return res.json({ success: true, message: 'Đăng ký thành công! Đang chuyển hướng...', redirect: '/admin' });
        }
        res.redirect('/admin');
    } catch (error) {
        console.error("Lỗi đăng ký tài khoản:", error);
        if (isAjax) return res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trên server khi đăng ký!' });
        res.redirect('/login?tab=register&error=server');
    }
});

// Đăng xuất
router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

module.exports = router;
