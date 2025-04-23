/**
 * integration.js
 * ملف التكامل بين جميع وحدات نظام الكاشير
 */

// دالة التهيئة الرئيسية للنظام
function initPOSSystem() {
    console.log("بدء تهيئة نظام الكاشير المتكامل...");
    
    // 1. تهيئة نظام إدارة الموظفين
    if (typeof initEmployeeSystem === 'function') {
        console.log("جاري تهيئة نظام إدارة الموظفين...");
        initEmployeeSystem();
    } else {
        console.error("تعذر العثور على نظام إدارة الموظفين!");
    }

    // 2. تهيئة نظام الولاء
    if (typeof initLoyaltySystem === 'function') {
        console.log("جاري تهيئة نظام الولاء...");
        initLoyaltySystem();
    }

    // 3. تهيئة نظام إدارة الفروع
    if (window.branchManager) {
        console.log("جاري تهيئة نظام إدارة الفروع...");
        window.branchManager = window.branchManager.init();
        
        // إضافة زر إدارة الفروع إلى القائمة الرئيسية
        addBranchManagerButtonToUI();
    } else {
        console.error("تعذر العثور على نظام إدارة الفروع!");
    }

    // 4. تهيئة نظام تقارير الموظفين
    if (typeof initEmployeeReportsSystem === 'function') {
        console.log("جاري تهيئة نظام تقارير الموظفين...");
        initEmployeeReportsSystem();
    }

    // 5. إضافة زر إدارة المخزون المحسن
    if (typeof setupInventoryEnhancements === 'function') {
        console.log("جاري تهيئة تحسينات المخزون...");
        setupInventoryEnhancements();
    }

    // 6. جلب بيانات المبيعات والموظفين والفروع
    loadInitialData();

    console.log("تم الانتهاء من تهيئة نظام الكاشير بنجاح!");
}

// إضافة زر إدارة الفروع إلى واجهة المستخدم
function addBranchManagerButtonToUI() {
    // إضافة زر إلى شريط التحكم العلوي
    const headerControls = document.querySelector('.header-controls');
    if (headerControls) {
        const branchButton = document.createElement('button');
        branchButton.id = 'btn-branches';
        branchButton.innerHTML = '<i class="fas fa-code-branch"></i> الفروع';
        
        // إضافة مستمع الحدث
        branchButton.addEventListener('click', function() {
            if (window.branchManager && typeof window.branchManager.openBranchManagerModal === 'function') {
                window.branchManager.openBranchManagerModal();
            } else {
                console.error("تعذر فتح واجهة إدارة الفروع");
            }
        });
        
        // إضافة الزر قبل زر التقارير
        const reportsButton = document.getElementById('btn-reports');
        if (reportsButton) {
            headerControls.insertBefore(branchButton, reportsButton.nextSibling);
        } else {
            headerControls.appendChild(branchButton);
        }
    }
}

// تحميل البيانات الأولية
function loadInitialData() {
    // تحميل بيانات الإعدادات من التخزين المحلي
    loadSettings();
}

// التحقق من تحميل جميع الملفات
function checkRequiredModules() {
    const requiredModules = [
        { name: 'نظام إدارة الموظفين', check: () => typeof employeeManager !== 'undefined' },
        { name: 'نظام إدارة الفروع', check: () => typeof branchManager !== 'undefined' },
        { name: 'نظام تقارير الموظفين', check: () => typeof employeeReports !== 'undefined' },
    ];

    const missingModules = requiredModules.filter(module => !module.check());
    
    if (missingModules.length > 0) {
        console.error("تعذر تحميل النظام بسبب فقدان الوحدات التالية:", missingModules.map(m => m.name).join(', '));
        alert("تعذر تحميل النظام بشكل كامل. يرجى التحقق من وجود جميع ملفات JavaScript المطلوبة.");
        return false;
    }
    
    return true;
}

// معالج أخطاء عام
function setupErrorHandling() {
    window.addEventListener('error', function(event) {
        console.error('حدث خطأ في النظام:', event.error);
        
        // يمكن إضافة معالجة أخطاء محددة هنا حسب الحاجة
        if (event.error && event.error.message && event.error.message.includes('employeeManager')) {
            console.warn('يبدو أن هناك مشكلة في نظام إدارة الموظفين، محاولة إعادة تهيئة...');
            if (typeof initEmployeeSystem === 'function') {
                setTimeout(initEmployeeSystem, 1000);
            }
        }
    });
}

// دالة الكشف عن الفروع والموظفين
function checkEmployeesAndBranches() {
    // التحقق من وجود فروع
    const hasBranches = window.branchManager && window.branchManager.branches && window.branchManager.branches.length > 0;
    
    // التحقق من وجود موظفين
    const hasEmployees = window.employeeManager && window.employeeManager.employees && window.employeeManager.employees.length > 0;
    
    console.log("معلومات النظام:", {
        "الفروع متاحة": hasBranches,
        "عدد الفروع": hasBranches ? window.branchManager.branches.length : 0,
        "الموظفون متاحون": hasEmployees,
        "عدد الموظفين": hasEmployees ? window.employeeManager.employees.length : 0
    });
    
    // إنشاء موظفين إذا لم يكن هناك أي منهم
    if (!hasEmployees && typeof createDefaultEmployees === 'function') {
        console.log("جاري إنشاء موظفين افتراضيين...");
        createDefaultEmployees();
    }
}

// إضافة مؤشر الموظف الحالي إلى واجهة المستخدم
function addCurrentEmployeeIndicator() {
    if (typeof createCurrentEmployeeIndicator === 'function') {
        createCurrentEmployeeIndicator();
    }
}

// إضافة زر إدارة الموظفين إلى قائمة الإعدادات
function addEmployeeManagerButtonToSettings() {
    if (typeof addEmployeeManagementButton === 'function') {
        addEmployeeManagementButton();
    }
}

// تهيئة النظام عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', function() {
    console.log("بدء تحميل نظام الكاشير...");
    
    // إعداد معالج الأخطاء
    setupErrorHandling();
    
    // التحقق من وجود جميع الوحدات المطلوبة
    if (checkRequiredModules()) {
        // تهيئة النظام بتأخير بسيط للتأكد من تحميل جميع الوحدات
        setTimeout(function() {
            initPOSSystem();
            
            // التحقق من الفروع والموظفين
            setTimeout(checkEmployeesAndBranches, 1000);
            
            // إضافة مؤشر الموظف الحالي
            setTimeout(addCurrentEmployeeIndicator, 500);
            
            // إضافة زر إدارة الموظفين
            setTimeout(addEmployeeManagerButtonToSettings, 800);
        }, 200);
    }
});