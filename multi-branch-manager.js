// نظام إدارة الفروع المتعددة
// multi-branch-manager.js

// تهيئة نظام إدارة الفروع المتعددة مع قاعدة بيانات Firebase
const branchManager = {
    // المتغيرات الرئيسية لإدارة الفروع
    branches: [],                  // قائمة الفروع
    currentBranch: null,           // الفرع الحالي الذي يتم العمل فيه
    syncQueue: [],                 // قائمة انتظار المزامنة
    lastSyncTime: null,            // آخر وقت مزامنة
    isSyncing: false,              // حالة المزامنة
    offlineMode: false,            // وضع عدم الاتصال
    
    // تهيئة Firebase
    firebaseApp: null,
    firebaseDB: null,
    firebaseAuth: null,
    firebaseStorage: null,
    
    // قائمة الانتظار للعمليات غير المتزامنة
    pendingTransactions: JSON.parse(localStorage.getItem('pendingTransactions')) || [],
    
    // تهيئة النظام
    init: function() {
        this.initFirebase();
        this.loadLocalBranches();
        this.setupEventListeners();
        this.checkConnectivity();
        
        // محاولة ضبط الفرع الحالي من التخزين المحلي
        const savedBranchId = localStorage.getItem('currentBranchId');
        if (savedBranchId) {
            this.setCurrentBranch(savedBranchId);
        }
        
        console.log("تم تهيئة نظام إدارة الفروع المتعددة");
        return this;
    },
    
    // تهيئة Firebase
    initFirebase: function() {
        try {
            // استخدام التكوين الموجود بالفعل
            if (!firebase.apps.length) {
                this.firebaseApp = firebase.initializeApp(firebaseConfig);
            } else {
                this.firebaseApp = firebase.app();
            }
            
            this.firebaseDB = firebase.database();
            this.firebaseAuth = firebase.auth();
            this.firebaseStorage = firebase.storage();
            
            // الاستماع لتغييرات حالة الاتصال
            const connectedRef = this.firebaseDB.ref('.info/connected');
            connectedRef.on('value', (snap) => {
                if (snap.val() === true) {
                    this.offlineMode = false;
                    this.processPendingTransactions();
                    console.log("تم الاتصال بقاعدة البيانات");
                } else {
                    this.offlineMode = true;
                    console.log("انقطع الاتصال بقاعدة البيانات - تفعيل وضع عدم الاتصال");
                }
            });
            
            return true;
        } catch (error) {
            console.error("خطأ في تهيئة Firebase:", error);
            this.offlineMode = true;
            return false;
        }
    },
    
    // تحميل الفروع من التخزين المحلي
    loadLocalBranches: function() {
        const localBranches = JSON.parse(localStorage.getItem('branches')) || [];
        this.branches = localBranches;
        
        // إذا لم تكن هناك فروع، إنشاء فرع افتراضي
        if (this.branches.length === 0) {
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
            
            this.branches.push(defaultBranch);
            this.saveBranches();
        }
        
        // تحديث قائمة الفروع في Firebase إذا كان متصلا
        if (!this.offlineMode) {
            this.syncBranchesToFirebase();
        }
        
        return this.branches;
    },
    
    // حفظ الفروع في التخزين المحلي
    saveBranches: function() {
        localStorage.setItem('branches', JSON.stringify(this.branches));
    },
    
    // إضافة فرع جديد
    addBranch: function(branchData) {
        if (!branchData.name) {
            console.error("يجب إدخال اسم الفرع");
            return null;
        }
        
        // إنشاء معرّف فريد للفرع الجديد
        const branchId = branchData.id || 'branch_' + Date.now();
        
        const newBranch = {
            id: branchId,
            name: branchData.name,
            address: branchData.address || "",
            phone: branchData.phone || "",
            manager: branchData.manager || "",
            email: branchData.email || "",
            isMainBranch: false,
            isActive: true,
            inventory: [],
            employees: [],
            createdAt: new Date().toISOString(),
            lastSync: null
        };
        
        this.branches.push(newBranch);
        this.saveBranches();
        
        // إضافة الفرع إلى Firebase إذا كان متصلا
        if (!this.offlineMode) {
            this.firebaseDB.ref(`branches/${branchId}`).set(newBranch)
                .then(() => {
                    console.log(`تم إضافة الفرع "${newBranch.name}" إلى قاعدة البيانات`);
                })
                .catch(error => {
                    console.error("خطأ في إضافة الفرع إلى Firebase:", error);
                    this.addPendingTransaction('add', 'branch', newBranch);
                });
        } else {
            this.addPendingTransaction('add', 'branch', newBranch);
        }
        
        console.log(`تم إضافة الفرع "${newBranch.name}" بنجاح`);
        return newBranch;
    },
    
    // تحديث بيانات فرع
    updateBranch: function(branchId, branchData) {
        const branchIndex = this.branches.findIndex(b => b.id === branchId);
        if (branchIndex === -1) {
            console.error(`الفرع برقم "${branchId}" غير موجود`);
            return null;
        }
        
        // تحديث البيانات مع الاحتفاظ بالبيانات الداخلية
        const updatedBranch = {
            ...this.branches[branchIndex],
            ...branchData,
            lastUpdated: new Date().toISOString()
        };
        
        // حماية الحقول الحساسة
        if (this.branches[branchIndex].isMainBranch) {
            updatedBranch.isMainBranch = true; // لا يمكن تغيير حالة الفرع الرئيسي
        }
        
        this.branches[branchIndex] = updatedBranch;
        this.saveBranches();
        
        // تحديث الفرع في Firebase إذا كان متصلا
        if (!this.offlineMode) {
            this.firebaseDB.ref(`branches/${branchId}`).update(updatedBranch)
                .then(() => {
                    console.log(`تم تحديث الفرع "${updatedBranch.name}" في قاعدة البيانات`);
                })
                .catch(error => {
                    console.error("خطأ في تحديث الفرع في Firebase:", error);
                    this.addPendingTransaction('update', 'branch', updatedBranch);
                });
        } else {
            this.addPendingTransaction('update', 'branch', updatedBranch);
        }
        
        console.log(`تم تحديث الفرع "${updatedBranch.name}" بنجاح`);
        return updatedBranch;
    },
    
    // تفعيل أو تعطيل فرع
    toggleBranchStatus: function(branchId) {
        const branch = this.getBranchById(branchId);
        if (!branch) {
            console.error(`الفرع برقم "${branchId}" غير موجود`);
            return false;
        }
        
        // لا يمكن تعطيل الفرع الرئيسي
        if (branch.isMainBranch) {
            console.error("لا يمكن تعطيل الفرع الرئيسي");
            return false;
        }
        
        branch.isActive = !branch.isActive;
        branch.lastUpdated = new Date().toISOString();
        
        this.saveBranches();
        
        // تحديث حالة الفرع في Firebase إذا كان متصلا
        if (!this.offlineMode) {
            this.firebaseDB.ref(`branches/${branchId}/isActive`).set(branch.isActive)
                .then(() => {
                    console.log(`تم ${branch.isActive ? 'تفعيل' : 'تعطيل'} الفرع "${branch.name}" في قاعدة البيانات`);
                })
                .catch(error => {
                    console.error("خطأ في تحديث حالة الفرع في Firebase:", error);
                    this.addPendingTransaction('update', 'branch_status', { id: branchId, isActive: branch.isActive });
                });
        } else {
            this.addPendingTransaction('update', 'branch_status', { id: branchId, isActive: branch.isActive });
        }
        
        console.log(`تم ${branch.isActive ? 'تفعيل' : 'تعطيل'} الفرع "${branch.name}" بنجاح`);
        return true;
    },
    
    // الحصول على فرع بواسطة المعرّف
    getBranchById: function(branchId) {
        return this.branches.find(b => b.id === branchId) || null;
    },
    
    // الحصول على الفروع النشطة فقط
    getActiveBranches: function() {
        return this.branches.filter(b => b.isActive);
    },
    
    // تعيين الفرع الحالي
    setCurrentBranch: function(branchId) {
        const branch = this.getBranchById(branchId);
        if (!branch) {
            console.error(`الفرع برقم "${branchId}" غير موجود`);
            return false;
        }
        
        if (!branch.isActive) {
            console.error(`الفرع "${branch.name}" غير نشط حاليًا`);
            return false;
        }
        
        this.currentBranch = branch;
        localStorage.setItem('currentBranchId', branchId);
        
        // تحديث واجهة المستخدم لعرض الفرع الحالي
        this.updateBranchUI();
        
        console.log(`تم تغيير الفرع الحالي إلى "${branch.name}"`);
        return true;
    },
    
    // تحديث واجهة المستخدم حسب الفرع الحالي
    updateBranchUI: function() {
        const branchNameElement = document.getElementById('current-branch-name');
        if (branchNameElement && this.currentBranch) {
            branchNameElement.textContent = this.currentBranch.name;
        }
        
        // تحديث شعار النظام ليعرض اسم الفرع
        const appTitle = document.querySelector('.logo h1');
        if (appTitle && this.currentBranch) {
            appTitle.textContent = `نظام كاشير متكامل - ${this.currentBranch.name}`;
        }
    },
    
    // إضافة معاملة معلقة للمزامنة لاحقًا
    addPendingTransaction: function(action, type, data) {
        const transaction = {
            id: Date.now().toString(),
            action, // 'add', 'update', 'delete'
            type,  // 'branch', 'inventory', 'sale', etc.
            data,
            timestamp: new Date().toISOString()
        };
        
        this.pendingTransactions.push(transaction);
        localStorage.setItem('pendingTransactions', JSON.stringify(this.pendingTransactions));
        console.log(`تمت إضافة معاملة معلقة للمزامنة لاحقًا: ${action} ${type}`);
    },
    
    // معالجة المعاملات المعلقة
    processPendingTransactions: function() {
        if (this.offlineMode || this.pendingTransactions.length === 0) return;
        
        console.log(`جاري معالجة ${this.pendingTransactions.length} معاملة معلقة...`);
        
        // معالجة المعاملات بالترتيب
        const processNext = () => {
            if (this.pendingTransactions.length === 0) {
                console.log("تمت معالجة جميع المعاملات المعلقة بنجاح");
                return;
            }
            
            const transaction = this.pendingTransactions[0];
            console.log(`معالجة معاملة: ${transaction.action} ${transaction.type} (${transaction.id})`);
            
            let promise;
            
            switch (transaction.type) {
                case 'branch':
                    if (transaction.action === 'add') {
                        promise = this.firebaseDB.ref(`branches/${transaction.data.id}`).set(transaction.data);
                    } else if (transaction.action === 'update') {
                        promise = this.firebaseDB.ref(`branches/${transaction.data.id}`).update(transaction.data);
                    }
                    break;
                    
                case 'branch_status':
                    promise = this.firebaseDB.ref(`branches/${transaction.data.id}/isActive`).set(transaction.data.isActive);
                    break;
                    
                case 'inventory':
                    if (transaction.action === 'transfer') {
                        // نقل المخزون بين الفروع
                        promise = this.syncInventoryTransfer(transaction.data);
                    } else if (transaction.action === 'update') {
                        // تحديث كمية المخزون
                        promise = this.syncInventoryUpdate(transaction.data);
                    }
                    break;
                    
                case 'sale':
                    // مزامنة بيانات المبيعات
                    promise = this.firebaseDB.ref(`branches/${transaction.data.branchId}/sales/${transaction.data.id}`).set(transaction.data);
                    break;
                    
                default:
                    console.warn(`نوع معاملة غير معروف: ${transaction.type}`);
                    promise = Promise.resolve();
            }
            
            // معالجة نتيجة المزامنة
            promise.then(() => {
                // إزالة المعاملة من قائمة الانتظار
                this.pendingTransactions.shift();
                localStorage.setItem('pendingTransactions', JSON.stringify(this.pendingTransactions));
                
                // معالجة المعاملة التالية
                processNext();
            }).catch(error => {
                console.error(`خطأ في معالجة المعاملة (${transaction.id}):`, error);
                
                // محاولة معالجة المعاملة التالية
                this.pendingTransactions.shift();
                localStorage.setItem('pendingTransactions', JSON.stringify(this.pendingTransactions));
                processNext();
            });
        };
        
        // بدء معالجة المعاملات
        processNext();
    },
    
    // مزامنة الفروع إلى Firebase
    syncBranchesToFirebase: function() {
        if (this.offlineMode) return;
        
        // تحديث تاريخ آخر مزامنة
        this.lastSyncTime = new Date().toISOString();
        
        // مزامنة كل فرع على حدة
        this.branches.forEach(branch => {
            this.firebaseDB.ref(`branches/${branch.id}`).update(branch)
                .then(() => {
                    console.log(`تمت مزامنة الفرع "${branch.name}" مع قاعدة البيانات`);
                })
                .catch(error => {
                    console.error(`خطأ في مزامنة الفرع "${branch.name}":`, error);
                });
        });
    },
    
    // جلب الفروع من Firebase
    fetchBranchesFromFirebase: function() {
        if (this.offlineMode) {
            showNotification('أنت في وضع عدم الاتصال، لا يمكن جلب الفروع من قاعدة البيانات', 'warning');
            return;
        }
        
        this.isSyncing = true;
        updateSyncIndicator(true);
        
        this.firebaseDB.ref('branches').once('value')
            .then(snapshot => {
                const fbBranches = snapshot.val() || {};
                
                // تحويل البيانات إلى مصفوفة
                let branchesList = [];
                for (const key in fbBranches) {
                    branchesList.push(fbBranches[key]);
                }
                
                if (branchesList.length > 0) {
                    // دمج البيانات المحلية مع البيانات عبر الإنترنت
                    this.mergeBranchData(branchesList);
                } else {
                    // لا توجد فروع في قاعدة البيانات، دفع الفروع المحلية
                    this.syncBranchesToFirebase();
                }
            })
            .catch(error => {
                console.error("خطأ في جلب الفروع من Firebase:", error);
                showNotification('حدث خطأ أثناء محاولة جلب الفروع من قاعدة البيانات', 'error');
            })
            .finally(() => {
                this.isSyncing = false;
                updateSyncIndicator(false);
            });
    },
    
    // دمج بيانات الفروع المحلية مع البيانات المستلمة من Firebase
    mergeBranchData: function(fbBranches) {
        // تحديث الفروع الموجودة وإضافة الفروع الجديدة
        fbBranches.forEach(fbBranch => {
            const localBranchIndex = this.branches.findIndex(b => b.id === fbBranch.id);
            
            if (localBranchIndex !== -1) {
                // تحديث الفرع الموجود محليًا
                const localBranch = this.branches[localBranchIndex];
                
                // استخدام أحدث نسخة بناءً على تاريخ آخر تحديث
                if (fbBranch.lastUpdated && (!localBranch.lastUpdated || new Date(fbBranch.lastUpdated) > new Date(localBranch.lastUpdated))) {
                    this.branches[localBranchIndex] = { ...localBranch, ...fbBranch };
                }
            } else {
                // إضافة فرع جديد من Firebase
                this.branches.push(fbBranch);
            }
        });
        
        // حفظ التغييرات محليًا
        this.saveBranches();
        console.log(`تم دمج بيانات ${fbBranches.length} فرع من قاعدة البيانات`);
        
        // تحديث واجهة المستخدم
        this.renderBranchList();
        
        // إذا كان الفرع الحالي غير محدد، اختيار الفرع الرئيسي أو الأول
        if (!this.currentBranch) {
            const mainBranch = this.branches.find(b => b.isMainBranch) || this.branches[0];
            if (mainBranch) {
                this.setCurrentBranch(mainBranch.id);
            }
        }
    },
    
    // نقل المخزون بين الفروع
    transferInventory: function(fromBranchId, toBranchId, items) {
        if (fromBranchId === toBranchId) {
            console.error("لا يمكن نقل المخزون إلى نفس الفرع");
            return false;
        }
        
        const fromBranch = this.getBranchById(fromBranchId);
        const toBranch = this.getBranchById(toBranchId);
        
        if (!fromBranch || !toBranch) {
            console.error("أحد الفروع المحددة غير موجود");
            return false;
        }
        
        if (!fromBranch.isActive || !toBranch.isActive) {
            console.error("أحد الفروع المحددة غير نشط");
            return false;
        }
        
        if (!Array.isArray(items) || items.length === 0) {
            console.error("يجب تحديد عناصر المخزون للنقل");
            return false;
        }
        
        // التحقق من توفر الكميات المطلوبة في الفرع المصدر
        for (const item of items) {
            const productInBranch = (fromBranch.inventory || []).find(p => p.id === item.productId);
            
            if (!productInBranch || productInBranch.quantity < item.quantity) {
                console.error(`المنتج ${item.productName || item.productId} غير متوفر بالكمية المطلوبة في الفرع المصدر`);
                return false;
            }
        }
        
        // إنشاء عملية نقل المخزون
        const transferId = `transfer_${Date.now()}`;
        const transfer = {
            id: transferId,
            fromBranchId,
            toBranchId,
            items,
            status: 'pending',
            createdAt: new Date().toISOString(),
            completedAt: null,
            notes: ''
        };
        
        // تحديث المخزون محليًا
        items.forEach(item => {
            // تقليل الكمية في الفرع المصدر
            const fromProductIndex = (fromBranch.inventory || []).findIndex(p => p.id === item.productId);
            if (fromProductIndex !== -1) {
                fromBranch.inventory[fromProductIndex].quantity -= item.quantity;
            }
            
            // زيادة الكمية في الفرع الوجهة
            const toProductIndex = (toBranch.inventory || []).findIndex(p => p.id === item.productId);
            if (toProductIndex !== -1) {
                toBranch.inventory[toProductIndex].quantity += item.quantity;
            } else {
                // إضافة المنتج إذا لم يكن موجودًا في الفرع الوجهة
                if (!toBranch.inventory) toBranch.inventory = [];
                
                toBranch.inventory.push({
                    id: item.productId,
                    quantity: item.quantity,
                    lastUpdated: new Date().toISOString()
                });
            }
        });
        
        // تحديث تاريخ آخر تحديث للفروع
        fromBranch.lastUpdated = new Date().toISOString();
        toBranch.lastUpdated = new Date().toISOString();
        
        // حفظ التغييرات محليًا
        this.saveBranches();
        
        // مزامنة التغييرات مع Firebase إذا كان متصلا
        if (!this.offlineMode) {
            this.firebaseDB.ref(`inventory_transfers/${transferId}`).set(transfer)
                .then(() => {
                    this.syncInventoryTransfer(transfer);
                    console.log("تم تسجيل عملية نقل المخزون في قاعدة البيانات");
                })
                .catch(error => {
                    console.error("خطأ في تسجيل عملية نقل المخزون:", error);
                    this.addPendingTransaction('transfer', 'inventory', transfer);
                });
        } else {
            this.addPendingTransaction('transfer', 'inventory', transfer);
        }
        
        console.log(`تم نقل ${items.length} منتج من "${fromBranch.name}" إلى "${toBranch.name}" بنجاح`);
        return true;
    },
    
    // مزامنة نقل المخزون مع Firebase
    syncInventoryTransfer: function(transfer) {
        if (this.offlineMode) return Promise.reject("أنت في وضع عدم الاتصال");
        
        // تحديث حالة النقل
        transfer.status = 'completed';
        transfer.completedAt = new Date().toISOString();
        
        // تحديث المخزون في كلا الفرعين
        const promises = [
            this.firebaseDB.ref(`inventory_transfers/${transfer.id}`).update({ 
                status: 'completed', 
                completedAt: transfer.completedAt 
            }),
            this.updateBranchInventory(transfer.fromBranchId),
            this.updateBranchInventory(transfer.toBranchId)
        ];
        
        return Promise.all(promises);
    },
    
    // تحديث مخزون الفرع في Firebase
    updateBranchInventory: function(branchId) {
        const branch = this.getBranchById(branchId);
        if (!branch) return Promise.reject(`الفرع برقم "${branchId}" غير موجود`);
        
        return this.firebaseDB.ref(`branches/${branchId}/inventory`).set(branch.inventory || []);
    },
    
    // جلب بيانات المخزون لجميع الفروع
    fetchAllBranchesInventory: function() {
        if (this.offlineMode) {
            showNotification('أنت في وضع عدم الاتصال، لا يمكن جلب بيانات المخزون', 'warning');
            return;
        }
        
        this.isSyncing = true;
        updateSyncIndicator(true);
        
        const promises = this.branches.map(branch => {
            return this.firebaseDB.ref(`branches/${branch.id}/inventory`).once('value')
                .then(snapshot => {
                    const inventory = snapshot.val() || [];
                    branch.inventory = inventory;
                    return branch;
                });
        });
        
        Promise.all(promises)
            .then(() => {
                this.saveBranches();
                console.log("تم جلب بيانات المخزون لجميع الفروع بنجاح");
                // تحديث واجهة المستخدم للمخزون
                if (typeof updateInventoryDisplay === 'function') {
                    updateInventoryDisplay();
                }
            })
            .catch(error => {
                console.error("خطأ في جلب بيانات المخزون:", error);
            })
            .finally(() => {
                this.isSyncing = false;
                updateSyncIndicator(false);
            });
    },
    
    // إنشاء تقرير نقص المخزون في الفروع
    generateLowStockReport: function() {
        const lowStockThreshold = parseInt(localStorage.getItem('lowStockThreshold')) || 10;
        const branchLowStock = {};
        
        this.branches.forEach(branch => {
            if (!branch.isActive) return;
            
            const lowStockItems = (branch.inventory || []).filter(item => {
                return item.quantity <= lowStockThreshold;
            }).map(item => {
                // الحصول على معلومات المنتج من قائمة المنتجات
                const product = products.find(p => p.id === item.id);
                return {
                    id: item.id,
                    name: product ? product.name : `منتج #${item.id}`,
                    quantity: item.quantity,
                    threshold: lowStockThreshold,
                    category: product ? product.category_id : null,
                    price: product ? product.price : 0
                };
            });
            
            branchLowStock[branch.id] = {
                id: branch.id,
                name: branch.name,
                items: lowStockItems
            };
        });
        
        return Object.values(branchLowStock);
    },
    
    // تسجيل عملية بيع مع تحديد الفرع
    recordSaleWithBranch: function(saleData) {
        if (!this.currentBranch) {
            console.error("لم يتم تحديد الفرع الحالي");
            return false;
        }
        
        // إضافة معرّف الفرع إلى بيانات البيع
        saleData.branchId = this.currentBranch.id;
        saleData.branchName = this.currentBranch.name;
        
        // تحديث المخزون في الفرع الحالي
        saleData.items.forEach(item => {
            this.updateProductQuantityInBranch(this.currentBranch.id, item.id, -item.quantity);
        });
        
        // مزامنة البيع مع Firebase إذا كان متصلاً
        if (!this.offlineMode) {
            this.firebaseDB.ref(`branches/${this.currentBranch.id}/sales/${saleData.id}`).set(saleData)
                .then(() => {
                    console.log(`تم تسجيل عملية البيع في الفرع "${this.currentBranch.name}" في قاعدة البيانات`);
                })
                .catch(error => {
                    console.error("خطأ في تسجيل عملية البيع:", error);
                    this.addPendingTransaction('add', 'sale', saleData);
                });
        } else {
            this.addPendingTransaction('add', 'sale', saleData);
        }
        
        return true;
    },
    
    // تحديث كمية منتج في فرع معين
    updateProductQuantityInBranch: function(branchId, productId, changeAmount) {
        const branch = this.getBranchById(branchId);
        if (!branch) {
            console.error(`الفرع برقم "${branchId}" غير موجود`);
            return false;
        }
        
        if (!branch.inventory) branch.inventory = [];
        
        const productIndex = branch.inventory.findIndex(p => p.id === productId);
        
        if (productIndex !== -1) {
            // تحديث كمية المنتج الموجود
            branch.inventory[productIndex].quantity += changeAmount;
            branch.inventory[productIndex].lastUpdated = new Date().toISOString();
        } else {
            // إضافة المنتج إذا لم يكن موجودًا
            const product = products.find(p => p.id === productId);
            if (!product) {
                console.error(`المنتج برقم "${productId}" غير موجود`);
                return false;
            }
            
            branch.inventory.push({
                id: productId,
                quantity: Math.max(0, changeAmount), // لا يمكن أن تكون الكمية سالبة
                lastUpdated: new Date().toISOString()
            });
        }
        
        this.saveBranches();
        
        // مزامنة التغييرات مع Firebase إذا كان متصلاً
        if (!this.offlineMode) {
            this.updateBranchInventory(branchId)
                .then(() => {
                    console.log(`تم تحديث كمية المنتج "${productId}" في فرع "${branch.name}"`);
                })
                .catch(error => {
                    console.error("خطأ في تحديث كمية المنتج:", error);
                    this.addPendingTransaction('update', 'inventory', {
                        branchId,
                        productId,
                        changeAmount
                    });
                });
        } else {
            this.addPendingTransaction('update', 'inventory', {
                branchId,
                productId,
                changeAmount
            });
        }
        
        return true;
    },
    
    // مزامنة تحديث المخزون مع Firebase
    syncInventoryUpdate: function(data) {
        if (this.offlineMode) return Promise.reject("أنت في وضع عدم الاتصال");
        
        const { branchId, productId, changeAmount } = data;
        const branch = this.getBranchById(branchId);
        
        if (!branch) return Promise.reject(`الفرع برقم "${branchId}" غير موجود`);
        
        // الحصول على المخزون المحدث من Firebase
        return this.firebaseDB.ref(`branches/${branchId}/inventory`).once('value')
            .then(snapshot => {
                const fbInventory = snapshot.val() || [];
                const productIndex = fbInventory.findIndex(p => p.id === productId);
                
                if (productIndex !== -1) {
                    // تحديث الكمية في المخزون
                    fbInventory[productIndex].quantity += changeAmount;
                    fbInventory[productIndex].lastUpdated = new Date().toISOString();
                } else {
                    // إضافة المنتج إذا لم يكن موجودًا
                    fbInventory.push({
                        id: productId,
                        quantity: Math.max(0, changeAmount),
                        lastUpdated: new Date().toISOString()
                    });
                }
                
                // تحديث المخزون في Firebase
                return this.firebaseDB.ref(`branches/${branchId}/inventory`).set(fbInventory);
            });
    },
    
    // إعداد مستمعي الأحداث
    setupEventListeners: function() {
        // الاستماع لتغييرات الاتصال بالإنترنت
        window.addEventListener('online', this.handleOnlineStatus.bind(this));
        window.addEventListener('offline', this.handleOfflineStatus.bind(this));
        
        // مراقبة التغييرات في قاعدة بيانات Firebase إذا كان متصلاً
        if (!this.offlineMode) {
            this.firebaseDB.ref('branches').on('child_changed', snapshot => {
                const fbBranch = snapshot.val();
                if (fbBranch) {
                    const localBranchIndex = this.branches.findIndex(b => b.id === fbBranch.id);
                    
                    if (localBranchIndex !== -1) {
                        // التحقق من أحدث إصدار
                        const localBranch = this.branches[localBranchIndex];
                        if (fbBranch.lastUpdated && (!localBranch.lastUpdated || new Date(fbBranch.lastUpdated) > new Date(localBranch.lastUpdated))) {
                            console.log(`تم تحديث الفرع "${fbBranch.name}" من قاعدة البيانات`);
                            
                            // تحديث الفرع محليًا
                            this.branches[localBranchIndex] = { ...localBranch, ...fbBranch };
                            this.saveBranches();
                            
                            // تحديث واجهة المستخدم إذا كان الفرع الحالي هو المحدث
                            if (this.currentBranch && this.currentBranch.id === fbBranch.id) {
                                this.currentBranch = this.branches[localBranchIndex];
                                this.updateBranchUI();
                            }
                        }
                    }
                }
            });
        }
    },
    
    // إنشاء تقرير مقارنة بين الفروع
    generateBranchComparisonReport: function(fromDate, toDate) {
        // جمع بيانات المبيعات من التخزين المحلي
        const salesData = JSON.parse(localStorage.getItem('pos_sales')) || [];
        
        const branchStats = {};
        this.branches.forEach(branch => {
            branchStats[branch.id] = {
                id: branch.id,
                name: branch.name,
                totalSales: 0,
                salesCount: 0,
                averageSale: 0,
                topProducts: {},
                totalItems: 0
            };
        });
        
        // حساب الإحصائيات لكل فرع
        salesData.forEach(sale => {
            // التحقق من أن البيع في النطاق الزمني المحدد
            const saleDate = new Date(sale.date);
            if (saleDate >= fromDate && saleDate <= toDate && sale.branchId) {
                const stats = branchStats[sale.branchId];
                if (stats) {
                    stats.totalSales += sale.total;
                    stats.salesCount++;
                    
                    // حساب المنتجات الأكثر مبيعًا
                    sale.items.forEach(item => {
                        if (!stats.topProducts[item.id]) {
                            stats.topProducts[item.id] = {
                                id: item.id,
                                name: item.name,
                                quantity: 0,
                                total: 0
                            };
                        }
                        
                        stats.topProducts[item.id].quantity += item.quantity;
                        stats.topProducts[item.id].total += item.price * item.quantity;
                        stats.totalItems += item.quantity;
                    });
                }
            }
        });
        
        // حساب المتوسطات وترتيب المنتجات
        Object.values(branchStats).forEach(branch => {
            branch.averageSale = branch.salesCount > 0 ? branch.totalSales / branch.salesCount : 0;
            
            // تحويل المنتجات إلى مصفوفة وترتيب
            const topProductsArray = Object.values(branch.topProducts);
            topProductsArray.sort((a, b) => b.quantity - a.quantity);
            branch.topProducts = topProductsArray.slice(0, 5); // أفضل 5 منتجات
        });
        
        // ترتيب الفروع حسب المبيعات
        const result = Object.values(branchStats).sort((a, b) => b.totalSales - a.totalSales);
        
        return {
            fromDate,
            toDate,
            branches: result,
            totalSales: result.reduce((sum, branch) => sum + branch.totalSales, 0),
            totalTransactions: result.reduce((sum, branch) => sum + branch.salesCount, 0)
        };
    },
    
    // معالجة حالة الاتصال بالإنترنت
    handleOnlineStatus: function() {
        console.log("تم استعادة الاتصال بالإنترنت");
        this.offlineMode = false;
        showNotification('تم استعادة الاتصال بالإنترنت', 'success');
        
        // محاولة مزامنة البيانات المعلقة
        this.processPendingTransactions();
        
        // تحديث مؤشر الاتصال في واجهة المستخدم
        updateConnectionIndicator(true);
    },
    
    // معالجة حالة عدم الاتصال بالإنترنت
    handleOfflineStatus: function() {
        console.log("تم فقدان الاتصال بالإنترنت - تفعيل وضع عدم الاتصال");
        this.offlineMode = true;
        showNotification('تم فقدان الاتصال بالإنترنت - التحويل إلى وضع عدم الاتصال', 'warning');
        
        // تحديث مؤشر الاتصال في واجهة المستخدم
        updateConnectionIndicator(false);
    },
    
    // التحقق من حالة الاتصال
    checkConnectivity: function() {
        // التحقق من حالة الاتصال الحالية
        this.offlineMode = !navigator.onLine;
        updateConnectionIndicator(navigator.onLine);
        
        if (this.offlineMode) {
            console.log("أنت في وضع عدم الاتصال");
        } else {
            console.log("أنت متصل بالإنترنت");
            this.processPendingTransactions();
        }
    },
    
    // عرض قائمة الفروع في واجهة المستخدم
    renderBranchList: function() {
        const branchSelector = document.getElementById('branch-selector');
        
        // إذا لم يكن عنصر الاختيار موجودًا، إنشاؤه
        if (!branchSelector) {
            this.createBranchSelector();
            return;
        }
        
        // تحديث قائمة الفروع
        branchSelector.innerHTML = '';
        
        this.getActiveBranches().forEach(branch => {
            const option = document.createElement('option');
            option.value = branch.id;
            option.textContent = branch.name;
            
            if (this.currentBranch && this.currentBranch.id === branch.id) {
                option.selected = true;
            }
            
            branchSelector.appendChild(option);
        });
    },
    
    // إنشاء عنصر اختيار الفروع في واجهة المستخدم
    createBranchSelector: function() {
        // إنشاء عنصر تحديد الفرع
        const header = document.querySelector('.header');
        
        if (!header) return;
        
        const branchSelectorContainer = document.createElement('div');
        branchSelectorContainer.className = 'branch-selector-container';
        branchSelectorContainer.innerHTML = `
            <label for="branch-selector">الفرع:</label>
            <select id="branch-selector" class="branch-selector"></select>
        `;
        
        // إدراج عنصر تحديد الفرع في الترويسة
        const headerControls = header.querySelector('.header-controls');
        if (headerControls) {
            header.insertBefore(branchSelectorContainer, headerControls);
        } else {
            header.appendChild(branchSelectorContainer);
        }
        
        // إضافة CSS للعنصر
        const style = document.createElement('style');
        style.textContent = `
            .branch-selector-container {
                display: flex;
                align-items: center;
                margin-right: 20px;
                color: white;
            }
            
            .branch-selector-container label {
                margin-right: 10px;
                font-weight: bold;
            }
            
            .branch-selector {
                background-color: rgba(255, 255, 255, 0.2);
                border: 1px solid rgba(255, 255, 255, 0.3);
                border-radius: 4px;
                color: white;
                padding: 5px 10px;
                font-size: 14px;
                cursor: pointer;
            }
            
            .branch-selector option {
                background-color: #34495e;
                color: white;
            }
            
            .connection-indicator {
                display: flex;
                align-items: center;
                margin-right: 15px;
                font-size: 12px;
                color: white;
            }
            
            .connection-indicator i {
                margin-left: 5px;
                font-size: 14px;
            }
            
            .connection-online {
                color: #2ecc71;
            }
            
            .connection-offline {
                color: #e74c3c;
            }
            
            .sync-indicator {
                margin-right: 15px;
                font-size: 14px;
                animation: spin 1s linear infinite;
                display: none;
                color: white;
            }
            
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            .sync-indicator.syncing {
                display: inline-block;
            }
        `;
        
        document.head.appendChild(style);
        
        // إضافة عناصر مؤشر الاتصال والمزامنة
        const connectionIndicator = document.createElement('div');
        connectionIndicator.className = 'connection-indicator';
        connectionIndicator.id = 'connection-indicator';
        connectionIndicator.innerHTML = `
            <i class="fas fa-circle connection-online"></i>
            <span>متصل</span>
        `;
        
        const syncIndicator = document.createElement('div');
        syncIndicator.className = 'sync-indicator';
        syncIndicator.id = 'sync-indicator';
        syncIndicator.innerHTML = `<i class="fas fa-sync"></i>`;
        
        header.insertBefore(connectionIndicator, headerControls);
        header.insertBefore(syncIndicator, headerControls);
        
        // إضافة مستمع الأحداث لتغيير الفرع
        const branchSelector = document.getElementById('branch-selector');
        branchSelector.addEventListener('change', () => {
            this.setCurrentBranch(branchSelector.value);
        });
        
        // تحديث قائمة الفروع
        this.renderBranchList();
    },
    
    // فتح نافذة إدارة الفروع
    openBranchManagerModal: function() {
        // إنشاء نافذة إدارة الفروع إذا لم تكن موجودة
        if (!document.getElementById('branch-manager-modal')) {
            this.createBranchManagerModal();
        }
        
        // تحديث قائمة الفروع
        this.updateBranchManagerList();
        
        // عرض النافذة
        document.getElementById('branch-manager-modal').style.display = 'flex';
    },
    
   // إنشاء نافذة إدارة الفروع
createBranchManagerModal: function() {
    const modalHtml = `
    <div class="modal" id="branch-manager-modal">
        <div class="modal-content" style="width: 90%; max-width: 1200px;">
            <div class="modal-header">
                <h2>إدارة الفروع</h2>
                <button class="modal-close" id="close-branch-manager-modal">&times;</button>
            </div>
            <div class="modal-body">
                <div class="settings-tabs">
                    <div class="settings-tab active" data-branch-tab="list">قائمة الفروع</div>
                    <div class="settings-tab" data-branch-tab="inventory">مخزون الفروع</div>
                    <div class="settings-tab" data-branch-tab="transfers">نقل المخزون</div>
                    <div class="settings-tab" data-branch-tab="reports">تقارير الفروع</div>
                    <div class="settings-tab" data-branch-tab="sync">المزامنة</div>
                </div>
                
                <!-- قائمة الفروع -->
                <div class="branch-panel active" id="branch-list-panel">
                    <div class="form-group" style="margin-bottom: 20px;">
                        <button class="btn btn-primary" id="add-new-branch">
                            <i class="fas fa-plus"></i>
                            إضافة فرع جديد
                        </button>
                        <button class="btn btn-primary" id="refresh-branches">
                            <i class="fas fa-sync"></i>
                            تحديث البيانات
                        </button>
                    </div>
                    
                    <table class="inventory-list">
                        <thead>
                            <tr>
                                <th>اسم الفرع</th>
                                <th>العنوان</th>
                                <th>المدير</th>
                                <th>رقم الهاتف</th>
                                <th>تاريخ الإنشاء</th>
                                <th>الحالة</th>
                                <th>الإجراءات</th>
                            </tr>
                        </thead>
                        <tbody id="branches-list">
                            <!-- سيتم إضافة الفروع هنا -->
                        </tbody>
                    </table>
                </div>
                
                <!-- مخزون الفروع -->
                <div class="branch-panel" id="branch-inventory-panel">
                    <div class="form-row" style="margin-bottom: 20px;">
                        <div class="form-col">
                            <div class="form-group">
                                <label for="inventory-branch-selector">اختر الفرع:</label>
                                <select class="form-control" id="inventory-branch-selector">
                                    <!-- سيتم إضافة الفروع هنا -->
                                </select>
                            </div>
                        </div>
                        <div class="form-col">
                            <div class="form-group">
                                <label for="inventory-search">بحث:</label>
                                <input type="text" class="form-control" id="inventory-search" placeholder="اسم المنتج أو الباركود...">
                            </div>
                        </div>
                        <div class="form-col">
                            <div class="form-group">
                                <label>&nbsp;</label>
                                <button class="btn btn-primary" id="refresh-branch-inventory" style="width: 100%;">
                                    <i class="fas fa-sync"></i>
                                    تحديث المخزون
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <table class="inventory-list">
                        <thead>
                            <tr>
                                <th>المنتج</th>
                                <th>الباركود</th>
                                <th>الكمية</th>
                                <th>السعر</th>
                                <th>القيمة</th>
                                <th>حالة المخزون</th>
                                <th>آخر تحديث</th>
                            </tr>
                        </thead>
                        <tbody id="branch-inventory-list">
                            <!-- سيتم إضافة المنتجات هنا -->
                        </tbody>
                    </table>
                </div>
                
                <!-- نقل المخزون -->
                <div class="branch-panel" id="branch-transfers-panel">
                    <div class="form-row" style="margin-bottom: 20px;">
                        <div class="form-col">
                            <div class="form-group">
                                <label for="transfer-from-branch">الفرع المصدر:</label>
                                <select class="form-control" id="transfer-from-branch">
                                    <!-- سيتم إضافة الفروع هنا -->
                                </select>
                            </div>
                        </div>
                        <div class="form-col">
                            <div class="form-group">
                                <label for="transfer-to-branch">الفرع الوجهة:</label>
                                <select class="form-control" id="transfer-to-branch">
                                    <!-- سيتم إضافة الفروع هنا -->
                                </select>
                            </div>
                        </div>
                        <div class="form-col">
                            <div class="form-group">
                                <label>&nbsp;</label>
                                <button class="btn btn-primary" id="create-new-transfer" style="width: 100%;">
                                    <i class="fas fa-plus"></i>
                                    إنشاء عملية نقل جديدة
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <h3>سجل عمليات النقل</h3>
                    <table class="inventory-list">
                        <thead>
                            <tr>
                                <th>رقم العملية</th>
                                <th>من فرع</th>
                                <th>إلى فرع</th>
                                <th>عدد المنتجات</th>
                                <th>التاريخ</th>
                                <th>الحالة</th>
                                <th>الإجراءات</th>
                            </tr>
                        </thead>
                        <tbody id="transfers-list">
                            <!-- سيتم إضافة عمليات النقل هنا -->
                        </tbody>
                    </table>
                </div>
                
                <!-- تقارير الفروع -->
                <div class="branch-panel" id="branch-reports-panel">
                    <div class="form-row" style="margin-bottom: 20px;">
                        <div class="form-col">
                            <div class="form-group">
                                <label for="report-from-date">من تاريخ:</label>
                                <input type="date" class="form-control" id="report-from-date">
                            </div>
                        </div>
                        <div class="form-col">
                            <div class="form-group">
                                <label for="report-to-date">إلى تاريخ:</label>
                                <input type="date" class="form-control" id="report-to-date">
                            </div>
                        </div>
                        <div class="form-col">
                            <div class="form-group">
                                <label for="report-type">نوع التقرير:</label>
                                <select class="form-control" id="report-type">
                                    <option value="comparison">مقارنة المبيعات بين الفروع</option>
                                    <option value="lowstock">تقرير نقص المخزون</option>
                                    <option value="performance">أداء الفروع</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-col">
                            <div class="form-group">
                                <label>&nbsp;</label>
                                <button class="btn btn-primary" id="generate-branch-report" style="width: 100%;">
                                    <i class="fas fa-chart-bar"></i>
                                    إنشاء التقرير
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <div id="branch-report-container">
                        <!-- سيتم عرض التقرير هنا -->
                    </div>
                </div>
                
                <!-- المزامنة -->
                <div class="branch-panel" id="branch-sync-panel">
                    <div class="form-group">
                        <h3>إعدادات المزامنة</h3>
                        <div class="form-row">
                            <div class="form-col">
                                <div class="form-group" style="margin-bottom: 20px;">
                                    <button class="btn btn-primary" id="sync-all-branches">
                                        <i class="fas fa-sync"></i>
                                        مزامنة جميع البيانات
                                    </button>
                                </div>
                            </div>
                            <div class="form-col">
                                <div class="form-group" style="margin-bottom: 20px;">
                                    <button class="btn btn-primary" id="sync-inventory">
                                        <i class="fas fa-box"></i>
                                        مزامنة المخزون فقط
                                    </button>
                                </div>
                            </div>
                            <div class="form-col">
                                <div class="form-group" style="margin-bottom: 20px;">
                                    <button class="btn btn-primary" id="sync-sales">
                                        <i class="fas fa-shopping-cart"></i>
                                        مزامنة المبيعات فقط
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <h3>المعاملات المعلقة <span id="pending-count">(0)</span></h3>
                        <div id="pending-transactions-list" style="max-height: 300px; overflow-y: auto;">
                            <!-- سيتم عرض المعاملات المعلقة هنا -->
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <h3>سجل المزامنة</h3>
                        <div id="sync-log-list" style="max-height: 300px; overflow-y: auto;">
                            <!-- سيتم عرض سجل المزامنة هنا -->
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn" id="close-branch-manager">إغلاق</button>
            </div>
        </div>
    </div>`;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // إضافة CSS للنوافذ المنبثقة
    const style = document.createElement('style');
    style.textContent = `
        .branch-panel {
            display: none;
            margin-top: 20px;
        }
        
        .branch-panel.active {
            display: block;
        }
    `;
    
    document.head.appendChild(style);
    
    // إضافة مستمعي الأحداث لعلامات التبويب
    const tabButtons = document.querySelectorAll('[data-branch-tab]');
    tabButtons.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabId = tab.getAttribute('data-branch-tab');
            
            // تحديث علامات التبويب
            tabButtons.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // تحديث اللوحات
            document.querySelectorAll('.branch-panel').forEach(panel => panel.classList.remove('active'));
            document.getElementById(`branch-${tabId}-panel`).classList.add('active');
            
            // تنفيذ إجراءات خاصة بكل علامة تبويب
            switch (tabId) {
                case 'list':
                    this.updateBranchManagerList();
                    break;
                case 'inventory':
                    this.updateBranchInventorySelector();
                    break;
                case 'transfers':
                    this.updateTransferBranchSelectors();
                    this.loadTransferHistory();
                    break;
                case 'reports':
                    // تعيين تواريخ افتراضية للتقرير
                    const today = new Date();
                    const monthAgo = new Date();
                    monthAgo.setMonth(today.getMonth() - 1);
                    
                    document.getElementById('report-from-date').valueAsDate = monthAgo;
                    document.getElementById('report-to-date').valueAsDate = today;
                    break;
                case 'sync':
                    this.updatePendingTransactionsDisplay();
                    break;
            }
        });
    });
    
    // إضافة مستمعي الأحداث للأزرار
    document.getElementById('close-branch-manager-modal').addEventListener('click', () => {
        document.getElementById('branch-manager-modal').style.display = 'none';
    });
    
    document.getElementById('close-branch-manager').addEventListener('click', () => {
        document.getElementById('branch-manager-modal').style.display = 'none';
    });
    
    document.getElementById('add-new-branch').addEventListener('click', () => {
        this.openAddBranchModal();
    });
    
    document.getElementById('refresh-branches').addEventListener('click', () => {
        this.fetchBranchesFromFirebase();
    });
    
    document.getElementById('refresh-branch-inventory').addEventListener('click', () => {
        const branchId = document.getElementById('inventory-branch-selector').value;
        if (branchId) {
            this.loadBranchInventory(branchId);
        }
    });
    
    document.getElementById('create-new-transfer').addEventListener('click', () => {
        this.openNewTransferModal();
    });
    
    document.getElementById('generate-branch-report').addEventListener('click', () => {
        this.generateBranchReport();
    });
    
    document.getElementById('sync-all-branches').addEventListener('click', () => {
        this.syncAllData();
    });
    
    document.getElementById('sync-inventory').addEventListener('click', () => {
        this.fetchAllBranchesInventory();
    });
    
    document.getElementById('sync-sales').addEventListener('click', () => {
        this.syncBranchSalesData();
    });
    
    // إضافة مستمع للبحث في المخزون
    document.getElementById('inventory-search').addEventListener('input', (e) => {
        this.filterBranchInventory(e.target.value);
    });
    
    // مستمع لتغيير فرع المخزون
    document.getElementById('inventory-branch-selector').addEventListener('change', (e) => {
        this.loadBranchInventory(e.target.value);
    });
},

