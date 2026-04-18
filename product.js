/* ═══════════════════════════════════════════════════════════════
   DALAL — Dynamic Product Detail Page
   ═══════════════════════════════════════════════════════════════ */

let currentProduct   = null;
let selectedQtyOption  = null;
let selectedSize       = null;

/* ─── Load product reviews ─── */
async function loadProductReviews(product, lang) {
    const isAr = lang === 'ar';
    const PER_PAGE = 3;

    try {
        const db = await getSupabase();
        const { data: reviews } = await db
            .from('reviews')
            .select('*')
            .eq('is_visible', true)
            .eq('product_id', product.id)
            .order('created_at', { ascending: false })
            .limit(50);

        const section  = document.getElementById('productReviewsSection');
        const grid     = document.getElementById('productReviewsGrid');
        const titleEl  = document.getElementById('productReviewsTitle');
        const writeBtn = document.getElementById('writeReviewBtn');
        const writeLbl = document.getElementById('writeReviewLabel');

        if (titleEl) titleEl.textContent = isAr ? 'تقييمات المنتج' : 'Product Reviews';
        if (writeLbl) writeLbl.textContent = isAr ? 'اكتبي تقييمك' : 'Write a Review';
        if (writeBtn) {
            writeBtn.href = `review.html?pid=${product.id}&lang=${lang}`;
        }
        if (section) section.style.display = '';

        if (!reviews || !reviews.length) {
            if (grid) grid.innerHTML = `<p style="font-size:0.85rem;color:var(--text-dim);padding:0.5rem 0">${isAr ? 'لا توجد تقييمات بعد — كوني أول من يقيّم!' : 'No reviews yet — be the first!'}</p>`;
            return;
        }

        // ─── Rating summary (only shown when reviews exist) ───
        const avg     = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
        const avgStr  = avg.toFixed(1);
        const count   = reviews.length;
        const fullStars = Math.round(avg);
        const starsHTML = Array.from({length:5},(_,i) =>
            `<svg width="15" height="15" viewBox="0 0 24 24" fill="${i<fullStars?'#E0C097':'none'}" stroke="#E0C097" stroke-width="1.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`
        ).join('');

        // Update JSON-LD with aggregateRating
        if (window._productSchema && window._productSchemaElement) {
            window._productSchema.aggregateRating = {
                '@type': 'AggregateRating',
                ratingValue: avgStr,
                reviewCount: count,
                bestRating: '5',
                worstRating: '1'
            };
            window._productSchemaElement.textContent = JSON.stringify(window._productSchema);
        }

        const summaryHTML = `<div style="display:inline-flex;align-items:center;gap:0.5rem;flex-wrap:wrap;padding:0.5rem 0.85rem;background:var(--bg-light);border:1px solid var(--border);border-radius:var(--r-lg);"><span style="font-size:1.1rem;font-weight:700;color:var(--gold);font-family:'Poppins',sans-serif;">${avgStr}</span><div style="display:flex;gap:2px;direction:ltr;">${starsHTML}</div><span style="font-size:0.75rem;color:var(--text-dim);">${count} ${isAr ? 'تقييم' : count === 1 ? 'review' : 'reviews'}</span></div>`;

        const summaryEl = document.getElementById('productRatingSummary');
        const summaryMobileEl = document.getElementById('productRatingSummaryMobile');
        if (summaryEl)       { summaryEl.innerHTML = summaryHTML;       summaryEl.style.display = ''; }
        if (summaryMobileEl) { summaryMobileEl.innerHTML = summaryHTML; summaryMobileEl.style.display = ''; }
        // Sort: pinned first, then verified buyers, then rest
        const sorted = [...reviews].sort((a, b) => {
            if (b.is_pinned !== a.is_pinned) return (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0);
            if (!!b.order_ref !== !!a.order_ref) return !!b.order_ref ? 1 : -1;
            return 0;
        });

        const renderCard = (r) => {
            const stars = Array.from({length:5},(_,i) =>
                `<svg width="13" height="13" viewBox="0 0 24 24" fill="${i<r.rating?'#E0C097':'none'}" stroke="#E0C097" stroke-width="1.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`
            ).join('');
            const name = r.reviewer_name || (isAr ? 'عميلة مجهولة' : 'Anonymous');
            const date = new Date(r.created_at).toLocaleDateString(isAr?'ar-EG':'en-US',{month:'short',year:'numeric'});
            const verifiedBadge = r.order_ref
                ? `<span style="display:inline-flex;align-items:center;gap:0.25rem;font-size:0.65rem;font-weight:600;color:#4caf7d;background:rgba(76,175,125,0.1);border:1px solid rgba(76,175,125,0.25);border-radius:20px;padding:0.1rem 0.5rem;white-space:nowrap;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="10" height="10"><polyline points="20 6 9 17 4 12"/></svg>
                    ${isAr ? 'مشتري موثق' : 'Verified Buyer'}
                   </span>`
                : '';
            const pinnedBadge = r.is_pinned
                ? `<span style="display:inline-flex;align-items:center;gap:0.2rem;font-size:0.65rem;color:#E0C097;opacity:0.7;">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="10" height="10"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>
                    ${isAr ? 'مميز' : 'Featured'}
                   </span>`
                : '';
            return `
            <div class="product-review-card">
                <div style="display:flex;align-items:center;gap:0.6rem;margin-bottom:0.5rem;flex-wrap:wrap;">
                    <div class="review-stars-pub" style="direction:ltr">${stars}</div>
                    <span style="font-size:0.82rem;font-weight:500;color:var(--text)">${name.replace(/</g,'&lt;')}</span>
                    ${verifiedBadge}${pinnedBadge}
                    <span style="font-size:0.72rem;color:var(--text-dim);margin-inline-start:auto">${date}</span>
                </div>
                ${r.comment ? `<p style="font-size:0.85rem;color:var(--text-muted);line-height:1.6;margin:0">${r.comment.replace(/</g,'&lt;')}</p>` : ''}
            </div>`;
        };

        let currentPage = 0;
        const totalPages = Math.ceil(sorted.length / PER_PAGE);

        const renderPage = (page) => {
            currentPage = page;
            const slice = sorted.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

            // Animate out then in
            grid.style.opacity = '0';
            grid.style.transform = 'translateY(6px)';
            grid.style.transition = 'opacity 0.2s, transform 0.2s';

            setTimeout(() => {
                grid.innerHTML = slice.map(renderCard).join('');

                // Pagination
                if (totalPages > 1) {
                    const pag = document.createElement('div');
                    pag.className = 'reviews-pagination';
                    pag.innerHTML = Array.from({length: totalPages}, (_,i) =>
                        `<button class="reviews-page-btn${i===page?' active':''}" data-p="${i}">${i+1}</button>`
                    ).join('');
                    pag.querySelectorAll('.reviews-page-btn').forEach(b =>
                        b.addEventListener('click', () => renderPage(+b.dataset.p))
                    );
                    grid.appendChild(pag);
                }

                grid.style.opacity = '1';
                grid.style.transform = 'translateY(0)';
            }, 200);
        };

        renderPage(0);
    } catch { /* silent */ }
}
function updateProductMeta(product, lang) {
    const name     = getProductName(product, lang);
    const nameEn   = getProductName(product, 'en');
    const desc     = product.description?.[lang] || product.description?.ar || `${name} — دلال للملابس الداخلية الفاخرة`;
    
    // Use main_image_url if available (from Supabase), otherwise fallback to folder/main
    const imgPath  = product.main_image_url || `${product.folder}/${product.main}`;
    
    const baseUrl  = 'https://www.dalalwear.shop';
    const pageUrl  = product.slug
        ? `${baseUrl}/product.html#${product.slug}`
        : `${baseUrl}/product.html?id=${product.id}`;
    const imgUrl   = imgPath.startsWith('http') ? imgPath : `${baseUrl}/${imgPath}`;

    // Starting price
    const pricingRows = product.pricing?.ar || [];
    const startPrice  = pricingRows.length
        ? parseFloat(pricingRows[0].value.replace(/[^\d.]/g, '')) || ''
        : '';

    const setMeta = (id, attr, val) => {
        const el = document.getElementById(id);
        if (el && val) el.setAttribute(attr, val);
    };

    // Page title & description
    document.title = `${name} — دلال`;
    const descEl = document.querySelector('meta[name="description"]');
    if (descEl) descEl.setAttribute('content', desc);

    // Open Graph
    setMeta('ogTitle',       'content', `${name} — DALAL`);
    setMeta('ogDescription', 'content', desc);
    setMeta('ogImage',       'content', imgUrl);
    setMeta('ogUrl',         'content', pageUrl);
    if (startPrice) setMeta('ogPrice', 'content', String(startPrice));

    // Twitter
    setMeta('twTitle',       'content', `${name} — DALAL`);
    setMeta('twDescription', 'content', desc);
    setMeta('twImage',       'content', imgUrl);

    // Canonical URL
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
        canonical = document.createElement('link');
        canonical.rel = 'canonical';
        document.head.appendChild(canonical);
    }
    canonical.href = pageUrl;

    // JSON-LD structured data (Google rich results)
    let jsonLd = document.getElementById('product-jsonld');
    if (!jsonLd) {
        jsonLd = document.createElement('script');
        jsonLd.id   = 'product-jsonld';
        jsonLd.type = 'application/ld+json';
        document.head.appendChild(jsonLd);
    }
    
    const productSchema = {
        '@context': 'https://schema.org',
        '@type':    'Product',
        name:       nameEn || name,
        description: desc,
        image:      imgUrl,
        url:        pageUrl,
        brand: { '@type': 'Brand', name: 'DALAL' },
        offers: {
            '@type':         'Offer',
            priceCurrency:   'EGP',
            price:           startPrice || 0,
            availability:    'https://schema.org/InStock',
            seller: { '@type': 'Organization', name: 'DALAL' }
        }
    };
    
    // Add aggregateRating if reviews exist (will be updated by loadProductReviews)
    window._productSchemaElement = jsonLd;
    window._productSchema = productSchema;
    
    jsonLd.textContent = JSON.stringify(productSchema);
}
const RV_KEY     = 'dalal-recently-viewed';
const RV_MAX     = 3;

