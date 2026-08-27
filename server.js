const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { testConnection } = require('./config/db');
const indexRoutes = require('./routes/index');

const app = express();
const PORT = process.env.PORT || 3000;

// Cấu hình View Engine là EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve các file tĩnh (CSS, JS, Images) từ thư mục public
app.use(express.static(path.join(__dirname, 'public')));

// Gắn các routes
app.use('/', indexRoutes);

// Khởi động server
app.listen(PORT, async () => {
    console.log(`🚀 [Server] Đang chạy tại http://localhost:${PORT}`);
    await testConnection();
});
