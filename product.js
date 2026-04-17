/* ═══════════════════════════════════════════════════════════════
   DALAL — Dynamic Product Detail Page
   ═══════════════════════════════════════════════════════════════ */

let currentProduct   = null;
let selectedQtyOption  = null;
let selectedSize       = null;

/* ─── Update meta tags for SEO & social sharing ─── */
function updateProductMeta(product, lang) {
    const name     = getProductName(product, lang);
    const nameEn   = getProductName(product, 'en');
    const desc     = product.description?.[lang] || product.description?.ar || `${name} — دلال للملابس الداخلية الفاخرة`;
    const imgPath  = `${product.folder}/${product.main}`;
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
    jsonLd.textContent = JSON.stringify({
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
    });
}
const RV_KEY     = 'dalal-recently-viewed';
const RV_MAX     = 6;

function saveRecentlyViewed(product) {
    if (!product?.id) return;
    let list = getRecentlyViewed();
    list = list.filter(p => p.id !== product.id); // remove if already exists
    list.unshift({ id: product.id, slug: product.slug || null, folder: product.folder, main: product.main, name: product.name });
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
        return `
            <a href="${url}" class="rv-card">
                <img src="${p.folder}/${p.main}" alt="${name}" loading="lazy"
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

/* ─── Boot ─── */
function initProductPage() {
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

    /* Save & render recently viewed */
    saveRecentlyViewed(product);
    renderRecentlyViewed(product.id);

    /* Update meta tags for SEO & social sharing */
    updateProductMeta(product, lang);

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
        img.src = `${product.folder}/${product.main}`;

        // Handle cached images — if already complete before listener fires
        if (img.complete && img.naturalWidth > 0) onLoad();

        mainWrapper.appendChild(img);
    }

    /* Thumbnails — replace skeleton thumbs */
    const thumbsContainer = document.getElementById('thumbsContainer');
    if (thumbsContainer && product.gallery) {
        thumbsContainer.innerHTML = '';
        product.gallery.forEach((file, i) => {
            const src = `${product.folder}/${file}`;

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

    /* Sticky order bar — show after scrolling past the main order button */
    const stickyBar = document.getElementById('stickyOrderBar');
    const stickyLbl = document.getElementById('stickyOrderLabel');
    const mainBtn   = document.getElementById('registerOrderBtn');

    if (stickyBar && mainBtn) {
        const onScroll = () => {
            const btnBottom = mainBtn.getBoundingClientRect().bottom;
            if (btnBottom < 0) {
                stickyBar.classList.add('visible');
            } else {
                stickyBar.classList.remove('visible');
            }
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        // update label on lang change
        document.addEventListener('dalal-lang-change', () => {
            const l = localStorage.getItem('dalal-lang') || 'ar';
            if (stickyLbl) stickyLbl.textContent = l === 'ar' ? 'اطلبي الآن' : 'Order Now';
        });
    }
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

