const { connectDB } = require('../config/db');

// Middleware kiểm tra đăng nhập
function requireLogin(req, res, next) {
    if (req.session && req.session.user) {
        return next();
    } else {
        return res.redirect('/login?error=2');
    }
}

// Middleware chỉ cho phép Admin
function requireAdmin(req, res, next) {
    if (req.session && req.session.user && req.session.user.role === 'admin') {
        return next();
    }
    return res.status(403).send('HTTP 403 Forbidden: Chỉ Quản trị viên (Admin) mới có quyền thực hiện thao tác này.');
}

function toId(val) {
    if (!val) return null;
    if (Array.isArray(val)) val = val[0];
    const n = parseInt(val, 10);
    return isNaN(n) ? null : n;
}

// Middleware kiểm tra quyền của Giáo viên trên Lớp học
async function checkClassPermission(req, res, next) {
    if (!req.session || !req.session.user) {
        return res.redirect('/login?error=2');
    }

    const user = req.session.user;
    if (user.role === 'admin') {
        return next(); // Admin có toàn quyền
    }

    try {
        const db = await connectDB();
        let rawClassId = req.body?.class_id || req.query?.class_id || req.params?.class_id;
        let classId = toId(rawClassId);
        const rawScheduleId = req.body?.schedule_id || req.query?.schedule_id || req.params?.schedule_id;
        const scheduleId = toId(rawScheduleId);
        const rawCellId = req.body?.cell_id;
        const cellId = toId(rawCellId);

        // Nếu có cell_id -> suy ra schedule_id -> suy ra class_id
        if (!classId && cellId) {
            const cell = await db.get(`
                SELECT s.class_id FROM schedule_cells sc 
                JOIN schedules s ON sc.schedule_id = s.id 
                WHERE sc.id = ?
            `, [cellId]);
            if (cell) classId = toId(cell.class_id);
        }

        // Nếu có scheduleId mà chưa có classId -> tìm class_id
        if (!classId && scheduleId) {
            const sched = await db.get('SELECT class_id FROM schedules WHERE id = ?', [scheduleId]);
            if (sched) classId = toId(sched.class_id);
        }

        if (!classId) {
            return next(); // Nếu không gắn với class cụ thể nào (ví dụ truy cập lần đầu), cho qua để route tự chọn lớp phụ trách
        }

        // Kiểm tra xem lớp này có thuộc về giáo viên đang đăng nhập không
        const targetClass = await db.get('SELECT * FROM classes WHERE id = ?', [classId]);
        if (!targetClass) {
            return res.status(404).send('Lớp học không tồn tại');
        }

        if (targetClass.teacher_id !== user.id) {
            console.warn(`[Forbidden] User ID ${user.id} (${user.username}) cố gắng truy cập lớp ID ${classId} (${targetClass.name})`);
            if (req.xhr || req.headers?.accept?.indexOf('json') > -1) {
                return res.status(403).json({ success: false, message: 'HTTP 403 Forbidden: Bạn không được phân công phụ trách lớp này.' });
            }
            return res.status(403).send('HTTP 403 Forbidden: Bạn không có quyền chỉnh sửa thời khóa biểu của lớp này.');
        }

        next();
    } catch (e) {
        console.error('Lỗi checkClassPermission:', e);
        res.status(500).send('Lỗi kiểm tra quyền hạn');
    }
}

// Middleware để truyền thông tin user ra toàn bộ các View EJS
function setLocals(req, res, next) {
    res.locals.user = req.session ? req.session.user : null;
    next();
}

module.exports = {
    requireLogin,
    requireAdmin,
    checkClassPermission,
    setLocals
};
