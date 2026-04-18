# 🚀 دليل نقل المنتجات إلى Supabase

## الوضع الحالي
- ✅ الصور موجودة في Supabase Storage (bucket: `products`)
- ✅ الفولدرات: 4، 5، 6، 7، 77، 8
- ✅ البيانات موجودة في `products.json`
- ✅ الكود معدّل ليستخدم Supabase

---

## الخطوات المطلوبة

### 1️⃣ تشغيل SQL في Supabase
افتح Supabase SQL Editor وشغّل الكود الموجود في `blocked-setup.sql` (كل الملف من أوله لآخره).

الـ SQL يحتوي على:
- إنشاء جداول المنتجات (products, product_images, product_pricing)
- إنشاء جدول product_stock
- إضافة Storage Policies للـ bucket `products`

### 2️⃣ نقل البيانات من products.json إلى Supabase
افتح الملف `migrate-products.html` في المتصفح:
```
https://www.dalalwear.shop/migrate-products.html
```

اضغط على زر "ابدأ النقل" وانتظر حتى تكتمل العملية.

السكريبت سيقوم بـ:
- قراءة المنتجات من `products.json`
- تحويل مسارات الصور من `images/models/X` إلى Supabase Storage URLs
- إضافة المنتجات إلى قاعدة البيانات
- إضافة الأسعار (4 عروض لكل لغة)
- إضافة صور المعرض
- تعيين حالة المخزون (متوفر)

### 3️⃣ التحقق من النقل
افتح الداشبورد → المنتجات وتأكد من ظهور جميع المنتجات الـ 6.

### 4️⃣ Deploy
```bash
git add .
git commit -m "Migrate products to Supabase with Storage integration"
git push
```

---

## ملاحظات مهمة

### ✅ ما تم تعديله:
1. **products-data.js**: يحمل من Supabase أولاً، ثم يرجع لـ `products.json` كـ fallback
2. **product.js**: يستخدم `main_image_url` و `gallery` URLs من Supabase
3. **admin.html**: لوحة إدارة كاملة للمنتجات مع إمكانية الإضافة والتعديل والحذف
4. **supabase.js**: دوال كاملة لإدارة المنتجات

### 🎯 الصور:
- الصور الموجودة في Supabase Storage ستُستخدم تلقائياً
- **يدعم جميع صيغ الصور**: jpg, jpeg, png, webp, gif, svg, إلخ
- مسارات الصور: `https://wnzueymobiwecuikwcgx.supabase.co/storage/v1/object/public/products/X/pic.{ext}`
- حيث X هو رقم الفولدر (4، 5، 6، 7، 77، 8)
- الامتداد يُحفظ تلقائياً من الملف الأصلي

### 📦 بعد النقل:
- يمكنك حذف `products.json` (اختياري - الكود يستخدمه كـ fallback فقط)
- يمكنك حذف `migrate-products.html` (بعد اكتمال النقل)
- فولدر `images/models/` يمكن الاحتفاظ به أو حذفه (الصور في Supabase الآن)

### 🔄 إضافة منتجات جديدة:
من الداشبورد → المنتجات → إضافة منتج جديد:
1. املأ البيانات (اسم، كود، وصف، إلخ)
2. ارفع الصورة الرئيسية (pic) - **أي صيغة: jpg, png, webp, إلخ**
3. ارفع صور المعرض (1-4) - **أي صيغة**
4. الصور ستُرفع تلقائياً على Supabase Storage **بنفس صيغتها الأصلية**
5. البيانات ستُحفظ في قاعدة البيانات

**ملاحظة:** النظام يحفظ الصور بأسمائها (pic, 1, 2, 3, 4) مع الاحتفاظ بالامتداد الأصلي. مثلاً:
- إذا رفعت `photo.jpg` كصورة رئيسية → ستُحفظ كـ `pic.jpg`
- إذا رفعت `image.webp` كصورة معرض → ستُحفظ كـ `1.webp`

---

## استكشاف الأخطاء

### المنتجات لا تظهر في الموقع:
- تأكد من تشغيل SQL في Supabase
- تأكد من اكتمال النقل عبر `migrate-products.html`
- افتح Console في المتصفح وتحقق من الأخطاء

### الصور لا تظهر:
- تأكد من أن الصور موجودة في Supabase Storage
- تأكد من أن الـ bucket اسمه `products` وهو public
- تأكد من تشغيل Storage Policies في SQL

### خطأ في الداشبورد:
- تأكد من تسجيل الدخول
- افتح Console وتحقق من رسائل الخطأ
- تأكد من أن Supabase URL و Key صحيحين في `supabase.js`

---

## الدعم
إذا واجهت أي مشكلة، تحقق من:
1. Supabase SQL Editor → تأكد من تشغيل جميع الـ SQL
2. Supabase Storage → تأكد من وجود bucket `products` وأنه public
3. Console في المتصفح → ابحث عن رسائل الخطأ