function saveRecentlyViewed(product) {
    if (!product?.id) return;
    let list = getRecentlyViewed();
    list = list.filter(p => p.id !== product.id); // remove if already exists
    
    // Save with main_image_url if available, otherwise use folder/main
    const imgUrl = product.main_image_url || `${product.folder}/${product.main}`;
    list.unshift({ 
        id: product.id, 
        slug: product.slug || null, 
        main_image_url: imgUrl,
        folder: product.folder, 
        main: product.main, 
        name: product.name 
    });
    
    if (list.length > RV_MAX) list = list.slice(0, RV_MAX);
    localStorage.setItem(RV_KEY, JSON.stringify(list));
}

function getRecentlyViewed() {
    try { return JSON.parse(localStorage.getItem(RV_KEY)) || []; }
    catch { return []; }
}

function clearRecentlyViewed() {
    localStorage.removeItem(RV_KEY);
    const section = document.getElementById('recentlyViewedSection');
    if (section) section.style.display = 'none';
    // also clear in cart if open
    const cartRV = document.getElementById('cartRecentlyViewed');
    if (cartRV) cartRV.innerHTML = '';
}
window.clearRecentlyViewed = clearRecentlyViewed;

function renderRecentlyViewed(currentId) {
    const lang    = localStorage.getItem('dalal-lang') || 'ar';
    const list    = getRecentlyViewed().filter(p => p.id !== currentId);
    const section = document.getElementById('recentlyViewedSection');
    const grid    = document.getElementById('recentlyViewedGrid');
    const title   = document.getElementById('recentlyViewedTitle');
    if (!section || !grid || !list.length) return;

    if (title) title.textContent = lang === 'ar' ? 'شاهدتِ مؤخراً' : 'Recently Viewed';

    grid.innerHTML = list.map(p => {
        const name = typeof p.name === 'object' ? (p.name[lang] || p.name.ar) : p.name;
        const url  = p.slug ? `product.html#${p.slug}` : `product.html?id=${p.id}`;
        // Use main_image_url if available, otherwise fallback to folder/main
        const imgSrc = p.main_image_url || `${p.folder}/${p.main}`;
        return `
            <a href="${url}" class="rv-card">
                <img src="${imgSrc}" alt="${name}" loading="lazy"
                     style="opacity:0;transition:opacity 0.3s"
                     onload="this.style.opacity='1'" onerror="this.style.opacity='0.3'">
                <div class="rv-card-name">${name}</div>
            </a>`;
    }).join('');

    section.style.display = '';
}

