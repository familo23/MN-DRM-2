// =========================
// MENU
// =========================

const navLinks = document.querySelectorAll(".nav-link");

navLinks.forEach(link => {

    link.addEventListener("click", function () {

        // Xóa active ở tất cả menu
        navLinks.forEach(item => {
            item.classList.remove("active");
        });

        // Thêm active cho menu được chọn
        this.classList.add("active");

    });

});


// =========================
// BANNER SLIDER
// =========================

const bannerTitle = document.getElementById("bannerTitle");

const dots = document.querySelectorAll(".dot");

const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");


const banners = [
    "Banner",
    "Nội dung",
    "Chào mừng bạn"
];

let currentSlide = 0;


// Hiển thị slide

function showSlide(index) {

    if (index < 0) {
        currentSlide = banners.length - 1;
    }
    else if (index >= banners.length) {
        currentSlide = 0;
    }
    else {
        currentSlide = index;
    }

    bannerTitle.style.opacity = "0";

    setTimeout(() => {

        bannerTitle.textContent = banners[currentSlide];

        bannerTitle.style.opacity = "1";

    }, 150);


    // Cập nhật dấu chấm

    dots.forEach(dot => {
        dot.classList.remove("active");
    });

    dots[currentSlide].classList.add("active");
}


// Nút Previous

prevBtn.addEventListener("click", () => {

    showSlide(currentSlide - 1);

});


// Nút Next

nextBtn.addEventListener("click", () => {

    showSlide(currentSlide + 1);

});


// Click vào dấu chấm

dots.forEach((dot, index) => {

    dot.addEventListener("click", () => {

        showSlide(index);

    });

});


// Tự động chuyển Banner

setInterval(() => {

    showSlide(currentSlide + 1);

}, 3000);