/* ═══════════════════════════════════════════════════════════════
   DALAL — Shopping Cart
   ═══════════════════════════════════════════════════════════════ */

const CART_KEY = 'dalal-cart';

/* ─── State ─── */
let cart = loadCart();

function loadCart() {
    try {
        const data = JSON.parse(localStorage.getItem(CART_KEY)) || [];
        // migrate old format (items without key)
        return data.filter(i => i.key);
    }
    catch { return []; }
}

function saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

/* ─── Central messenger message builder ─── */
function buildMessengerMsg({ lang, productName, code, priceLabel, priceValue, size, color, notes }) {
    const codeStr = code ? ` — Code: [${code}]` : '';
    if (lang === 'ar') {
        let msg = `DALAL — طلب جديد${codeStr}\n\nالمنتج: ${productName}\nالكمية: ${priceLabel} — ${priceValue}`;
        if (size)  msg += `\nالمقاس: ${size}`;
        if (color) msg += `\nاللون: ${color}`;
        if (notes) msg += `\nملاحظات: ${notes}`;
        return msg;
    } else {
        let msg = `DALAL — New Order${codeStr}\n\nProduct: ${productName}\nQuantity: ${priceLabel} — ${priceValue}`;
        if (size)  msg += `\nSize: ${size}`;
        if (color) msg += `\nColor: ${color}`;
        if (notes) msg += `\nNotes: ${notes}`;
        return msg;
    }
}

function openMessenger(msg) {
    window.open(`https://m.me/dalal.lingerie?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
}
function cartAdd(product, selectedRow, qty = 1, extras = {}) {
    const key = `${product.id}_${selectedRow.label}_${Date.now()}`;
    cart.push({
        key,
        id:         product.id,
        slug:       product.slug || null,
        code:       product.code || null,
        nameAr:     typeof product.name === 'object' ? product.name.ar : product.name,
        nameEn:     typeof product.name === 'object' ? product.name.en : product.name,
        image:      `${product.folder}/${product.main}`,
        priceLabel: selectedRow.label,
        priceValue: selectedRow.value,
        priceNum:   parseFloat(selectedRow.value.replace(/[^\d.]/g, '')) || 0,
        size:       extras.size  || '',
        color:      extras.color || '',
        notes:      extras.notes || '',
        qty
    });
    saveCart();
    updateCartUI();
    showAddToCartToast(product);
    animateCartIcon();
}

/* ─── Quick-add modal (shown when clicking "Add to Cart" from cards) ─── */
let _quickAddProduct = null;
let _quickSelectedQty = null;

function openQuickAddModal(product) {
    _quickAddProduct  = product;
    _quickSelectedQty = null;

    const lang = localStorage.getItem('dalal-lang') || 'ar';
    const isAr = lang === 'ar';
    const name = isAr ? (product.name?.ar || product.name) : (product.name?.en || product.name);

    // Remove old modal if exists
    const old = document.getElementById('quickAddModal');
    if (old) old.remove();

    const rows = product.pricing?.[lang] || product.pricing?.ar || [];
    const qtyOptionsHTML = rows.map(row => `
        <button class="modal-option qa-qty-btn" type="button" data-label="${row.label}" data-value="${row.value}">
            <span class="opt-label">${row.label}</span>
            <span class="opt-value">${row.value}</span>
        </button>
    `).join('');

    const html = `
    <div class="modal-overlay" id="quickAddModal" role="dialog" aria-modal="true">
        <div class="modal">
            <button class="modal-close" id="qaClose" aria-label="close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>

            <h2 class="modal-title">${name}</h2>
            <div class="modal-divider"></div>

            <div class="modal-step">
                <p class="modal-label">${isAr ? 'اختاري الكمية' : 'Select Quantity'}</p>
                <div class="modal-options" id="qaQtyOptions">${qtyOptionsHTML}</div>
            </div>

            <div class="modal-step">
                <label class="modal-label" for="qaSizeInput">${isAr ? 'المقاس' : 'Size'}</label>
                <input type="text" id="qaSizeInput" class="modal-input"
                       placeholder="${isAr ? 'مثال: L، XL، 2XL...' : 'e.g. L, XL, 2XL...'}">
            </div>

            <div class="modal-step">
                <label class="modal-label" for="qaColorInput">${isAr ? 'اللون' : 'Color'}</label>
                <input type="text" id="qaColorInput" class="modal-input"
                       placeholder="${isAr ? 'مثال: أبيض، أسود، بيج...' : 'e.g. White, Black, Beige...'}">
            </div>

            <div class="modal-step">
                <label class="modal-label" for="qaNotesInput">
                    ${isAr ? 'ملاحظات' : 'Notes'}
                    <span class="modal-optional">${isAr ? '(اختياري)' : '(optional)'}</span>
                </label>
                <input type="text" id="qaNotesInput" class="modal-input"
                       placeholder="${isAr ? 'أي تفاصيل إضافية...' : 'Any extra details...'}">
            </div>

            <div class="qa-action-row">
                <button class="btn btn-secondary qa-cart-btn" id="qaAddCartBtn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                        <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                    </svg>
                    ${isAr ? 'أضيفي للسلة' : 'Add to Cart'}
                </button>
                <button class="btn btn-primary qa-site-order-btn" id="qaSiteOrderBtn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15">
                        <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                    </svg>
                    ${isAr ? 'اطلبي عن طريق الموقع' : 'Order via Website'}
                </button>
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', html);
    // reflow then activate to trigger CSS transition
    const overlay = document.getElementById('quickAddModal');
    requestAnimationFrame(() => {
        requestAnimationFrame(() => overlay.classList.add('active'));
    });
    document.body.style.overflow = 'hidden';

    // Qty selection
    overlay.querySelectorAll('.qa-qty-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            overlay.querySelectorAll('.qa-qty-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            _quickSelectedQty = { label: btn.dataset.label, value: btn.dataset.value };
        });
    });

    // Close
    const closeQA = () => {
        overlay.classList.remove('active');
        setTimeout(() => overlay.remove(), 350);
        document.body.style.overflow = '';
    };
    document.getElementById('qaClose').addEventListener('click', closeQA);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeQA(); });

    // Add to cart
    document.getElementById('qaAddCartBtn').addEventListener('click', () => {
        if (!_quickSelectedQty) {
            overlay.querySelectorAll('.qa-qty-btn').forEach(b => {
                b.style.borderColor = '#c0392b';
                setTimeout(() => b.style.borderColor = '', 1500);
            });
            return;
        }
        const size  = document.getElementById('qaSizeInput')?.value.trim() || '';
        const color = document.getElementById('qaColorInput')?.value.trim() || '';
        const notes = document.getElementById('qaNotesInput')?.value.trim() || '';
        // qty is always 1 — priceValue is the total price for the selected tier
        cartAdd(product, _quickSelectedQty, 1, { size, color, notes });
        closeQA();
    });

    // Order via Website
    document.getElementById('qaSiteOrderBtn').addEventListener('click', () => {
        if (!_quickSelectedQty) {
            overlay.querySelectorAll('.qa-qty-btn').forEach(b => {
                b.style.borderColor = '#c0392b';
                setTimeout(() => b.style.borderColor = '', 1500);
            });
            return;
        }
        const size  = document.getElementById('qaSizeInput')?.value.trim() || '';
        const color = document.getElementById('qaColorInput')?.value.trim() || '';
        const notes = document.getElementById('qaNotesInput')?.value.trim() || '';

        closeQA();
        // Open customer info modal with all product details pre-filled
        openSiteOrderModal({
            product,
            selectedRow: _quickSelectedQty,
            size, color, notes
        });
    });

    // Drag to dismiss
    const modal = overlay.querySelector('.modal');
    let startY = 0, curY = 0, dragging = false;
    modal.addEventListener('touchstart', e => {
        if (modal.scrollTop > 0) return;
        startY = e.touches[0].clientY; curY = 0; dragging = true;
        modal.style.transition = 'none';
    }, { passive: true });
    modal.addEventListener('touchmove', e => {
        if (!dragging) return;
        const dy = e.touches[0].clientY - startY;
        if (dy < 0) return;
        curY = dy; modal.style.transform = `translateY(${dy}px)`;
    }, { passive: true });
    modal.addEventListener('touchend', () => {
        if (!dragging) return; dragging = false;
        modal.style.transition = 'transform 0.3s cubic-bezier(0.4,0,0.2,1)';
        if (curY > 120) { modal.style.transform = 'translateY(100%)'; setTimeout(closeQA, 300); }
        else modal.style.transform = '';
    });
}