// تحديث قائمة الفروع في مدير الفروع
updateBranchManagerList: function() {
    const branchesList = document.getElementById('branches-list');
    if (!branchesList) return;
    
    branchesList.innerHTML = '';
    
    this.branches.forEach(branch => {
        const row = document.createElement('tr');
        
        const createdDate = new Date(branch.createdAt).toLocaleDateString('ar-SA');
        
        row.innerHTML = `
            <td>${branch.name} ${branch.isMainBranch ? '<span class="badge">رئيسي</span>' : ''}</td>
            <td>${branch.address || '-'}</td>
            <td>${branch.manager || '-'}</td>
            <td>${branch.phone || '-'}</td>
            <td>${createdDate}</td>
            <td>
                <span class="status-badge ${branch.isActive ? 'active' : 'inactive'}">
                    ${branch.isActive ? 'نشط' : 'غير نشط'}
                </span>
            </td>
            <td>
                <button class="btn-icon edit-branch" data-id="${branch.id}" title="تعديل">
                    <i class="fas fa-edit"></i>
                </button>
                ${!branch.isMainBranch ? `
                <button class="btn-icon toggle-branch" data-id="${branch.id}" title="${branch.isActive ? 'تعطيل' : 'تفعيل'}">
                    <i class="fas fa-${branch.isActive ? 'ban' : 'check'}"></i>
                </button>` : ''}
                <button class="btn-icon view-branch-inventory" data-id="${branch.id}" title="عرض المخزون">
                    <i class="fas fa-boxes"></i>
                </button>
            </td>
        `;
        
        branchesList.appendChild(row);
    });
    
    // إضافة مستمعي الأحداث للأزرار
    document.querySelectorAll('.edit-branch').forEach(btn => {
        btn.addEventListener('click', () => {
            const branchId = btn.getAttribute('data-id');
            this.openEditBranchModal(branchId);
        });
    });
    
    document.querySelectorAll('.toggle-branch').forEach(btn => {
        btn.addEventListener('click', () => {
            const branchId = btn.getAttribute('data-id');
            this.toggleBranchStatus(branchId);
            this.updateBranchManagerList();
        });
    });
    
    document.querySelectorAll('.view-branch-inventory').forEach(btn => {
        btn.addEventListener('click', () => {
            const branchId = btn.getAttribute('data-id');
            // تحويل إلى علامة تبويب المخزون وتحديد الفرع
            document.querySelector('[data-branch-tab="inventory"]').click();
            document.getElementById('inventory-branch-selector').value = branchId;
            this.loadBranchInventory(branchId);
        });
    });
},