/* ─── Modal helpers ─── */
function openModal() {
    document.getElementById('orderModal').classList.add('active');
    document.body.style.overflow = 'hidden';
    selectedQtyOption = null;
    selectedSize      = null;
    document.getElementById('modalColorInput').value = '';
    document.getElementById('modalNotesInput').value = '';
    document.querySelectorAll('.modal-option').forEach(o => o.classList.remove('selected'));
}

function closeModal() {
    document.getElementById('orderModal').classList.remove('active');
    document.body.style.overflow = '';
}

/* ─── Drag to dismiss (mobile) ─── */
function initModalDrag() {
    const overlay = document.getElementById('orderModal');
    const modal   = overlay?.querySelector('.modal');
    if (!modal) return;

    let startY = 0, currentY = 0, dragging = false;

    modal.addEventListener('touchstart', e => {
        if (modal.scrollTop > 0) return; // only when scrolled to top
        startY   = e.touches[0].clientY;
        currentY = 0;
        dragging = true;
        modal.style.transition = 'none';
    }, { passive: true });

    modal.addEventListener('touchmove', e => {
        if (!dragging) return;
        const dy = e.touches[0].clientY - startY;
        if (dy < 0) return; // block upward drag
        currentY = dy;
        modal.style.transform = `translateY(${dy}px)`;
    }, { passive: true });

    modal.addEventListener('touchend', () => {
        if (!dragging) return;
        dragging = false;
        modal.style.transition = 'transform 0.3s cubic-bezier(0.4,0,0.2,1)';

        if (currentY > 120) {
            modal.style.transform = `translateY(100%)`;
            setTimeout(() => {
                closeModal();
                modal.style.transform = '';
            }, 300);
        } else {
            modal.style.transform = '';
        }
    });
}