function cartRemove(key) {
    const el = document.querySelector(`.cart-item[data-key="${CSS.escape(key)}"]`);
    const doRemove = () => {
        cart = cart.filter(i => i.key !== key);
        saveCart();
        updateCartUI();
        renderCartItems();
    };
    if (el) {
        el.style.transition = 'opacity 0.22s ease, transform 0.22s ease';
        el.style.opacity    = '0';
        el.style.transform  = 'translateX(40px)';
        setTimeout(doRemove, 240);
    } else {
        doRemove();
    }
}

function cartSetQty(key, qty) {
    const item = cart.find(i => i.key === key);
    if (!item) return;
    if (qty < 1) { cartRemove(key); return; }
    item.qty = qty;
    saveCart();
    updateCartUI();
    renderCartItems();
}

function cartClear() {
    const items = document.querySelectorAll('.cart-item');
    if (!items.length) {
        cart = [];
        saveCart();
        updateCartUI();
        renderCartItems();
        return;
    }
    // animate each item out with stagger
    items.forEach((el, i) => {
        el.style.transition = `opacity 0.25s ease ${i * 60}ms, transform 0.25s ease ${i * 60}ms`;
        el.style.opacity   = '0';
        el.style.transform = 'translateX(40px)';
    });
    const totalDuration = items.length * 60 + 280;
    setTimeout(() => {
        cart = [];
        saveCart();
        updateCartUI();
        renderCartItems();
    }, totalDuration);
}

function cartTotal() {
    return cart.reduce((sum, item) => sum + (item.priceNum * item.qty), 0);
}

