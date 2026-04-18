# 🚀 التحسينات المطلوبة للداشبورد

## الميزات المطلوبة:

### 1️⃣ المقاسات الديناميكية
- ✅ مقاسات جاهزة: L, XL, 2XL, 3XL, 4XL, 5XL, 6XL, 7XL, 8XL
- ✅ إضافة مقاسات مخصصة (text field)
- ✅ حذف المقاسات المخصصة
- ✅ ترتيب المقاسات

### 2️⃣ الأسعار الديناميكية
- ✅ إضافة عروض أسعار غير محدودة (مش 4 بس)
- ✅ حذف عرض سعر
- ✅ إعادة ترتيب العروض (أزرار ↑ ↓)
- ✅ تطبيق على العربي والإنجليزي

### 3️⃣ إدارة صور المعرض
- ✅ حذف صورة واحدة من المعرض
- ✅ إعادة ترتيب الصور (drag & drop)
- ✅ عرض رقم الترتيب على كل صورة
- ✅ رفع أكثر من 4 صور

### 4️⃣ ترتيب المنتجات
- ⏳ drag & drop لترتيب المنتجات في الداشبورد
- ⏳ حفظ الترتيب في `display_order` column
- ⏳ عرض المنتجات حسب الترتيب في الموقع

---

## الملفات المُعدّلة:

### ✅ تم إنشاؤها:
1. **product-form-enhanced.js** - JavaScript للـ form المحسّن
   - إدارة المقاسات الديناميكية
   - إدارة الأسعار الديناميكية
   - إدارة صور المعرض مع drag & drop

2. **blocked-setup.sql** - تحديث قاعدة البيانات
   - إضافة `display_order` column للمنتجات
   - تحديث تعليقات المقاسات

3. **supabase.js** - دوال جديدة
   - `updateProductOrder()` - تحديث ترتيب منتج
   - `deleteProductImage()` - حذف صورة واحدة
   - تحديث `fetchAllProducts()` للترتيب حسب `display_order`
   - تحديث `updateProduct()` لدعم `display_order`

---

## التعديلات المطلوبة على admin.html:

### 1. إضافة السكريبت الجديد
في نهاية `<body>` قبل `</body>`:
```html
<script src="product-form-enhanced.js"></script>
```

### 2. تعديل قسم المقاسات في الـ form
استبدال:
```html
<div class="pf-section">
    <div class="pf-section-title">المقاسات المتاحة</div>
    <div class="pf-sizes">
        <input type="checkbox" id="pfSize_L" ...>
        <!-- ... -->
    </div>
</div>
```

بـ:
```html
<div class="pf-section">
    <div class="pf-section-title">المقاسات المتاحة</div>
    <div id="pfSizesContainer"></div>
</div>
```

### 3. تعديل قسم الأسعار - عربي
استبدال كل قسم الأسعار العربي بـ:
```html
<div class="pf-section">
    <div class="pf-section-title">الأسعار — عربي</div>
    <div id="pfPricingArContainer"></div>
</div>
```

### 4. تعديل قسم الأسعار - إنجليزي
استبدال كل قسم الأسعار الإنجليزي بـ:
```html
<div class="pf-section">
    <div class="pf-section-title">الأسعار — إنجليزي</div>
    <div id="pfPricingEnContainer"></div>
</div>
```

### 5. تعديل قسم صور المعرض
استبدال:
```html
<input type="file" id="pfGalleryInput" accept="image/*" multiple onchange="previewGalleryImages(this)">
```

بـ:
```html
<input type="file" id="pfGalleryInput" accept="image/*" multiple onchange="handleGalleryFiles(this)">
```

### 6. تعديل دالة `openProductModal`
استبدال الكود الحالي بـ:
```javascript
function openProductModal(product) {
    const isEdit = !!product;
    const modal = document.getElementById('productFormModal');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Reset form
    document.getElementById('pfNameAr').value     = product?.name?.ar || '';
    document.getElementById('pfNameEn').value     = product?.name?.en || '';
    document.getElementById('pfSlug').value       = product?.slug || '';
    document.getElementById('pfCode').value       = product?.code || '';
    document.getElementById('pfDescAr').value     = product?.description?.ar || '';
    document.getElementById('pfDescEn').value     = product?.description?.en || '';
    document.getElementById('pfFeatured').checked = product?.featured || false;

    // Load dynamic fields
    loadProductDataToForm(product);

    // Main image preview
    document.getElementById('pfMainPreview').src = product?.main_image_url || '';
    document.getElementById('pfMainPreview').style.display = product?.main_image_url ? 'block' : 'none';
    document.getElementById('pfMainInput').value = '';

    document.getElementById('pfModalTitle').textContent = isEdit ? 'تعديل المنتج' : 'إضافة منتج جديد';
    document.getElementById('pfSaveBtn').textContent    = isEdit ? 'حفظ التعديلات' : 'إضافة المنتج';
}
```