/* ─── Build size options ─── */
function buildSizeOptions(product) {
    const container = document.getElementById('modalSizeOptions');
    if (!container) return;
    const lang = localStorage.getItem('dalal-lang') || 'ar';
    container.closest('.modal-step').style.display = '';
    container.innerHTML = `
        <input type="text" id="modalSizeInput" class="modal-input"
               placeholder="${lang === 'ar' ? 'مثال: L، XL، 2XL...' : 'e.g. L, XL, 2XL...'}">
    `;
}

/* ─── Build quantity options from product pricing ─── */
function buildQtyOptions(product, lang) {
    const container = document.getElementById('modalQtyOptions');
    if (!container) return;
    const rows = product.pricing[lang] || product.pricing.ar;
    container.innerHTML = '';
    rows.forEach(row => {
        const btn = document.createElement('button');
        btn.className = 'modal-option';
        btn.type = 'button';
        btn.innerHTML = `<span class="opt-label">${row.label}</span><span class="opt-value">${row.value}</span>`;
        btn.addEventListener('click', () => {
            document.querySelectorAll('.modal-option').forEach(o => o.classList.remove('selected'));
            btn.classList.add('selected');
            selectedQtyOption = row;
        });
        container.appendChild(btn);
    });
}

/* ─── Send to Messenger ─── */
function submitOrder() {
    const colorInput = document.getElementById('modalColorInput');
    const notesInput = document.getElementById('modalNotesInput');
    const sizeInput  = document.getElementById('modalSizeInput');
    const lang       = localStorage.getItem('dalal-lang') || 'ar';
    const name       = getProductName(currentProduct, 'ar');

    /* Validate — only qty is required */
    if (!selectedQtyOption) {
        document.querySelectorAll('#modalQtyOptions .modal-option').forEach(o => {
            o.style.borderColor = '#c0392b';
            setTimeout(() => o.style.borderColor = '', 1500);
        });
        return;
    }

    /* Build message */
    const size  = sizeInput?.value.trim();
    const color = colorInput?.value.trim();
    const notes = notesInput?.value.trim();

    openMessengerWithContact(({ phone, email }) => buildMessengerMsg({
        lang,
        productName: lang === 'ar' ? getProductName(currentProduct, 'ar') : getProductName(currentProduct, 'en'),
        code:        currentProduct.code || null,
        priceLabel:  selectedQtyOption.label,
        priceValue:  selectedQtyOption.value,
        size, color, notes, phone, email
    }));
}

