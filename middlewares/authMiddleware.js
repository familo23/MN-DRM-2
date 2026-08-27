// Middleware kiểm tra xem người dùng đã đăng nhập chưa
function requireLogin(req, res, next) {
    if (req.session && req.session.user) {
        // Đã đăng nhập
        return next();
    } else {
        // Chưa đăng nhập, chuyển hướng về trang login kèm thông báo
        return res.redirect('/login?error=2');
    }
}

// Middleware để truyền thông tin user ra toàn bộ các View EJS
function setLocals(req, res, next) {
    res.locals.user = req.session ? req.session.user : null;
    next();
}

module.exports = {
    requireLogin,
    setLocals
};
