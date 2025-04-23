/**
 * branch-fix.js
 * ملف إصلاح مشاكل نظام إدارة الفروع
 */

// إصلاح مشكلة عدم تهيئة نظام إدارة الفروع
function fixBranchManagerInitialization() {
    if (typeof branchManager !== 'undefined') {
        // التحقق من تهيئة مدير الفروع
        if (!branchManager.branches || branchManager.branches.length === 0) {
            console.log("جاري إعادة تهيئة نظام إدارة الفروع...");
            
            try {
                // محاولة استدعاء دالة التهيئة
                if (typeof branchManager.init === 'function') {
                    window.branchManager = branchManager.init();
                    console.log("تم إعادة تهيئة نظام إدارة الفروع بنجاح");
                }
            } catch (error) {
                console.error("خطأ في تهيئة نظام إدارة الفروع:", error);
            }
        }
    } else {
        console.error("كائن إدارة الفروع غير معرّف");
    }
}

// إضافة زر إدارة الفروع إلى الواجهة الرئيسية
function addBranchManagerButton() {
    // التحقق من وجود شريط التحكم العلوي
    const headerControls = document.querySelector('.header-controls');
    if (!headerControls) {
        console.error("شريط التحكم العلوي غير موجود");
        return;
    }
    
    // التحقق من عدم وجود زر الفروع مسبقًا
    if (document.getElementById('btn-branches')) {
        return;
    }
    
    // إنشاء زر إدارة الفروع
    const branchButton = document.createElement('button');
    branchButton.id = 'btn-branches';
    branchButton.innerHTML = '<i class="fas fa-code-branch"></i> الفروع';
    
    // إضافة مستمع للزر
    branchButton.addEventListener('click', function() {
        if (window.branchManager && typeof window.branchManager.openBranchManagerModal === 'function') {
            window.branchManager.openBranchManagerModal();
        } else {
            console.error("تعذر فتح واجهة إدارة الفروع");
            alert("تعذر فتح واجهة إدارة الفروع");
        }
    });
    
    // إضافة الزر قبل زر التقارير
    const reportsButton = document.getElementById('btn-reports');
    if (reportsButton) {
        headerControls.insertBefore(branchButton, reportsButton.nextSibling);
        console.log("تم إضافة زر إدارة الفروع بنجاح");
    } else {
        headerControls.appendChild(branchButton);
        console.log("تم إضافة زر إدارة الفروع إلى نهاية شريط التحكم");
    }
}

// إنشاء محدد الفروع في واجهة المستخدم
function createBranchSelector() {
    // التحقق من وجود مدير الفروع
    if (!window.branchManager || typeof window.branchManager.createBranchSelector !== 'function') {
        console.error("مدير الفروع غير متاح أو وظيفة إنشاء محدد الفروع غير موجودة");
        return;
    }
    
    // التحقق من عدم وجود محدد الفروع مسبقًا
    if (document.getElementById('branch-selector')) {
        return;
    }
    
    try {
        window.branchManager.createBranchSelector();
        console.log("تم إنشاء محدد الفروع بنجاح");
    } catch (error) {
        console.error("خطأ في إنشاء محدد الفروع:", error);
        
        // إنشاء محدد بسيط في حالة فشل الوظيفة الأصلية
        const header = document.querySelector('.header');
        if (header) {
            const branchSelectorContainer = document.createElement('div');
            branchSelectorContainer.className = 'branch-selector-container';
            branchSelectorContainer.style.display = 'flex';
            branchSelectorContainer.style.alignItems = 'center';
            branchSelectorContainer.style.marginRight = '20px';
            branchSelectorContainer.style.color = 'white';
            
            branchSelectorContainer.innerHTML = `
                <label for="branch-selector" style="margin-right: 10px; font-weight: bold;">الفرع:</label>
                <select id="branch-selector" class="branch-selector" style="background-color: rgba(255, 255, 255, 0.2); border: 1px solid rgba(255, 255, 255, 0.3); border-radius: 4px; color: white; padding: 5px 10px; font-size: 14px; cursor: pointer;">
                    <option value="main">الفرع الرئيسي</option>
                </select>
            `;
            
            const headerControls = header.querySelector('.header-controls');
            if (headerControls) {
                header.insertBefore(branchSelectorContainer, headerControls);
                console.log("تم إنشاء محدد الفروع البديل بنجاح");
            } else {
                header.appendChild(branchSelectorContainer);
                console.log("تم إضافة محدد الفروع البديل إلى header");
            }
        }
    }
}