function cartCount() {
    return cart.reduce((sum, item) => sum + item.qty, 0);
}

/* ─── Cart Icon Badge ─── */
function updateCartUI() {
    const count = cartCount();
    document.querySelectorAll('.cart-badge').forEach(el => {
        el.textContent = count;
        el.style.display = count > 0 ? 'flex' : 'none';
    });
}

/* ─── Animate cart icon ─── */
function animateCartIcon() {
    document.querySelectorAll('.cart-icon-btn').forEach(btn => {
        btn.classList.remove('cart-pop');
        void btn.offsetWidth; // reflow
        btn.classList.add('cart-pop');
        btn.addEventListener('animationend', () => btn.classList.remove('cart-pop'), { once: true });
    });
}

/* ─── Toast notification ─── */
function showAddToCartToast(product) {
    const lang = localStorage.getItem('dalal-lang') || 'ar';
    const name = lang === 'ar' ? (product.name?.ar || product.name) : (product.name?.en || product.name);
    const msg  = lang === 'ar' ? `✓ تمت الإضافة: ${name}` : `✓ Added: ${name}`;

    let toast = document.getElementById('cartToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'cartToast';
        toast.className = 'cart-toast';
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.remove('cart-toast-hide');
    toast.classList.add('cart-toast-show');

    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
        toast.classList.remove('cart-toast-show');
        toast.classList.add('cart-toast-hide');
    }, 2800);
}