// تحديث قائمة الفروع في محدد فرع المخزون
updateBranchInventorySelector: function() {
    const selector = document.getElementById('inventory-branch-selector');
    if (!selector) return;
    
    selector.innerHTML = '';
    
    const activeBranches = this.getActiveBranches();
    
    activeBranches.forEach(branch => {
        const option = document.createElement('option');
        option.value = branch.id;
        option.textContent = branch.name;
        
        if (this.currentBranch && this.currentBranch.id === branch.id) {
            option.selected = true;
        }
        
        selector.appendChild(option);
    });
    
    // تحميل مخزون الفرع المحدد
    if (activeBranches.length > 0) {
        const selectedBranchId = selector.value;
        this.loadBranchInventory(selectedBranchId);
    }
},

// تحميل بيانات مخزون فرع معين
loadBranchInventory: function(branchId) {
    const branch = this.getBranchById(branchId);
    if (!branch) return;
    
    const inventoryList = document.getElementById('branch-inventory-list');
    if (!inventoryList) return;
    
    inventoryList.innerHTML = '';
    
    // بيانات المخزون
    const inventory = branch.inventory || [];
    
    if (inventory.length === 0) {
        const emptyRow = document.createElement('tr');
        emptyRow.innerHTML = '<td colspan="7" class="text-center">لا توجد منتجات في مخزون هذا الفرع</td>';
        inventoryList.appendChild(emptyRow);
        return;
    }
    
    // تحميل بيانات المنتجات من المخزن المحلي
    const productsData = JSON.parse(localStorage.getItem('products')) || [];
    
    inventory.forEach(item => {
        const product = productsData.find(p => p.id === item.id) || {
            name: `منتج #${item.id}`,
            barcode: '-',
            price: 0
        };
        
        const row = document.createElement('tr');
        
        // تحديد حالة المخزون (منخفض/جيد)
        const lowStockThreshold = parseInt(localStorage.getItem('lowStockThreshold')) || 10;
        const stockStatus = item.quantity <= lowStockThreshold ? 'low' : 'good';
        
        // تاريخ آخر تحديث بالتنسيق المحلي
        const lastUpdated = item.lastUpdated ? new Date(item.lastUpdated).toLocaleDateString('ar-SA') : '-';
        
        row.innerHTML = `
            <td>${product.name}</td>
            <td>${product.barcode || '-'}</td>
            <td>${item.quantity}</td>
            <td>${formatCurrency(product.price)}</td>
            <td>${formatCurrency(product.price * item.quantity)}</td>
            <td><span class="stock-status ${stockStatus}">${stockStatus === 'low' ? 'منخفض' : 'جيد'}</span></td>
            <td>${lastUpdated}</td>
        `;
        
        inventoryList.appendChild(row);
    });
},

