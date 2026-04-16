/* ═══════════════════════════════════════════════════════════════
   DALAL — Dynamic Product Detail Page
   ═══════════════════════════════════════════════════════════════ */

let currentProduct   = null;
let selectedQtyOption  = null;
let selectedSize       = null;

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

    const msg = buildMessengerMsg({
        lang,
        productName: lang === 'ar' ? getProductName(currentProduct, 'ar') : getProductName(currentProduct, 'en'),
        code:        currentProduct.code || null,
        priceLabel:  selectedQtyOption.label,
        priceValue:  selectedQtyOption.value,
        size, color, notes
    });
    openMessenger(msg);
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
}

/* ─── Bind help buttons once (lang-aware) ─── */
document.addEventListener('DOMContentLoaded', showProductSkeleton);
document.addEventListener('dalal:products-ready', initProductPage);
if (Object.keys(DALAL_PRODUCTS_MAP).length > 0) initProductPage();