/* ─── Render cart drawer items ─── */
function renderCartItems() {
    const container = document.getElementById('cartItems');
    const emptyMsg  = document.getElementById('cartEmpty');
    const footer    = document.getElementById('cartFooter');
    if (!container) return;

    const lang = localStorage.getItem('dalal-lang') || 'ar';

    if (cart.length === 0) {
        container.innerHTML = '';
        if (emptyMsg) emptyMsg.style.display = 'flex';
        if (footer)   footer.style.display   = 'none';
        return;
    }

    if (emptyMsg) emptyMsg.style.display = 'none';
    if (footer)   footer.style.display   = 'flex';

    container.innerHTML = cart.map(item => {
        const name = lang === 'ar' ? item.nameAr : item.nameEn;
        const keyEsc = item.key.replace(/'/g, "\\'");
        
        // Get current language label from product pricing if available
        let displayLabel = item.priceLabel;
        let displayValue = item.priceValue;
        
        if (typeof DALAL_PRODUCTS_MAP !== 'undefined') {
            const product = DALAL_PRODUCTS_MAP[item.id];
            if (product && product.pricing) {
                const pricingRows = product.pricing[lang] || product.pricing.ar;
                // Find matching row by value (since value is consistent across languages)
                const matchingRow = pricingRows.find(row => {
                    const rowNum = parseFloat(row.value.replace(/[^\d.]/g, ''));
                    return Math.abs(rowNum - item.priceNum) < 0.01;
                });
                if (matchingRow) {
                    displayLabel = matchingRow.label;
                    displayValue = matchingRow.value;
                }
            }
        }
        
        const productUrl = item.slug ? `product.html#${item.slug}` : `product.html?id=${item.id}`;
        return `
        <div class="cart-item" data-key="${item.key}">
            <a href="${productUrl}" onclick="closeCart()">
                <img class="cart-item-img" src="${item.image}" alt="${name}" loading="lazy">
            </a>
            <div class="cart-item-info">
                <a href="${productUrl}" onclick="closeCart()" class="cart-item-name" style="color:var(--text);text-decoration:none;">${name}</a>
                <span class="cart-item-tier">${displayLabel}</span>
                ${item.size  ? `<span class="cart-item-meta">${lang === 'ar' ? 'مقاس' : 'Size'}: ${item.size}</span>`  : ''}
                ${item.color ? `<span class="cart-item-meta">${lang === 'ar' ? 'لون' : 'Color'}: ${item.color}</span>` : ''}
                ${item.notes ? `<span class="cart-item-meta">${lang === 'ar' ? 'ملاحظة' : 'Note'}: ${item.notes}</span>` : ''}
                <span class="cart-item-price"><strong>${displayValue}</strong></span>
            </div>
            <div class="cart-item-controls">
                <button class="cart-qty-btn" onclick="cartSetQty('${keyEsc}', ${item.qty - 1})" aria-label="decrease">−</button>
                <span class="cart-qty-val">${item.qty}</span>
                <button class="cart-qty-btn" onclick="cartSetQty('${keyEsc}', ${item.qty + 1})" aria-label="increase">+</button>
                <button class="cart-remove-btn" onclick="cartRemove('${keyEsc}')" aria-label="remove">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                </button>
            </div>
        </div>`;
    }).join('');

    /* total */
    const totalEl = document.getElementById('cartTotal');
    if (totalEl) {
        const currency = lang === 'ar' ? 'جنيه' : 'EGP';
        totalEl.textContent = `${cartTotal().toLocaleString()} ${currency}`;
    }
}

/* ─── Drawer open/close ─── */
function openCart() {
    renderCartItems();
    const drawer  = document.getElementById('cartDrawer');
    const overlay = document.getElementById('cartOverlay');
    const sticky  = document.getElementById('mobileSticky');
    if (drawer)  drawer.classList.add('open');
    if (overlay) overlay.classList.add('active');
    if (sticky)  sticky.style.display = 'none';
    document.body.style.overflow = 'hidden';
}

function closeCart() {
    const drawer  = document.getElementById('cartDrawer');
    const overlay = document.getElementById('cartOverlay');
    const sticky  = document.getElementById('mobileSticky');
    if (drawer)  drawer.classList.remove('open');
    if (overlay) overlay.classList.remove('active');
    if (sticky)  sticky.style.display = '';
    document.body.style.overflow = '';
}

/* ─── Site Order Modal (single product with full details) ─── */
function openSiteOrderModal({ product, selectedRow, size, color, notes }) {
    const lang = localStorage.getItem('dalal-lang') || 'ar';
    const isAr = lang === 'ar';
    const name = isAr ? (product.name?.ar || product.name) : (product.name?.en || product.name);

    const old = document.getElementById('siteOrderModal');
    if (old) old.remove();

    const detailsHTML = [
        `<div style="display:flex;justify-content:space-between;font-size:0.82rem;padding:0.3rem 0;">
            <span style="color:var(--text-muted)">${isAr ? 'الكمية' : 'Qty'}</span>
            <span style="color:var(--gold)">${selectedRow.label} — ${selectedRow.value}</span>
        </div>`,
        size  ? `<div style="display:flex;justify-content:space-between;font-size:0.82rem;padding:0.3rem 0;">
            <span style="color:var(--text-muted)">${isAr ? 'المقاس' : 'Size'}</span>
            <span style="color:var(--text)">${size}</span>
        </div>` : '',
        color ? `<div style="display:flex;justify-content:space-between;font-size:0.82rem;padding:0.3rem 0;">
            <span style="color:var(--text-muted)">${isAr ? 'اللون' : 'Color'}</span>
            <span style="color:var(--text)">${color}</span>
        </div>` : '',
        notes ? `<div style="display:flex;justify-content:space-between;font-size:0.82rem;padding:0.3rem 0;">
            <span style="color:var(--text-muted)">${isAr ? 'ملاحظات' : 'Notes'}</span>
            <span style="color:var(--text)">${notes}</span>
        </div>` : '',
    ].filter(Boolean).join('');

    const html = `
    <div class="order-overlay" id="siteOrderModal" role="dialog" aria-modal="true">
        <div class="order-modal">
            <div class="order-drag-handle"></div>
            <div class="order-modal-header">
                <h2 class="order-modal-title">${isAr ? 'تأكيد الطلب' : 'Confirm Order'}</h2>
                <button class="order-modal-close" id="siteOrderClose">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>
            <div class="order-modal-divider"></div>

            <!-- Product summary -->
            <div style="background:var(--bg-light);border:1px solid var(--border);border-radius:var(--r-lg);padding:0.85rem 1rem;margin-bottom:1.25rem;">
                <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.6rem;">
                    <img src="${product.folder}/${product.main}" alt="${name}"
                         style="width:48px;height:48px;object-fit:cover;border-radius:4px;border:1px solid var(--border);flex-shrink:0;">
                    <span style="font-size:0.9rem;font-weight:500;color:var(--text)">${name}</span>
                </div>
                ${detailsHTML}
            </div>

            <form id="siteOrderForm" novalidate>
                <div class="order-field">
                    <label class="order-label" for="soName">${isAr ? 'الاسم' : 'Name'}</label>
                    <input class="order-input" id="soName" type="text" placeholder="${isAr ? 'اكتب أسمك' : 'Your full name'}" required>
                </div>
                <div class="order-field">
                    <label class="order-label" for="soPhone">${isAr ? 'رقم الهاتف' : 'Phone'}</label>
                    <input class="order-input" id="soPhone" type="tel" placeholder="01xxxxxxxxx" inputmode="numeric" pattern="[0-9]*" required>
                </div>
                <div class="order-field">
                    <label class="order-label" for="soAddress">${isAr ? 'العنوان' : 'Address'}</label>
                    <input class="order-input" id="soAddress" type="text" placeholder="${isAr ? 'المحافظة / المدينة / الشارع' : 'Governorate / City / Street'}" required>
                </div>
                <div class="order-error" id="soError"></div>
                <button type="submit" class="order-submit-btn" id="soSubmitBtn">
                    <span id="soSubmitLabel">${isAr ? 'تأكيد الطلب' : 'Confirm Order'}</span>
                </button>
            </form>

            <div class="order-success" id="soSuccess">
                <div class="order-success-icon">✓</div>
                <div class="order-success-msg">${isAr ? 'تم تأكيد طلبك بنجاح' : 'Order confirmed successfully'}</div>
                <div class="order-success-sub">${isAr ? 'سنتواصل معكِ قريباً' : 'We will contact you soon'}</div>
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', html);
    const overlay = document.getElementById('siteOrderModal');
    requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('is-open')));
    document.body.style.overflow = 'hidden';

    const closeModal = () => {
        overlay.classList.remove('is-open');
        setTimeout(() => overlay.remove(), 350);
        document.body.style.overflow = '';
    };

    document.getElementById('siteOrderClose').addEventListener('click', closeModal);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

    /* Numbers only */
    overlay.querySelector('#soPhone').addEventListener('input', function () {
        this.value = this.value.replace(/[^0-9]/g, '');
    });

    document.getElementById('siteOrderForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const customerName = document.getElementById('soName').value.trim();
        const phone        = document.getElementById('soPhone').value.trim();
        const address      = document.getElementById('soAddress').value.trim();

        if (!customerName || !phone || !address) {
            const errEl = document.getElementById('soError');
            errEl.textContent = isAr ? 'يرجى ملء جميع الحقول' : 'Please fill in all fields';
            errEl.classList.add('is-visible');
            return;
        }

        const btn   = document.getElementById('soSubmitBtn');
        const label = document.getElementById('soSubmitLabel');
        btn.disabled = true;
        label.innerHTML = '<span class="order-spinner"></span>';

        const priceNum = parseFloat(selectedRow.value.replace(/[^\d.]/g, '')) || 0;

        const orderRef = (typeof generateOrderRef === 'function') ? generateOrderRef() : ('DL-' + Math.random().toString(36).slice(2,7).toUpperCase());

        const orderData = {
            name:    customerName,
            phone,
            address,
            products: [{
                id:    product.id,
                name:  typeof product.name === 'object'
                    ? (isAr ? product.name.ar : (product.name.en || product.name.ar))
                    : product.name,
                offer: selectedRow.label,
                price: selectedRow.value,
                size:  size  || '',
                color: color || '',
                notes: notes || '',
                code:  product.code || '',
                qty:   1
            }],
            total:     priceNum,
            status:    'pending',
            order_ref: orderRef
        };

        try {
            const result = await insertOrder(orderData);
            const savedId = result?.[0]?.id || null;

            if (typeof saveOrderLocally === 'function') {
                saveOrderLocally({
                    ref: orderRef, dbId: savedId,
                    name: customerName, phone,
                    products: orderData.products,
                    total: priceNum, status: 'pending',
                    date: new Date().toISOString()
                });
            }

            document.getElementById('siteOrderForm').style.display = 'none';
            document.getElementById('soSuccess').innerHTML = `
                <div class="order-success-icon">✓</div>
                <div class="order-success-msg">${isAr ? 'تم تأكيد طلبك بنجاح' : 'Order confirmed successfully'}</div>
                <div class="order-success-sub">${isAr ? 'سنتواصل معكِ قريباً' : 'We will contact you soon'}</div>
                <span style="font-size:0.8rem;color:var(--text-dim);margin-top:0.2rem;display:block">
                    ${isAr ? 'رقم طلبك' : 'Order ID'}: <strong style="color:var(--gold)">${orderRef}</strong>
                </span>
                <a href="track.html?ref=${orderRef}" style="color:var(--gold);text-decoration:underline;font-size:0.82rem;margin-top:0.4rem;display:inline-block">
                    ${isAr ? 'تتبع طلبك ←' : 'Track your order ←'}
                </a>`;
            document.getElementById('soSuccess').classList.add('is-visible');
            setTimeout(closeModal, 5000);
        } catch (err) {
            console.error(err);
            btn.disabled = false;
            label.textContent = isAr ? 'تأكيد الطلب' : 'Confirm Order';
            const errEl = document.getElementById('soError');
            errEl.textContent = isAr ? 'حدث خطأ، يرجى المحاولة مرة أخرى' : 'Something went wrong';
            errEl.classList.add('is-visible');
        }
    });
}

/* ─── Checkout via Site (single order with all cart items) ─── */
function checkoutViaSite() {
    if (cart.length === 0) return;
    const lang = localStorage.getItem('dalal-lang') || 'ar';
    const isAr = lang === 'ar';

    // Remove old modal if exists
    const old = document.getElementById('cartOrderModal');
    if (old) old.remove();

    const html = `
    <div class="order-overlay" id="cartOrderModal" role="dialog" aria-modal="true">
        <div class="order-modal">
            <div class="order-drag-handle"></div>
            <div class="order-modal-header">
                <h2 class="order-modal-title">${isAr ? 'تأكيد الطلب' : 'Confirm Order'}</h2>
                <button class="order-modal-close" id="cartOrderClose">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>
            <div class="order-modal-divider"></div>

            <!-- Cart summary -->
            <div style="background:var(--bg-light);border:1px solid var(--border);border-radius:var(--r-lg);padding:0.85rem 1rem;margin-bottom:1.25rem;display:flex;flex-direction:column;gap:0.6rem;">
                ${cart.map(i => {
                    const name = lang === 'ar' ? i.nameAr : i.nameEn;
                    const meta = [
                        i.size  ? (isAr ? `مقاس: ${i.size}`   : `Size: ${i.size}`)   : '',
                        i.color ? (isAr ? `لون: ${i.color}`    : `Color: ${i.color}`) : '',
                        i.notes ? (isAr ? `ملاحظة: ${i.notes}` : `Note: ${i.notes}`) : '',
                    ].filter(Boolean).join('<br>');
                    return `<div style="display:flex;align-items:center;gap:0.7rem;">
                        <img src="${i.image}" alt="${name}" style="width:40px;height:40px;object-fit:cover;border-radius:4px;border:1px solid var(--border);flex-shrink:0;">
                        <div style="flex:1;min-width:0;">
                            <div style="font-size:0.83rem;color:var(--text);font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${name} × ${i.qty}</div>
                            <div style="font-size:0.75rem;color:var(--text-dim);">${i.priceLabel}</div>
                            ${meta ? `<div style="font-size:0.72rem;color:var(--text-dim);margin-top:0.1rem;">${meta}</div>` : ''}
                        </div>
                        <span style="color:var(--gold);font-size:0.82rem;font-weight:600;flex-shrink:0;">${i.priceValue}</span>
                    </div>`;
                }).join('')}
                <div style="border-top:1px solid var(--border);margin-top:0.2rem;padding-top:0.5rem;display:flex;justify-content:space-between;font-size:0.85rem;font-weight:600;">
                    <span style="color:var(--text-muted)">${isAr ? 'الإجمالي' : 'Total'}</span>
                    <span style="color:var(--gold)">${cartTotal().toLocaleString()} ${isAr ? 'جنيه' : 'EGP'}</span>
                </div>
            </div>

            <form id="cartOrderForm" novalidate>
                <div class="order-field">
                    <label class="order-label" for="coName">${isAr ? 'الاسم' : 'Name'}</label>
                    <input class="order-input" id="coName" type="text" placeholder="${isAr ? 'اكتب أسمك' : 'Your full name'}" required>
                </div>
                <div class="order-field">
                    <label class="order-label" for="coPhone">${isAr ? 'رقم الهاتف' : 'Phone'}</label>
                    <input class="order-input" id="coPhone" type="tel" placeholder="01xxxxxxxxx" inputmode="numeric" pattern="[0-9]*" required>
                </div>
                <div class="order-field">
                    <label class="order-label" for="coAddress">${isAr ? 'العنوان' : 'Address'}</label>
                    <input class="order-input" id="coAddress" type="text" placeholder="${isAr ? 'المحافظة / المدينة / الشارع' : 'Governorate / City / Street'}" required>
                </div>
                <div class="order-error" id="coError"></div>
                <button type="submit" class="order-submit-btn" id="coSubmitBtn">
                    <span id="coSubmitLabel">${isAr ? 'تأكيد الطلب' : 'Confirm Order'}</span>
                </button>
            </form>

            <div class="order-success" id="coSuccess">
                <div class="order-success-icon">✓</div>
                <div class="order-success-msg">${isAr ? 'تم تأكيد طلبك بنجاح' : 'Order confirmed successfully'}</div>
                <div class="order-success-sub">${isAr ? 'سنتواصل معكِ قريباً' : 'We will contact you soon'}</div>
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', html);
    const overlay = document.getElementById('cartOrderModal');
    requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('is-open')));
    document.body.style.overflow = 'hidden';

    const closeModal = () => {
        overlay.classList.remove('is-open');
        setTimeout(() => overlay.remove(), 350);
        document.body.style.overflow = '';
    };

    document.getElementById('cartOrderClose').addEventListener('click', closeModal);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

    /* Numbers only */
    overlay.querySelector('#coPhone').addEventListener('input', function () {
        this.value = this.value.replace(/[^0-9]/g, '');
    });

    document.getElementById('cartOrderForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name    = document.getElementById('coName').value.trim();
        const phone   = document.getElementById('coPhone').value.trim();
        const address = document.getElementById('coAddress').value.trim();

        if (!name || !phone || !address) {
            const errEl = document.getElementById('coError');
            errEl.textContent = isAr ? 'يرجى ملء جميع الحقول' : 'Please fill in all fields';
            errEl.classList.add('is-visible');
            return;
        }

        const btn = document.getElementById('coSubmitBtn');
        const label = document.getElementById('coSubmitLabel');
        btn.disabled = true;
        label.innerHTML = '<span class="order-spinner"></span>';

        // Build products array from cart
        const products = cart.map(i => ({
            id:    i.id,
            name:  lang === 'ar' ? i.nameAr : (i.nameEn || i.nameAr),
            size:  i.size  || '',
            color: i.color || '',
            notes: i.notes || '',
            offer: i.priceLabel,
            price: i.priceValue,
            qty:   i.qty,
            code:  i.code || ''
        }));

        const orderRef = (typeof generateOrderRef === 'function') ? generateOrderRef() : ('DL-' + Math.random().toString(36).slice(2,7).toUpperCase());

        const orderData = {
            name,
            phone,
            address,
            products,
            total:     cartTotal(),
            status:    'pending',
            order_ref: orderRef
        };

        try {
            const result = await insertOrder(orderData);
            const savedId = result?.[0]?.id || null;

            if (typeof saveOrderLocally === 'function') {
                saveOrderLocally({
                    ref: orderRef, dbId: savedId, name, phone,
                    products, total: cartTotal(), status: 'pending',
                    date: new Date().toISOString()
                });
            }

            document.getElementById('cartOrderForm').style.display = 'none';
            document.getElementById('coSuccess').innerHTML = `
                <div class="order-success-icon">✓</div>
                <div class="order-success-msg">${isAr ? 'تم تأكيد طلبك بنجاح' : 'Order confirmed successfully'}</div>
                <div class="order-success-sub">${isAr ? 'سنتواصل معكِ قريباً' : 'We will contact you soon'}</div>
                <span style="font-size:0.8rem;color:var(--text-dim);margin-top:0.2rem;display:block">
                    ${isAr ? 'رقم طلبك' : 'Order ID'}: <strong style="color:var(--gold)">${orderRef}</strong>
                </span>
                <a href="track.html?ref=${orderRef}" style="color:var(--gold);text-decoration:underline;font-size:0.82rem;margin-top:0.4rem;display:inline-block">
                    ${isAr ? 'تتبع طلبك ←' : 'Track your order ←'}
                </a>`;
            document.getElementById('coSuccess').classList.add('is-visible');
            cartClear();
            closeCart();
            setTimeout(closeModal, 5000);
        } catch (err) {
            console.error(err);
            btn.disabled = false;
            label.textContent = isAr ? 'تأكيد الطلب' : 'Confirm Order';
            const errEl = document.getElementById('coError');
            errEl.textContent = isAr ? 'حدث خطأ، يرجى المحاولة مرة أخرى' : 'Something went wrong';
            errEl.classList.add('is-visible');
        }
    });
}
function checkoutViaMessenger() {
    if (cart.length === 0) return;
    const lang = localStorage.getItem('dalal-lang') || 'ar';

    const lines = cart.map(i => {
        const name = lang === 'ar' ? i.nameAr : i.nameEn;

        // Get current-language label+value from product data
        let label = i.priceLabel;
        let value = i.priceValue;
        if (typeof DALAL_PRODUCTS_MAP !== 'undefined') {
            const product = DALAL_PRODUCTS_MAP[i.id];
            if (product?.pricing) {
                const rows = product.pricing[lang] || product.pricing.ar;
                const match = rows.find(r => Math.abs(parseFloat(r.value.replace(/[^\d.]/g, '')) - i.priceNum) < 0.01);
                if (match) { label = match.label; value = match.value; }
            }
        }

        const codeStr = i.code ? ` [${i.code}]` : '';
        let line = lang === 'ar'
            ? `${name}${codeStr}\n   الكمية: ${i.qty} × ${label}\n   السعر: ${value}`
            : `${name}${codeStr}\n   Qty: ${i.qty} × ${label}\n   Price: ${value}`;
        if (i.size)  line += lang === 'ar' ? `\n   المقاس: ${i.size}`    : `\n   Size: ${i.size}`;
        if (i.color) line += lang === 'ar' ? `\n   اللون: ${i.color}`    : `\n   Color: ${i.color}`;
        if (i.notes) line += lang === 'ar' ? `\n   ملاحظات: ${i.notes}`  : `\n   Notes: ${i.notes}`;
        return line;
    }).join('\n\n');

    const total = cartTotal().toLocaleString();
    const msg = lang === 'ar'
        ? `DALAL — طلب جديد\n${'─'.repeat(28)}\n\n${lines}\n\n${'─'.repeat(28)}\nالاجمالي: ${total} جنيه`
        : `DALAL — New Order\n${'─'.repeat(28)}\n\n${lines}\n\n${'─'.repeat(28)}\nTotal: ${total} EGP`;

    openMessenger(msg);
}

