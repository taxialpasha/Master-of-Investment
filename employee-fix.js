/**
 * employee-fix.js
 * ملف إصلاح مشاكل نظام إدارة الموظفين
 */

// إصلاح مشكلة عدم ظهور مؤشر الموظف الحالي
function fixEmployeeIndicator() {
    // التحقق من وجود وظيفة إنشاء مؤشر الموظف
    if (typeof createCurrentEmployeeIndicator === 'function') {
        try {
            // محاولة إنشاء مؤشر الموظف
            createCurrentEmployeeIndicator();
            console.log("تم إنشاء مؤشر الموظف الحالي بنجاح");
        } catch (error) {
            console.error("خطأ في إنشاء مؤشر الموظف:", error);
            
            // محاولة إنشاء مؤشر بسيط في حالة فشل الوظيفة الأصلية
            const cart = document.querySelector('.cart');
            if (cart) {
                const indicator = document.createElement('div');
                indicator.id = 'current-employee-indicator';
                indicator.className = 'current-employee';
                indicator.style.display = 'flex';
                
                indicator.innerHTML = `
                    <div class="employee-info">
                        <i class="fas fa-user-circle"></i>
                        <span id="current-employee-name">موظف الكاشير</span>
                    </div>
                    <button id="employee-logout-btn" title="تسجيل الخروج">
                        <i class="fas fa-sign-out-alt"></i>
                    </button>
                `;
                
                cart.insertBefore(indicator, cart.firstChild);
                console.log("تم إنشاء مؤشر الموظف البديل");
            }
        }
    } else {
        console.error("وظيفة إنشاء مؤشر الموظف غير موجودة");
    }
}

// إصلاح مشكلة عدم ظهور زر إدارة الموظفين في الإعدادات
function fixEmployeeManagementButton() {
    // التحقق من وجود علامة تبويب المستخدمين في الإعدادات
    const usersSettingsTab = document.getElementById('users-settings');
    if (!usersSettingsTab) {
        console.error("علامة تبويب المستخدمين غير موجودة");
        return;
    }
    
    // إنشاء زر إدارة الموظفين إذا لم يكن موجودًا
    if (!document.getElementById('manage-employees-btn')) {
        const manageEmployeesButton = document.createElement('button');
        manageEmployeesButton.id = 'manage-employees-btn';
        manageEmployeesButton.classList.add('btn', 'btn-primary');
        manageEmployeesButton.style.marginTop = '15px';
        manageEmployeesButton.innerHTML = '<i class="fas fa-users"></i> إدارة الموظفين';
        
        // إضافة مستمع للزر
        manageEmployeesButton.addEventListener('click', function() {
            // التحقق من وجود وظيفة فتح نافذة إدارة الموظفين
            if (typeof openEmployeeManagementModal === 'function') {
                openEmployeeManagementModal();
            } else {
                console.error("وظيفة فتح نافذة إدارة الموظفين غير موجودة");
                alert("عذرًا، تعذر فتح نافذة إدارة الموظفين");
            }
        });
        
        usersSettingsTab.appendChild(manageEmployeesButton);
        console.log("تم إضافة زر إدارة الموظفين بنجاح");
    }
}

// إنشاء واجهة لتسجيل دخول الموظفين إذا لم تكن موجودة
function createLoginModalIfNeeded() {
    if (!document.getElementById('login-modal') && typeof createLoginModal === 'function') {
        try {
            createLoginModal();
            console.log("تم إنشاء نافذة تسجيل الدخول بنجاح");
        } catch (error) {
            console.error("خطأ في إنشاء نافذة تسجيل الدخول:", error);
        }
    }
}

// إنشاء موظفين افتراضيين إذا لم يكن هناك موظفين
function ensureDefaultEmployeesExist() {
    // التحقق من وجود وظيفة إنشاء الموظفين الافتراضيين
    if (typeof createDefaultEmployees === 'function') {
        try {
            createDefaultEmployees();
            console.log("تم التحقق من وجود الموظفين الافتراضيين");
        } catch (error) {
            console.error("خطأ في إنشاء الموظفين الافتراضيين:", error);
        }
    }
}

// إصلاح مشكلة عدم تحميل بيانات الموظفين
function fixEmployeeDataLoading() {
    // التحقق من وجود كائن إدارة الموظفين
    if (typeof employeeManager !== 'undefined') {
        if (!Array.isArray(employeeManager.employees) || employeeManager.employees.length === 0) {
            console.log("لا يوجد موظفين محملين، جارٍ محاولة تحميل البيانات من التخزين المحلي...");
            
            // محاولة تحميل بيانات الموظفين من التخزين المحلي
            const savedEmployees = localStorage.getItem('pos_employees');
            if (savedEmployees) {
                try {
                    employeeManager.employees = JSON.parse(savedEmployees);
                    console.log("تم تحميل بيانات الموظفين من التخزين المحلي بنجاح");
                } catch (error) {
                    console.error("خطأ في تحميل بيانات الموظفين:", error);
                }
            } else {
                // إنشاء موظف افتراضي إذا لم يكن هناك بيانات محفوظة
                console.log("لا توجد بيانات موظفين محفوظة، جارٍ إنشاء موظف افتراضي...");
                
                // إنشاء مدير النظام الافتراضي
                employeeManager.addEmployee({
                    name: 'مدير النظام',
                    username: 'admin',
                    password: 'admin123',
                    role: 'admin',
                    phone: '07700000000'
                });
                
                // حفظ البيانات
                employeeManager.saveEmployees();
            }
        }
    } else {
        console.error("كائن إدارة الموظفين غير معرّف");
    }
}

// تهيئة إصلاحات نظام إدارة الموظفين
function initEmployeeSystemFixes() {
    console.log("بدء تطبيق إصلاحات نظام إدارة الموظفين...");
    
    // إصلاح مشكلة تحميل بيانات الموظفين
    fixEmployeeDataLoading();
    
    // إنشاء موظفين افتراضيين إذا لزم الأمر
    ensureDefaultEmployeesExist();
    
    // إنشاء نافذة تسجيل الدخول إذا لزم الأمر
    createLoginModalIfNeeded();
    
    // إصلاح مشكلة مؤشر الموظف
    fixEmployeeIndicator();
    
    // إصلاح زر إدارة الموظفين
    fixEmployeeManagementButton();
    
    console.log("تم تطبيق إصلاحات نظام إدارة الموظفين بنجاح");
}

// تنفيذ الإصلاحات عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', function() {
    // تأخير بسيط للتأكد من تحميل جميع ملفات JavaScript الأخرى
    setTimeout(initEmployeeSystemFixes, 500);
});