// تصفية قائمة مخزون الفرع حسب البحث
filterBranchInventory: function(searchTerm) {
    const inventoryRows = document.querySelectorAll('#branch-inventory-list tr');
    
    if (!searchTerm.trim()) {
        inventoryRows.forEach(row => row.style.display = '');
        return;
    }
    
    const searchTermLower = searchTerm.trim().toLowerCase();
    
    inventoryRows.forEach(row => {
        const productName = row.cells[0].textContent.toLowerCase();
        const barcode = row.cells[1].textContent.toLowerCase();
        
        if (productName.includes(searchTermLower) || barcode.includes(searchTermLower)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
},

// تحديث محددات فروع النقل
updateTransferBranchSelectors: function() {
    const fromSelector = document.getElementById('transfer-from-branch');
    const toSelector = document.getElementById('transfer-to-branch');
    
    if (!fromSelector || !toSelector) return;
    
    fromSelector.innerHTML = '';
    toSelector.innerHTML = '';
    
    const activeBranches = this.getActiveBranches();
    
    activeBranches.forEach(branch => {
        const fromOption = document.createElement('option');
        fromOption.value = branch.id;
        fromOption.textContent = branch.name;
        
        const toOption = document.createElement('option');
        toOption.value = branch.id;
        toOption.textContent = branch.name;
        
        fromSelector.appendChild(fromOption);
        toSelector.appendChild(toOption);
    });
    
    // تحديد الفرع الحالي في المصدر إذا كان موجوداً
    if (this.currentBranch && fromSelector.querySelector(`option[value="${this.currentBranch.id}"]`)) {
        fromSelector.value = this.currentBranch.id;
    }
},

// تحميل سجل عمليات النقل
loadTransferHistory: function() {
    // جلب سجل النقل من Firebase إذا كان متصلاً، وإلا استخدام البيانات المحلية
    if (!this.offlineMode) {
        this.firebaseDB.ref('inventory_transfers').orderByChild('createdAt').limitToLast(50).once('value')
            .then(snapshot => {
                const transfers = [];
                snapshot.forEach(childSnapshot => {
                    transfers.push({ id: childSnapshot.key, ...childSnapshot.val() });
                });
                
                // عرض سجل النقل مرتبًا بالتاريخ تنازليًا
                this.displayTransferHistory(transfers.reverse());
            })
            .catch(error => {
                console.error("خطأ في جلب سجل النقل:", error);
                this.displayTransferHistory([]);
            });
    } else {
        // استخدام سجل محلي (يمكن تخزينه في localStorage)
        const localTransfers = JSON.parse(localStorage.getItem('inventory_transfers')) || [];
        this.displayTransferHistory(localTransfers);
    }
},

// عرض سجل عمليات النقل
displayTransferHistory: function(transfers) {
    const transfersList = document.getElementById('transfers-list');
    if (!transfersList) return;
    
    transfersList.innerHTML = '';
    
    if (transfers.length === 0) {
        const emptyRow = document.createElement('tr');
        emptyRow.innerHTML = '<td colspan="7" class="text-center">لا توجد عمليات نقل مخزون حتى الآن</td>';
        transfersList.appendChild(emptyRow);
        return;
    }
    
    transfers.forEach(transfer => {
        const row = document.createElement('tr');
        
        // الحصول على أسماء الفروع
        const fromBranch = this.getBranchById(transfer.fromBranchId) || { name: transfer.fromBranchId };
        const toBranch = this.getBranchById(transfer.toBranchId) || { name: transfer.toBranchId };
        
        // تنسيق التاريخ
        const createdDate = new Date(transfer.createdAt).toLocaleDateString('ar-SA');
        
        // حالة النقل
        const statusClass = transfer.status === 'completed' ? 'success' : 'pending';
        const statusText = transfer.status === 'completed' ? 'مكتمل' : 'قيد التنفيذ';
        
        row.innerHTML = `
            <td>${transfer.id}</td>
            <td>${fromBranch.name}</td>
            <td>${toBranch.name}</td>
            <td>${transfer.items ? transfer.items.length : 0}</td>
            <td>${createdDate}</td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            <td>
                <button class="btn-icon view-transfer" data-id="${transfer.id}" title="عرض التفاصيل">
                    <i class="fas fa-eye"></i>
                </button>
                ${transfer.status !== 'completed' ? `
                <button class="btn-icon complete-transfer" data-id="${transfer.id}" title="إتمام النقل">
                    <i class="fas fa-check"></i>
                </button>` : ''}
            </td>
        `;
        
        transfersList.appendChild(row);
    });
    
    // إضافة مستمعي الأحداث للأزرار
    document.querySelectorAll('.view-transfer').forEach(btn => {
        btn.addEventListener('click', () => {
            const transferId = btn.getAttribute('data-id');
            const transfer = transfers.find(t => t.id === transferId);
            if (transfer) {
                this.showTransferDetails(transfer);
            }
        });
    });
    
    document.querySelectorAll('.complete-transfer').forEach(btn => {
        btn.addEventListener('click', () => {
            const transferId = btn.getAttribute('data-id');
            const transfer = transfers.find(t => t.id === transferId);
            if (transfer && transfer.status !== 'completed') {
                this.completeTransfer(transfer);
            }
        });
    });
},

// عرض تفاصيل عملية نقل
showTransferDetails: function(transfer) {
    // إنشاء نافذة منبثقة لعرض التفاصيل
    const fromBranch = this.getBranchById(transfer.fromBranchId) || { name: transfer.fromBranchId };
    const toBranch = this.getBranchById(transfer.toBranchId) || { name: transfer.toBranchId };
    
    // الحصول على بيانات المنتجات
    const productsData = JSON.parse(localStorage.getItem('products')) || [];
    
    let itemsHtml = '';
    if (transfer.items && transfer.items.length > 0) {
        itemsHtml = `
        <table class="inventory-list">
            <thead>
                <tr>
                    <th>المنتج</th>
                    <th>الكمية</th>
                    <th>السعر</th>
                    <th>الإجمالي</th>
                </tr>
            </thead>
            <tbody>
        `;
        
        transfer.items.forEach(item => {
            const product = productsData.find(p => p.id === item.productId) || {
                name: `منتج #${item.productId}`,
                price: 0
            };
            
            itemsHtml += `
            <tr>
                <td>${product.name}</td>
                <td>${item.quantity}</td>
                <td>${formatCurrency(product.price)}</td>
                <td>${formatCurrency(product.price * item.quantity)}</td>
            </tr>
            `;
        });
        
        itemsHtml += '</tbody></table>';
    } else {
        itemsHtml = '<p>لا توجد منتجات في هذه العملية</p>';
    }
    // إنشاء نافذة منبثقة مؤقتة
    const modalId = 'transfer-details-modal';
    
    // إزالة النافذة المنبثقة السابقة إذا كانت موجودة
    const existingModal = document.getElementById(modalId);
    if (existingModal) {
        existingModal.remove();
    }
    
    // إنشاء النافذة المنبثقة الجديدة
    const modalHtml = `
    <div class="modal" id="${modalId}">
        <div class="modal-content">
            <div class="modal-header">
                <h2>تفاصيل عملية نقل المخزون</h2>
                <button class="modal-close" id="close-transfer-details">&times;</button>
            </div>
            <div class="modal-body">
                <div class="details-group">
                    <div class="details-row">
                        <div class="details-label">رقم العملية:</div>
                        <div class="details-value">${transfer.id}</div>
                    </div>
                    <div class="details-row">
                        <div class="details-label">من فرع:</div>
                        <div class="details-value">${fromBranch.name}</div>
                    </div>
                    <div class="details-row">
                        <div class="details-label">إلى فرع:</div>
                        <div class="details-value">${toBranch.name}</div>
                    </div>
                    <div class="details-row">
                        <div class="details-label">تاريخ الإنشاء:</div>
                        <div class="details-value">${new Date(transfer.createdAt).toLocaleString('ar-SA')}</div>
                    </div>
                    <div class="details-row">
                        <div class="details-label">حالة النقل:</div>
                        <div class="details-value">
                            <span class="status-badge ${transfer.status === 'completed' ? 'success' : 'pending'}">
                                ${transfer.status === 'completed' ? 'مكتمل' : 'قيد التنفيذ'}
                            </span>
                        </div>
                    </div>
                    ${transfer.completedAt ? `
                    <div class="details-row">
                        <div class="details-label">تاريخ الإتمام:</div>
                        <div class="details-value">${new Date(transfer.completedAt).toLocaleString('ar-SA')}</div>
                    </div>` : ''}
                    ${transfer.notes ? `
                    <div class="details-row">
                        <div class="details-label">ملاحظات:</div>
                        <div class="details-value">${transfer.notes}</div>
                    </div>` : ''}
                </div>
                
                <h3>المنتجات المنقولة</h3>
                ${itemsHtml}
            </div>
            <div class="modal-footer">
                <button class="btn" id="close-transfer-details-btn">إغلاق</button>
                ${transfer.status !== 'completed' ? `
                <button class="btn btn-primary" id="complete-transfer-btn" data-id="${transfer.id}">
                    <i class="fas fa-check"></i>
                    إتمام النقل
                </button>` : ''}
            </div>
        </div>
    </div>`;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // إضافة CSS للتفاصيل
    const style = document.createElement('style');
    style.textContent = `
        .details-group {
            margin-bottom: 20px;
            border: 1px solid #e0e0e0;
            border-radius: 4px;
            padding: 15px;
            background-color: #f9f9f9;
        }
        
        .details-row {
            display: flex;
            margin-bottom: 10px;
            border-bottom: 1px dashed #e0e0e0;
            padding-bottom: 10px;
        }
        
        .details-row:last-child {
            margin-bottom: 0;
            border-bottom: none;
            padding-bottom: 0;
        }
        
        .details-label {
            font-weight: bold;
            width: 150px;
            color: #444;
        }
        
        .details-value {
            flex: 1;
        }
    `;
    
    document.head.appendChild(style);
    
    // إضافة مستمعي الأحداث
    document.getElementById('close-transfer-details').addEventListener('click', () => {
        document.getElementById(modalId).remove();
    });
    
    document.getElementById('close-transfer-details-btn').addEventListener('click', () => {
        document.getElementById(modalId).remove();
    });
    
    const completeBtn = document.getElementById('complete-transfer-btn');
    if (completeBtn) {
        completeBtn.addEventListener('click', () => {
            this.completeTransfer(transfer);
            document.getElementById(modalId).remove();
        });
    }
    
    // عرض النافذة المنبثقة
    document.getElementById(modalId).style.display = 'flex';
},

// إكمال عملية نقل
completeTransfer: function(transfer) {
    if (transfer.status === 'completed') {
        showNotification('هذه العملية مكتملة بالفعل', 'info');
        return;
    }
    
    if (this.offlineMode) {
        showNotification('لا يمكن إكمال عملية النقل في وضع عدم الاتصال', 'warning');
        this.addPendingTransaction('update', 'inventory_transfer_status', {
            id: transfer.id,
            status: 'completed',
            completedAt: new Date().toISOString()
        });
        return;
    }
    
    // تحديث حالة النقل في Firebase
    this.firebaseDB.ref(`inventory_transfers/${transfer.id}`).update({
        status: 'completed',
        completedAt: new Date().toISOString()
    })
        .then(() => {
            showNotification('تم إكمال عملية النقل بنجاح', 'success');
            this.loadTransferHistory();
        })
        .catch(error => {
            console.error("خطأ في إكمال عملية النقل:", error);
            showNotification('حدث خطأ أثناء محاولة إكمال عملية النقل', 'error');
        });
},

// فتح نافذة إنشاء نقل جديد
openNewTransferModal: function() {
    // التحقق من وجود فرعين نشطين على الأقل
    const activeBranches = this.getActiveBranches();
    if (activeBranches.length < 2) {
        showNotification('يجب وجود فرعين نشطين على الأقل لإجراء عملية نقل', 'warning');
        return;
    }
    
    // إنشاء نافذة منبثقة للنقل الجديد
    const modalId = 'new-transfer-modal';
    
    // إزالة النافذة المنبثقة السابقة إذا كانت موجودة
    const existingModal = document.getElementById(modalId);
    if (existingModal) {
        existingModal.remove();
    }
    
    // الحصول على الفرعين المحددين
    const fromBranchId = document.getElementById('transfer-from-branch').value;
    const toBranchId = document.getElementById('transfer-to-branch').value;
    
    if (fromBranchId === toBranchId) {
        showNotification('لا يمكن النقل إلى نفس الفرع، الرجاء اختيار فرع وجهة مختلف', 'warning');
        return;
    }
    
    const fromBranch = this.getBranchById(fromBranchId);
    const toBranch = this.getBranchById(toBranchId);
    
    // الحصول على بيانات المنتجات
    const productsData = JSON.parse(localStorage.getItem('products')) || [];
    
    // الحصول على مخزون الفرع المصدر
    const fromBranchInventory = fromBranch.inventory || [];
    
    // تصفية المنتجات التي لها كمية موجبة فقط
    const availableProducts = fromBranchInventory
        .filter(item => item.quantity > 0)
        .map(item => {
            const product = productsData.find(p => p.id === item.id) || {
                name: `منتج #${item.id}`,
                barcode: '-',
                price: 0
            };
            
            return {
                ...item,
                name: product.name,
                barcode: product.barcode,
                price: product.price
            };
        });
    
    // إنشاء قائمة المنتجات للاختيار
    let productsListHtml = '';
    
    if (availableProducts.length === 0) {
        productsListHtml = '<tr><td colspan="5" class="text-center">لا توجد منتجات متوفرة في المخزون للنقل</td></tr>';
    } else {
        availableProducts.forEach(product => {
            productsListHtml += `
            <tr>
                <td>
                    <input type="checkbox" class="select-product" data-id="${product.id}" data-name="${product.name}">
                </td>
                <td>${product.name}</td>
                <td>${product.barcode || '-'}</td>
                <td>${product.quantity}</td>
                <td>
                    <input type="number" class="form-control product-transfer-quantity" 
                        data-id="${product.id}" min="1" max="${product.quantity}" value="1" disabled>
                </td>
            </tr>
            `;
        });
    }
    
    // إنشاء النافذة المنبثقة الجديدة
    const modalHtml = `
    <div class="modal" id="${modalId}">
        <div class="modal-content" style="width: 90%; max-width: 1000px;">
            <div class="modal-header">
                <h2>إنشاء عملية نقل مخزون جديدة</h2>
                <button class="modal-close" id="close-new-transfer">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-row">
                    <div class="form-col">
                        <div class="form-group">
                            <label>الفرع المصدر:</label>
                            <div class="form-static-text">${fromBranch.name}</div>
                        </div>
                    </div>
                    <div class="form-col">
                        <div class="form-group">
                            <label>الفرع الوجهة:</label>
                            <div class="form-static-text">${toBranch.name}</div>
                        </div>
                    </div>
                </div>
                
                <div class="form-group">
                    <label>ملاحظات:</label>
                    <textarea class="form-control" id="transfer-notes" placeholder="إضافة ملاحظات اختيارية..."></textarea>
                </div>
                
                <div class="form-group">
                    <label>البحث عن منتج:</label>
                    <input type="text" class="form-control" id="transfer-product-search" placeholder="اسم المنتج أو الباركود...">
                </div>
                
                <div class="form-group">
                    <div class="table-container" style="max-height: 400px; overflow-y: auto;">
                        <table class="inventory-list">
                            <thead>
                                <tr>
                                    <th style="width: 50px;">
                                        <input type="checkbox" id="select-all-products">
                                    </th>
                                    <th>المنتج</th>
                                    <th>الباركود</th>
                                    <th>الكمية المتوفرة</th>
                                    <th>الكمية للنقل</th>
                                </tr>
                            </thead>
                            <tbody id="transfer-products-list">
                                ${productsListHtml}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn" id="cancel-transfer">إلغاء</button>
                <button class="btn btn-primary" id="confirm-transfer">
                    <i class="fas fa-exchange-alt"></i>
                    إجراء النقل
                </button>
            </div>
        </div>
    </div>`;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // إضافة CSS للنماذج
    const style = document.createElement('style');
    style.textContent = `
        .form-static-text {
            padding: 8px 12px;
            background-color: #f9f9f9;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-weight: bold;
        }
        
        .product-transfer-quantity {
            width: 80px;
            text-align: center;
        }
    `;
    
    document.head.appendChild(style);
    
    // إضافة مستمعي الأحداث
    document.getElementById('close-new-transfer').addEventListener('click', () => {
        document.getElementById(modalId).remove();
    });
    
    document.getElementById('cancel-transfer').addEventListener('click', () => {
        document.getElementById(modalId).remove();
    });
    
    // مستمع لتفعيل/تعطيل حقول الإدخال عند اختيار المنتجات
    document.querySelectorAll('.select-product').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const productId = e.target.getAttribute('data-id');
            const quantityInput = document.querySelector(`.product-transfer-quantity[data-id="${productId}"]`);
            
            if (e.target.checked) {
                quantityInput.disabled = false;
            } else {
                quantityInput.disabled = true;
            }
        });
    });
    
    // مستمع لتحديد/إلغاء تحديد جميع المنتجات
    const selectAllCheckbox = document.getElementById('select-all-products');
    selectAllCheckbox.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        
        document.querySelectorAll('.select-product').forEach(checkbox => {
            checkbox.checked = isChecked;
            
            const productId = checkbox.getAttribute('data-id');
            const quantityInput = document.querySelector(`.product-transfer-quantity[data-id="${productId}"]`);
            
            if (quantityInput) {
                quantityInput.disabled = !isChecked;
            }
        });
    });
    
    // مستمع للبحث عن منتجات
    document.getElementById('transfer-product-search').addEventListener('input', (e) => {
        const searchTerm = e.target.value.trim().toLowerCase();
        
        document.querySelectorAll('#transfer-products-list tr').forEach(row => {
            if (row.cells.length < 2) return;
            
            const productName = row.cells[1].textContent.toLowerCase();
            const barcode = row.cells[2].textContent.toLowerCase();
            
            if (productName.includes(searchTerm) || barcode.includes(searchTerm)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    });
    
    // مستمع لتأكيد النقل
    document.getElementById('confirm-transfer').addEventListener('click', () => {
        // جمع المنتجات المحددة للنقل
        const selectedProducts = [];
        
        document.querySelectorAll('.select-product:checked').forEach(checkbox => {
            const productId = checkbox.getAttribute('data-id');
            const productName = checkbox.getAttribute('data-name');
            const quantityInput = document.querySelector(`.product-transfer-quantity[data-id="${productId}"]`);
            
            if (quantityInput && !quantityInput.disabled) {
                const quantity = parseInt(quantityInput.value);
                
                if (quantity > 0) {
                    selectedProducts.push({
                        productId,
                        productName,
                        quantity
                    });
                }
            }
        });
        
        if (selectedProducts.length === 0) {
            showNotification('الرجاء اختيار منتج واحد على الأقل للنقل', 'warning');
            return;
        }
        
        // الحصول على الملاحظات
        const notes = document.getElementById('transfer-notes').value.trim();
        
        // إجراء النقل
        const success = this.transferInventory(fromBranchId, toBranchId, selectedProducts);
        
        if (success) {
            showNotification('تم إنشاء عملية النقل بنجاح', 'success');
            
            // تحديث سجل النقل وإغلاق النافذة
            this.loadTransferHistory();
            document.getElementById(modalId).remove();
            
            // تبديل إلى علامة تبويب سجل النقل
            document.querySelector('[data-branch-tab="transfers"]').click();
        }
    });
    
    // عرض النافذة المنبثقة
    document.getElementById(modalId).style.display = 'flex';
},

// فتح نافذة إضافة فرع جديد
openAddBranchModal: function() {
    // إنشاء نافذة منبثقة لإضافة فرع جديد
    const modalId = 'add-branch-modal';
    
    // إزالة النافذة المنبثقة السابقة إذا كانت موجودة
    const existingModal = document.getElementById(modalId);
    if (existingModal) {
        existingModal.remove();
    }
    
    // إنشاء النافذة المنبثقة الجديدة
    const modalHtml = `
    <div class="modal" id="${modalId}">
        <div class="modal-content">
            <div class="modal-header">
                <h2>إضافة فرع جديد</h2>
                <button class="modal-close" id="close-add-branch">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label for="branch-name">اسم الفرع *</label>
                    <input type="text" class="form-control" id="branch-name" placeholder="اسم الفرع" required>
                </div>
                <div class="form-group">
                    <label for="branch-address">العنوان</label>
                    <input type="text" class="form-control" id="branch-address" placeholder="عنوان الفرع">
                </div>
                <div class="form-group">
                    <label for="branch-phone">رقم الهاتف</label>
                    <input type="text" class="form-control" id="branch-phone" placeholder="رقم هاتف الفرع">
                </div>
                <div class="form-group">
                    <label for="branch-manager">اسم المدير</label>
                    <input type="text" class="form-control" id="branch-manager" placeholder="اسم مدير الفرع">
                </div>
                <div class="form-group">
                    <label for="branch-email">البريد الإلكتروني</label>
                    <input type="email" class="form-control" id="branch-email" placeholder="البريد الإلكتروني للفرع">
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn" id="cancel-add-branch">إلغاء</button>
                <button class="btn btn-primary" id="confirm-add-branch">
                    <i class="fas fa-plus"></i>
                    إضافة الفرع
                </button>
            </div>
        </div>
    </div>`;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // إضافة مستمعي الأحداث
    document.getElementById('close-add-branch').addEventListener('click', () => {
        document.getElementById(modalId).remove();
    });
    
    document.getElementById('cancel-add-branch').addEventListener('click', () => {
        document.getElementById(modalId).remove();
    });
    
    document.getElementById('confirm-add-branch').addEventListener('click', () => {
        // جمع بيانات الفرع الجديد
        const branchName = document.getElementById('branch-name').value.trim();
        
        if (!branchName) {
            showNotification('يجب إدخال اسم الفرع', 'warning');
            return;
        }
        
        const branchData = {
            name: branchName,
            address: document.getElementById('branch-address').value.trim(),
            phone: document.getElementById('branch-phone').value.trim(),
            manager: document.getElementById('branch-manager').value.trim(),
            email: document.getElementById('branch-email').value.trim()
        };
        
        // إضافة الفرع
        const newBranch = this.addBranch(branchData);
        
        if (newBranch) {
            showNotification(`تم إضافة الفرع "${newBranch.name}" بنجاح`, 'success');
            
            // تحديث قائمة الفروع وإغلاق النافذة
            this.updateBranchManagerList();
            document.getElementById(modalId).remove();
        }
    });
    
    // عرض النافذة المنبثقة
    document.getElementById(modalId).style.display = 'flex';
},

// فتح نافذة تعديل فرع
openEditBranchModal: function(branchId) {
    const branch = this.getBranchById(branchId);
    if (!branch) {
        showNotification(`الفرع برقم "${branchId}" غير موجود`, 'error');
        return;
    }
    
    // إنشاء نافذة منبثقة لتعديل الفرع
    const modalId = 'edit-branch-modal';
    
    // إزالة النافذة المنبثقة السابقة إذا كانت موجودة
    const existingModal = document.getElementById(modalId);
    if (existingModal) {
        existingModal.remove();
    }
    
    // إنشاء النافذة المنبثقة الجديدة
    const modalHtml = `
    <div class="modal" id="${modalId}">
        <div class="modal-content">
            <div class="modal-header">
                <h2>تعديل الفرع</h2>
                <button class="modal-close" id="close-edit-branch">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label for="edit-branch-name">اسم الفرع *</label>
                    <input type="text" class="form-control" id="edit-branch-name" 
                        placeholder="اسم الفرع" value="${branch.name}" ${branch.isMainBranch ? 'readonly' : ''} required>
                </div>
                <div class="form-group">
                    <label for="edit-branch-address">العنوان</label>
                    <input type="text" class="form-control" id="edit-branch-address" 
                        placeholder="عنوان الفرع" value="${branch.address || ''}">
                </div>
                <div class="form-group">
                    <label for="edit-branch-phone">رقم الهاتف</label>
                    <input type="text" class="form-control" id="edit-branch-phone" 
                        placeholder="رقم هاتف الفرع" value="${branch.phone || ''}">
                </div>
                <div class="form-group">
                    <label for="edit-branch-manager">اسم المدير</label>
                    <input type="text" class="form-control" id="edit-branch-manager" 
                        placeholder="اسم مدير الفرع" value="${branch.manager || ''}">
                </div>
                <div class="form-group">
                    <label for="edit-branch-email">البريد الإلكتروني</label>
                    <input type="email" class="form-control" id="edit-branch-email" 
                        placeholder="البريد الإلكتروني للفرع" value="${branch.email || ''}">
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn" id="cancel-edit-branch">إلغاء</button>
                <button class="btn btn-primary" id="confirm-edit-branch">
                    <i class="fas fa-save"></i>
                    حفظ التغييرات
                </button>
            </div>
        </div>
    </div>`;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // إضافة مستمعي الأحداث
    document.getElementById('close-edit-branch').addEventListener('click', () => {
        document.getElementById(modalId).remove();
    });
    
    document.getElementById('cancel-edit-branch').addEventListener('click', () => {
        document.getElementById(modalId).remove();
    });
    
    document.getElementById('confirm-edit-branch').addEventListener('click', () => {
        // جمع بيانات الفرع المعدلة
        const branchName = document.getElementById('edit-branch-name').value.trim();
        
        if (!branchName) {
            showNotification('يجب إدخال اسم الفرع', 'warning');
            return;
        }
        
        const branchData = {
            name: branchName,
            address: document.getElementById('edit-branch-address').value.trim(),
            phone: document.getElementById('edit-branch-phone').value.trim(),
            manager: document.getElementById('edit-branch-manager').value.trim(),
            email: document.getElementById('edit-branch-email').value.trim()
        };
        
        // تحديث الفرع
        const updatedBranch = this.updateBranch(branchId, branchData);
        
        if (updatedBranch) {
            showNotification(`تم تحديث الفرع "${updatedBranch.name}" بنجاح`, 'success');
            
            // تحديث قائمة الفروع وإغلاق النافذة
            this.updateBranchManagerList();
            this.renderBranchList();
            document.getElementById(modalId).remove();
        }
    });
    
    // عرض النافذة المنبثقة
    document.getElementById(modalId).style.display = 'flex';
},

// إنشاء تقرير الفروع
generateBranchReport: function() {
    const reportType = document.getElementById('report-type').value;
    
    switch (reportType) {
        case 'comparison':
            this.generateComparisonReport();
            break;
        case 'lowstock':
            this.generateLowStockReportUI();
            break;
        case 'performance':
            this.generatePerformanceReport();
            break;
        default:
            showNotification('نوع تقرير غير معروف', 'error');
    }
},

// إنشاء تقرير مقارنة المبيعات بين الفروع
generateComparisonReport: function() {
    const fromDateInput = document.getElementById('report-from-date').value;
    const toDateInput = document.getElementById('report-to-date').value;
    
    if (!fromDateInput || !toDateInput) {
        showNotification('يرجى تحديد نطاق التاريخ للتقرير', 'warning');
        return;
    }
    
    // تحويل التواريخ إلى كائنات Date
    // إضافة الوقت للتأكد من شمول اليوم كاملاً
    const fromDate = new Date(fromDateInput);
    fromDate.setHours(0, 0, 0, 0);
    
    const toDate = new Date(toDateInput);
    toDate.setHours(23, 59, 59, 999);
    
    if (fromDate > toDate) {
        showNotification('تاريخ البداية يجب أن يكون قبل تاريخ النهاية', 'warning');
        return;
    }
    
    // إنشاء التقرير
    const report = this.generateBranchComparisonReport(fromDate, toDate);
    
    // عرض التقرير
    this.displayComparisonReport(report);
},

// عرض تقرير المقارنة بين الفروع
displayComparisonReport: function(report) {
    const container = document.getElementById('branch-report-container');
    if (!container) return;
    
    // تنسيق التواريخ
const fromDateStr = report.fromDate.toLocaleDateString('ar-SA');
const toDateStr = report.toDate.toLocaleDateString('ar-SA');

let branchRows = '';

if (report.branches.length === 0) {
    branchRows = '<tr><td colspan="6" class="text-center">لا توجد بيانات مبيعات للفروع في الفترة المحددة</td></tr>';
} else {
    report.branches.forEach((branch, index) => {
        // إنشاء قائمة المنتجات الأكثر مبيعًا
        let topProductsList = '';
        if (branch.topProducts && branch.topProducts.length > 0) {
            branch.topProducts.forEach(product => {
                topProductsList += `<div class="top-product">
                    <span class="product-name">${product.name}</span>
                    <span class="product-quantity">${product.quantity} وحدة</span>
                </div>`;
            });
        } else {
            topProductsList = '<div class="text-center">لا توجد بيانات</div>';
        }
        
        // حساب النسبة المئوية من إجمالي المبيعات
        const salesPercentage = report.totalSales > 0 
            ? ((branch.totalSales / report.totalSales) * 100).toFixed(1) 
            : 0;
        
        branchRows += `
        <tr class="${index === 0 ? 'top-branch' : ''}">
            <td>${index + 1}</td>
            <td>${branch.name}</td>
            <td>${formatCurrency(branch.totalSales)}</td>
            <td>${branch.salesCount}</td>
            <td>${formatCurrency(branch.averageSale)}</td>
            <td>${salesPercentage}%</td>
            <td>
                <div class="top-products-list">
                    ${topProductsList}
                </div>
            </td>
        </tr>`;
    });
}

// إنشاء محتوى التقرير
const reportHtml = `
<div class="report-container">
    <div class="report-header">
        <h3>تقرير مقارنة المبيعات بين الفروع</h3>
        <div class="report-period">الفترة: ${fromDateStr} إلى ${toDateStr}</div>
    </div>
    
    <div class="report-summary">
        <div class="summary-card">
            <div class="summary-title">إجمالي المبيعات</div>
            <div class="summary-value">${formatCurrency(report.totalSales)}</div>
        </div>
        <div class="summary-card">
            <div class="summary-title">عدد المعاملات</div>
            <div class="summary-value">${report.totalTransactions}</div>
        </div>
        <div class="summary-card">
            <div class="summary-title">متوسط المعاملة</div>
            <div class="summary-value">${report.totalTransactions > 0 
                ? formatCurrency(report.totalSales / report.totalTransactions) 
                : formatCurrency(0)}</div>
        </div>
        <div class="summary-card">
            <div class="summary-title">عدد الفروع النشطة</div>
            <div class="summary-value">${this.getActiveBranches().length}</div>
        </div>
    </div>
    
    <div class="sales-chart-container">
        <canvas id="branchSalesChart" width="400" height="200"></canvas>
    </div>
    
    <table class="report-table">
        <thead>
            <tr>
                <th>#</th>
                <th>اسم الفرع</th>
                <th>إجمالي المبيعات</th>
                <th>عدد المعاملات</th>
                <th>متوسط المعاملة</th>
                <th>النسبة</th>
                <th>المنتجات الأكثر مبيعاً</th>
            </tr>
        </thead>
        <tbody>
            ${branchRows}
        </tbody>
    </table>
    
    <div class="report-footer">
        <div class="report-generated">تم إنشاء التقرير في: ${new Date().toLocaleString('ar-SA')}</div>
        <div class="report-actions">
            <button class="btn btn-primary" id="print-comparison-report">
                <i class="fas fa-print"></i>
                طباعة التقرير
            </button>
            <button class="btn" id="export-comparison-report">
                <i class="fas fa-file-export"></i>
                تصدير إلى Excel
            </button>
        </div>
    </div>
</div>`;

// إضافة محتوى التقرير إلى الصفحة
container.innerHTML = reportHtml;

// إضافة CSS للتقرير
const style = document.createElement('style');
style.textContent = `
    .report-container {
        font-family: 'Tajawal', sans-serif;
        background-color: #fff;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        padding: 20px;
        margin-bottom: 30px;
    }
    
    .report-header {
        text-align: center;
        margin-bottom: 20px;
        padding-bottom: 15px;
        border-bottom: 2px solid #f0f0f0;
    }
    
    .report-period {
        color: #666;
        font-size: 14px;
        margin-top: 5px;
    }
    
    .report-summary {
        display: flex;
        justify-content: space-between;
        flex-wrap: wrap;
        margin-bottom: 20px;
    }
    
    .summary-card {
        flex: 1;
        min-width: 200px;
        background-color: #f9f9f9;
        border-radius: 6px;
        padding: 15px;
        margin: 0 5px 10px;
        text-align: center;
    }
    
    .summary-title {
        font-size: 14px;
        color: #777;
        margin-bottom: 5px;
    }
    
    .summary-value {
        font-size: 22px;
        font-weight: bold;
        color: #2c3e50;
    }
    
    .sales-chart-container {
        height: 300px;
        margin-bottom: 20px;
    }
    
    .report-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 20px;
    }
    
    .report-table th, .report-table td {
        padding: 12px 15px;
        text-align: right;
        border-bottom: 1px solid #e0e0e0;
    }
    
    .report-table th {
        background-color: #f5f5f5;
        font-weight: bold;
    }
    
    .report-table .top-branch {
        background-color: rgba(46, 204, 113, 0.1);
    }
    
    .top-products-list {
        max-height: 100px;
        overflow-y: auto;
    }
    
    .top-product {
        display: flex;
        justify-content: space-between;
        padding: 3px 0;
        border-bottom: 1px dashed #eee;
    }
    
    .top-product:last-child {
        border-bottom: none;
    }
    
    .product-name {
        font-size: 13px;
    }
    
    .product-quantity {
        font-size: 12px;
        color: #666;
    }
    
    .report-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 20px;
        padding-top: 15px;
        border-top: 2px solid #f0f0f0;
    }
    
    .report-generated {
        font-size: 12px;
        color: #777;
    }
    
    .report-actions {
        display: flex;
        gap: 10px;
    }
`;

document.head.appendChild(style);

// إنشاء الرسم البياني إذا كانت المكتبة متاحة
if (typeof Chart !== 'undefined') {
    // إعداد بيانات الرسم البياني
    const branchNames = report.branches.map(branch => branch.name);
    const branchSales = report.branches.map(branch => branch.totalSales);
    const branchTransactions = report.branches.map(branch => branch.salesCount);
    
    // إنشاء الرسم البياني
    const ctx = document.getElementById('branchSalesChart').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: branchNames,
            datasets: [
                {
                    label: 'المبيعات',
                    data: branchSales,
                    backgroundColor: 'rgba(46, 204, 113, 0.6)',
                    borderColor: 'rgba(46, 204, 113, 1)',
                    borderWidth: 1
                },
                {
                    label: 'عدد المعاملات',
                    data: branchTransactions,
                    backgroundColor: 'rgba(52, 152, 219, 0.6)',
                    borderColor: 'rgba(52, 152, 219, 1)',
                    borderWidth: 1,
                    type: 'line',
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'المبيعات'
                    }
                },
                y1: {
                    beginAtZero: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'عدد المعاملات'
                    },
                    grid: {
                        drawOnChartArea: false
                    }
                }
            }
        }
    });
}