### 7. تعديل دالة `saveProduct`
استبدال جزء الأسعار والمقاسات بـ:
```javascript
// Get dynamic form data
const formData = getProductFormData();
const sizes = formData.sizes;
const pricingAr = formData.pricingAr;
const pricingEn = formData.pricingEn;

// ... باقي الكود ...

// Upload gallery images
let galleryUrls = [];
for (let i = 0; i < formData.galleryImages.length; i++) {
    const img = formData.galleryImages[i];
    if (img.file) {
        // New file - upload it
        const ext = img.file.name.split('.').pop();
        const fileName = `${slug}/${i+1}.${ext}`;
        const url = await uploadProductImage(img.file, fileName);
        galleryUrls.push(url);
    } else {
        // Existing URL - keep it
        galleryUrls.push(img.url);
    }
}
```

### 8. إضافة drag & drop للمنتجات في الداشبورد
في دالة `renderProductsManagement()`, أضف:
```javascript
grid.innerHTML = _pmProducts.map((p, i) => {
    const imgSrc = p.main_image_url || 'images/dalal-logo.png';
    
    return `<div class="pm-card" draggable="true" data-product-id="${p.id}" data-index="${i}"
                 ondragstart="handleProductDragStart(event, ${i})"
                 ondragover="handleProductDragOver(event)"
                 ondrop="handleProductDrop(event, ${i})"
                 ondragend="handleProductDragEnd(event)">
        ${p.featured ? '<div class="pm-badge-featured">⭐ مميز</div>' : ''}
        <div class="pm-drag-handle" style="position:absolute;top:8px;left:8px;cursor:move;color:var(--text-dim);font-size:1.2rem;">⋮⋮</div>
        <img src="${imgSrc}" alt="${p.name.ar}" class="pm-card-img" onerror="this.src='images/dalal-logo.png'">
        <!-- ... باقي الكود ... -->
    </div>`;
}).join('');
```

وأضف الدوال:
```javascript
let _draggedProductIndex = null;

window.handleProductDragStart = function(e, index) {
    _draggedProductIndex = index;
    e.target.style.opacity = '0.5';
};

window.handleProductDragOver = function(e) {
    e.preventDefault();
};

window.handleProductDrop = async function(e, dropIndex) {
    e.preventDefault();
    if (_draggedProductIndex === null || _draggedProductIndex === dropIndex) return;
    
    // Reorder array
    const [removed] = _pmProducts.splice(_draggedProductIndex, 1);
    _pmProducts.splice(dropIndex, 0, removed);
    
    // Update display_order in database
    for (let i = 0; i < _pmProducts.length; i++) {
        await updateProductOrder(_pmProducts[i].id, i);
    }
    
    renderProductsManagement();
    showAdminToast('✅ تم تحديث ترتيب المنتجات');
};

window.handleProductDragEnd = function(e) {
    e.target.style.opacity = '1';
    _draggedProductIndex = null;
};
```

---

## الخطوات للتطبيق:

1. ✅ شغّل SQL الجديد في Supabase (من `blocked-setup.sql`)
2. ⏳ عدّل `admin.html` حسب التعديلات أعلاه
3. ⏳ أضف `<script src="product-form-enhanced.js"></script>` في `admin.html`
4. ⏳ اختبر الميزات الجديدة
5. ⏳ Deploy

---

## ملاحظات:

- الكود الحالي في `admin.html` كبير جداً (3342 سطر)
- التعديلات المطلوبة معقدة وتحتاج دقة
- يُفضل عمل backup قبل التعديل
- يمكن تطبيق الميزات تدريجياً (واحدة واحدة)

---

## هل تريد:
1. ملف `admin.html` كامل معدّل؟ (سيكون كبير جداً)
2. تطبيق الميزات واحدة واحدة؟
3. إنشاء صفحة منفصلة للـ product form؟
