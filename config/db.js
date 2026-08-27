const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'mn_drm2',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4'
});

// Hàm kiểm tra kết nối database
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('✅ [Database] Kết nối MySQL thành công tới database:', process.env.DB_NAME || 'mn_drm2');
        connection.release();
        return true;
    } catch (err) {
        console.error('❌ [Database] Không thể kết nối tới MySQL:', err.message);
        console.warn('👉 Lưu ý: Hãy đảm bảo MySQL (XAMPP/WAMP/MySQL Server) đang chạy và đã import file schema.sql.');
        console.warn('👉 Kiểm tra lại thông tin cấu hình trong file .env nếu cần.');
        return false;
    }
}

module.exports = {
    pool,
    testConnection
};
