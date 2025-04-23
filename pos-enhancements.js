
/**
 * ملف تحديثات نظام الكاشير - إصدار متقدم
 * يحتوي على الميزات المقترحة مثل الإشعارات، التقييم، الدفع الإلكتروني، وغيرها
 */

// 1. إشعارات فورية
function notify(title, message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `<strong>${title}</strong><p>${message}</p>`;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 5000);
}

// مثال: تنبيه انخفاض المخزون
function checkLowStock(products, threshold = 10) {
    products.forEach(p => {
        if (p.inventory <= threshold) {
            notify('تنبيه مخزون منخفض', `المنتج ${p.name} على وشك النفاد`, 'warning');
        }
    });
}

// 2. دعم الدفع الإلكتروني (محاكاة)
function simulateOnlinePayment(amount, onSuccess, onFailure) {
    setTimeout(() => {
        const success = Math.random() > 0.1;
        if (success) {
            notify('نجاح الدفع', `تم الدفع بمبلغ ${amount} د.ع عبر الإنترنت`, 'success');
            if (onSuccess) onSuccess();
        } else {
            notify('فشل الدفع', 'تعذر إتمام عملية الدفع الإلكتروني', 'error');
            if (onFailure) onFailure();
        }
    }, 2000);
}

// 3. واجهة عرض بيانات العميل
function showCustomerPanel(customer) {
    const panel = document.createElement('div');
    panel.className = 'customer-panel';
    panel.innerHTML = `
        <h3>معلومات العميل</h3>
        <p><strong>الاسم:</strong> ${customer.name}</p>
        <p><strong>الهاتف:</strong> ${customer.phone}</p>
        <p><strong>النقاط:</strong> ${customer.points}</p>
        <p><strong>الرتبة:</strong> ${customer.loyaltyTier}</p>
    `;
    document.body.appendChild(panel);
    setTimeout(() => panel.remove(), 8000);
}

// 4. شاشة تقييم بعد الشراء
function showRatingPopup() {
    const popup = document.createElement('div');
    popup.className = 'rating-popup';
    popup.innerHTML = `
        <div class="popup-content">
            <h4>قيّم تجربتك</h4>
            <div class="stars">
                ${[1, 2, 3, 4, 5].map(i => `<span class="star" data-score="${i}">&#9733;</span>`).join('')}
            </div>
            <button onclick="document.querySelector('.rating-popup').remove()">إغلاق</button>
        </div>`;
    document.body.appendChild(popup);

    document.querySelectorAll('.star').forEach(star => {
        star.addEventListener('click', () => {
            const score = star.dataset.score;
            notify('شكرًا لك', `تم تسجيل تقييمك: ${score} نجوم`, 'success');
        });
    });
}

// 5. عروض مؤقتة
function getActiveOffers(date = new Date()) {
    return [
        { name: 'خصم 10% على المشروبات', validUntil: '2025-05-01' },
        { name: 'اشترِ 2 واحصل على 1 مجانًا', validUntil: '2025-04-30' }
    ].filter(offer => new Date(offer.validUntil) >= date);
}

// 6. دعم الوضع الليلي
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    notify('الوضع الليلي', 'تم تغيير المظهر', 'info');
}

// 7. دعم قارئ الباركود بالكاميرا
function startCameraScanner(onScan) {
    notify('قارئ الباركود', 'تم تفعيل الكاميرا (محاكاة)', 'info');
    // هذا فقط للمحاكاة - استخدم مكتبات مثل QuaggaJS للقراءة الحقيقية
    setTimeout(() => onScan && onScan('123456789'), 3000);
}

// 8. إعداد CSS افتراضي للميزات الجديدة
const style = document.createElement('style');
style.textContent = `
.notification {
    position: fixed;
    top: 10px; right: 10px;
    background: white;
    padding: 10px 15px;
    border-left: 5px solid #3498db;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    z-index: 9999;
    margin-bottom: 10px;
    transition: all 0.3s ease;
}
.notification.success { border-color: #2ecc71; }
.notification.error { border-color: #e74c3c; }
.notification.warning { border-color: #f1c40f; }
.rating-popup {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: white;
    padding: 20px;
    border-radius: 10px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    z-index: 10000;
}
.rating-popup .stars { font-size: 24px; color: gold; cursor: pointer; }
.customer-panel {
    position: fixed;
    bottom: 10px;
    left: 10px;
    background: #fff;
    padding: 15px;
    border: 1px solid #ddd;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    z-index: 9999;
}
.dark-mode {
    background: #1e1e1e;
    color: white;
}
`;
document.head.appendChild(style);