/* ─── Apply language to product page ─── */
function applyProductPageLang(lang) {
    if (!currentProduct) return;
    const t    = DALAL_I18N[lang];
    const name = getProductName(currentProduct, lang);

    const nameEl   = document.getElementById('productName');
    const titleEl  = document.getElementById('pricingTitle');
    const orderBtn = document.getElementById('orderBtn');
    const backBtn  = document.getElementById('backToProducts');

    if (nameEl)   nameEl.textContent  = name;
    const descEl = document.getElementById('productDescription');
    if (descEl) {
        const desc = currentProduct.description;
        descEl.textContent = desc ? (desc[lang] || desc.ar || '') : '';
    }
    if (titleEl)  titleEl.textContent = t.pricingTitle;
    if (orderBtn) {
        const titleSpan = orderBtn.querySelector('.btn-stack-title');
        if (titleSpan) titleSpan.textContent = lang === 'ar' ? 'الطلب عبر ماسنجر' : 'Order via Messenger';
        else { const svg = orderBtn.querySelector('svg'); orderBtn.textContent = lang === 'ar' ? 'الطلب عبر ماسنجر' : 'Order via Messenger'; if (svg) orderBtn.prepend(svg); }
    }
    /* add to cart btn */
    const addToCartBtn = document.getElementById('addToCartBtn');
    if (addToCartBtn) {
        const titleSpan = addToCartBtn.querySelector('.btn-stack-title');
        if (titleSpan) titleSpan.textContent = lang === 'ar' ? 'أضيفي للسلة' : 'Add to Cart';
        else { const svg = addToCartBtn.querySelector('svg'); addToCartBtn.textContent = lang === 'ar' ? 'أضيفي للسلة' : 'Add to Cart'; if (svg) addToCartBtn.prepend(svg); }
    }
    /* order via site btn (primary) */
    const registerOrderBtn = document.getElementById('registerOrderBtn');
    if (registerOrderBtn) {
        const titleSpan = registerOrderBtn.querySelector('.btn-stack-title');
        if (titleSpan) titleSpan.textContent = lang === 'ar' ? 'اطلبي الآن' : 'Order Now';
        else { const svg = registerOrderBtn.querySelector('svg'); registerOrderBtn.textContent = lang === 'ar' ? 'اطلبي الآن' : 'Order Now'; if (svg) registerOrderBtn.prepend(svg); }
    }
    if (backBtn) {
        const svg = backBtn.querySelector('svg');
        backBtn.textContent = t.backToHome;
        if (svg) backBtn.prepend(svg);
    }

    /* btn-stack subtitles — update on lang change */
    const setHint = (id, textAr, textEn) => {
        const el = document.getElementById(id);
        if (el) el.textContent = lang === 'ar' ? textAr : textEn;
    };
    setHint('hintSite',      'سجّلي طلبك وتابعيه من صفحة طلباتي', 'Place & track your order easily');
    setHint('hintCart',      'أكتر من منتج بطلب واحد',             'Multiple items, one order');
    setHint('hintMessenger', 'تواصلي مباشرة معنا',                  'Chat with us directly');

    /* modal labels */
    const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
    set('modalTitle',      lang === 'ar' ? 'تفاصيل الطلب'              : 'Order Details');
    set('modalQtyLabel',   lang === 'ar' ? 'اختاري الكمية'             : 'Select Quantity');
    set('modalSizeLabel',  lang === 'ar' ? 'اختاري المقاس'             : 'Select Size');
    set('modalColorLabel', lang === 'ar' ? 'اللون المطلوب'             : 'Color');
    set('modalNotesLabel', lang === 'ar' ? 'ملاحظات إضافية'            : 'Additional Notes');
    set('modalSubmit',     lang === 'ar' ? 'أرسلي طلبك عبر ماسنجر'    : 'Send Order via Messenger');

    const colorInput = document.getElementById('modalColorInput');
    const notesInput = document.getElementById('modalNotesInput');
    const sizeInput  = document.getElementById('modalSizeInput');
    if (colorInput) colorInput.placeholder = lang === 'ar' ? 'مثال: أبيض، أسود، بيج...' : 'e.g. White, Black, Beige...';
    if (notesInput) notesInput.placeholder = lang === 'ar' ? 'أي تفاصيل إضافية...'      : 'Any extra details...';
    if (sizeInput)  sizeInput.placeholder  = lang === 'ar' ? 'مثال: L، XL، 2XL...'      : 'e.g. L, XL, 2XL...';

    const optEl = document.querySelector('.modal-optional');
    if (optEl) optEl.textContent = lang === 'ar' ? '(اختياري)' : '(optional)';

    renderPricing(currentProduct, lang);
    buildQtyOptions(currentProduct, lang);
    buildSizeOptions(currentProduct);
    document.title = `${lang === 'ar' ? 'دلال' : 'DALAL'} — ${name}`;
}

