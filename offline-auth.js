/**
 * نظام المصادقة بدون اتصال بالإنترنت
 * يوفر وظائف تسجيل الدخول عندما لا يوجد اتصال بالإنترنت
 */

const OfflineAuth = (function() {
    // المتغيرات الخاصة
    let isAuthenticated = false;
    let currentUser = null;
    let authObservers = [];
    
    // تهيئة المصادقة عند تحميل الصفحة
    function initialize() {
        console.log('تهيئة نظام المصادقة دون اتصال بالإنترنت...');
        
        // التحقق من وجود مستخدم محفوظ محليًا
        const savedUser = localStorage.getItem('offline_auth_user');
        if (savedUser) {
            try {
                currentUser = JSON.parse(savedUser);
                isAuthenticated = true;
                console.log(`تم تسجيل الدخول محليًا: ${currentUser.email}`);
                
                // إخفاء شاشة تسجيل الدخول إذا كانت ظاهرة
                hideOfflineAuthModal();
                
                // إظهار واجهة المستخدم الرئيسية
                document.body.classList.add('authenticated');
                
                // إشعار المراقبين بتسجيل الدخول
                notifyObservers({ type: 'login', user: getUserInfo() });
            } catch (error) {
                console.error('خطأ في قراءة بيانات المستخدم المحفوظة:', error);
                currentUser = null;
                isAuthenticated = false;
            }
        }
        
        return Promise.resolve({ isAuthenticated, user: getUserInfo() });
    }
    
    /**
     * تسجيل الدخول دون اتصال بالإنترنت
     * @param {string} username اسم المستخدم
     * @param {string} password كلمة المرور (PIN)
     * @returns {Promise} وعد بالاستجابة
     */
    function login(username, password) {
        // التحقق من اسم المستخدم وكلمة المرور
        if (!username || !password) {
            return Promise.reject(new Error('اسم المستخدم وكلمة المرور مطلوبان'));
        }
        
        // التحقق من المستخدمين المسموح لهم بالدخول دون اتصال
        // هذه البيانات يجب أن تكون قد تم تخزينها مسبقًا أثناء وجود اتصال
        const offlineUsers = localStorage.getItem('offline_authorized_users');
        let authorizedUsers = [];
        
        try {
            if (offlineUsers) {
                authorizedUsers = JSON.parse(offlineUsers);
            } else {
                // إذا لم يكن هناك مستخدمون محفوظون، نستخدم القيم الافتراضية
                // في الإنتاج، يجب أن تكون هذه القيم قد تم تخزينها مسبقًا
                authorizedUsers = [
                    {
                        username: 'admin',
                        // تخزين كلمة المرور المشفرة أو رمز PIN
                        // في هذا المثال نستخدم "1234" للتبسيط
                        pin: '1234',
                        displayName: 'المسؤول',
                        permissions: {
                            canAddInvestors: true,
                            canEditInvestors: true,
                            canDeleteInvestors: true,
                            canProcessDeposits: true,
                            canProcessWithdrawals: true,
                            canPayProfits: true,
                            canManageSettings: true,
                            canExportData: true,
                            canImportData: true,
                            canCreateBackup: true,
                            canRestoreBackup: true,
                            canCreateUsers: true,
                            canDeleteUsers: true,
                            canViewReports: true
                        }
                    },
                    {
                        username: 'user',
                        pin: '0000',
                        displayName: 'مستخدم عادي',
                        permissions: {
                            canAddInvestors: true,
                            canEditInvestors: true,
                            canDeleteInvestors: false,
                            canProcessDeposits: true,
                            canProcessWithdrawals: true,
                            canPayProfits: false,
                            canManageSettings: false,
                            canExportData: true,
                            canImportData: false,
                            canCreateBackup: true,
                            canRestoreBackup: false,
                            canCreateUsers: false,
                            canDeleteUsers: false,
                            canViewReports: true
                        }
                    }
                ];
                
                // تخزين المستخدمين المسموح لهم محليًا للاستخدام المستقبلي
                localStorage.setItem('offline_authorized_users', JSON.stringify(authorizedUsers));
            }
        } catch (error) {
            console.error('خطأ في قراءة بيانات المستخدمين المصرح لهم:', error);
            return Promise.reject(new Error('حدث خطأ في نظام المصادقة'));
        }
        
        // البحث عن المستخدم المطلوب
        const user = authorizedUsers.find(u => u.username === username && u.pin === password);
        
        if (user) {
            // إنشاء جلسة المستخدم
            currentUser = {
                uid: `offline_${username}`,
                username: username,
                displayName: user.displayName || username,
                email: `${username}@offline.local`,
                permissions: user.permissions || {},
                isOfflineSession: true
            };
            
            isAuthenticated = true;
            
            // حفظ المستخدم محليًا
            localStorage.setItem('offline_auth_user', JSON.stringify(currentUser));
            
            console.log(`تم تسجيل الدخول دون اتصال: ${username}`);
            
            // إخفاء شاشة تسجيل الدخول
            hideOfflineAuthModal();
            
            // إظهار واجهة المستخدم الرئيسية
            document.body.classList.add('authenticated');
            
            // إشعار المراقبين
            notifyObservers({ type: 'login', user: getUserInfo() });
            
            return Promise.resolve({ success: true, user: getUserInfo() });
        } else {
            // المستخدم غير مصرح له
            console.error('فشل تسجيل الدخول: بيانات اعتماد غير صالحة');
            
            // إظهار رسالة الخطأ
            showOfflineAuthError('اسم المستخدم أو كلمة المرور غير صحيحة');
            
            return Promise.reject(new Error('بيانات الاعتماد غير صالحة'));
        }
    }
    
    /**
     * تسجيل الخروج
     * @returns {Promise} وعد بالاستجابة
     */
    function logout() {
        // مسح المستخدم الحالي
        currentUser = null;
        isAuthenticated = false;
        
        // مسح المستخدم المحفوظ محليًا
        localStorage.removeItem('offline_auth_user');
        
        console.log('تم تسجيل الخروج بنجاح');
        
        // إظهار شاشة تسجيل الدخول
        showOfflineAuthModal();
        
        // إخفاء واجهة المستخدم الرئيسية
        document.body.classList.remove('authenticated');
        
        // إشعار المراقبين
        notifyObservers({ type: 'logout' });
        
        return Promise.resolve({ success: true });
    }
    
    /**
     * الحصول على معلومات المستخدم الحالي
     * @returns {Object|null} معلومات المستخدم أو null إذا لم يكن مسجل الدخول
     */
    function getUserInfo() {
        return currentUser;
    }
    
    /**
     * إضافة مراقب لأحداث المصادقة
     * @param {Function} observer دالة المراقبة
     */
    function addAuthObserver(observer) {
        if (typeof observer === 'function' && !authObservers.includes(observer)) {
            authObservers.push(observer);
        }
    }
    
    /**
     * إزالة مراقب من مراقبي المصادقة
     * @param {Function} observer دالة المراقبة
     */
    function removeAuthObserver(observer) {
        const index = authObservers.indexOf(observer);
        if (index !== -1) {
            authObservers.splice(index, 1);
        }
    }
    
    /**
     * إشعار جميع المراقبين بحدث
     * @param {Object} event حدث المصادقة
     */
    function notifyObservers(event) {
        authObservers.forEach(observer => {
            try {
                observer(event);
            } catch (error) {
                console.error('خطأ في مراقب المصادقة:', error);
            }
        });
    }
    
    /**
     * إظهار شاشة تسجيل الدخول دون اتصال
     */
    function showOfflineAuthModal() {
        // التحقق من وجود النافذة
        let modal = document.getElementById('offline-auth-modal');
        
        if (!modal) {
            // إنشاء نافذة المصادقة دون اتصال
            modal = createOfflineAuthModal();
            document.body.appendChild(modal);
        }
        
        // إظهار النافذة
        modal.classList.add('active');
    }
    
    /**
     * إخفاء شاشة تسجيل الدخول دون اتصال
     */
    function hideOfflineAuthModal() {
        const modal = document.getElementById('offline-auth-modal');
        if (modal) {
            modal.classList.remove('active');
        }
    }
    
    /**
     * إنشاء نافذة المصادقة دون اتصال
     * @returns {HTMLElement} عنصر النافذة
     */
    function createOfflineAuthModal() {
        const modal = document.createElement('div');
        modal.id = 'offline-auth-modal';
        modal.className = 'auth-modal-overlay';
        
        modal.innerHTML = `
            <div class="auth-modal">
                <div class="auth-modal-header">
                    <h3 class="auth-modal-title">
                        <i class="fas fa-wifi-slash auth-modal-icon"></i>
                        تسجيل الدخول (وضع بدون اتصال)
                    </h3>
                </div>
                <div class="auth-modal-body">
                    <div class="offline-alert">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>لا يوجد اتصال بالإنترنت، يمكنك تسجيل الدخول في وضع بدون اتصال.</p>
                    </div>
                    
                    <div id="offline-auth-error" class="auth-error-message"></div>
                    
                    <form id="offline-login-form" class="auth-form">
                        <div class="auth-form-group">
                            <label for="offline-username" class="auth-form-label">اسم المستخدم</label>
                            <input type="text" id="offline-username" class="auth-form-input" placeholder="أدخل اسم المستخدم" required>
                        </div>
                        <div class="auth-form-group">
                            <label for="offline-password" class="auth-form-label">كلمة المرور أو PIN</label>
                            <div class="auth-password-container">
                                <input type="password" id="offline-password" class="auth-form-input" placeholder="أدخل كلمة المرور أو PIN" required>
                                <button type="button" class="auth-toggle-password" data-target="offline-password">
                                    <i class="fas fa-eye"></i>
                                </button>
                            </div>
                        </div>
                        <div class="auth-actions">
                            <button type="button" id="offline-login-btn" class="auth-submit-btn">تسجيل الدخول</button>
                        </div>
                        <div class="auth-footer-note">
                            <p>ملاحظة: بعض الميزات قد تكون محدودة في وضع عدم الاتصال</p>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        // إضافة مستمعي الأحداث بعد إنشاء العناصر
        setTimeout(() => {
            const loginBtn = document.getElementById('offline-login-btn');
            if (loginBtn) {
                loginBtn.addEventListener('click', handleOfflineLogin);
            }
            
            const form = document.getElementById('offline-login-form');
            if (form) {
                form.addEventListener('submit', (e) => {
                    e.preventDefault();
                    handleOfflineLogin();
                });
            }
            
            const togglePasswordBtn = modal.querySelector('.auth-toggle-password');
            if (togglePasswordBtn) {
                togglePasswordBtn.addEventListener('click', () => {
                    const targetId = togglePasswordBtn.getAttribute('data-target');
                    const passwordInput = document.getElementById(targetId);
                    
                    if (passwordInput) {
                        const type = passwordInput.type === 'password' ? 'text' : 'password';
                        passwordInput.type = type;
                        
                        const icon = togglePasswordBtn.querySelector('i');
                        if (icon) {
                            icon.className = type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
                        }
                    }
                });
            }
        }, 100);
        
        return modal;
    }
    
    /**
     * معالجة تسجيل الدخول دون اتصال
     */
    function handleOfflineLogin() {
        const username = document.getElementById('offline-username').value;
        const password = document.getElementById('offline-password').value;
        
        if (!username || !password) {
            showOfflineAuthError('يرجى إدخال اسم المستخدم وكلمة المرور');
            return;
        }
        
        // محاولة تسجيل الدخول
        login(username, password)
            .catch(error => {
                console.error('فشل تسجيل الدخول دون اتصال:', error);
            });
    }
    
    /**
     * إظهار رسالة خطأ في شاشة المصادقة دون اتصال
     * @param {string} message رسالة الخطأ
     */
    function showOfflineAuthError(message) {
        const errorElement = document.getElementById('offline-auth-error');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
            
            // إخفاء الرسالة بعد 5 ثوانٍ
            setTimeout(() => {
                errorElement.style.display = 'none';
            }, 5000);
        }
    }

    // CSS للوضع بدون اتصال
    function addOfflineStyles() {
        if (document.getElementById('offline-auth-styles')) {
            return;
        }
        
        const styleElement = document.createElement('style');
        styleElement.id = 'offline-auth-styles';
        styleElement.textContent = `
            .offline-alert {
                background-color: #fff3cd;
                color: #856404;
                padding: 12px;
                border-radius: 8px;
                margin-bottom: 20px;
                display: flex;
                align-items: center;
                gap: 10px;
            }
            
            .offline-alert i {
                font-size: 24px;
            }
            
            .offline-alert p {
                margin: 0;
            }
            
            .auth-footer-note {
                text-align: center;
                margin-top: 20px;
                font-size: 0.85rem;
                color: #6c757d;
            }
            
            .auth-modal-icon {
                margin-left: 8px;
                color: #dc3545;
            }
        `;
        
        document.head.appendChild(styleElement);
    }
    
    // واجهة برمجة التطبيق العامة
    return {
        initialize,
        login,
        logout,
        getUserInfo,
        isAuthenticated: () => isAuthenticated,
        currentUser: () => currentUser,
        addAuthObserver,
        removeAuthObserver,
        showOfflineAuthModal,
        hideOfflineAuthModal,
        addOfflineStyles
    };
})();

// تصدير النظام للاستخدام الخارجي
window.OfflineAuth = OfflineAuth;

// تهيئة نظام المصادقة دون اتصال بعد تحميل الصفحة
document.addEventListener('DOMContentLoaded', function() {
    // إضافة أنماط CSS
    OfflineAuth.addOfflineStyles();
});