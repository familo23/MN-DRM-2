const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const fs = require('fs');
const path = require('path');

let db;

// Hàm tạo kết nối SQLite
async function connectDB() {
    if (db) return db;
    
    // Tạo file database.sqlite trong thư mục gốc
    db = await open({
        filename: path.join(__dirname, '../database.sqlite'),
        driver: sqlite3.Database
    });
    return db;
}

// Hàm kiểm tra kết nối và tự động chạy schema.sql
async function testConnection() {
    try {
        const database = await connectDB();
        console.log('✅ [Database] Kết nối SQLite thành công tới database.sqlite');
        
        // Đọc và chạy file schema.sql để tạo bảng và dữ liệu mẫu nếu chưa có
        const schemaPath = path.join(__dirname, '../schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf-8');
        
        await database.exec(schema);
        console.log('✅ [Database] Đã khởi tạo cấu trúc bảng và dữ liệu mẫu thành công');
        
        return true;
    } catch (err) {
        console.error('❌ [Database] Lỗi kết nối hoặc khởi tạo SQLite:', err.message);
        return false;
    }
}

module.exports = {
    connectDB,
    testConnection
};
