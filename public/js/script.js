// Custom Script cho Mầm Non Đồ Rê Mí 2

document.addEventListener('DOMContentLoaded', () => {
    // Xử lý chọn 5 ngôi sao trong Modal Cảm Nhận Phụ Huynh
    const starContainer = document.getElementById('starRatingSelect');
    if (starContainer) {
        const stars = starContainer.querySelectorAll('.star-item');
        const ratingInput = document.getElementById('ratingScoreInput');
        const ratingLabel = document.getElementById('ratingTextLabel');

        const ratingDescriptions = {
            1: '⭐ 1.0 - Cần cải thiện',
            2: '⭐⭐ 2.0 - Bình thường',
            3: '⭐⭐⭐ 3.0 - Khá tốt',
            4: '⭐⭐⭐⭐ 4.0 - Rất hài lòng',
            5: '⭐⭐⭐⭐⭐ 5.0 - Xuất sắc & Rất hài lòng!'
        };

        let currentRating = 5;

        function renderStars(val) {
            stars.forEach((star) => {
                const starVal = parseInt(star.getAttribute('data-value'), 10);
                if (starVal <= val) {
                    star.classList.add('active');
                } else {
                    star.classList.remove('active');
                }
            });
            if (ratingLabel && ratingDescriptions[val]) {
                ratingLabel.textContent = ratingDescriptions[val];
            }
        }

        stars.forEach((star) => {
            star.addEventListener('mouseenter', () => {
                const hoverVal = parseInt(star.getAttribute('data-value'), 10);
                renderStars(hoverVal);
            });

            star.addEventListener('click', () => {
                currentRating = parseInt(star.getAttribute('data-value'), 10);
                if (ratingInput) ratingInput.value = currentRating;
                renderStars(currentRating);
            });
        });

        starContainer.addEventListener('mouseleave', () => {
            renderStars(currentRating);
        });
    }
});