/* ─── Inject cart HTML into page ─── */
function injectCartHTML() {
    const lang = localStorage.getItem('dalal-lang') || 'ar';
    const isAr = lang === 'ar';

    const html = `
    <!-- Cart Overlay -->
    <div id="cartOverlay" class="cart-overlay" onclick="closeCart()"></div>

    <!-- Cart Drawer -->
    <aside id="cartDrawer" class="cart-drawer" role="dialog" aria-label="${isAr ? 'سلة التسوق' : 'Shopping Cart'}">
        <div class="cart-drawer-header">
            <h2 class="cart-drawer-title" id="cartDrawerTitle">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="20" height="20">
                    <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                </svg>
                ${isAr ? 'سلة التسوق' : 'Shopping Cart'}
            </h2>
            <button class="cart-close-btn" onclick="closeCart()" aria-label="close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        </div>

        <div id="cartEmpty" class="cart-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" width="52" height="52" style="color:var(--text-dim)">
                <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
            </svg>
            <p id="cartEmptyText">${isAr ? 'السلة فارغة' : 'Your cart is empty'}</p>
        </div>

        <div id="cartItems" class="cart-items-list"></div>

        <div id="cartFooter" class="cart-footer" style="display:none">
            <div class="cart-total-row">
                <span id="cartTotalLabel">${isAr ? 'الإجمالي' : 'Total'}</span>
                <span id="cartTotal" class="cart-total-amount">0</span>
            </div>
            <button class="btn btn-secondary cart-clear-btn" onclick="cartClear()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                <span id="cartClearLabel">${isAr ? 'إفراغ السلة' : 'Clear Cart'}</span>
            </button>
            <button class="btn btn-primary cart-checkout-btn" onclick="checkoutViaMessenger()">
                <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                    <path d="M12 2C6.477 2 2 6.145 2 11.243c0 2.907 1.434 5.503 3.678 7.199V22l3.38-1.853c.9.25 1.855.384 2.842.384h.1c5.523 0 10-4.145 10-9.243S17.523 2 12 2zm1.076 12.457l-2.55-2.72-4.98 2.72 5.474-5.81 2.613 2.72 4.916-2.72-5.473 5.81z"/>
                </svg>
                <span id="cartCheckoutLabel">${isAr ? 'اطلبي عبر ماسنجر' : 'Order via Messenger'}</span>
            </button>
            <button class="btn btn-secondary cart-site-order-btn" onclick="checkoutViaSite()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                    <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                </svg>
                <span id="cartSiteOrderLabel">${isAr ? 'اطلبي عن طريق الموقع' : 'Order via Website'}</span>
            </button>
        </div>
    </aside>

    <!-- Toast -->
    <div id="cartToast" class="cart-toast"></div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
}

/* ─── Inject cart icon into navbar ─── */
function injectCartIcon() {
    document.querySelectorAll('.nav-controls-icons').forEach(container => {
        if (container.querySelector('.cart-icon-btn')) return;
        const btn = document.createElement('button');
        btn.className = 'cart-icon-btn nav-icon-btn';
        btn.setAttribute('aria-label', 'cart');
        btn.onclick = openCart;
        btn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="18" height="18">
                <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
            </svg>
            <span class="cart-badge" style="display:none">0</span>
        `;
        container.appendChild(btn);
    });
    updateCartUI();
}