/* ─── Render pricing rows ─── */
function renderPricing(product, lang) {
    const list = document.getElementById('pricingList');
    if (!list) return;
    const rows = product.pricing[lang] || product.pricing.ar;
    list.innerHTML = rows.map((row, i) => `
        <li class="pricing-row ${i === rows.length - 1 ? 'pricing-row-highlight' : ''}">
            <span class="pricing-label">${row.label}</span>
            <span class="pricing-value">${row.value}</span>
        </li>
    `).join('');
}

/* ─── Show skeleton for product detail page ─── */
function showProductSkeleton() {
    const mainWrapper     = document.querySelector('.main-image-wrapper');
    const thumbsContainer = document.getElementById('thumbsContainer');
    const nameEl          = document.getElementById('productName');
    const descEl          = document.getElementById('productDescription');
    const orderBtn        = document.getElementById('orderBtn');

    if (mainWrapper) {
        mainWrapper.innerHTML = '<div class="skeleton skeleton-main-image"></div>';
    }
    if (thumbsContainer) {
        thumbsContainer.innerHTML = '';
        for (let i = 0; i < 4; i++) {
            const d = document.createElement('div');
            d.className = 'skeleton skeleton-thumb';
            thumbsContainer.appendChild(d);
        }
    }
    if (nameEl) {
        nameEl.innerHTML = '<div class="skeleton skeleton-product-name"></div>';
    }
    if (descEl) {
        descEl.innerHTML = `
            <div class="skeleton" style="height:0.8rem;width:100%;border-radius:4px;margin-bottom:0.5rem;"></div>
            <div class="skeleton" style="height:0.8rem;width:85%;border-radius:4px;"></div>
        `;
    }
}

