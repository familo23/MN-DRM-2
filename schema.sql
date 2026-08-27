-- =======================================================
-- DATABASE SCHEMA: MN-DRM-2 (SQLite Version)
-- =======================================================

-- 1. Bảng Người dùng / Giáo viên quản trị
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT CHECK(role IN ('admin', 'teacher')) DEFAULT 'teacher',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Bảng Danh sách lớp học
CREATE TABLE IF NOT EXISTS classes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    order_index INTEGER DEFAULT 0
);

-- 3. Bảng Quản lý Thời khóa biểu (theo tuần của từng lớp)
CREATE TABLE IF NOT EXISTS schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER NOT NULL,
    month_title TEXT DEFAULT 'THÁNG 05',
    theme_title TEXT DEFAULT 'QUÊ HƯƠNG ĐẤT NƯỚC BÁC HỒ',
    week_label TEXT DEFAULT 'Tuần 2',
    date_range TEXT DEFAULT 'Từ ngày 11/05 - 16/05/2026',
    is_active BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
);

-- 4. Bảng Nội dung từng ô Thời khóa biểu (kèm màu sắc ô)
CREATE TABLE IF NOT EXISTS schedule_cells (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    schedule_id INTEGER NOT NULL,
    day_of_week INTEGER NOT NULL, -- 2: Thứ 2, 3: Thứ 3, ..., 7: Thứ 7
    slot_index INTEGER NOT NULL,  -- 0: 7h00-8h20, 1: 8h20-8h45, 2: 8h50-9h00, 3: 9h00-9h50, 4: 9h50-10h25, 5: 15h15-15h45, 6: 16h00-18h00
    content TEXT,
    bg_color TEXT DEFAULT '#ffffff',
    row_span INTEGER DEFAULT 1,
    col_span INTEGER DEFAULT 1,
    is_merged BOOLEAN DEFAULT 0,
    FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE,
    UNIQUE (schedule_id, day_of_week, slot_index)
);

-- =======================================================
-- DỮ LIỆU KHỞI TẠO MẪU (SEED DATA)
-- =======================================================

-- 1. Tài khoản giáo viên mặc định (Mật khẩu: 123456)
INSERT OR IGNORE INTO users (id, username, password, full_name, role) VALUES
(1, 'giaovien', '$2a$10$7RkbQ0n0z91bYJb4f5Y4jOB6N01v8mDk.2XWbY13e8oQY9U15wXea', 'Cô Giáo Đồ Rê Mí', 'admin');

-- Tài khoản Admin (Mật khẩu: admin@123)
INSERT OR IGNORE INTO users (id, username, password, full_name, role) VALUES
(2, 'admin', '$2b$10$Zaj6ytcIskfF1x.ZS5MkGuqBV2/OhWQOVJ5mbtFhvJKsaWCJXrDQW', 'Quản trị viên', 'admin');

-- 2. Danh sách lớp
INSERT OR IGNORE INTO classes (id, name, code, order_index) VALUES
(1, 'Nhà trẻ', 'nha_tre', 1),
(2, 'Mầm non', 'mam_non', 2);

-- 3. Thời khóa biểu mẫu cho lớp Nhà trẻ
INSERT OR IGNORE INTO schedules (id, class_id, month_title, theme_title, week_label, date_range, is_active) VALUES
(1, 1, 'LỊCH HỌC : THÁNG 05', 'CHỦ ĐỀ : QUÊ HƯƠNG ĐẤT NƯỚC BÁC HỒ', 'Tuần 2', 'Từ ngày 11/05 - 16/05/2026', 1);

-- 4. Chi tiết các ô TKB theo mẫu demo.jpg
INSERT OR REPLACE INTO schedule_cells (schedule_id, day_of_week, slot_index, content, bg_color, row_span, col_span, is_merged) VALUES
-- Thứ 2
(1, 2, 0, 'Đón trẻ, cho trẻ ăn sáng', '#ffffff', 1, 1, 0),
(1, 2, 1, 'Tập thể dục buổi sáng', '#ffffff', 1, 1, 0),
(1, 2, 2, 'Uống sữa vinamilk', '#ffffff', 1, 1, 0),
(1, 2, 3, 'STEAM :- Tìm hiểu trống cơm', '#ffffff', 1, 1, 0),
(1, 2, 4, 'Tạo hình :- Tô mầu cái trống cơm', '#92d050', 1, 1, 0),
(1, 2, 5, 'Truyện :- Cái trống của sóc', '#ffffff', 1, 1, 0),
(1, 2, 6, 'Phụ Huynh đón trẻ ra về', '#ffffff', 6, 1, 0),

