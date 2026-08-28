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
        multipleStatements: true, // Cho phép thực thi nhiều câu lệnh trong schema.sql
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

// Wrapper DB tương thích với các route hiện tại (all, get, run, query)
const db = {
    // Lấy danh sách nhiều dòng (tương đương db.all của sqlite)
    async all(sql, params = []) {
        const p = getPool();
        const [rows] = await p.query(sql, params);
        return rows;
    },

    // Lấy 1 dòng duy nhất (tương đương db.get của sqlite)
    async get(sql, params = []) {
        const p = getPool();
        const [rows] = await p.query(sql, params);
        return rows && rows.length > 0 ? rows[0] : null;
    },

    // Thực hiện INSERT / UPDATE / DELETE (tương đương db.run của sqlite)
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

    // Query trực tiếp
    async query(sql, params = []) {
        const p = getPool();
        return await p.query(sql, params);
    }
};

async function connectDB() {
    getPool();
    return db;
}

// Hàm kiểm tra kết nối và tự động khởi tạo bảng dữ liệu trên TiDB Cloud
async function testConnection() {
    try {
        const p = getPool();
        const connection = await p.getConnection();
        console.log('✅ [Database] Kết nối thành công tới TiDB Cloud Database (mndrm2_db)!');
        connection.release();

        // Kiểm tra xem bảng users đã tồn tại chưa
        const [tables] = await p.query("SHOW TABLES LIKE 'users'");
        
        if (tables.length === 0) {
            console.log('⏳ [Database] Chưa có bảng, đang khởi tạo schema & dữ liệu mẫu từ schema.sql...');
            const schemaPath = path.join(__dirname, '../schema.sql');
            const schema = fs.readFileSync(schemaPath, 'utf-8');
            await p.query(schema);
            console.log('✅ [Database] Đã khởi tạo thành công cấu trúc bảng và dữ liệu ban đầu trên TiDB Cloud!');
        } else {
            console.log('✅ [Database] Cấu trúc bảng đã sẵn sàng trên Cloud.');
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
