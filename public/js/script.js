/**
 * MẦM NON ĐỒ RÊ MÍ 2 - JAVASCRIPT CHÍNH
 * Tối ưu hiệu năng bằng IntersectionObserver, requestAnimationFrame
 * Không dùng thư viện nặng, mượt mà và thân thiện với trẻ nhỏ & phụ huynh
 */

document.addEventListener('DOMContentLoaded', () => {
    // =========================================================================
    // 1. MÀN HÌNH INTRO / LOADING CHÀO MỪNG (LƯU PHIÊN SESSIONSTORAGE)
    // =========================================================================
    const introScreen = document.getElementById('introScreen');
    const introBar = document.getElementById('introProgressBar');
    const introPercent = document.getElementById('introPercent');
    const skipIntroBtn = document.getElementById('skipIntroBtn');

    if (introScreen) {
        const hasSeenIntro = sessionStorage.getItem('drm2_intro_seen');

        const dismissIntro = (immediate = false) => {
            sessionStorage.setItem('drm2_intro_seen', 'true');
            if (immediate) {
                introScreen.style.display = 'none';
                return;
            }
            introScreen.classList.add('intro-hidden');
            setTimeout(() => {
                introScreen.style.display = 'none';
            }, 850);
        };

        if (hasSeenIntro === 'true') {
            // Đã xem trong phiên hiện tại -> ẩn ngay không giật trang
            introScreen.style.display = 'none';
        } else {
            // Chạy tiến trình loading 2.3 giây
            let progress = 0;
            const startTime = performance.now();
            const duration = 2300; // 2.3s

            const updateProgress = (currentTime) => {
                const elapsed = currentTime - startTime;
                progress = Math.min(100, Math.round((elapsed / duration) * 100));

                if (introPercent) {
                    introPercent.textContent = `${progress}%`;
                }

                if (introBar) {
                    const runner = introBar.querySelector('.intro-progress-runner');
                    // Cập nhật vệt màu và bóng bay chạy theo
                    introBar.style.setProperty('--progress', `${progress}%`);
                    const fill = introBar.querySelector('::before');
                    introBar.setAttribute('data-progress', progress);
                    // Dùng style trực tiếp trên pseudo qua runner
                    if (runner) {
                        runner.style.left = `${progress}%`;
                    }
                    // Tạo thanh màu trực tiếp nếu ::before không nhận inline
                    let barFill = introBar.querySelector('.intro-bar-fill-dynamic');
                    if (!barFill) {
                        barFill = document.createElement('div');
                        barFill.className = 'intro-bar-fill-dynamic';
                        barFill.style.position = 'absolute';
                        barFill.style.left = '0';
                        barFill.style.top = '0';
                        barFill.style.bottom = '0';
                        barFill.style.borderRadius = '20px';
                        barFill.style.background = 'linear-gradient(90deg, #38bdf8, #818cf8, #f472b6, #fbbf24)';
                        barFill.style.transition = 'width 0.1s linear';
                        barFill.style.zIndex = '1';
                        introBar.appendChild(barFill);
                    }
                    barFill.style.width = `${progress}%`;
                }

                if (progress < 100) {
                    requestAnimationFrame(updateProgress);
                } else {
                    setTimeout(() => {
                        dismissIntro(false);
                    }, 350);
                }
            };

            requestAnimationFrame(updateProgress);

            if (skipIntroBtn) {
                skipIntroBtn.addEventListener('click', () => {
                    dismissIntro(false);
                });
            }
        }
    }

    // =========================================================================
    // 2. TƯƠNG TÁC LINH VẬT 2 CHÚ SƯ TỬ (LÂN CHIBI) & TỜ SỚ
    // =========================================================================
    const lionLeft = document.getElementById('lionMascotLeft');
    const lionRight = document.getElementById('lionMascotRight');
    const scrollCeremony = document.getElementById('scrollCeremony');

    const triggerCheer = (element) => {
        if (!element) return;
        element.classList.remove('lion-celebrate');
        // trigger reflow
        void element.offsetWidth;
        element.classList.add('lion-celebrate');

        // Tạo hiệu ứng sao bay tung tăng
        const rect = element.getBoundingClientRect();
        for (let i = 0; i < 3; i++) {
            const star = document.createElement('span');
            star.textContent = ['⭐', '✨', '🎈', '💖'][Math.floor(Math.random() * 4)];
            star.style.position = 'fixed';
            star.style.left = `${rect.left + rect.width / 2 + (Math.random() * 40 - 20)}px`;
            star.style.top = `${rect.top + (Math.random() * 20)}px`;
            star.style.fontSize = '1.2rem';
            star.style.pointerEvents = 'none';
            star.style.zIndex = '9999';
            star.style.transition = 'all 0.8s cubic-bezier(0.2, 0.8, 0.2, 1)';
            star.style.opacity = '1';
            document.body.appendChild(star);

            requestAnimationFrame(() => {
                star.style.transform = `translateY(-${50 + Math.random() * 40}px) scale(1.3) rotate(${Math.random() * 40 - 20}deg)`;
                star.style.opacity = '0';
            });

            setTimeout(() => {
                if (star.parentNode) star.parentNode.removeChild(star);
            }, 850);
        }
    };

    if (lionLeft) {
        lionLeft.addEventListener('click', () => triggerCheer(lionLeft));
    }
    if (lionRight) {
        lionRight.addEventListener('click', () => triggerCheer(lionRight));
    }
    if (scrollCeremony) {
        scrollCeremony.addEventListener('click', () => {
            scrollCeremony.classList.remove('scroll-unfurl-active');
            void scrollCeremony.offsetWidth;
            scrollCeremony.classList.add('scroll-unfurl-active');
            triggerCheer(lionLeft);
            triggerCheer(lionRight);
        });
    }

    // =========================================================================
    // 3. XỬ LÝ FORM ĐĂNG NHẬP (SHAKE KHI LỖI, CHECKMARK KHI THÀNH CÔNG)
    // =========================================================================
    const loginForm = document.getElementById('loginForm');
    const loginCard = document.getElementById('loginCard');
    const btnLogin = document.getElementById('btnLogin');
    const clientErrorAlert = document.getElementById('clientErrorAlert');
    const clientErrorMessage = document.getElementById('clientErrorMessage');
    const serverErrorAlert = document.getElementById('serverErrorAlert');
    const loginSuccessBox = document.getElementById('loginSuccessBox');

    if (loginForm && loginCard && btnLogin) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            // Ẩn alert lỗi cũ nếu có
            if (clientErrorAlert) clientErrorAlert.classList.add('d-none');
            if (serverErrorAlert) serverErrorAlert.classList.add('d-none');
            loginCard.classList.remove('shake-card');

            // Hiển thị nút trạng thái loading
            const btnText = btnLogin.querySelector('.btn-text');
            const btnSpinner = btnLogin.querySelector('.btn-spinner');
            if (btnText) btnText.classList.add('d-none');
            if (btnSpinner) btnSpinner.classList.remove('d-none');
            btnLogin.disabled = true;

            const usernameInput = document.getElementById('username');
            const passwordInput = document.getElementById('password');
            const username = usernameInput ? usernameInput.value.trim() : '';
            const password = passwordInput ? passwordInput.value : '';

            try {
                const response = await fetch('/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({ username, password })
                });

                const data = await response.json().catch(() => null);

                if (response.ok && data && data.success) {
                    // Đăng nhập thành công -> Hiển thị checkmark xanh chuyển động
                    if (loginSuccessBox) {
                        loginSuccessBox.classList.remove('d-none');
                    }
                    setTimeout(() => {
                        window.location.href = data.redirect || '/admin';
                    }, 750);
                } else {
                    // Đăng nhập thất bại -> Thẻ rung lắc và hiển thị thông báo lỗi
                    if (btnText) btnText.classList.remove('d-none');
                    if (btnSpinner) btnSpinner.classList.add('d-none');
                    btnLogin.disabled = false;

                    const msg = (data && data.message) ? data.message : 'Tài khoản hoặc mật khẩu không chính xác!';
                    if (clientErrorMessage) clientErrorMessage.textContent = msg;
                    if (clientErrorAlert) clientErrorAlert.classList.remove('d-none');

                    // Kích hoạt Shake animation trên loginCard
                    void loginCard.offsetWidth;
                    loginCard.classList.add('shake-card');
                    if (passwordInput) {
                        passwordInput.value = '';
                        passwordInput.focus();
                    }
                }
            } catch (err) {
                // Fallback nếu có lỗi mạng bất thường -> submit form chuẩn
                console.warn('Fallback standard submit:', err);
                loginForm.submit();
            }
        });
    }

    // =========================================================================
    // 4. HIỆU ỨNG SCROLL NAVBAR VÀ NÚT BACK-TO-TOP
    // =========================================================================
    const navbar = document.getElementById('siteNavbar');
    const backToTopBtn = document.getElementById('backToTop');
    let ticking = false;

    window.addEventListener('scroll', () => {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                const scrollY = window.scrollY || window.pageYOffset;

                // Xử lý Navbar khi cuộn
                if (navbar) {
                    if (scrollY > 35) {
                        navbar.classList.add('scrolled');
                    } else {
                        navbar.classList.remove('scrolled');
                    }
                }

                // Xử lý Nút Back To Top
                if (backToTopBtn) {
                    if (scrollY > 350) {
                        backToTopBtn.classList.add('is-active');
                    } else {
                        backToTopBtn.classList.remove('is-active');
                    }
                }

                ticking = false;
            });
            ticking = true;
        }
    }, { passive: true });

    if (backToTopBtn) {
        backToTopBtn.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }

    // =========================================================================
    // 5. HỆ THỐNG SCROLL ANIMATION (INTERSECTION OBSERVER)
    // =========================================================================
    const revealElements = document.querySelectorAll('.reveal');

    if ('IntersectionObserver' in window && revealElements.length > 0) {
        const revealObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    // Ngừng quan sát để giải phóng CPU
                    observer.unobserve(entry.target);
                }
            });
        }, {
            root: null,
            threshold: 0.1,
            rootMargin: '0px 0px -40px 0px'
        });

        revealElements.forEach(el => revealObserver.observe(el));
    } else {
        revealElements.forEach(el => el.classList.add('is-visible'));
    }

    // =========================================================================
    // 6. TỰ ĐỘNG ĐÓNG MENU MOBILE KHI CLICK LINK ANCHOR
    // =========================================================================
    const navLinks = document.querySelectorAll('.navbar-nav .nav-link');
    const navbarCollapse = document.getElementById('navbarNav');

    if (navbarCollapse && typeof bootstrap !== 'undefined') {
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                if (window.innerWidth < 992 && navbarCollapse.classList.contains('show')) {
                    const bsCollapse = bootstrap.Collapse.getInstance(navbarCollapse);
                    if (bsCollapse) {
                        bsCollapse.hide();
                    }
                }
            });
        });
    }

    console.log('🌈 Mầm Non Độc Lập Đồ Rê Mí 2 - Toàn bộ animation đã sẵn sàng & mượt mà!');
});