-- Thứ 3
(1, 3, 0, 'Đón trẻ, cho trẻ ăn sáng', '#ffffff', 1, 1, 0),
(1, 3, 1, 'Tập thể dục buổi sáng', '#ffffff', 1, 1, 0),
(1, 3, 2, 'uống sữa vinamilk', '#ffffff', 1, 1, 0),
(1, 3, 3, 'Toán nhận biết :- Nhận biết hình tròn, Hình Vuông', '#ffc000', 1, 1, 0),
(1, 3, 4, 'Làm quen với toán :- Ôn nhận biết một và nhiều To - Nhỏ', '#ffffff', 1, 1, 0),
(1, 3, 5, 'Giáo dục cảm xúc:- Khi nào bé thấy vui', '#ffffff', 1, 1, 0),
(1, 3, 6, '', '#ffffff', 1, 1, 1),

-- Thứ 4
(1, 4, 0, 'Đón trẻ, cho trẻ ăn sáng', '#ffffff', 1, 1, 0),
(1, 4, 1, 'Tập thể dục buổi sáng', '#ffffff', 1, 1, 0),
(1, 4, 2, 'uống sữa vinamilk', '#ffffff', 1, 1, 0),
(1, 4, 3, 'Âm Nhạc :- Nhạc em yêu Hà nội', '#ffffff', 1, 1, 0),
(1, 4, 4, 'Hoạt động nhận biết ;- Trò truyện về Thủ Đô Hà Nội', '#ffffff', 1, 1, 0),
(1, 4, 5, 'Tiếng anh', '#ffffff', 1, 1, 0),
(1, 4, 6, '', '#ffffff', 1, 1, 1),

-- Thứ 5
(1, 5, 0, 'Đón trẻ, cho trẻ ăn sáng', '#ffffff', 1, 1, 0),
(1, 5, 1, 'Tập thể dục buổi sáng', '#ffffff', 1, 1, 0),
(1, 5, 2, 'Uống sữa vi namikl', '#ffffff', 1, 1, 0),
(1, 5, 3, 'VĐCB: - Tung bóng qua dây', '#ffffff', 1, 1, 0),
(1, 5, 4, 'Toán tư duy :- Nối bóng - Đồ vật - đồ chơi', '#92d050', 1, 1, 0),
(1, 5, 5, 'Làm quen văn học: - Thơ Về Quê', '#ffffff', 1, 1, 0),
(1, 5, 6, '', '#ffffff', 1, 1, 1),

-- Thứ 6
(1, 6, 0, 'Đón trẻ, cho trẻ ăn sáng', '#ffffff', 1, 1, 0),
(1, 6, 1, 'Tập thể dục buổi sáng', '#ffffff', 1, 1, 0),
(1, 6, 2, 'uống sữa vinamik', '#ffc000', 1, 1, 0),
(1, 6, 3, 'Truyện :- Sự tích Hồ Gươm', '#ffc000', 1, 1, 0),
(1, 6, 4, 'Hoạt động nhận biết :- Trống cơm', '#ffc000', 1, 1, 0),
(1, 6, 5, 'Tiếng Anh', '#ffffff', 1, 1, 0),
(1, 6, 6, '', '#ffffff', 1, 1, 1),

-- Thứ 7
(1, 7, 0, 'Đón trẻ, cho trẻ ăn sáng', '#ffffff', 1, 1, 0),
(1, 7, 1, 'Tập thể dục buổi sáng', '#ffffff', 1, 1, 0),
(1, 7, 2, 'Uống sữa vi na mikl', '#ffffff', 1, 1, 0),
(1, 7, 3, 'Truyện :- Cáo và cá trống', '#ffffff', 1, 1, 0),
(1, 7, 4, 'HĐG', '#ffffff', 1, 1, 0),
(1, 7, 5, 'Hoạt động góc', '#ffffff', 1, 1, 0),
(1, 7, 6, '', '#ffffff', 1, 1, 1);