/* ─── Show Out of Stock Product ─── */
function showOutOfStockProduct(product, lang) {
    const isAr = lang === 'ar';
    const name = getProductName(product, lang);
    // Use main_image_url if available, otherwise fallback to folder/main
    const cover = product.main_image_url || `${product.folder}/${product.main}`;
    
    // Hide skeleton
    const skeleton = document.getElementById('productSkeleton');
    if (skeleton) skeleton.style.display = 'none';
    
    const container = document.getElementById('productDetail');
    if (!container) return;
    
    container.innerHTML = `
        <div style="max-width:800px;margin:0 auto;padding:2rem 1rem;text-align:center;">
            <div style="position:relative;max-width:400px;margin:0 auto 2rem;">
                <img src="${cover}" alt="${name}" style="width:100%;border-radius:12px;opacity:0.4;filter:grayscale(100%);">
                <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(224,92,92,0.95);color:#fff;padding:0.75rem 2rem;border-radius:8px;font-weight:700;font-size:1.1rem;white-space:nowrap;">
                    ${isAr ? '✕ غير متوفر' : '✕ Out of Stock'}
                </div>
            </div>
            
            <h1 style="font-family:'Playfair Display',serif;font-size:1.8rem;color:var(--text);margin-bottom:0.75rem;">${name}</h1>
            
            <div style="background:var(--bg-card);border:1px solid rgba(224,92,92,0.3);border-radius:12px;padding:1.5rem;margin:2rem auto;max-width:500px;">
                <div style="font-size:3rem;margin-bottom:1rem;opacity:0.6;">📦</div>
                <p style="font-size:1.1rem;color:var(--text);margin-bottom:0.5rem;font-weight:600;">
                    ${isAr ? 'هذا المنتج غير متوفر حالياً' : 'This product is currently out of stock'}
                </p>
                <p style="font-size:0.85rem;color:var(--text-muted);line-height:1.6;">
                    ${isAr ? 'نعتذر عن عدم توفر هذا المنتج في الوقت الحالي. يمكنك تصفح منتجات أخرى من تشكيلتنا.' : 'Sorry, this product is not available at the moment. You can browse other products from our collection.'}
                </p>
            </div>
            
            <div style="display:flex;gap:1rem;justify-content:center;flex-wrap:wrap;margin-top:2rem;">
                <a href="products.html" style="display:inline-flex;align-items:center;gap:0.5rem;background:var(--gold);color:var(--bg);padding:0.75rem 1.5rem;border-radius:8px;text-decoration:none;font-weight:600;transition:all 0.2s;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                        <rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
                    </svg>
                    ${isAr ? 'تصفح المنتجات' : 'Browse Products'}
                </a>
                <a href="index.html" style="display:inline-flex;align-items:center;gap:0.5rem;background:var(--bg-card);border:1px solid var(--border);color:var(--text);padding:0.75rem 1.5rem;border-radius:8px;text-decoration:none;font-weight:600;transition:all 0.2s;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                    </svg>
                    ${isAr ? 'الصفحة الرئيسية' : 'Home Page'}
                </a>
            </div>
        </div>
    `;
    
    // Update page title
    document.title = `${name} — ${isAr ? 'غير متوفر' : 'Out of Stock'} — دلال`;
    
    // Update meta for SEO
    const descEl = document.querySelector('meta[name="description"]');
    if (descEl) descEl.setAttribute('content', `${name} — ${isAr ? 'غير متوفر حالياً' : 'Currently out of stock'}`);
}