// إضافة مستمعي أحداث للأزرار
document.getElementById('print-comparison-report').addEventListener('click', () => {
    this.printReport('تقرير مقارنة المبيعات بين الفروع');
});

document.getElementById('export-comparison-report').addEventListener('click', () => {
    this.exportReportToExcel('branch_comparison_report');
});
},

// إنشاء تقرير المخزون المنخفض
generateLowStockReportUI: function() {
    const report = this.generateLowStockReport();
    const container = document.getElementById('branch-report-container');
    if (!container) return;
    
    let branchSections = '';
    
    if (report.length === 0) {
        branchSections = '<div class="text-center">لا توجد فروع نشطة لعرض بيانات المخزون</div>';
    } else {
        report.forEach(branchReport => {
            let itemsRows = '';
            
            if (branchReport.items.length === 0) {
                itemsRows = '<tr><td colspan="5" class="text-center">لا توجد منتجات منخفضة المخزون في هذا الفرع</td></tr>';
            } else {
                branchReport.items.forEach(item => {
                    const stockStatus = item.quantity <= 0 ? 'out' : 'low';
                    itemsRows += `
                    <tr>
                        <td>${item.name}</td>
                        <td>${item.category || '-'}</td>
                        <td>${formatCurrency(item.price)}</td>
                        <td><span class="stock-status ${stockStatus}">${item.quantity}</span></td>
                        <td>${item.threshold}</td>
                    </tr>`;
                });
            }
            
            branchSections += `
            <div class="branch-stock-section">
                <h4>${branchReport.name}</h4>
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>المنتج</th>
                            <th>الفئة</th>
                            <th>السعر</th>
                            <th>الكمية الحالية</th>
                            <th>حد المخزون المنخفض</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsRows}
                    </tbody>
                </table>
            </div>`;
        });
    }
    
    const reportHtml = `
    <div class="report-container">
        <div class="report-header">
            <h3>تقرير المخزون المنخفض حسب الفروع</h3>
            <div class="report-period">تاريخ التقرير: ${new Date().toLocaleDateString('ar-SA')}</div>
        </div>
        
        <div class="report-summary">
            <div class="summary-card">
                <div class="summary-title">إجمالي المنتجات المنخفضة</div>
                <div class="summary-value">${report.reduce((sum, branch) => sum + branch.items.length, 0)}</div>
            </div>
            <div class="summary-card">
                <div class="summary-title">عدد الفروع</div>
                <div class="summary-value">${report.length}</div>
            </div>
            <div class="summary-card">
                <div class="summary-title">حد المخزون المنخفض</div>
                <div class="summary-value">${parseInt(localStorage.getItem('lowStockThreshold')) || 10}</div>
            </div>
        </div>
        
        <div class="branches-low-stock">
            ${branchSections}
        </div>
        
        <div class="report-footer">
            <div class="report-generated">تم إنشاء التقرير في: ${new Date().toLocaleString('ar-SA')}</div>
            <div class="report-actions">
                <button class="btn btn-primary" id="print-lowstock-report">
                    <i class="fas fa-print"></i>
                    طباعة التقرير
                </button>
                <button class="btn" id="export-lowstock-report">
                    <i class="fas fa-file-export"></i>
                    تصدير إلى Excel
                </button>
            </div>
        </div>
    </div>`;
    
    // إضافة محتوى التقرير إلى الصفحة
    container.innerHTML = reportHtml;
    
    // إضافة CSS للتقرير
    const style = document.createElement('style');
    style.textContent = `
        .branch-stock-section {
            margin-bottom: 30px;
            border-bottom: 1px solid #eee;
            padding-bottom: 20px;
        }
        
        .branch-stock-section h4 {
            margin-bottom: 15px;
            color: #34495e;
            font-size: 18px;
        }
        
        .stock-status {
            padding: 3px 8px;
            border-radius: 10px;
            font-weight: bold;
        }
        
        .stock-status.low {
            background-color: #fff3cd;
            color: #856404;
        }
        
        .stock-status.out {
            background-color: #f8d7da;
            color: #721c24;
        }
        
        .stock-status.good {
            background-color: #d4edda;
            color: #155724;
        }
    `;
    
    document.head.appendChild(style);
    
    // إضافة مستمعي أحداث للأزرار
    document.getElementById('print-lowstock-report').addEventListener('click', () => {
        this.printReport('تقرير المخزون المنخفض حسب الفروع');
    });
    
    document.getElementById('export-lowstock-report').addEventListener('click', () => {
        this.exportReportToExcel('low_stock_report');
    });
},