/* ─── Update cart drawer text on language switch ─── */
function updateCartLang(lang) {
    const isAr = lang === 'ar';
    const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
    set('cartDrawerTitle', isAr ? 'سلة التسوق' : 'Shopping Cart');
    set('cartEmptyText',   isAr ? 'السلة فارغة' : 'Your cart is empty');
    set('cartTotalLabel',    isAr ? 'الإجمالي' : 'Total');
    set('cartClearLabel',    isAr ? 'إفراغ السلة' : 'Clear Cart');
    set('cartCheckoutLabel', isAr ? 'اطلبي عبر ماسنجر' : 'Order via Messenger');
    set('cartSiteOrderLabel', isAr ? 'اطلبي عن طريق الموقع' : 'Order via Website');
    renderCartItems();
}

/* ─── Patch product cards to add "Add to Cart" button ─── */
const _origCreateProductCard = typeof createProductCard !== 'undefined' ? createProductCard : null;

function patchProductCards() {
    // We hook into the existing createProductCard by wrapping it
    if (typeof window._cartPatched !== 'undefined') return;
    window._cartPatched = true;

    const original = window.createProductCard;
    if (!original) return;

    window.createProductCard = function(product) {
        const article = original(product);
        const lang    = localStorage.getItem('dalal-lang') || 'ar';
        const info    = article.querySelector('.product-info');
        if (!info) return article;

        // Replace the existing btn-order with two buttons
        const existingBtn = info.querySelector('.btn-order');
        if (existingBtn) existingBtn.remove();

        const btnWrap = document.createElement('div');
        btnWrap.className = 'product-card-btns';

        const addBtn = document.createElement('button');
        addBtn.className = 'btn btn-cart-add';
        addBtn.setAttribute('data-product-id', product.id);
        addBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
            </svg>
            <span>${lang === 'ar' ? 'أضيفي للسلة' : 'Add to Cart'}</span>
        `;
        addBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openQuickAddModal(product);
        });

        const productUrl = product.slug ? `product.html#${product.slug}` : `product.html?id=${product.id}`;
        const orderBtn = document.createElement('a');
        orderBtn.href = productUrl;
        orderBtn.className = 'btn btn-order';
        orderBtn.textContent = lang === 'ar' ? 'اطلبي الآن' : 'Order Now';        btnWrap.appendChild(addBtn);
        btnWrap.appendChild(orderBtn);
        info.appendChild(btnWrap);

        return article;
    };
}

/* ─── Add to cart from product detail page ─── */
function addCurrentProductToCart() {
    if (typeof currentProduct === 'undefined' || !currentProduct) return;
    cartAdd(currentProduct);
}

/* ─── Boot ─── */
document.addEventListener('DOMContentLoaded', () => {
    injectCartHTML();
    injectCartIcon();
    updateCartUI();

    // Patch createProductCard before products render
    patchProductCards();

    // Re-patch after products-ready in case script order varies
    document.addEventListener('dalal:products-ready', () => {
        patchProductCards();
    });

    // Hook into language changes — defer to ensure applyLanguage is defined first
    setTimeout(() => {
        const origApplyLanguage = window.applyLanguage;
        if (origApplyLanguage) {
            window.applyLanguage = function(lang) {
                origApplyLanguage(lang);
                updateCartLang(lang);
            };
        }
    }, 0);

    // Keyboard close
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeCart();
    });
});