// إضافة الفرع الرئيسي إذا لم تكن هناك فروع
function ensureMainBranchExists() {
    if (window.branchManager && Array.isArray(window.branchManager.branches)) {
        if (window.branchManager.branches.length === 0) {
            console.log("لا توجد فروع، جارٍ إنشاء الفرع الرئيسي...");
            
            const defaultBranch = {
                id: "main",
                name: "الفرع الرئيسي",
                address: "",
                phone: "",
                manager: "",
                isMainBranch: true,
                isActive: true,
                createdAt: new Date().toISOString(),
                lastSync: null
            };
            
            window.branchManager.branches.push(defaultBranch);
            window.branchManager.saveBranches();
            
            // تعيين الفرع الرئيسي كفرع حالي
            if (typeof window.branchManager.setCurrentBranch === 'function') {
                window.branchManager.setCurrentBranch("main");
            }
            
            console.log("تم إنشاء الفرع الرئيسي بنجاح");
        }
    }
}

// تحديث واجهة المستخدم لعرض الفرع الحالي
function updateBranchUI() {
    if (window.branchManager && window.branchManager.currentBranch) {
        // تحديث عنوان النظام ليعرض اسم الفرع
        const appTitle = document.querySelector('.logo h1');
        if (appTitle) {
            appTitle.textContent = `نظام كاشير متكامل - ${window.branchManager.currentBranch.name}`;
        }
        
        // تحديث محدد الفروع
        const branchSelector = document.getElementById('branch-selector');
        if (branchSelector) {
            // التحقق من وجود خيار للفرع الحالي
            let optionExists = false;
            for (let i = 0; i < branchSelector.options.length; i++) {
                if (branchSelector.options[i].value === window.branchManager.currentBranch.id) {
                    branchSelector.options[i].selected = true;
                    optionExists = true;
                    break;
                }
            }
            
            // إضافة خيار للفرع الحالي إذا لم يكن موجودًا
            if (!optionExists) {
                const option = document.createElement('option');
                option.value = window.branchManager.currentBranch.id;
                option.textContent = window.branchManager.currentBranch.name;
                option.selected = true;
                branchSelector.appendChild(option);
            }
        }
    }
}

// تحديث قائمة الفروع في محدد الفروع
function updateBranchSelector() {
    if (!window.branchManager || !Array.isArray(window.branchManager.branches)) {
        return;
    }
    
    const branchSelector = document.getElementById('branch-selector');
    if (!branchSelector) {
        return;
    }
    
    // حفظ الفرع المحدد حاليًا
    const selectedValue = branchSelector.value;
    
    // مسح الخيارات الحالية
    branchSelector.innerHTML = '';
    
    // إضافة الفروع النشطة فقط
    const activeBranches = window.branchManager.branches.filter(branch => branch.isActive);
    
    activeBranches.forEach(branch => {
        const option = document.createElement('option');
        option.value = branch.id;
        option.textContent = branch.name;
        
        // تحديد الخيار إذا كان هو الفرع المحدد مسبقًا أو الفرع الحالي
        if (branch.id === selectedValue || 
            (window.branchManager.currentBranch && branch.id === window.branchManager.currentBranch.id)) {
            option.selected = true;
        }
        
        branchSelector.appendChild(option);
    });
}