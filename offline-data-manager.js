/**
 * مدير البيانات دون اتصال
 * نظام لإدارة البيانات وتخزينها وتزامنها عندما لا يكون هناك اتصال بالإنترنت
 */

const OfflineDataManager = (function() {
    // المتغيرات الخاصة
    const STORAGE_KEYS = {
        AUTH_USERS: 'offline_authorized_users',
        SETTINGS: 'offline_app_settings',
        INVESTORS: 'offline_investors_data',
        TRANSACTIONS: 'offline_transactions_data',
        PROFITS: 'offline_profits_data',
        PENDING_CHANGES: 'offline_pending_changes',
        LAST_SYNC: 'offline_last_sync'
    };
    
    let pendingChanges = [];
    let isInitialized = false;
    
    // تهيئة مدير البيانات
    function initialize() {
        console.log('تهيئة مدير البيانات دون اتصال...');
        
        // تحميل التغييرات المعلقة
        loadPendingChanges();
        
        // إضافة مستمع لحدث عودة الاتصال
        window.addEventListener('online', handleConnectionRestored);
        
        // إضافة مستمع لإغلاق التطبيق لضمان حفظ التغييرات المعلقة
        window.addEventListener('beforeunload', savePendingChanges);
        
        isInitialized = true;
        return Promise.resolve(true);
    }
    
    /**
     * تحميل التغييرات المعلقة من التخزين المحلي
     */
    function loadPendingChanges() {
        try {
            const savedChanges = localStorage.getItem(STORAGE_KEYS.PENDING_CHANGES);
            if (savedChanges) {
                pendingChanges = JSON.parse(savedChanges);
                console.log(`تم تحميل ${pendingChanges.length} تغيير معلق`);
            }
        } catch (error) {
            console.error('خطأ في تحميل التغييرات المعلقة:', error);
            pendingChanges = [];
        }
    }
    
    /**
     * حفظ التغييرات المعلقة في التخزين المحلي
     */
    function savePendingChanges() {
        try {
            localStorage.setItem(STORAGE_KEYS.PENDING_CHANGES, JSON.stringify(pendingChanges));
        } catch (error) {
            console.error('خطأ في حفظ التغييرات المعلقة:', error);
        }
    }
    
    /**
     * معالجة استعادة الاتصال
     */
    function handleConnectionRestored() {
        console.log('تم استعادة الاتصال، محاولة مزامنة التغييرات المعلقة...');
        
        // إذا كان هناك تغييرات معلقة، نحاول مزامنتها
        if (pendingChanges.length > 0) {
            syncPendingChanges();
        } else {
            console.log('لا توجد تغييرات معلقة للمزامنة');
        }
    }
    
    /**
     * مزامنة التغييرات المعلقة مع الخادم
     * @returns {Promise} وعد بإتمام المزامنة
     */
    function syncPendingChanges() {
        if (!navigator.onLine) {
            console.log('لا يوجد اتصال بالإنترنت، تأجيل المزامنة');
            return Promise.resolve(false);
        }
        
        console.log(`بدء مزامنة ${pendingChanges.length} تغيير معلق`);
        
        // إظهار مؤشر المزامنة
        showSyncIndicator(true);
        
        // في هذا المثال، سنفترض وجود دالة للمزامنة مع Firebase
        return new Promise((resolve, reject) => {
            // نسخة من التغييرات المعلقة للمعالجة
            const changesToProcess = [...pendingChanges];
            
            // مزامنة التغييرات واحدة تلو الأخرى
            processNextChange(changesToProcess, 0, [], [])
                .then(result => {
                    const { succeeded, failed } = result;
                    
                    console.log(`اكتملت المزامنة: ${succeeded.length} ناجحة، ${failed.length} فاشلة`);
                    
                    // إذا كانت هناك تغييرات فاشلة، نحتفظ بها في قائمة التغييرات المعلقة
                    pendingChanges = failed;
                    savePendingChanges();
                    
                    // إخفاء مؤشر المزامنة
                    showSyncIndicator(false);
                    
                    // إظهار إشعار بنتيجة المزامنة
                    showSyncNotification(succeeded.length, failed.length);
                    
                    // تحديث وقت آخر مزامنة
                    localStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
                    
                    resolve(succeeded.length > 0);
                })
                .catch(error => {
                    console.error('خطأ في مزامنة التغييرات:', error);
                    
                    // إخفاء مؤشر المزامنة
                    showSyncIndicator(false);
                    
                    // إظهار إشعار بفشل المزامنة
                    showSyncNotification(0, pendingChanges.length);
                    
                    reject(error);
                });
        });
    }
    
    /**
     * معالجة التغييرات المعلقة واحدًا تلو الآخر
     * @param {Array} changes قائمة التغييرات المعلقة
     * @param {number} index المؤشر الحالي
     * @param {Array} succeeded قائمة التغييرات الناجحة
     * @param {Array} failed قائمة التغييرات الفاشلة
     * @returns {Promise} وعد بإتمام المعالجة
     */
    function processNextChange(changes, index, succeeded, failed) {
        // إذا انتهينا من جميع التغييرات، نرجع النتيجة
        if (index >= changes.length) {
            return Promise.resolve({ succeeded, failed });
        }
        
        const change = changes[index];
        
        // في هذا المثال، سنستخدم دالة وهمية للمزامنة
        // في الإصدار الفعلي، يجب استبدالها بمنطق المزامنة الحقيقي
        return syncChangeWithServer(change)
            .then(success => {
                if (success) {
                    succeeded.push(change);
                } else {
                    failed.push(change);
                }
                
                // معالجة التغيير التالي
                return processNextChange(changes, index + 1, succeeded, failed);
            })
            .catch(error => {
                console.error(`خطأ في مزامنة التغيير #${index}:`, error);
                
                // إضافة التغيير إلى قائمة الفاشلة
                failed.push(change);
                
                // معالجة التغيير التالي
                return processNextChange(changes, index + 1, succeeded, failed);
            });
    }
    
    /**
     * مزامنة تغيير معين مع الخادم
     * @param {Object} change التغيير المراد مزامنته
     * @returns {Promise<boolean>} وعد بنجاح أو فشل المزامنة
     */
    function syncChangeWithServer(change) {
        // هذه دالة وهمية للتوضيح فقط
        // في الإصدار الفعلي، يجب استبدالها بمنطق المزامنة الحقيقي
        return new Promise((resolve, reject) => {
            console.log('محاولة مزامنة تغيير:', change);
            
            // محاكاة تأخير الشبكة
            setTimeout(() => {
                // للتبسيط، نفترض نجاح المزامنة بنسبة 90%
                const isSuccess = Math.random() < 0.9;
                
                if (isSuccess) {
                    console.log('تمت المزامنة بنجاح:', change);
                    resolve(true);
                } else {
                    console.log('فشلت المزامنة:', change);
                    resolve(false);
                }
            }, 500);
        });
    }
    
    /**
     * إظهار مؤشر المزامنة
     * @param {boolean} isVisible ما إذا كان المؤشر مرئيًا
     */
    function showSyncIndicator(isVisible) {
        // البحث عن مؤشر المزامنة
        let indicator = document.getElementById('sync-indicator');
        
        if (!indicator && isVisible) {
            // إنشاء مؤشر المزامنة
            indicator = document.createElement('div');
            indicator.id = 'sync-indicator';
            indicator.className = 'sync-indicator';
            indicator.innerHTML = `
                <i class="fas fa-sync-alt fa-spin"></i>
                <span>جارٍ المزامنة...</span>
            `;
            
            // إضافة المؤشر إلى الصفحة
            document.body.appendChild(indicator);
        }
        
        if (indicator) {
            indicator.style.display = isVisible ? 'flex' : 'none';
        }
    }
    
    /**
     * إظهار إشعار بنتيجة المزامنة
     * @param {number} succeeded عدد التغييرات الناجحة
     * @param {number} failed عدد التغييرات الفاشلة
     */
    function showSyncNotification(succeeded, failed) {
        // استخدام نظام الإشعارات إذا كان متوفرًا
        if (typeof showNotification === 'function') {
            if (failed === 0) {
                showNotification(`تمت مزامنة ${succeeded} تغيير بنجاح`, 'success');
            } else if (succeeded === 0) {
                showNotification(`فشلت مزامنة ${failed} تغيير`, 'error');
            } else {
                showNotification(`تمت مزامنة ${succeeded} تغيير بنجاح، وفشل ${failed}`, 'warning');
            }
        }
    }