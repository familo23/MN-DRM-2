const express = require('express');
const router = express.Router();
const { connectDB } = require('../config/db');

// Route hiển thị giao diện trang chủ
router.get('/', (req, res) => {
    res.render('index', { currentRoute: '/' });
});

// Route hiển thị Thời khóa biểu
router.get('/tkb', async (req, res) => {
    try {
        const db = await connectDB();
        
        // 1. Lấy danh sách các lớp để hiển thị ra Dropdown
        const classes = await db.all('SELECT * FROM classes ORDER BY order_index ASC');
        
        // 2. Xác định class_id đang được chọn (ưu tiên query param, nếu không có thì lấy lớp đầu tiên)
        let selectedClassId = req.query.class_id;
        if (!selectedClassId && classes.length > 0) {
            selectedClassId = classes[0].id;
        }
        
        let schedule = null;
        let matrix = [];
        
        // Định nghĩa 7 khung giờ
        const timeSlots = [
            "07:00 - 08:20",
            "08:20 - 08:45",
            "08:50 - 09:00",
            "09:00 - 09:50",
            "09:50 - 10:25",
            "15:15 - 15:45",
            "16:00 - 18:00"
        ];
        
        // 3. Lấy dữ liệu Thời khóa biểu của lớp đã chọn
        if (selectedClassId) {
            schedule = await db.get('SELECT * FROM schedules WHERE class_id = ? AND is_active = 1', [selectedClassId]);
            
            if (schedule) {
                const cells = await db.all('SELECT * FROM schedule_cells WHERE schedule_id = ? ORDER BY slot_index, day_of_week', [schedule.id]);
                
                // Khởi tạo ma trận [7 slots][6 days (T2-T7)]
                for (let s = 0; s < 7; s++) {
                    matrix[s] = [];
                    for (let d = 2; d <= 7; d++) {
                        // Tìm cell tương ứng (nếu chưa có trong db thì gán null)
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
            matrix,
            timeSlots
        });
        
    } catch (error) {
        console.error("Lỗi khi lấy dữ liệu TKB:", error);
        res.status(500).send("Đã xảy ra lỗi trên server");
    }
});

// Route hiển thị trang Đăng nhập
router.get('/login', (req, res) => {
    res.render('login', { currentRoute: '/login' });
});

module.exports = router;
