const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const fs = require('fs');
const path = require('path');

let db;
const dbPath = path.join(__dirname, '../database.sqlite');

// Hàm tạo kết nối SQLite
async function connectDB() {
    if (db) return db;
    
    // Tạo file database.sqlite trong thư mục gốc
    db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });
    return db;
}

// Hàm kiểm tra kết nối và tự động chạy schema.sql
async function testConnection() {
    try {
        // KIỂM TRA: File CSDL đã từng được tạo chưa?
        // Nếu chưa tồn tại, tức là chạy lần đầu -> Cần khởi tạo cấu trúc và dữ liệu mẫu
        const isFirstRun = !fs.existsSync(dbPath) || fs.statSync(dbPath).size === 0;

        const database = await connectDB();
        console.log('✅ [Database] Kết nối SQLite thành công tới database.sqlite');
        
        if (isFirstRun) {
            // Đọc và chạy file schema.sql để tạo bảng và dữ liệu mẫu lần đầu
            const schemaPath = path.join(__dirname, '../schema.sql');
            const schema = fs.readFileSync(schemaPath, 'utf-8');
            
            await database.exec(schema);
            console.log('✅ [Database] Đã khởi tạo cấu trúc bảng và dữ liệu mẫu (Lần đầu chạy)');
        } else {
            console.log('✅ [Database] Database cũ đã tồn tại, không cần chèn lại dữ liệu mẫu');
        }
        
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