/* ─── Boot ─── */
async function initProductPage() {
    const slug    = window.location.hash.replace('#', '');
    const params  = new URLSearchParams(window.location.search);
    const product = slug
        ? DALAL_PRODUCTS_SLUG_MAP[slug]
        : DALAL_PRODUCTS_MAP[parseInt(params.get('id'))];
    const lang = localStorage.getItem('dalal-lang') || 'ar';

    if (!product) {
        const container = document.getElementById('productDetail');
        if (container) container.innerHTML = `<p class="not-found">${DALAL_I18N[lang].productNotFound}</p>`;
        return;
    }

    currentProduct = product;

    // Check if product is in stock
    const inStock = DALAL_PRODUCTS_STOCK[product.id] !== false; // Default to true if not set
    
    // If out of stock, show message and disable all actions
    if (!inStock) {
        showOutOfStockProduct(product, lang);
        return;
    }

    /* Save & render recently viewed */
    saveRecentlyViewed(product);
    renderRecentlyViewed(product.id);

    /* Update meta tags for SEO & social sharing */
    updateProductMeta(product, lang);

    /* Load product reviews */
    loadProductReviews(product, lang);

    /* Main image — replace skeleton in wrapper */
    const mainWrapper = document.querySelector('.main-image-wrapper');
    if (mainWrapper) {
        mainWrapper.innerHTML = '';
        const img = document.createElement('img');
        img.id        = 'mainImage';
        img.alt       = getProductName(product, lang);
        img.className = 'main-image';
        img.style.opacity    = '0';
        img.style.transition = 'opacity 0.4s ease';

        const onLoad  = () => { img.style.opacity = '1'; mainWrapper.classList.add('loaded'); };
        const onError = () => {
            // retry once after 1.5s, then show broken state
            if (!img.dataset.retried) {
                img.dataset.retried = '1';
                setTimeout(() => { img.src = img.src.split('?')[0] + '?r=' + Date.now(); }, 1500);
            } else {
                img.style.opacity = '0.3';
                mainWrapper.classList.add('loaded');
            }
        };

        img.addEventListener('load',  onLoad);
        img.addEventListener('error', onError);
        // Use main_image_url if available, otherwise fallback to folder/main
        img.src = product.main_image_url || `${product.folder}/${product.main}`;

        // Handle cached images — if already complete before listener fires
        if (img.complete && img.naturalWidth > 0) onLoad();

        mainWrapper.appendChild(img);
    }

    /* Thumbnails — replace skeleton thumbs */
    const thumbsContainer = document.getElementById('thumbsContainer');
    if (thumbsContainer && product.gallery) {
        thumbsContainer.innerHTML = '';
        product.gallery.forEach((file, i) => {
            // If file is already a full URL (from Supabase), use it directly
            // Otherwise, construct path from folder
            const src = file.startsWith('http') ? file : `${product.folder}/${file}`;

            const wrap = document.createElement('div');
            wrap.className = 'img-wrap thumb-wrap';

            const img = document.createElement('img');
            img.alt       = `${getProductName(product, lang)} — ${i + 1}`;
            img.className = 'thumb' + (i === 0 ? ' active' : '');
            img.loading   = 'lazy';
            img.style.opacity    = '0';
            img.style.transition = 'opacity 0.35s ease';

            const onLoad  = () => { img.style.opacity = '1'; wrap.classList.add('loaded'); };
            const onError = () => {
                if (!img.dataset.retried) {
                    img.dataset.retried = '1';
                    setTimeout(() => { img.src = src + '?r=' + Date.now(); }, 1500);
                } else {
                    img.style.opacity = '0.3';
                    wrap.classList.add('loaded');
                }
            };

            img.addEventListener('load',  onLoad);
            img.addEventListener('error', onError);
            img.src = src;

            // Handle cached images
            if (img.complete && img.naturalWidth > 0) onLoad();

            img.addEventListener('click', () => {
                const currentMain = document.getElementById('mainImage');
                if (currentMain) {
                    currentMain.style.opacity = '0';
                    setTimeout(() => { currentMain.src = src; currentMain.style.opacity = '1'; }, 220);
                }
                thumbsContainer.querySelectorAll('.thumb').forEach(t => t.classList.remove('active'));
                img.classList.add('active');
            });
            wrap.appendChild(img);
            thumbsContainer.appendChild(wrap);
        });
    }

    /* Order button (Messenger — ghost) */
    const orderBtn = document.getElementById('orderBtn');
    if (orderBtn) {
        orderBtn.style.opacity = '1';
        orderBtn.addEventListener('click', openModal);
    }

    /* Modal close */
    document.getElementById('modalClose')?.addEventListener('click', closeModal);
    document.getElementById('orderModal')?.addEventListener('click', e => {
        if (e.target === e.currentTarget) closeModal();
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

    /* Drag to dismiss */
    initModalDrag();

    /* Modal submit */
    document.getElementById('modalSubmit')?.addEventListener('click', submitOrder);

    /* Apply language — fills productName, pricingTitle, pricingList */
    applyProductPageLang(lang);

}

/* ─── Bind help buttons once (lang-aware) ─── */
document.addEventListener('DOMContentLoaded', showProductSkeleton);
document.addEventListener('dalal:products-ready', initProductPage);
if (Object.keys(DALAL_PRODUCTS_MAP).length > 0) initProductPage();

// Re-init when navigating between products on the same page
window.addEventListener('hashchange', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showProductSkeleton();
    if (Object.keys(DALAL_PRODUCTS_MAP).length > 0) initProductPage();
});

