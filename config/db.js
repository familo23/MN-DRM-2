const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

let pool;

function getPool() {
    if (pool) return pool;

    const connectionConfig = {
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        multipleStatements: true,
        ssl: {
            minVersion: 'TLSv1.2',
            rejectUnauthorized: true
        }
    };

    if (process.env.DATABASE_URL) {
        pool = mysql.createPool({
            uri: process.env.DATABASE_URL,
            ...connectionConfig
        });
    } else {
        pool = mysql.createPool({
            host: process.env.DB_HOST || 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
            port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 4000,
            user: process.env.DB_USER || '49Zi7BWFt5FA645.root',
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME || 'mndrm2_db',
            ...connectionConfig
        });
    }

    return pool;
}

// Wrapper DB tương thích với các route hiện tại
const db = {
    async all(sql, params = []) {
        const p = getPool();
        const [rows] = await p.query(sql, params);
        return rows;
    },

    async get(sql, params = []) {
        const p = getPool();
        const [rows] = await p.query(sql, params);
        return rows && rows.length > 0 ? rows[0] : null;
    },

    async run(sql, params = []) {
        const p = getPool();
        const [result] = await p.query(sql, params);
        return {
            lastID: result.insertId,
            insertId: result.insertId,
            changes: result.affectedRows,
            affectedRows: result.affectedRows
        };
    },

    async query(sql, params = []) {
        const p = getPool();
        return await p.query(sql, params);
    }
};

async function connectDB() {
    getPool();
    return db;
}

// Hàm kiểm tra và tự động chạy migration an toàn
async function runAutoMigrations(p) {
    try {
        // 1. Kiểm tra cột teacher_id trong bảng classes
        const [classCols] = await p.query("SHOW COLUMNS FROM classes LIKE 'teacher_id'");
        if (classCols.length === 0) {
            console.log('🔄 [Migration] Thêm cột teacher_id vào bảng classes...');
            await p.query("ALTER TABLE classes ADD COLUMN teacher_id INT NULL");
        }

        // 2. Kiểm tra các cột trong bảng schedules
        const [schedCols] = await p.query("SHOW COLUMNS FROM schedules");
        const colNames = schedCols.map(c => c.Field);

        if (!colNames.includes('week_start')) {
            console.log('🔄 [Migration] Thêm cột week_start vào bảng schedules...');
            await p.query("ALTER TABLE schedules ADD COLUMN week_start DATE NULL");
        }
        if (!colNames.includes('week_end')) {
            console.log('🔄 [Migration] Thêm cột week_end vào bảng schedules...');
            await p.query("ALTER TABLE schedules ADD COLUMN week_end DATE NULL");
        }
        if (!colNames.includes('week_number')) {
            console.log('🔄 [Migration] Thêm cột week_number vào bảng schedules...');
            await p.query("ALTER TABLE schedules ADD COLUMN week_number INT DEFAULT 1");
        }
        if (!colNames.includes('is_deleted')) {
            console.log('🔄 [Migration] Thêm cột is_deleted vào bảng schedules...');
            await p.query("ALTER TABLE schedules ADD COLUMN is_deleted TINYINT(1) DEFAULT 0");
        }
        if (!colNames.includes('deleted_at')) {
            console.log('🔄 [Migration] Thêm cột deleted_at vào bảng schedules...');
            await p.query("ALTER TABLE schedules ADD COLUMN deleted_at TIMESTAMP NULL");
        }

        // 3. Cập nhật dữ liệu mặc định cho các schedule cũ nếu bị thiếu ngày
        await p.query(`
            UPDATE schedules 
            SET week_start = '2026-05-11', 
                week_end = '2026-05-16', 
                week_number = 2,
                is_deleted = 0
            WHERE week_start IS NULL AND id = 1
        `);

        // 4. Tạo bảng activity_library nếu chưa có
        await p.query(`
            CREATE TABLE IF NOT EXISTS activity_library (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                default_color VARCHAR(50) DEFAULT '#ffffff',
                user_id INT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Seed các hoạt động mẫu nếu bảng rỗng
        const [acts] = await p.query("SELECT COUNT(*) as count FROM activity_library");
        if (acts[0].count === 0) {
            console.log('🌱 [Seed] Khởi tạo dữ liệu mẫu cho Thư viện hoạt động...');
            const defaultActivities = [
                ['Đón trẻ, cho trẻ ăn sáng', '#ffffff'],
                ['Tập thể dục buổi sáng', '#ffffff'],
                ['Uống sữa vinamilk', '#ffffff'],
                ['STEAM :- Tìm hiểu thế giới xung quanh', '#92d050'],
                ['Tạo hình :- Vẽ & Tô màu sáng tạo', '#92d050'],
                ['Toán nhận biết :- Nhận biết hình khối, chữ số', '#ffc000'],
                ['Âm Nhạc :- Hát & Vận động theo nhạc', '#ff99cc'],
                ['Làm quen văn học :- Truyện & Thơ', '#ffffff'],
                ['Tiếng Anh với giáo viên bản ngữ', '#00b0f0'],
                ['Hoạt động góc / Vui chơi tự do', '#ffffff'],
                ['Ăn trưa & Ngủ trưa', '#ffffff'],
                ['Phụ Huynh đón trẻ ra về', '#ffffff']
            ];
            for (const [title, color] of defaultActivities) {
                await p.query("INSERT INTO activity_library (title, default_color) VALUES (?, ?)", [title, color]);
            }
        }

        console.log('✅ [Migration] Kiểm tra và cập nhật cấu trúc Database hoàn tất!');
    } catch (e) {
        console.error('⚠️ [Migration] Cảnh báo khi chạy auto migration:', e.message);
    }
}

async function testConnection() {
    try {
        const p = getPool();
        const connection = await p.getConnection();
        console.log('✅ [Database] Kết nối thành công tới TiDB Cloud Database (mndrm2_db)!');
        connection.release();

        const [tables] = await p.query("SHOW TABLES LIKE 'users'");
        if (tables.length === 0) {
            console.log('⏳ [Database] Đang khởi tạo schema & dữ liệu ban đầu...');
            const schemaPath = path.join(__dirname, '../schema.sql');
            const schema = fs.readFileSync(schemaPath, 'utf-8');
            await p.query(schema);
            console.log('✅ [Database] Đã khởi tạo cấu trúc bảng thành công!');
        } else {
            // Chạy auto migrations để đảm bảo các cột mới luôn tồn tại
            await runAutoMigrations(p);
        }

        return true;
    } catch (err) {
        console.error('❌ [Database] Lỗi kết nối TiDB Cloud:', err.message);
        return false;
    }
}

module.exports = {
    connectDB,
    testConnection,
    getPool,
    db
};