// إنشاء تقرير أداء الفروع
generatePerformanceReport: function() {
    const fromDateInput = document.getElementById('report-from-date').value;
    const toDateInput = document.getElementById('report-to-date').value;
    
    if (!fromDateInput || !toDateInput) {
        showNotification('يرجى تحديد نطاق التاريخ للتقرير', 'warning');
        return;
    }
    
    // تحويل التواريخ إلى كائنات Date
    const fromDate = new Date(fromDateInput);
    fromDate.setHours(0, 0, 0, 0);
    
    const toDate = new Date(toDateInput);
    toDate.setHours(23, 59, 59, 999);
    
    if (fromDate > toDate) {
        showNotification('تاريخ البداية يجب أن يكون قبل تاريخ النهاية', 'warning');
        return;
    }
    
    // الحصول على بيانات المبيعات
    const salesData = JSON.parse(localStorage.getItem('pos_sales')) || [];
    
    // جمع بيانات الأداء
    const branchPerformance = {};
    
    // تهيئة البيانات لكل فرع
    this.branches.forEach(branch => {
        if (!branch.isActive) return;
        
        branchPerformance[branch.id] = {
            id: branch.id,
            name: branch.name,
            salesByDay: {},
            salesByHour: Array(24).fill(0),
            totalSales: 0,
            transactionCount: 0,
            averageTransactionValue: 0,
            peakDay: null,
            peakHour: null,
            categories: {}
        };
    });
    
    // معالجة بيانات المبيعات
    salesData.forEach(sale => {
        // التحقق من أن البيع في النطاق الزمني المحدد وتابع لفرع معروف
        const saleDate = new Date(sale.date);
        if (saleDate >= fromDate && saleDate <= toDate && sale.branchId && branchPerformance[sale.branchId]) {
            const branchId = sale.branchId;
            const branch = branchPerformance[branchId];
            
            // إجمالي المبيعات وعدد المعاملات
            branch.totalSales += sale.total;
            branch.transactionCount++;
            
            // المبيعات حسب اليوم
            const dayKey = saleDate.toISOString().split('T')[0];
            if (!branch.salesByDay[dayKey]) {
                branch.salesByDay[dayKey] = {
                    count: 0,
                    total: 0
                };
            }
            branch.salesByDay[dayKey].count++;
            branch.salesByDay[dayKey].total += sale.total;
            
            // المبيعات حسب الساعة
            const hour = saleDate.getHours();
            branch.salesByHour[hour] += sale.total;
            
            // المبيعات حسب الفئة
            sale.items.forEach(item => {
                const product = products.find(p => p.id === item.id);
                if (product && product.category_id) {
                    const categoryId = product.category_id;
                    const category = categories.find(c => c.id === categoryId);
                    
                    if (!branch.categories[categoryId]) {
                        branch.categories[categoryId] = {
                            id: categoryId,
                            name: category ? category.name : `فئة #${categoryId}`,
                            total: 0,
                            count: 0
                        };
                    }
                    
                    branch.categories[categoryId].total += item.price * item.quantity;
                    branch.categories[categoryId].count += item.quantity;
                }
            });
        }
    });
    
    // حساب المؤشرات الإضافية لكل فرع
    Object.values(branchPerformance).forEach(branch => {
        // متوسط قيمة المعاملة
        branch.averageTransactionValue = branch.transactionCount > 0 
            ? branch.totalSales / branch.transactionCount 
            : 0;
        
        // ذروة المبيعات حسب اليوم
        let maxDayTotal = 0;
        let peakDayKey = null;
        
        Object.entries(branch.salesByDay).forEach(([day, data]) => {
            if (data.total > maxDayTotal) {
                maxDayTotal = data.total;
                peakDayKey = day;
            }
        });
        
        if (peakDayKey) {
            const peakDate = new Date(peakDayKey);
            branch.peakDay = {
                date: peakDayKey,
                dayName: peakDate.toLocaleDateString('ar-SA', { weekday: 'long' }),
                total: maxDayTotal,
                count: branch.salesByDay[peakDayKey].count
            };
        }
        
        // ذروة المبيعات حسب الساعة
        let maxHourTotal = 0;
        let peakHourIndex = 0;
        
        branch.salesByHour.forEach((total, hour) => {
            if (total > maxHourTotal) {
                maxHourTotal = total;
                peakHourIndex = hour;
            }
        });
        
        branch.peakHour = {
            hour: peakHourIndex,
            formattedHour: `${peakHourIndex}:00 - ${peakHourIndex + 1}:00`,
            total: maxHourTotal
        };
        
        // ترتيب الفئات حسب المبيعات
        branch.topCategories = Object.values(branch.categories)
            .sort((a, b) => b.total - a.total)
            .slice(0, 5);
    });
    
    // ترتيب الفروع حسب إجمالي المبيعات
    const sortedBranches = Object.values(branchPerformance)
        .sort((a, b) => b.totalSales - a.totalSales);
    
    // عرض التقرير
    this.displayPerformanceReport(sortedBranches, fromDate, toDate);
},

