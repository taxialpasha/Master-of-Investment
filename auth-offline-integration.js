/**
 * تكامل نظام المصادقة عبر الإنترنت ودون اتصال
 * يوفر وظائف التبديل التلقائي بين نظامي المصادقة حسب حالة الاتصال
 */

const AuthIntegration = (function() {
    // المتغيرات الخاصة
    let isOnline = navigator.onLine;
    let currentSystem = null; // النظام الحالي المستخدم للمصادقة (AuthSystem أو OfflineAuth)
    let offlineModeActive = false;
    let connectionObservers = [];
    
    // تهيئة نظام التكامل
    function initialize() {
        console.log('تهيئة نظام تكامل المصادقة...');
        
        // إضافة مستمعي أحداث حالة الاتصال
        window.addEventListener('online', handleConnectionChange);
        window.addEventListener('offline', handleConnectionChange);
        
        // التحقق من حالة الاتصال الحالية
        checkConnectionStatus();
        
        // تهيئة نظام المصادقة المناسب
        return initializeAuthSystem();
    }
    
    /**
     * التحقق من حالة الاتصال الحالية
     */
    function checkConnectionStatus() {
        // هناك طرق أكثر دقة للتحقق من الاتصال
        const oldStatus = isOnline;
        isOnline = navigator.onLine;
        
        if (oldStatus !== isOnline) {
            console.log(`تغيير حالة الاتصال: ${isOnline ? 'متصل' : 'غير متصل'}`);
            notifyConnectionObservers({ online: isOnline });
        }
        
        return isOnline;
    }
    
    /**
     * التعامل مع تغيير حالة الاتصال
     * @param {Event} event حدث تغيير الاتصال
     */
    function handleConnectionChange(event) {
        console.log(`تغيير حالة الاتصال: ${event.type}`);
        
        isOnline = (event.type === 'online');
        
        // إشعار المراقبين بتغيير حالة الاتصال
        notifyConnectionObservers({ online: isOnline });
        
        // إظهار إشعار للمستخدم
        showConnectionNotification(isOnline);
        
        // التبديل بين أنظمة المصادقة إذا لزم الأمر
        if (offlineModeActive !== !isOnline) {
            switchAuthSystem();
        }
    }
    
    /**
     * إظهار إشعار بتغيير حالة الاتصال
     * @param {boolean} online حالة الاتصال (true = متصل، false = غير متصل)
     */
    function showConnectionNotification(online) {
        // استخدام نظام الإشعارات إذا كان متوفرًا
        if (typeof showNotification === 'function') {
            if (online) {
                showNotification('تم استعادة الاتصال بالإنترنت', 'success');
            } else {
                showNotification('انقطع الاتصال بالإنترنت، تم التبديل إلى وضع عدم الاتصال', 'warning');
            }
        } else {
            // إنشاء إشعار بسيط
            const notification = document.createElement('div');
            notification.className = `simple-notification ${online ? 'success' : 'warning'}`;
            notification.innerHTML = `
                <i class="fas fa-${online ? 'wifi' : 'wifi-slash'}"></i>
                <span>${online ? 'تم استعادة الاتصال بالإنترنت' : 'انقطع الاتصال بالإنترنت، تم التبديل إلى وضع عدم الاتصال'}</span>
                <button class="close-btn">&times;</button>
            `;
            
            // إضافة الإشعار إلى الصفحة
            document.body.appendChild(notification);
            
            // إضافة مستمع حدث لزر الإغلاق
            const closeBtn = notification.querySelector('.close-btn');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    notification.remove();
                });
            }
            
            // إخفاء الإشعار تلقائيًا بعد 5 ثوانٍ
            setTimeout(() => {
                notification.remove();
            }, 5000);
        }
    }
    
    /**
     * تهيئة نظام المصادقة المناسب حسب حالة الاتصال
     * @returns {Promise} وعد بنتيجة التهيئة
     */
    function initializeAuthSystem() {
        offlineModeActive = !isOnline;
        
        // اختيار نظام المصادقة المناسب
        if (!isOnline) {
            console.log('استخدام نظام المصادقة دون اتصال');
            
            // التحقق من وجود نظام المصادقة دون اتصال
            if (typeof OfflineAuth === 'undefined') {
                console.error('نظام المصادقة دون اتصال غير موجود');
                
                // محاولة تحميل النظام
                return loadOfflineAuthSystem()
                    .then(() => {
                        // تعيين نظام المصادقة الحالي
                        currentSystem = window.OfflineAuth;
                        
                        // تهيئة نظام المصادقة دون اتصال
                        return currentSystem.initialize();
                    })
                    .catch(error => {
                        console.error('فشل تحميل نظام المصادقة دون اتصال:', error);
                        
                        // عرض رسالة خطأ للمستخدم
                        showAuthError('لا يمكن تحميل نظام المصادقة دون اتصال، يرجى التحقق من اتصالك بالإنترنت وإعادة تحميل الصفحة.');
                        
                        return Promise.reject(error);
                    });
            } else {
                // تعيين نظام المصادقة الحالي
                currentSystem = window.OfflineAuth;
                
                // تهيئة نظام المصادقة دون اتصال
                return currentSystem.initialize();
            }
        } else {
            console.log('استخدام نظام المصادقة عبر الإنترنت');
            
            // التحقق من وجود نظام المصادقة الأصلي
            if (typeof AuthSystem === 'undefined') {
                console.error('نظام المصادقة عبر الإنترنت غير موجود');
                
                // محاولة تحميل النظام
                return loadOnlineAuthSystem()
                    .then(() => {
                        // تعيين نظام المصادقة الحالي
                        currentSystem = window.AuthSystem;
                        
                        // تهيئة نظام المصادقة عبر الإنترنت
                        return currentSystem.initialize();
                    })
                    .catch(error => {
                        console.error('فشل تحميل نظام المصادقة عبر الإنترنت:', error);
                        
                        // تجربة التبديل إلى نظام المصادقة دون اتصال كبديل
                        console.log('محاولة استخدام نظام المصادقة دون اتصال كبديل');
                        offlineModeActive = true;
                        
                        // التحقق من وجود نظام المصادقة دون اتصال
                        if (typeof OfflineAuth !== 'undefined') {
                            currentSystem = window.OfflineAuth;
                            return currentSystem.initialize();
                        } else {
                            // محاولة تحميل نظام المصادقة دون اتصال
                            return loadOfflineAuthSystem()
                                .then(() => {
                                    currentSystem = window.OfflineAuth;
                                    return currentSystem.initialize();
                                })
                                .catch(offlineError => {
                                    console.error('فشل تحميل نظام المصادقة دون اتصال:', offlineError);
                                    showAuthError('لا يمكن تحميل أي نظام مصادقة، يرجى إعادة تحميل الصفحة.');
                                    return Promise.reject(offlineError);
                                });
                        }
                    });
            } else {
                // تعيين نظام المصادقة الحالي
                currentSystem = window.AuthSystem;
                
                // تهيئة نظام المصادقة عبر الإنترنت
                return currentSystem.initialize();
            }
        }
    }
    
    /**
     * تحميل نظام المصادقة دون اتصال
     * @returns {Promise} وعد بتحميل النظام
     */
    function loadOfflineAuthSystem() {
        return new Promise((resolve, reject) => {
            // التحقق من وجود النظام
            if (typeof OfflineAuth !== 'undefined') {
                resolve();
                return;
            }
            
            console.log('محاولة تحميل نظام المصادقة دون اتصال...');
            
            // البحث عن ملف النظام المخزن محليًا
            const cachedScript = localStorage.getItem('offline_auth_script');
            
            if (cachedScript) {
                try {
                    console.log('استخدام نسخة محلية من نظام المصادقة دون اتصال');
                    
                    // إنشاء عنصر script وتنفيذه
                    const script = document.createElement('script');
                    script.textContent = cachedScript;
                    document.head.appendChild(script);
                    
                    // التحقق من تحميل النظام
                    if (typeof OfflineAuth !== 'undefined') {
                        resolve();
                    } else {
                        reject(new Error('فشل تنفيذ نظام المصادقة دون اتصال المخزن محليًا'));
                    }
                } catch (error) {
                    console.error('خطأ في تنفيذ النظام المخزن محليًا:', error);
                    reject(error);
                }
            } else {
                // محاولة تحميل الملف من الخادم
                const script = document.createElement('script');
                script.src = 'offline-auth.js';
                script.onload = function() {
                    console.log('تم تحميل نظام المصادقة دون اتصال بنجاح');
                    
                    // تخزين النص البرمجي محليًا للاستخدام المستقبلي
                    try {
                        const scriptContent = Array.from(document.querySelectorAll('script'))
                            .find(s => s.src.includes('offline-auth.js'));
                            
                        if (scriptContent && scriptContent.textContent) {
                            localStorage.setItem('offline_auth_script', scriptContent.textContent);
                        }
                    } catch (e) {
                        console.warn('لم يتم تخزين نظام المصادقة دون اتصال محليًا:', e);
                    }
                    
                    resolve();
                };
                script.onerror = function() {
                    console.error('فشل تحميل ملف نظام المصادقة دون اتصال');
                    reject(new Error('فشل تحميل ملف نظام المصادقة دون اتصال'));
                };
                document.head.appendChild(script);
            }
        });
    }
    
    /**
     * تحميل نظام المصادقة عبر الإنترنت
     * @returns {Promise} وعد بتحميل النظام
     */
    function loadOnlineAuthSystem() {
        return new Promise((resolve, reject) => {
            // التحقق من وجود النظام
            if (typeof AuthSystem !== 'undefined') {
                resolve();
                return;
            }
            
            console.log('محاولة تحميل نظام المصادقة عبر الإنترنت...');
            
            // محاولة تحميل الملف من الخادم
            const script = document.createElement('script');
            script.src = 'auth-system.js';
            script.onload = function() {
                console.log('تم تحميل نظام المصادقة عبر الإنترنت بنجاح');
                resolve();
            };
            script.onerror = function() {
                console.error('فشل تحميل ملف نظام المصادقة عبر الإنترنت');
                reject(new Error('فشل تحميل ملف نظام المصادقة عبر الإنترنت'));
            };
            document.head.appendChild(script);
        });
    }
    
    /**
     * التبديل بين أنظمة المصادقة
     */
    function switchAuthSystem() {
        console.log(`التبديل بين أنظمة المصادقة: من ${offlineModeActive ? 'دون اتصال' : 'عبر الإنترنت'} إلى ${!offlineModeActive ? 'دون اتصال' : 'عبر الإنترنت'}`);
        
        // تغيير حالة وضع عدم الاتصال
        offlineModeActive = !offlineModeActive;
        
        // الحصول على معلومات المستخدم الحالي
        const currentUser = currentSystem ? currentSystem.getUserInfo() : null;
        
        // تهيئة النظام الجديد
        initializeAuthSystem()
            .then(result => {
                // إذا كان المستخدم مسجل الدخول في النظام السابق، نحاول تسجيل الخروج
                if (currentUser) {
                    // إذا كنا نتحول إلى وضع دون اتصال وكان المستخدم مسجل الدخول عبر الإنترنت
                    if (offlineModeActive) {
                        // نحاول حفظ معلومات المستخدم في النظام دون اتصال
                        // في الإنتاج، يجب التحقق من وجود بيانات اعتماد محلية أولاً
                        if (typeof OfflineAuth !== 'undefined') {
                            OfflineAuth.showOfflineAuthModal();
                        }
                    } else {
                        // نحاول تسجيل الدخول تلقائيًا في النظام عبر الإنترنت
                        // هذا يتطلب وجود بيانات اعتماد مخزنة أو وجود رمز مصادقة
                        if (typeof AuthSystem !== 'undefined') {
                            // في الإنتاج، يمكن محاولة استخدام رمز مصادقة محفوظ
                            // في هذا المثال، نظهر نافذة تسجيل الدخول
                            AuthSystem.showAuthModal();
                        }
                    }
                }
            })
            .catch(error => {
                console.error('خطأ في تبديل نظام المصادقة:', error);
            });
    }
    
    /**
     * إظهار رسالة خطأ للمستخدم
     * @param {string} message رسالة الخطأ
     */
    function showAuthError(message) {
        // استخدام نظام الإشعارات إذا كان متوفرًا
        if (typeof showNotification === 'function') {
            showNotification(message, 'error');
        } else {
            alert(message);
        }
    }
    
    /**
     * إضافة مراقب لتغييرات حالة الاتصال
     * @param {Function} observer دالة المراقبة
     */
    function addConnectionObserver(observer) {
        if (typeof observer === 'function' && !connectionObservers.includes(observer)) {
            connectionObservers.push(observer);
        }
    }
    
    /**
     * إزالة مراقب من مراقبي حالة الاتصال
     * @param {Function} observer دالة المراقبة
     */
    function removeConnectionObserver(observer) {
        const index = connectionObservers.indexOf(observer);
        if (index !== -1) {
            connectionObservers.splice(index, 1);
        }
    }
    
    /**
     * إشعار جميع المراقبين بتغيير حالة الاتصال
     * @param {Object} event حدث تغيير الاتصال
     */
    function notifyConnectionObservers(event) {
        connectionObservers.forEach(observer => {
            try {
                observer(event);
            } catch (error) {
                console.error('خطأ في مراقب حالة الاتصال:', error);
            }
        });
    }
    
    /**
     * إضافة أنماط CSS للإشعارات البسيطة
     */
    function addNotificationStyles() {
        if (document.getElementById('simple-notification-styles')) {
            return;
        }
        
        const styleElement = document.createElement('style');
        styleElement.id = 'simple-notification-styles';
        styleElement.textContent = `
            .simple-notification {
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                padding: 12px 20px;
                border-radius: 8px;
                display: flex;
                align-items: center;
                gap: 12px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                z-index: 10000;
                animation: slideInDown 0.3s ease;
                direction: rtl;
            }
            
            .simple-notification.success {
                background-color: #d1e7dd;
                color: #0a3622;
                border-right: 4px solid #0a3622;
            }
            
            .simple-notification.warning {
                background-color: #fff3cd;
                color: #664d03;
                border-right: 4px solid #664d03;
            }
            
            .simple-notification.error {
                background-color: #f8d7da;
                color: #58151c;
                border-right: 4px solid #58151c;
            }
            
            .simple-notification i {
                font-size: 18px;
            }
            
            .simple-notification .close-btn {
                margin-right: auto;
                background: none;
                border: none;
                color: inherit;
                font-size: 18px;
                cursor: pointer;
                opacity: 0.7;
                padding: 0;
            }
            
            .simple-notification .close-btn:hover {
                opacity: 1;
            }
            
            @keyframes slideInDown {
                from {
                    transform: translate3d(-50%, -100%, 0);
                    visibility: visible;
                }
                to {
                    transform: translate3d(-50%, 0, 0);
                }
            }
        `;
        
        document.head.appendChild(styleElement);
    }
    
    // واجهة برمجة التطبيق العامة
    return {
        initialize,
        checkConnectionStatus,
        isOnline: () => isOnline,
        isOfflineMode: () => offlineModeActive,
        getCurrentSystem: () => currentSystem,
        switchAuthSystem,
        addConnectionObserver,
        removeConnectionObserver,
        addNotificationStyles
    };
})();

// تصدير النظام للاستخدام الخارجي
window.AuthIntegration = AuthIntegration;

// تهيئة نظام التكامل بعد تحميل الصفحة
document.addEventListener('DOMContentLoaded', function() {
    // إضافة أنماط CSS للإشعارات
    AuthIntegration.addNotificationStyles();
    
    // تهيئة نظام التكامل
    AuthIntegration.initialize()
        .then(result => {
            console.log('تم تهيئة نظام تكامل المصادقة بنجاح');
        })
        .catch(error => {
            console.error('فشل تهيئة نظام تكامل المصادقة:', error);
        });
});

// إضافة وظيفة اختبار حالة الاتصال
window.testOfflineMode = function() {
    // تبديل وضع الاتصال للاختبار
    const fakeEvent = {
        type: AuthIntegration.isOnline() ? 'offline' : 'online'
    };
    
    console.log(`اختبار تغيير حالة الاتصال إلى: ${fakeEvent.type}`);
    
    // استدعاء معالج تغيير الاتصال مباشرة
    AuthIntegration.getCurrentSystem().handleConnectionChange(fakeEvent);
};