// عرض تقرير أداء الفروع
displayPerformanceReport: function(branchesPerformance, fromDate, toDate) {
    const container = document.getElementById('branch-report-container');
    if (!container) return;
    
    // تنسيق التواريخ
    const fromDateStr = fromDate.toLocaleDateString('ar-SA');
    const toDateStr = toDate.toLocaleDateString('ar-SA');
    
    let branchSections = '';
    
    if (branchesPerformance.length === 0) {
        branchSections = '<div class="text-center">لا توجد بيانات أداء للفروع في الفترة المحددة</div>';
    } else {
        branchesPerformance.forEach(branch => {
            // ترتيب أيام المبيعات
            const salesDaysArray = Object.entries(branch.salesByDay)
                .map(([date, data]) => {
                    const day = new Date(date);
                    return {
                        date,
                        dayName: day.toLocaleDateString('ar-SA', { weekday: 'long' }),
                        ...data
                    };
                })
                .sort((a, b) => new Date(a.date) - new Date(b.date));
            
            // إنشاء HTML لأفضل الفئات
            let topCategoriesHtml = '';
            if (branch.topCategories && branch.topCategories.length > 0) {
                branch.topCategories.forEach(category => {
                    topCategoriesHtml += `
                    <div class="category-item">
                        <div class="category-name">${category.name}</div>
                        <div class="category-total">${formatCurrency(category.total)}</div>
                    </div>`;
                });
            } else {
                topCategoriesHtml = '<div class="text-center">لا توجد بيانات فئات</div>';
            }
            
            branchSections += `
            <div class="branch-performance-section">
                <h4>${branch.name}</h4>
                
                <div class="performance-stats">
                    <div class="performance-card">
                        <div class="performance-title">إجمالي المبيعات</div>
                        <div class="performance-value">${formatCurrency(branch.totalSales)}</div>
                    </div>
                    <div class="performance-card">
                        <div class="performance-title">عدد المعاملات</div>
                        <div class="performance-value">${branch.transactionCount}</div>
                    </div>
                    <div class="performance-card">
                        <div class="performance-title">متوسط المعاملة</div>
                        <div class="performance-value">${formatCurrency(branch.averageTransactionValue)}</div>
                    </div>
                    <div class="performance-card">
                        <div class="performance-title">يوم الذروة</div>
                        <div class="performance-value">${branch.peakDay ? branch.peakDay.dayName : '-'}</div>
                    </div>
                    <div class="performance-card">
                        <div class="performance-title">ساعة الذروة</div>
                        <div class="performance-value">${branch.peakHour ? branch.peakHour.formattedHour : '-'}</div>
                    </div>
                </div>
                
                <div class="performance-charts">
                    <div class="chart-container">
                        <h5>المبيعات حسب اليوم</h5>
                        <canvas id="dayChart_${branch.id}" width="400" height="200"></canvas>
                    </div>
                    <div class="chart-container">
                        <h5>المبيعات حسب الساعة</h5>
                        <canvas id="hourChart_${branch.id}" width="400" height="200"></canvas>
                    </div>
                </div>
                
                <div class="top-categories">
                    <h5>أفضل الفئات مبيعاً</h5>
                    <div class="categories-container">
                        ${topCategoriesHtml}
                    </div>
                </div>
            </div>`;
        });
    }
    
    const reportHtml = `
    <div class="report-container">
        <div class="report-header">
            <h3>تقرير أداء الفروع</h3>
            <div class="report-period">الفترة: ${fromDateStr} إلى ${toDateStr}</div>
        </div>
        
        <div class="branches-performance">
            ${branchSections}
        </div>
        
        <div class="report-footer">
            <div class="report-generated">تم إنشاء التقرير في: ${new Date().toLocaleString('ar-SA')}</div>
            <div class="report-actions">
                <button class="btn btn-primary" id="print-performance-report">
                    <i class="fas fa-print"></i>
                    طباعة التقرير
                </button>
                <button class="btn" id="export-performance-report">
                    <i class="fas fa-file-export"></i>
                    تصدير إلى Excel
                </button>
            </div>
        </div>
    </div>`;
    
    // إضافة محتوى التقرير إلى الصفحة
    container.innerHTML = reportHtml;
    
    // إضافة CSS للتقرير
    const style = document.createElement('style');
    style.textContent = `
        .branch-performance-section {
            margin-bottom: 40px;
            border-bottom: 2px solid #eee;
            padding-bottom: 20px;
        }
        
        .branch-performance-section h4 {
            margin-bottom: 20px;
            color: #34495e;
            font-size: 20px;
            border-bottom: 1px solid #ddd;
            padding-bottom: 10px;
        }
        
        .performance-stats {
            display: flex;
            flex-wrap: wrap;
            justify-content: space-between;
            margin-bottom: 20px;
        }
        
        .performance-card {
            flex: 1;
            min-width: 150px;
            background-color: #f9f9f9;
            border-radius: 6px;
            padding: 15px;
            margin: 0 5px 10px;
            text-align: center;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        
        .performance-title {
            font-size: 13px;
            color: #666;
            margin-bottom: 5px;
        }
        
        .performance-value {
            font-size: 18px;
            font-weight: bold;
            color: #2c3e50;
        }
        
        .performance-charts {
            display: flex;
            flex-wrap: wrap;
            gap: 20px;
            margin-bottom: 20px;
        }
       .chart-container {
            flex: 1;
            min-width: 300px;
            background-color: #fff;
            border-radius: 6px;
            padding: 15px;
            box-shadow: 0 1px 5px rgba(0,0,0,0.1);
        }
        
        .chart-container h5 {
            text-align: center;
            margin-bottom: 15px;
            color: #555;
        }
        
        .top-categories {
            background-color: #f9f9f9;
            border-radius: 6px;
            padding: 15px;
            margin-top: 20px;
        }
        
        .top-categories h5 {
            text-align: center;
            margin-bottom: 15px;
            color: #555;
        }
        
        .categories-container {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
        }
        
        .category-item {
            flex: 1;
            min-width: 150px;
            background-color: #fff;
            border-radius: 6px;
            padding: 10px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        
        .category-name {
            font-size: 13px;
            color: #555;
            margin-bottom: 5px;
        }
        
        .category-total {
            font-size: 16px;
            font-weight: bold;
            color: #2c3e50;
        }
    `;
    
    document.head.appendChild(style);
    
    // إنشاء الرسوم البيانية إذا كانت المكتبة متاحة
    if (typeof Chart !== 'undefined') {
        branchesPerformance.forEach(branch => {
            // إنشاء بيانات الرسم البياني للأيام
            const dayLabels = [];
            const daySalesData = [];
            const dayCountData = [];
            
            // ترتيب أيام المبيعات
            const salesDaysArray = Object.entries(branch.salesByDay)
                .map(([date, data]) => {
                    const day = new Date(date);
                    return {
                        date,
                        dayName: day.toLocaleDateString('ar-SA', { weekday: 'long' }),
                        ...data
                    };
                })
                .sort((a, b) => new Date(a.date) - new Date(b.date));
            
            salesDaysArray.forEach(dayData => {
                dayLabels.push(dayData.dayName);
                daySalesData.push(dayData.total);
                dayCountData.push(dayData.count);
            });
            
            // إنشاء الرسم البياني للأيام
            const dayCtx = document.getElementById(`dayChart_${branch.id}`);
            if (dayCtx) {
                new Chart(dayCtx, {
                    type: 'bar',
                    data: {
                        labels: dayLabels,
                        datasets: [
                            {
                                label: 'المبيعات',
                                data: daySalesData,
                                backgroundColor: 'rgba(46, 204, 113, 0.6)',
                                borderColor: 'rgba(46, 204, 113, 1)',
                                borderWidth: 1
                            },
                            {
                                label: 'عدد المعاملات',
                                data: dayCountData,
                                backgroundColor: 'rgba(52, 152, 219, 0.6)',
                                borderColor: 'rgba(52, 152, 219, 1)',
                                borderWidth: 1,
                                type: 'line',
                                yAxisID: 'y1'
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            y: {
                                beginAtZero: true,
                                title: {
                                    display: true,
                                    text: 'المبيعات'
                                }
                            },
                            y1: {
                                beginAtZero: true,
                                position: 'right',
                                title: {
                                    display: true,
                                    text: 'عدد المعاملات'
                                },
                                grid: {
                                    drawOnChartArea: false
                                }
                            }
                        }
                    }
                });
            }
            
            // إنشاء بيانات الرسم البياني للساعات
            const hourLabels = [];
            const hourSalesData = [];
            
            for (let i = 0; i < 24; i++) {
                hourLabels.push(`${i}:00`);
                hourSalesData.push(branch.salesByHour[i] || 0);
            }
            
            // إنشاء الرسم البياني للساعات
            const hourCtx = document.getElementById(`hourChart_${branch.id}`);
            if (hourCtx) {
                new Chart(hourCtx, {
                    type: 'line',
                    data: {
                        labels: hourLabels,
                        datasets: [
                            {
                                label: 'المبيعات حسب الساعة',
                                data: hourSalesData,
                                backgroundColor: 'rgba(155, 89, 182, 0.2)',
                                borderColor: 'rgba(155, 89, 182, 1)',
                                borderWidth: 2,
                                tension: 0.2,
                                fill: true
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            y: {
                                beginAtZero: true
                            }
                        }
                    }
                });
            }
        });
    }
    
    // إضافة مستمعي أحداث للأزرار
    document.getElementById('print-performance-report').addEventListener('click', () => {
        this.printReport('تقرير أداء الفروع');
    });
    
    document.getElementById('export-performance-report').addEventListener('click', () => {
        this.exportReportToExcel('branch_performance_report');
    });
},

// طباعة التقرير
printReport: function(title) {
    const reportContainer = document.querySelector('.report-container');
    
    if (!reportContainer) {
        showNotification('لا يوجد محتوى للطباعة', 'error');
        return;
    }
    
    // إنشاء نافذة طباعة جديدة
    const printWindow = window.open('', '_blank');
    
    // إنشاء محتوى HTML للطباعة
    const printContent = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
        <meta charset="UTF-8">
        <title>${title}</title>
        <style>
            @media print {
                body {
                    font-family: 'Tajawal', Arial, sans-serif;
                    margin: 0;
                    padding: 20px;
                    color: #333;
                }
                
                h3 {
                    text-align: center;
                    margin-bottom: 10px;
                }
                
                .report-period {
                    text-align: center;
                    margin-bottom: 20px;
                    font-size: 14px;
                    color: #666;
                }
                
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 20px;
                }
                
                th, td {
                    padding: 8px;
                    text-align: right;
                    border: 1px solid #ddd;
                }
                
                th {
                    background-color: #f2f2f2;
                    font-weight: bold;
                }
                
                .summary-card {
                    display: inline-block;
                    width: 22%;
                    margin: 0 1% 15px;
                    padding: 10px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    text-align: center;
                }
                
                .summary-title {
                    font-size: 12px;
                    color: #666;
                    margin-bottom: 5px;
                }
                
                .summary-value {
                    font-size: 16px;
                    font-weight: bold;
                }
                
                .report-footer {
                    margin-top: 30px;
                    text-align: center;
                    font-size: 12px;
                    color: #666;
                }
                
                .chart-container {
                    display: none; /* إخفاء الرسوم البيانية عند الطباعة */
                }
            }
        </style>
    </head>
    <body>
        ${reportContainer.outerHTML}
        <script>
            window.onload = function() {
                window.print();
                setTimeout(function() {
                    window.close();
                }, 500);
            };
        </script>
    </body>
    </html>`;
    
    printWindow.document.open();
    printWindow.document.write(printContent);
    printWindow.document.close();
},

// تصدير التقرير إلى Excel
exportReportToExcel: function(filename) {
    // التحقق من وجود مكتبة XLSX
    if (typeof XLSX === 'undefined') {
        showNotification('مكتبة Excel غير متاحة، يرجى تثبيتها أولاً', 'error');
        return;
    }
    
    // إنشاء جدول البيانات من محتوى الجدول
    const tables = document.querySelectorAll('.report-table');
    
    if (tables.length === 0) {
        showNotification('لا توجد بيانات للتصدير', 'error');
        return;
    }
    
    try {
        const workbook = XLSX.utils.book_new();
        
        // إضافة ورقة عمل لكل جدول
        tables.forEach((table, index) => {
            const worksheet = XLSX.utils.table_to_sheet(table);
            XLSX.utils.book_append_sheet(workbook, worksheet, `Sheet${index + 1}`);
        });
        
        // تحميل الملف
        XLSX.writeFile(workbook, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
        
        showNotification('تم تصدير التقرير بنجاح', 'success');
    } catch (error) {
        console.error('خطأ في تصدير التقرير:', error);
        showNotification('حدث خطأ أثناء تصدير التقرير', 'error');
    }
},

// تحديث عرض المعاملات المعلقة
updatePendingTransactionsDisplay: function() {
    const pendingList = document.getElementById('pending-transactions-list');
    const pendingCount = document.getElementById('pending-count');
    
    if (!pendingList || !pendingCount) return;
    
    // تحديث عدد المعاملات المعلقة
    pendingCount.textContent = `(${this.pendingTransactions.length})`;
    
    if (this.pendingTransactions.length === 0) {
        pendingList.innerHTML = '<div class="empty-list">لا توجد معاملات معلقة</div>';
        return;
    }
    
    // عرض المعاملات المعلقة بالترتيب
    let pendingHtml = '';
    
    this.pendingTransactions.forEach((transaction, index) => {
        const typeLabel = (() => {
            switch (transaction.type) {
                case 'branch': return 'بيانات فرع';
                case 'branch_status': return 'حالة فرع';
                case 'inventory': return 'مخزون';
                case 'sale': return 'مبيعات';
                default: return transaction.type;
            }
        })();
        
        const actionLabel = (() => {
            switch (transaction.action) {
                case 'add': return 'إضافة';
                case 'update': return 'تحديث';
                case 'delete': return 'حذف';
                case 'transfer': return 'نقل';
                default: return transaction.action;
            }
        })();
        
        const date = new Date(transaction.timestamp).toLocaleString('ar-SA');
        
        pendingHtml += `
        <div class="pending-transaction">
            <div class="transaction-header">
                <span class="transaction-index">${index + 1}</span>
                <span class="transaction-label">${actionLabel} ${typeLabel}</span>
                <span class="transaction-date">${date}</span>
            </div>
            <div class="transaction-details">
                <pre>${JSON.stringify(transaction.data, null, 2)}</pre>
            </div>
        </div>`;
    });
    
    pendingList.innerHTML = pendingHtml;
    
    // إضافة CSS للمعاملات المعلقة
    const style = document.createElement('style');
    style.textContent = `
        .empty-list {
            text-align: center;
            padding: 20px;
            color: #777;
            background-color: #f9f9f9;
            border-radius: 4px;
        }
        
        .pending-transaction {
            margin-bottom: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            overflow: hidden;
        }
        
        .transaction-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 12px;
            background-color: #f5f5f5;
            border-bottom: 1px solid #ddd;
        }
        
        .transaction-index {
            background-color: #34495e;
            color: white;
            padding: 2px 6px;
            border-radius: 10px;
            font-size: 12px;
        }
        
        .transaction-label {
            font-weight: bold;
        }
        
        .transaction-date {
            font-size: 12px;
            color: #777;
        }
        
        .transaction-details {
            padding: 10px;
            background-color: #fff;
            max-height: 150px;
            overflow-y: auto;
        }
        
        .transaction-details pre {
            margin: 0;
            white-space: pre-wrap;
            font-size: 12px;
            color: #333;
        }
    `;
    
    document.head.appendChild(style);
},

// مزامنة جميع البيانات
syncAllData: function() {
    if (this.offlineMode) {
        showNotification('أنت في وضع عدم الاتصال، لا يمكن مزامنة البيانات', 'warning');
        return;
    }
    
    this.isSyncing = true;
    updateSyncIndicator(true);
    
    // مزامنة الفروع
    this.fetchBranchesFromFirebase();
    
    // مزامنة المخزون
    this.fetchAllBranchesInventory();
    
    // مزامنة المبيعات
    this.syncBranchSalesData();
    
    // معالجة المعاملات المعلقة
    this.processPendingTransactions();
    
    setTimeout(() => {
        this.isSyncing = false;
        updateSyncIndicator(false);
        showNotification('تمت مزامنة البيانات بنجاح', 'success');
    }, 2000);
},

// مزامنة بيانات المبيعات
syncBranchSalesData: function() {
    if (this.offlineMode) {
        showNotification('أنت في وضع عدم الاتصال، لا يمكن مزامنة بيانات المبيعات', 'warning');
        return;
    }
    
    this.isSyncing = true;
    updateSyncIndicator(true);
    
    // الحصول على بيانات المبيعات المحلية
    const salesData = JSON.parse(localStorage.getItem('pos_sales')) || [];
    
    // مزامنة المبيعات لكل فرع
    const promises = [];
    
    this.branches.forEach(branch => {
        // تصفية المبيعات التابعة لهذا الفرع
        const branchSales = salesData.filter(sale => sale.branchId === branch.id);
        
        if (branchSales.length > 0) {
            // بناء مجموعة المبيعات للفرع
            const salesObj = {};
            branchSales.forEach(sale => {
                salesObj[sale.id] = sale;
            });
            
            // مزامنة المبيعات مع Firebase
            const promise = this.firebaseDB.ref(`branches/${branch.id}/sales`).update(salesObj)
                .then(() => {
                    console.log(`تمت مزامنة ${branchSales.length} عملية بيع لفرع "${branch.name}"`);
                    return branch.id;
                })
                .catch(error => {
                    console.error(`خطأ في مزامنة مبيعات فرع "${branch.name}":`, error);
                    throw error;
                });
            
            promises.push(promise);
        }
    });
    
    Promise.all(promises)
        .then(results => {
            console.log(`تمت مزامنة المبيعات لـ ${results.length} فرع بنجاح`);
            showNotification('تمت مزامنة بيانات المبيعات بنجاح', 'success');
        })
        .catch(error => {
            console.error("خطأ في مزامنة بيانات المبيعات:", error);
            showNotification('حدث خطأ أثناء مزامنة بيانات المبيعات', 'error');
        })
        .finally(() => {
            this.isSyncing = false;
            updateSyncIndicator(false);
        });
}
};

// دالة مساعدة لتنسيق العملة
function formatCurrency(amount) {
    return new Intl.NumberFormat('ar-SA', {
        style: 'currency',
        currency: 'SAR'
    }).format(amount);
}

// دالة مساعدة لعرض الإشعارات
function showNotification(message, type = 'info') {
    if (typeof window.showToast === 'function') {
        window.showToast(message, type);
    } else {
        console.log(`[${type.toUpperCase()}] ${message}`);
        
        // إنشاء إشعار بسيط إذا لم تكن دالة showToast متاحة
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('show');
            
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => {
                    document.body.removeChild(toast);
                }, 300);
            }, 3000);
        }, 100);
    }
}

// دالة مساعدة لتحديث مؤشر الاتصال
function updateConnectionIndicator(isOnline) {
    const indicator = document.getElementById('connection-indicator');
    if (!indicator) return;
    
    const icon = indicator.querySelector('i');
    const text = indicator.querySelector('span');
    
    if (isOnline) {
        icon.className = 'fas fa-circle connection-online';
        text.textContent = 'متصل';
    } else {
        icon.className = 'fas fa-circle connection-offline';
        text.textContent = 'غير متصل';
    }
}

// دالة مساعدة لتحديث مؤشر المزامنة
function updateSyncIndicator(isSyncing) {
    const indicator = document.getElementById('sync-indicator');
    if (!indicator) return;
    
    if (isSyncing) {
        indicator.classList.add('syncing');
    } else {
        indicator.classList.remove('syncing');
    }
}

// إضافة زر إدارة الفروع إلى القائمة الجانبية
function addBranchManagerMenuButton() {
    const sidebar = document.querySelector('.sidebar-menu');
    if (!sidebar) return;
    
    const menuItem = document.createElement('li');
    menuItem.innerHTML = `
        <a href="#" id="branch-manager-menu">
            <i class="fas fa-code-branch"></i>
            <span>إدارة الفروع</span>
        </a>
    `;
    
    sidebar.appendChild(menuItem);
    
    // إضافة مستمع الأحداث لفتح نافذة إدارة الفروع
    document.getElementById('branch-manager-menu').addEventListener('click', () => {
        branchManager.openBranchManagerModal();
    });
}

// تحميل وحدة إدارة الفروع عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    // تهيئة وحدة إدارة الفروع
    window.branchManager = branchManager.init();
    
    // إضافة زر إدارة الفروع إلى القائمة
    addBranchManagerMenuButton();
    
    console.log('تم تحميل وحدة إدارة الفروع بنجاح');
});