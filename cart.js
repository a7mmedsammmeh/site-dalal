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
    // Re-verify prices before saving to prevent console manipulation
    if (typeof DALAL_PRODUCTS_MAP !== 'undefined') {
        cart.forEach(item => {
            const product = DALAL_PRODUCTS_MAP[item.id];
            if (product && product.pricing) {
                const rows = product.pricing.ar || [];
                const match = rows.find(r => r.label === item.priceLabel);
                if (match) {
                    // Force correct price from product database
                    item.priceNum = parseFloat(match.value.replace(/[^\d.]/g, '')) || 0;
                    item.priceValue = match.value;
                }
            }
        });
    }
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

/* ─── Central messenger message builder ─── */
function buildMessengerMsg({ lang, productName, code, priceLabel, priceValue, size, color, notes, phone, email }) {
    const codeStr = code ? ` — Code: [${code}]` : '';
    if (lang === 'ar') {
        let msg = `DALAL — طلب جديد${codeStr}\n\nالمنتج: ${productName}\nالكمية: ${priceLabel} — ${priceValue}`;
        if (size) msg += `\nالمقاس: ${size}`;
        if (color) msg += `\nاللون: ${color}`;
        if (notes) msg += `\nملاحظات: ${notes}`;
        if (phone) msg += `\n\nرقم الهاتف: ${phone}`;
        if (email) msg += `\nالإيميل: ${email}`;
        return msg;
    } else {
        let msg = `DALAL — New Order${codeStr}\n\nProduct: ${productName}\nQuantity: ${priceLabel} — ${priceValue}`;
        if (size) msg += `\nSize: ${size}`;
        if (color) msg += `\nColor: ${color}`;
        if (notes) msg += `\nNotes: ${notes}`;
        if (phone) msg += `\n\nPhone: ${phone}`;
        if (email) msg += `\nEmail: ${email}`;
        return msg;
    }
}

function openMessenger(msg) {
    window.open(`https://m.me/dalal.lingerie?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
}

/* ─── Wishlist ─── */
const WISHLIST_KEY = 'dalal-wishlist';

function getWishlist() {
    try { return JSON.parse(localStorage.getItem(WISHLIST_KEY)) || []; }
    catch { return []; }
}

function saveWishlist(list) {
    localStorage.setItem(WISHLIST_KEY, JSON.stringify(list));
}

function isWishlisted(id) {
    return getWishlist().includes(+id);
}

function toggleWishlist(id) {
    id = +id;
    let list = getWishlist();
    const idx = list.indexOf(id);
    if (idx === -1) list.push(id);
    else list.splice(idx, 1);
    saveWishlist(list);
    updateWishlistBadge();
    // Update all heart buttons for this product
    document.querySelectorAll(`.wishlist-btn[data-id="${id}"]`).forEach(btn => {
        updateHeartBtn(btn, list.includes(id));
    });
}

function updateHeartBtn(btn, active) {
    btn.setAttribute('aria-pressed', active);
    btn.querySelector('svg').setAttribute('fill', active ? '#e05c5c' : 'none');
    btn.querySelector('svg').setAttribute('stroke', active ? '#e05c5c' : 'currentColor');
    btn.style.opacity = active ? '1' : '';
}

function createWishlistBtn(productId) {
    const active = isWishlisted(productId);
    const btn = document.createElement('button');
    btn.className = 'wishlist-btn';
    btn.dataset.id = productId;
    btn.setAttribute('aria-label', 'أضيفي للمفضلة');
    btn.setAttribute('aria-pressed', active);
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="${active ? '#e05c5c' : 'none'}" stroke="${active ? '#e05c5c' : 'currentColor'}" stroke-width="2" width="16" height="16"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
    btn.style.opacity = active ? '1' : '';
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleWishlist(productId);
        // pop animation
        btn.classList.remove('wishlist-pop');
        void btn.offsetWidth;
        btn.classList.add('wishlist-pop');
    });
    return btn;
}

/* ─── Success sound ─── */
function playSuccessSound() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const notes = [523, 659, 784]; // C5, E5, G5 — major chord arpeggio
        notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.value = freq;
            const start = ctx.currentTime + i * 0.1;
            gain.gain.setValueAtTime(0, start);
            gain.gain.linearRampToValueAtTime(0.18, start + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
            osc.start(start);
            osc.stop(start + 0.35);
        });
    } catch { /* silent fail */ }
}

/* ─── Contact modal before Messenger ─── */
function openMessengerWithContact(buildMsg) {
    const lang = localStorage.getItem('dalal-lang') || 'ar';
    const isAr = lang === 'ar';

    const old = document.getElementById('messengerContactModal');
    if (old) old.remove();

    const html = `
    <div class="order-overlay" id="messengerContactModal" role="dialog" aria-modal="true">
        <div class="order-modal" style="max-width:400px;">
            <div class="order-drag-handle"></div>
            <div class="order-modal-header">
                <h2 class="order-modal-title">${isAr ? 'قبل ما نكمل...' : 'Before we continue...'}</h2>
                <button class="order-modal-close" id="mcClose">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>
            <div class="order-modal-divider"></div>
            <p style="font-size:0.82rem;color:var(--text-muted);margin-bottom:1.25rem;line-height:1.6;">
                ${isAr ? 'أضيفي رقمك وإيميلك عشان نقدر نتواصل معاكِ بسهولة — اختياري تماماً' : 'Add your phone & email so we can reach you easily — completely optional'}
            </p>
            <div class="order-field">
                <label class="order-label" for="mcPhone">${isAr ? 'رقم الهاتف' : 'Phone'}</label>
                <input class="order-input" id="mcPhone" type="tel" inputmode="numeric" placeholder="01xxxxxxxxx">
                <span class="order-field-hint">${isAr ? 'اختياري — للتواصل معاكِ بخصوص الطلب' : 'Optional — to contact you about your order'}</span>
            </div>
            <div class="order-field">
                <label class="order-label" for="mcEmail">${isAr ? 'البريد الإلكتروني' : 'Email'}</label>
                <input class="order-input" id="mcEmail" type="email" placeholder="example@email.com">
                <span class="order-field-hint">${isAr ? 'اختياري — لاستلام تحديثات الطلب' : 'Optional — to receive order updates'}</span>
            </div>
            <button class="order-submit-btn" id="mcSubmit">
                <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M12 2C6.477 2 2 6.145 2 11.243c0 2.907 1.434 5.503 3.678 7.199V22l3.38-1.853c.9.25 1.855.384 2.842.384h.1c5.523 0 10-4.145 10-9.243S17.523 2 12 2zm1.076 12.457l-2.55-2.72-4.98 2.72 5.474-5.81 2.613 2.72 4.916-2.72-5.473 5.81z"/></svg>
                ${isAr ? 'فتح ماسنجر' : 'Open Messenger'}
            </button>
            <button id="mcSkip" style="width:100%;margin-top:0.5rem;background:transparent;border:none;color:var(--text-dim);font-size:0.78rem;cursor:pointer;padding:0.5rem;font-family:inherit;">
                ${isAr ? 'تخطي وفتح ماسنجر مباشرة' : 'Skip and open Messenger directly'}
            </button>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', html);
    const overlay = document.getElementById('messengerContactModal');
    requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('is-open')));
    if (typeof DalalModal !== 'undefined') DalalModal.lock();
    else document.body.style.overflow = 'hidden';

    const closeModal = () => {
        overlay.classList.remove('is-open');
        setTimeout(() => overlay.remove(), 350);
        if (typeof DalalModal !== 'undefined') DalalModal.unlock();
        else document.body.style.overflow = '';
    };

    const submit = (skip = false) => {
        const phone = skip ? '' : (document.getElementById('mcPhone')?.value.trim() || '');
        const email = skip ? '' : (document.getElementById('mcEmail')?.value.trim() || '');
        closeModal();
        const msg = buildMsg({ phone, email });
        openMessenger(msg);
    };

    document.getElementById('mcClose').addEventListener('click', closeModal);
    document.getElementById('mcSubmit').addEventListener('click', () => submit(false));
    document.getElementById('mcSkip').addEventListener('click', () => submit(true));
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
    document.getElementById('mcPhone').addEventListener('input', function () {
        this.value = this.value.replace(/[^0-9]/g, '');
    });

    /* Drag to dismiss (mobile) */
    const mcCard = overlay.querySelector('.order-modal');
    if (typeof DalalModal !== 'undefined') {
        DalalModal.setupDrag(mcCard, closeModal);
    } else {
        let _mcStartY = 0, _mcCurrentY = 0, _mcDragging = false;
        mcCard.addEventListener('touchstart', e => {
            if (window.innerWidth >= 640 || mcCard.scrollTop > 0) return;
            _mcDragging = true;
            _mcStartY = e.touches[0].clientY;
            _mcCurrentY = 0;
            mcCard.style.transition = 'none';
        }, { passive: true });
        mcCard.addEventListener('touchmove', e => {
            if (!_mcDragging) return;
            const dy = e.touches[0].clientY - _mcStartY;
            if (dy < 0) return;
            _mcCurrentY = dy;
            mcCard.style.transform = `translateY(${dy}px)`;
            e.preventDefault();
        }, { passive: false });
        mcCard.addEventListener('touchend', () => {
            if (!_mcDragging) return;
            _mcDragging = false;
            mcCard.style.transition = 'transform 0.35s cubic-bezier(0.4,0,0.2,1)';
            if (_mcCurrentY > 120) {
                mcCard.style.transform = 'translateY(100%)';
                setTimeout(closeModal, 300);
            } else mcCard.style.transform = '';
        });
    }
}
function cartAdd(product, selectedRow, qty = 1, extras = {}, sourceEl = null, flyProduct = null) {
    // Block if product is out of stock
    if (typeof DALAL_PRODUCTS_STOCK !== 'undefined') {
        const stock = DALAL_PRODUCTS_STOCK[product.id];
        if (stock && stock.visibility_status !== 'visible') {
            const lang = localStorage.getItem('dalal-lang') || 'ar';
            const isAr = lang === 'ar';
            const name = isAr ? (product.name?.ar || product.name) : (product.name?.en || product.name);
            alert(isAr ? `"${name}" غير متوفر حالياً ولا يمكن إضافته للسلة.` : `"${name}" is currently out of stock.`);
            return;
        }
    }
    // Build a stable key from product id + offer label + size + color
    // so adding the same item twice increments qty instead of duplicating
    const key = `${product.id}_${selectedRow.label}_${(extras.size || '').toLowerCase()}_${(extras.color || '').toLowerCase()}`;

    const existing = cart.find(i => i.key === key);
    if (existing) {
        existing.qty += qty;
        saveCart();
        updateCartUI();
        showAddToCartToast(product);
        playSuccessSound();
        if (sourceEl) flyToCart(sourceEl, flyProduct || product);
        else animateCartIcon();
        return;
    }

    cart.push({
        key,
        id: product.id,
        slug: product.slug || null,
        code: product.code || null,
        nameAr: typeof product.name === 'object' ? product.name.ar : product.name,
        nameEn: typeof product.name === 'object' ? product.name.en : product.name,
        image: product.main_image_url || `${product.folder}/${product.main}`,
        priceLabel: selectedRow.label,
        priceValue: selectedRow.value,
        priceNum: parseFloat(selectedRow.value.replace(/[^\d.]/g, '')) || 0,
        size: extras.size || '',
        color: extras.color || '',
        notes: extras.notes || '',
        qty
    });
    saveCart();
    updateCartUI();
    showAddToCartToast(product);
    playSuccessSound();
    if (sourceEl) flyToCart(sourceEl, flyProduct || product);
    else animateCartIcon();
}

/* ─── Quick-add modal (shown when clicking "Add to Cart" from cards) ─── */
let _quickAddProduct = null;
let _quickSelectedQty = null;

function openQuickAddModal(product) {
    _quickAddProduct = product;
    _quickSelectedQty = null;

    const lang = localStorage.getItem('dalal-lang') || 'ar';
    const isAr = lang === 'ar';
    const name = isAr ? (product.name?.ar || product.name) : (product.name?.en || product.name);

    // Block if out of stock
    if (typeof DALAL_PRODUCTS_STOCK !== 'undefined') {
        const stock = DALAL_PRODUCTS_STOCK[product.id];
        if (stock && stock.visibility_status !== 'visible') {
            alert(isAr ? `"${name}" غير متوفر حالياً.` : `"${name}" is currently out of stock.`);
            return;
        }
    }

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

            <div class="qa-action-row" style="grid-template-columns:1fr">
                <button class="btn btn-primary qa-cart-btn" id="qaAddCartBtn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                        <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                    </svg>
                    ${isAr ? 'أضيفي للسلة' : 'Add to Cart'}
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
    if (typeof DalalModal !== 'undefined') DalalModal.lock();
    else document.body.style.overflow = 'hidden';

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
        if (typeof DalalModal !== 'undefined') DalalModal.unlock();
        else document.body.style.overflow = '';
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
        const size = document.getElementById('qaSizeInput')?.value.trim() || '';
        const color = document.getElementById('qaColorInput')?.value.trim() || '';
        const notes = document.getElementById('qaNotesInput')?.value.trim() || '';
        // qty is always 1 — priceValue is the total price for the selected tier
        cartAdd(product, _quickSelectedQty, 1, { size, color, notes }, document.getElementById('qaAddCartBtn'), product);
        closeQA();
    });

    // Order via Website — removed

    // Drag to dismiss
    const modal = overlay.querySelector('.modal');
    if (typeof DalalModal !== 'undefined') {
        DalalModal.setupDrag(modal, closeQA);
    } else {
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
            e.preventDefault();
        }, { passive: false });
        modal.addEventListener('touchend', () => {
            if (!dragging) return; dragging = false;
            modal.style.transition = 'transform 0.35s cubic-bezier(0.4,0,0.2,1)';
            if (curY > 120) { modal.style.transform = 'translateY(100%)'; setTimeout(closeQA, 300); }
            else modal.style.transform = '';
        });
    }
}

function cartRemove(key) {
    const el = document.querySelector(`.cart-item[data-key="${CSS.escape(key)}"]`);
    const doRemove = () => {
        cart = cart.filter(i => i.key !== key);
        saveCart();
        updateCartUI();
        // Remove warning banner before re-render to avoid flash
        const w = document.getElementById('cartStockWarning');
        if (w) w.remove();
        renderCartItems();
    };
    if (el) {
        el.style.transition = 'opacity 0.22s ease, transform 0.22s ease';
        el.style.opacity = '0';
        el.style.transform = 'translateX(40px)';
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

function cartClear(skipConfirm = false) {
    if (!skipConfirm) {
        const lang = localStorage.getItem('dalal-lang') || 'ar';
        const msg = lang === 'ar' ? 'هل أنت متأكدة من إفراغ السلة؟' : 'Are you sure you want to clear the cart?';
        if (!confirm(msg)) return;
    }

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
        el.style.opacity = '0';
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
    return cart.reduce((sum, item) => {
        // Use VERIFIED price from product data, not from localStorage
        const verifiedPrice = getVerifiedPrice(item);
        return sum + (verifiedPrice * item.qty);
    }, 0);
}

/* ── Get verified price from product database, fallback to stored price ── */
function getVerifiedPrice(item) {
    if (typeof DALAL_PRODUCTS_MAP !== 'undefined') {
        const product = DALAL_PRODUCTS_MAP[item.id];
        if (product && product.pricing) {
            const lang = localStorage.getItem('dalal-lang') || 'ar';
            const rows = product.pricing[lang] || product.pricing.ar || [];
            // Match by label (not by priceNum which can be manipulated)
            const match = rows.find(r => r.label === item.priceLabel);
            if (match) {
                return parseFloat(match.value.replace(/[^\d.]/g, '')) || 0;
            }
            // Fallback: match by index position
            const fallbackRows = product.pricing.ar || [];
            const matchFallback = fallbackRows.find(r => r.label === item.priceLabel);
            if (matchFallback) {
                return parseFloat(matchFallback.value.replace(/[^\d.]/g, '')) || 0;
            }
        }
    }
    // Last resort: use stored price (only if product data not loaded yet)
    return item.priceNum || 0;
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

/* ─── Fly-to-cart animation ─── */
function flyToCart(sourceEl, product) {
    const cartBtn = document.querySelector('.cart-icon-btn');
    if (!cartBtn || !sourceEl) return;

    const srcRect = sourceEl.getBoundingClientRect();
    const destRect = cartBtn.getBoundingClientRect();

    const imgSrc = product?.main_image_url
        || (product?.folder && product?.main ? `${product.folder}/${product.main}` : null);

    // Start size = same as product card image area
    const startSize = 120;
    const endSize = 20;

    const startX = srcRect.left + srcRect.width / 2 - startSize / 2;
    const startY = srcRect.top + srcRect.height / 2 - startSize / 2;
    const destX = destRect.left + destRect.width / 2;
    const destY = destRect.top + destRect.height / 2;

    // Inject keyframes dynamically
    const animId = 'fly-' + Date.now();
    const style = document.createElement('style');
    style.textContent = `
        @keyframes ${animId} {
            0%   { top:${startY}px; left:${startX}px; width:${startSize}px; height:${startSize}px; transform:rotate(0deg) scale(1);   opacity:1; }
            60%  { transform:rotate(200deg) scale(0.5); opacity:1; }
            85%  { top:${destY - endSize / 2}px; left:${destX - endSize / 2}px; width:${endSize}px; height:${endSize}px; transform:rotate(340deg) scale(0.3); opacity:0.8; }
            100% { top:${destY - endSize / 2}px; left:${destX - endSize / 2}px; width:${endSize}px; height:${endSize}px; transform:rotate(360deg) scale(0);   opacity:0; }
        }
    `;
    document.head.appendChild(style);

    const el = document.createElement(imgSrc ? 'img' : 'div');
    if (imgSrc) { el.src = imgSrc; el.alt = ''; }

    el.style.cssText = `
        position: fixed;
        width: ${startSize}px; height: ${startSize}px;
        border-radius: 10px;
        ${imgSrc ? 'object-fit: cover;' : 'background: var(--gold);'}
        z-index: 99999;
        pointer-events: none;
        top: ${startY}px;
        left: ${startX}px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.5);
        border: 1.5px solid rgba(224,192,151,0.4);
        animation: ${animId} 0.7s cubic-bezier(0.25,0.46,0.45,0.94) forwards;
    `;
    document.body.appendChild(el);

    setTimeout(() => {
        el.remove();
        style.remove();
        animateCartIcon();
    }, 720);
}

/* ─── Toast notification ─── */
function showAddToCartToast(product) {
    const lang = localStorage.getItem('dalal-lang') || 'ar';
    const name = lang === 'ar' ? (product.name?.ar || product.name) : (product.name?.en || product.name);
    const msg = lang === 'ar' ? `✓ تمت الإضافة: ${name}` : `✓ Added: ${name}`;

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
    const emptyMsg = document.getElementById('cartEmpty');
    const footer = document.getElementById('cartFooter');
    if (!container) return;

    const lang = localStorage.getItem('dalal-lang') || 'ar';

    if (cart.length === 0) {
        container.innerHTML = '';
        // Remove any stock warning when cart is empty
        const w = document.getElementById('cartStockWarning');
        if (w) w.remove();
        if (emptyMsg) emptyMsg.style.display = 'flex';
        if (footer) footer.style.display = 'none';
        return;
    }

    if (emptyMsg) emptyMsg.style.display = 'none';
    if (footer) footer.style.display = 'flex';

    // Check stock status for each item
    const outOfStockIds = new Set();
    if (typeof DALAL_PRODUCTS_STOCK !== 'undefined') {
        cart.forEach(item => {
            const stock = DALAL_PRODUCTS_STOCK[item.id];
            if (stock && stock.visibility_status !== 'visible') {
                outOfStockIds.add(item.id);
            }
        });
    }

    // Show warning banner if any item is out of stock
    const existingWarning = document.getElementById('cartStockWarning');
    if (existingWarning) existingWarning.remove();

    if (outOfStockIds.size > 0) {
        const isAr = lang === 'ar';
        const warning = document.createElement('div');
        warning.id = 'cartStockWarning';
        warning.style.cssText = `
            display:flex; align-items:flex-start; gap:0.6rem;
            background:rgba(224,92,92,0.1); border:1px solid rgba(224,92,92,0.3);
            border-radius:8px; padding:0.75rem 1rem; margin-bottom:0.75rem;
            font-size:0.82rem; color:#e05c5c; font-weight:600; line-height:1.5;
        `;
        warning.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18" style="flex-shrink:0;margin-top:1px;">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span>${isAr
                ? 'بعض المنتجات في سلتك غير متوفرة حالياً. يرجى إزالتها قبل إتمام الطلب.'
                : 'Some items in your cart are currently out of stock. Please remove them before checkout.'
            }</span>
        `;
        container.parentNode.insertBefore(warning, container);
    }

    // Disable checkout button if any out-of-stock items
    const checkoutBtn = document.getElementById('cartCheckoutBtn');
    const messengerBtn = document.getElementById('cartMessengerBtn');
    if (outOfStockIds.size > 0) {
        if (checkoutBtn) { checkoutBtn.disabled = true; checkoutBtn.style.opacity = '0.4'; checkoutBtn.style.cursor = 'not-allowed'; }
        if (messengerBtn) { messengerBtn.disabled = true; messengerBtn.style.opacity = '0.4'; messengerBtn.style.cursor = 'not-allowed'; }
    } else {
        if (checkoutBtn) { checkoutBtn.disabled = false; checkoutBtn.style.opacity = ''; checkoutBtn.style.cursor = ''; }
        if (messengerBtn) { messengerBtn.disabled = false; messengerBtn.style.opacity = ''; messengerBtn.style.cursor = ''; }
    }

    container.innerHTML = cart.map(item => {
        const name = lang === 'ar' ? item.nameAr : item.nameEn;
        const keyEsc = item.key.replace(/'/g, "\\'");
        const isOutOfStock = outOfStockIds.has(item.id);

        // Get VERIFIED price from product database (not from localStorage)
        let displayLabel = item.priceLabel;
        let displayValue = item.priceValue;

        if (typeof DALAL_PRODUCTS_MAP !== 'undefined') {
            const product = DALAL_PRODUCTS_MAP[item.id];
            if (product && product.pricing) {
                const pricingRows = product.pricing[lang] || product.pricing.ar;
                // Match by LABEL (tamper-resistant) not by priceNum (tamper-prone)
                const matchingRow = pricingRows.find(row => row.label === item.priceLabel);
                if (matchingRow) {
                    displayLabel = matchingRow.label;
                    displayValue = matchingRow.value;
                }
            }
        }

        const productUrl = item.slug ? `product.html#${item.slug}` : `product.html?id=${item.id}`;
        return `
        <div class="cart-item" data-key="${item.key}" style="${isOutOfStock ? 'opacity:0.6;' : ''}">
            <a href="${productUrl}" onclick="closeCart()">
                <img class="cart-item-img" src="${item.image}" alt="${name}" loading="lazy">
            </a>
            <div class="cart-item-info">
                <a href="${productUrl}" onclick="closeCart()" class="cart-item-name" style="color:var(--text);text-decoration:none;">${name}</a>
                ${isOutOfStock ? `<span style="font-size:0.7rem;color:#e05c5c;font-weight:700;">${lang === 'ar' ? '⚠ غير متوفر' : '⚠ Out of Stock'}</span>` : ''}
                <span class="cart-item-tier">${displayLabel}</span>
                ${item.size ? `<span class="cart-item-meta">${lang === 'ar' ? 'مقاس' : 'Size'}: ${item.size}</span>` : ''}
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

/* ─── Recently Viewed in cart ─── */
function renderCartRecentlyViewed() {
    const container = document.getElementById('cartRecentlyViewed');
    if (!container) return;
    const lang = localStorage.getItem('dalal-lang') || 'ar';
    let list = [];
    try { list = JSON.parse(localStorage.getItem('dalal-recently-viewed')) || []; } catch { }
    if (!list.length) return;

    container.innerHTML = `
        <p style="font-size:0.72rem;color:var(--text-dim);margin-bottom:0.75rem;letter-spacing:0.06em;">
            ${lang === 'ar' ? 'شاهدتِ مؤخراً' : 'Recently Viewed'}
        </p>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0.5rem;">
            ${list.slice(0, 3).map(p => {
        const name = typeof p.name === 'object' ? (p.name[lang] || p.name.ar) : p.name;
        const url = p.slug ? `product.html#${p.slug}` : `product.html?id=${p.id}`;
        return `
                    <a href="${url}" onclick="closeCart()" style="text-decoration:none;color:inherit;">
                        <div style="border:1px solid var(--border);border-radius:var(--r);overflow:hidden;transition:border-color 0.15s;">
                            <img src="${p.folder}/${p.main}" alt="${name}" loading="lazy"
                                 style="width:100%;aspect-ratio:1;object-fit:cover;display:block;opacity:0;transition:opacity 0.3s"
                                 onload="this.style.opacity='1'" onerror="this.style.opacity='0.3'">
                            <div style="font-size:0.68rem;color:var(--text-dim);padding:0.3rem 0.4rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${name}</div>
                        </div>
                    </a>`;
    }).join('')}
        </div>
    `;
}

/* ─── Drawer open/close ─── */
function openCart() {
    // Refresh stock data before rendering to catch any changes
    if (typeof fetchProductStock === 'function' && typeof DALAL_PRODUCTS_STOCK !== 'undefined') {
        fetchProductStock().then(stockData => {
            DALAL_PRODUCTS_STOCK = {};
            stockData.forEach(s => {
                DALAL_PRODUCTS_STOCK[s.product_id] = {
                    in_stock: s.in_stock,
                    visibility_status: s.visibility_status || 'visible'
                };
            });
            renderCartItems();
        }).catch(() => renderCartItems());
    } else {
        renderCartItems();
    }

    const drawer = document.getElementById('cartDrawer');
    const overlay = document.getElementById('cartOverlay');
    const sticky = document.getElementById('mobileSticky');
    if (drawer) drawer.classList.add('open');
    if (overlay) overlay.classList.add('active');
    if (sticky) sticky.style.display = 'none';
    document.body.style.overflow = 'hidden';

    if (cart.length === 0) renderCartRecentlyViewed();
}

function closeCart() {
    const drawer = document.getElementById('cartDrawer');
    const overlay = document.getElementById('cartOverlay');
    const sticky = document.getElementById('mobileSticky');
    if (drawer) drawer.classList.remove('open');
    if (overlay) overlay.classList.remove('active');
    if (sticky) sticky.style.display = '';
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
        size ? `<div style="display:flex;justify-content:space-between;font-size:0.82rem;padding:0.3rem 0;">
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
                    <img src="${product.main_image_url || `${product.folder}/${product.main}`}" alt="${name}"
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
                ${typeof SpamGuard !== 'undefined' ? SpamGuard.honeypotHTML() : ''}
            </form>

            <div class="order-success" id="soSuccess">
                <div class="order-success-icon">✓</div>
                <div class="order-success-msg">${isAr ? 'تم تأكيد طلبك بنجاح' : 'Order confirmed successfully'}</div>
                <div class="order-success-sub">${isAr ? 'سنتواصل معكِ قريباً' : 'We will contact you soon'}</div>
            </div>
        </div>
    </div>`;

    //

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

    const _soOpenedAt = Date.now();

    document.getElementById('siteOrderForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const customerName = document.getElementById('soName').value.trim();
        const phone = document.getElementById('soPhone').value.trim();
        const address = document.getElementById('soAddress').value.trim();

        if (!customerName || !phone || !address) {
            const errEl = document.getElementById('soError');
            errEl.textContent = isAr ? 'يرجى ملء جميع الحقول' : 'Please fill in all fields';
            errEl.classList.add('is-visible');
            return;
        }

        const btn = document.getElementById('soSubmitBtn');
        const label = document.getElementById('soSubmitLabel');
        btn.disabled = true;
        label.innerHTML = '<span class="order-loading-dots"><span></span><span></span><span></span></span>';

        /* ── Spam Guard ── */
        if (typeof SpamGuard !== 'undefined') {
            const guard = SpamGuard.check(_soOpenedAt);
            if (guard.blocked) {
                btn.disabled = false;
                label.textContent = isAr ? 'تأكيد الطلب' : 'Confirm Order';
                const errEl = document.getElementById('soError');
                errEl.innerHTML = SpamGuard.errorMsg(guard.reason, lang);
                errEl.classList.add('is-visible');
                return;
            }
        }

        /* ── Fetch IP ── */
        let _soIP = null, _soCountry = null, _soCity = null;
        if (typeof SpamGuard !== 'undefined') {
            const geo = await SpamGuard.getClientIP();
            _soIP = geo.ip;
            _soCountry = geo.country;
            _soCity = geo.city;
        }

        /* ── Find offer index from product pricing ── */
        let offerIndex = 0;
        const pricingRows = product.pricing?.[lang] || product.pricing?.ar || [];
        const matchIdx = pricingRows.findIndex(r => r.label === selectedRow.label);
        if (matchIdx >= 0) offerIndex = matchIdx;

        try {
            /* ── SERVER-SIDE ORDER CREATION (price validated from DB) ── */
            const response = await fetch('/api/create-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: customerName,
                    phone,
                    address,
                    lang,
                    items: [{
                        product_id: product.id,
                        offer_index: offerIndex,
                        qty: 1,
                        size: size || '',
                        color: color || '',
                        notes: notes || '',
                        code: product.code || ''
                    }],
                    client_ip: _soIP,
                    client_country: _soCountry,
                    client_city: _soCity,
                    fingerprint: (typeof DalalFingerprint !== 'undefined') ? await DalalFingerprint.get() : null
                }),
                signal: AbortSignal.timeout(15000)
            });

            const result = await response.json();

            if (!response.ok) {
                if (result.error === 'phone_blocked') {
                    btn.disabled = false;
                    label.textContent = isAr ? 'تأكيد الطلب' : 'Confirm Order';
                    const errEl = document.getElementById('soError');
                    errEl.textContent = isAr
                        ? 'عذراً، لا يمكنك إتمام الطلب. للاستفسار تواصلي معنا.'
                        : 'Sorry, you cannot place an order. Please contact us.';
                    errEl.classList.add('is-visible');
                    return;
                }
                if (result.error === 'out_of_stock') {
                    btn.disabled = false;
                    label.textContent = isAr ? 'تأكيد الطلب' : 'Confirm Order';
                    alert(isAr ? 'عذراً، هذا المنتج غير متوفر حالياً.' : 'Sorry, this product is currently out of stock.');
                    return;
                }
                if (result.error === 'rate_limited') {
                    btn.disabled = false;
                    label.textContent = isAr ? 'تأكيد الطلب' : 'Confirm Order';
                    const errEl = document.getElementById('soError');
                    errEl.textContent = isAr
                        ? 'لقد أرسلت عدة طلبات في وقت قصير. يرجى الانتظار 30 دقيقة.'
                        : 'Too many orders in a short time. Please wait 30 minutes.';
                    errEl.classList.add('is-visible');
                    return;
                }
                throw new Error(result.message || 'Order failed');
            }

            const orderRef = result.order_ref;
            const savedId = result.id;
            const serverTotal = result.total;

            if (typeof SpamGuard !== 'undefined') SpamGuard.recordOrder();

            if (typeof saveOrderLocally === 'function') {
                saveOrderLocally({
                    ref: orderRef, dbId: savedId,
                    name: customerName, phone,
                    products: result.products || [],
                    total: serverTotal, status: 'pending',
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

    // Block checkout if any item is out of stock
    if (typeof DALAL_PRODUCTS_STOCK !== 'undefined') {
        const outOfStock = cart.filter(item => {
            const stock = DALAL_PRODUCTS_STOCK[item.id];
            return stock && stock.visibility_status !== 'visible';
        });
        if (outOfStock.length > 0) {
            const names = outOfStock.map(i => isAr ? i.nameAr : i.nameEn).join('، ');
            alert(isAr
                ? `المنتجات التالية غير متوفرة حالياً:\n${names}\n\nيرجى إزالتها من السلة أولاً.`
                : `The following items are out of stock:\n${names}\n\nPlease remove them from your cart first.`
            );
            return;
        }
    }

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
            i.size ? (isAr ? `مقاس: ${i.size}` : `Size: ${i.size}`) : '',
            i.color ? (isAr ? `لون: ${i.color}` : `Color: ${i.color}`) : '',
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
                    <label class="order-label" for="coEmail">${isAr ? 'البريد الإلكتروني' : 'Email'}</label>
                    <input class="order-input" id="coEmail" type="email" placeholder="example@email.com" autocomplete="email">
                    <span class="order-field-hint">${isAr ? '(اختياري — لتلقي تحديثات الطلب)' : '(optional — to receive order updates)'}</span>
                </div>
                <div class="order-field">
                    <label class="order-label" for="coAddress">${isAr ? 'العنوان' : 'Address'}</label>
                    <input class="order-input" id="coAddress" type="text" placeholder="${isAr ? 'المحافظة / المدينة / الشارع' : 'Governorate / City / Street'}" required>
                </div>
                <div class="order-error" id="coError"></div>
                <button type="submit" class="order-submit-btn" id="coSubmitBtn">
                    <span id="coSubmitLabel">${isAr ? 'تأكيد الطلب' : 'Confirm Order'}</span>
                </button>
                ${typeof SpamGuard !== 'undefined' ? SpamGuard.honeypotHTML() : ''}
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
    if (typeof DalalModal !== 'undefined') DalalModal.lock();
    else document.body.style.overflow = 'hidden';

    const closeModal = () => {
        overlay.classList.remove('is-open');
        setTimeout(() => overlay.remove(), 350);
        if (typeof DalalModal !== 'undefined') DalalModal.unlock();
        else document.body.style.overflow = '';
    };

    document.getElementById('cartOrderClose').addEventListener('click', closeModal);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

    /* Drag to dismiss (mobile) */
    const card = overlay.querySelector('.order-modal');
    if (typeof DalalModal !== 'undefined') {
        DalalModal.setupDrag(card, closeModal);
    } else {
        let _startY = 0, _currentY = 0, _dragging = false;
        card.addEventListener('touchstart', e => {
            if (window.innerWidth >= 640 || card.scrollTop > 0) return;
            _dragging = true;
            _startY = e.touches[0].clientY;
            _currentY = 0;
            card.style.transition = 'none';
        }, { passive: true });
        card.addEventListener('touchmove', e => {
            if (!_dragging) return;
            const dy = e.touches[0].clientY - _startY;
            if (dy < 0) return;
            _currentY = dy;
            card.style.transform = `translateY(${dy}px)`;
            e.preventDefault();
        }, { passive: false });
        card.addEventListener('touchend', () => {
            if (!_dragging) return;
            _dragging = false;
            card.style.transition = 'transform 0.35s cubic-bezier(0.4,0,0.2,1)';
            if (_currentY > 120) {
                card.style.transform = 'translateY(100%)';
                setTimeout(closeModal, 300);
            } else card.style.transform = '';
        });
    }

    /* Numbers only */
    overlay.querySelector('#coPhone').addEventListener('input', function () {
        this.value = this.value.replace(/[^0-9]/g, '');
    });

    const _coOpenedAt = Date.now();

    document.getElementById('cartOrderForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('coName').value.trim();
        const phone = document.getElementById('coPhone').value.trim();
        const email = document.getElementById('coEmail')?.value.trim() || '';
        const address = document.getElementById('coAddress').value.trim();

        if (!name || !phone || !address) {
            const shake = (id) => {
                const el = document.getElementById(id);
                if (!el) return;
                el.classList.remove('input-error');
                void el.offsetWidth;
                el.classList.add('input-error');
                setTimeout(() => el.classList.remove('input-error'), 600);
            };
            if (!name) shake('coName');
            if (!phone) shake('coPhone');
            if (!address) shake('coAddress');
            return;
        }

        const btn = document.getElementById('coSubmitBtn');
        const label = document.getElementById('coSubmitLabel');
        btn.disabled = true;
        label.innerHTML = '<span class="order-loading-dots"><span></span><span></span><span></span></span>';

        /* ── Spam Guard ── */
        if (typeof SpamGuard !== 'undefined') {
            const guard = SpamGuard.check(_coOpenedAt);
            if (guard.blocked) {
                btn.disabled = false;
                label.textContent = isAr ? 'تأكيد الطلب' : 'Confirm Order';
                const errEl = document.getElementById('coError');
                errEl.innerHTML = SpamGuard.errorMsg(guard.reason, lang);
                errEl.classList.add('is-visible');
                return;
            }
        }

        /* ── Fetch IP ── */
        let _coIP = null, _coCountry = null, _coCity = null;
        if (typeof SpamGuard !== 'undefined') {
            const geo = await SpamGuard.getClientIP();
            _coIP = geo.ip;
            _coCountry = geo.country;
            _coCity = geo.city;
        }

        /* ── Build items array with product IDs + offer indices (NO prices from client) ── */
        const items = cart.map(i => {
            // Find the offer index by matching the priceLabel against the product's pricing rows
            let offerIndex = 0;
            if (typeof DALAL_PRODUCTS_MAP !== 'undefined') {
                const product = DALAL_PRODUCTS_MAP[i.id];
                if (product && product.pricing) {
                    const rows = product.pricing[lang] || product.pricing.ar || [];
                    const idx = rows.findIndex(r => r.label === i.priceLabel);
                    if (idx >= 0) offerIndex = idx;
                }
            }
            return {
                product_id: i.id,
                offer_index: offerIndex,
                qty: i.qty,
                size: i.size || '',
                color: i.color || '',
                notes: i.notes || '',
                code: i.code || ''
            };
        });

        try {
            /* ── SERVER-SIDE ORDER CREATION (price validated from DB) ── */
            const response = await fetch('/api/create-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    phone,
                    email: email || null,
                    address,
                    lang,
                    items,
                    client_ip: _coIP,
                    client_country: _coCountry,
                    client_city: _coCity,
                    fingerprint: (typeof DalalFingerprint !== 'undefined') ? await DalalFingerprint.get() : null
                }),
                signal: AbortSignal.timeout(15000)
            });

            const result = await response.json();

            if (!response.ok) {
                // Handle specific server errors
                if (result.error === 'phone_blocked') {
                    btn.disabled = false;
                    label.textContent = isAr ? 'تأكيد الطلب' : 'Confirm Order';
                    const errEl = document.getElementById('coError');
                    errEl.textContent = isAr
                        ? 'عذراً، لا يمكنك إتمام الطلب. للاستفسار تواصلي معنا.'
                        : 'Sorry, you cannot place an order. Please contact us.';
                    errEl.classList.add('is-visible');
                    return;
                }
                if (result.error === 'out_of_stock') {
                    btn.disabled = false;
                    label.textContent = isAr ? 'تأكيد الطلب' : 'Confirm Order';
                    alert(isAr
                        ? 'عذراً، بعض المنتجات أصبحت غير متوفرة. يرجى إزالتها من السلة.'
                        : 'Sorry, some items are now out of stock. Please remove them from your cart.');
                    return;
                }
                if (result.error === 'rate_limited') {
                    btn.disabled = false;
                    label.textContent = isAr ? 'تأكيد الطلب' : 'Confirm Order';
                    const errEl = document.getElementById('coError');
                    errEl.textContent = isAr
                        ? 'لقد أرسلت عدة طلبات في وقت قصير. يرجى الانتظار 30 دقيقة.'
                        : 'Too many orders in a short time. Please wait 30 minutes.';
                    errEl.classList.add('is-visible');
                    return;
                }
                throw new Error(result.message || 'Order failed');
            }

            const orderRef = result.order_ref;
            const savedId = result.id;
            const serverTotal = result.total;

            if (typeof SpamGuard !== 'undefined') SpamGuard.recordOrder();

            if (typeof saveOrderLocally === 'function') {
                saveOrderLocally({
                    ref: orderRef, dbId: savedId, name, phone,
                    products: result.products || [], total: serverTotal, status: 'pending',
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
            playSuccessSound();
            cartClear(true);
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
    const isAr = lang === 'ar';

    // Block checkout if any item is out of stock
    if (typeof DALAL_PRODUCTS_STOCK !== 'undefined') {
        const outOfStock = cart.filter(item => {
            const stock = DALAL_PRODUCTS_STOCK[item.id];
            return stock && stock.visibility_status !== 'visible';
        });
        if (outOfStock.length > 0) {
            const names = outOfStock.map(i => isAr ? i.nameAr : i.nameEn).join('، ');
            alert(isAr
                ? `المنتجات التالية غير متوفرة حالياً:\n${names}\n\nيرجى إزالتها من السلة أولاً.`
                : `The following items are out of stock:\n${names}\n\nPlease remove them from your cart first.`
            );
            return;
        }
    }

    const lines = cart.map(i => {
        const name = lang === 'ar' ? i.nameAr : i.nameEn;

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
        if (i.size) line += lang === 'ar' ? `\n   المقاس: ${i.size}` : `\n   Size: ${i.size}`;
        if (i.color) line += lang === 'ar' ? `\n   اللون: ${i.color}` : `\n   Color: ${i.color}`;
        if (i.notes) line += lang === 'ar' ? `\n   ملاحظات: ${i.notes}` : `\n   Notes: ${i.notes}`;
        return line;
    }).join('\n\n');

    const total = cartTotal().toLocaleString();

    openMessengerWithContact(({ phone, email }) => {
        let msg = lang === 'ar'
            ? `DALAL — طلب جديد\n${'─'.repeat(28)}\n\n${lines}\n\n${'─'.repeat(28)}\nالاجمالي: ${total} جنيه`
            : `DALAL — New Order\n${'─'.repeat(28)}\n\n${lines}\n\n${'─'.repeat(28)}\nTotal: ${total} EGP`;
        if (phone) msg += lang === 'ar' ? `\n\nرقم الهاتف: ${phone}` : `\n\nPhone: ${phone}`;
        if (email) msg += lang === 'ar' ? `\nالإيميل: ${email}` : `\nEmail: ${email}`;
        return msg;
    });
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
            <a href="products.html" onclick="closeCart()"
               class="btn btn-secondary"
               style="margin-top:0.75rem;font-size:0.82rem;padding:0.65rem 1.5rem;display:inline-flex;align-items:center;gap:0.4rem;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/>
                    <path d="M16 10a4 4 0 0 1-8 0"/>
                </svg>
                <span id="cartShopNowLabel">${isAr ? 'تسوّقي الآن' : 'Shop Now'}</span>
            </a>
            <div id="cartRecentlyViewed" style="margin-top:1.25rem;width:100%;"></div>
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
            <button class="btn btn-primary cart-checkout-btn" id="cartCheckoutBtn" onclick="checkoutViaSite()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                    <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                </svg>
                <span class="btn-stack">
                    <span class="btn-stack-title" id="cartSiteOrderLabel">${isAr ? 'اطلبي الآن' : 'Order Now'}</span>
                    <span class="btn-stack-sub">${isAr ? 'سجّلي طلبك وتابعيه من طلباتي' : 'Place & track your order'}</span>
                </span>
            </button>
            <div class="btn-secondary-row" style="margin-top:0">
                <button class="btn btn-ghost btn-secondary-row-item" id="cartMessengerBtn" onclick="checkoutViaMessenger()">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                        <path d="M12 2C6.477 2 2 6.145 2 11.243c0 2.907 1.434 5.503 3.678 7.199V22l3.38-1.853c.9.25 1.855.384 2.842.384h.1c5.523 0 10-4.145 10-9.243S17.523 2 12 2zm1.076 12.457l-2.55-2.72-4.98 2.72 5.474-5.81 2.613 2.72 4.916-2.72-5.473 5.81z"/>
                    </svg>
                    <span class="btn-stack">
                        <span class="btn-stack-title" id="cartCheckoutLabel">${isAr ? 'الطلب عبر ماسنجر' : 'Order via Messenger'}</span>
                        <span class="btn-stack-sub">${isAr ? 'تواصلي مباشرة معنا' : 'Chat with us directly'}</span>
                    </span>
                </button>
            </div>
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
    set('cartEmptyText', isAr ? 'السلة فارغة' : 'Your cart is empty');
    set('cartShopNowLabel', isAr ? 'تسوّقي الآن' : 'Shop Now');
    set('cartTotalLabel', isAr ? 'الإجمالي' : 'Total');
    set('cartClearLabel', isAr ? 'إفراغ السلة' : 'Clear Cart');
    set('cartCheckoutLabel', isAr ? 'الطلب عبر ماسنجر' : 'Order via Messenger');
    set('cartSiteOrderLabel', isAr ? 'اطلبي الآن' : 'Order Now');
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

    window.createProductCard = function (product) {
        const article = original(product);
        const lang = localStorage.getItem('dalal-lang') || 'ar';
        const info = article.querySelector('.product-info');
        if (!info) return article;

        // Check product stock status
        const stockInfo = DALAL_PRODUCTS_STOCK[product.id] || { in_stock: true, visibility_status: 'visible' };
        const isOutOfStock = stockInfo.visibility_status === 'out_of_stock';

        // Replace the existing btn-order with two buttons
        const existingBtn = info.querySelector('.btn-order');
        if (existingBtn) existingBtn.remove();

        const btnWrap = document.createElement('div');
        btnWrap.className = 'product-card-btns';

        const addBtn = document.createElement('button');
        addBtn.className = 'btn-cart-add';
        addBtn.setAttribute('data-product-id', product.id);

        // Disable button for out of stock products
        if (isOutOfStock) {
            addBtn.disabled = true;
            addBtn.style.opacity = '0.4';
            addBtn.style.cursor = 'not-allowed';
            addBtn.title = lang === 'ar' ? 'المنتج غير متوفر حالياً' : 'Product currently out of stock';
        }

        addBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
            </svg>
            <span>${lang === 'ar' ? 'أضيفي للسلة' : 'Add to Cart'}</span>
        `;

        // Only add click listener if product is available
        if (!isOutOfStock) {
            addBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                openQuickAddModal(product);
            });
        }

        const productUrl = product.slug ? `product.html#${product.slug}` : `product.html?id=${product.id}`;
        const orderBtn = document.createElement('a');
        orderBtn.href = productUrl;
        orderBtn.className = 'btn btn-order';
        orderBtn.textContent = lang === 'ar' ? 'اطلبي الآن' : 'Order Now';

        btnWrap.appendChild(addBtn);
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
            window.applyLanguage = function (lang) {
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

/* ─── Swipe to dismiss drawers (mobile) ─── */
function initDrawerSwipe(drawer, closeFn) {
    if (!drawer || drawer._swipeInit) return;
    drawer._swipeInit = true;

    let startX = 0, startY = 0, currentX = 0, startTime = 0, dragging = false;

    drawer.addEventListener('touchstart', e => {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        startTime = Date.now();
        currentX = 0;
        dragging = true;
        drawer.style.transition = 'none';
    }, { passive: true });

    drawer.addEventListener('touchmove', e => {
        if (!dragging) return;
        const dx = e.touches[0].clientX - startX;
        const dy = Math.abs(e.touches[0].clientY - startY);
        if (dy > Math.abs(dx)) return;
        const isRTL = document.documentElement.dir === 'rtl';
        const swipeClose = isRTL ? dx > 0 : dx < 0;
        if (!swipeClose) return;
        currentX = dx;
        drawer.style.transform = `translateX(${dx}px)`;
    }, { passive: true });

    drawer.addEventListener('touchend', () => {
        if (!dragging) return;
        dragging = false;
        drawer.style.transition = '';
        const isRTL = document.documentElement.dir === 'rtl';
        const elapsed = Date.now() - startTime;
        const velocity = Math.abs(currentX) / elapsed; // px/ms
        // Close if: dragged > 80px OR fast flick (velocity > 0.3 px/ms with > 20px drag)
        const shouldClose = isRTL
            ? (currentX > 80 || (velocity > 0.3 && currentX > 20))
            : (currentX < -80 || (velocity > 0.3 && currentX < -20));
        if (shouldClose) {
            closeFn();
        } else {
            drawer.style.transform = '';
        }
    });
}

/* ─── Wishlist Drawer ─── */
function updateWishlistBadge() {
    const count = getWishlist().length;
    document.querySelectorAll('#wishlistBadge').forEach(el => {
        el.textContent = count;
        el.style.display = count > 0 ? 'flex' : 'none';
    });
}

function renderWishlistItems() {
    const container = document.getElementById('wishlistItems');
    const emptyEl = document.getElementById('wishlistEmpty');
    if (!container) return;

    const lang = localStorage.getItem('dalal-lang') || 'ar';
    const ids = getWishlist();

    if (!ids.length) {
        container.innerHTML = '';
        if (emptyEl) emptyEl.style.display = 'flex';
        return;
    }
    if (emptyEl) emptyEl.style.display = 'none';

    // Update texts
    const titleEl = document.getElementById('wishlistTitle');
    const emptyTxt = document.getElementById('wishlistEmptyText');
    const emptyHint = document.getElementById('wishlistEmptyHint');
    if (titleEl) titleEl.textContent = lang === 'ar' ? 'المفضلة' : 'Wishlist';
    if (emptyTxt) emptyTxt.textContent = lang === 'ar' ? 'قائمة المفضلة فارغة' : 'Your wishlist is empty';
    if (emptyHint) emptyHint.textContent = lang === 'ar' ? 'اضغطي على القلب على أي منتج لإضافته' : 'Tap the heart on any product to save it';

    if (typeof DALAL_PRODUCTS_MAP === 'undefined') {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = ids.map(id => {
        const p = DALAL_PRODUCTS_MAP[id];
        if (!p) return '';
        const name = typeof p.name === 'object' ? (p.name[lang] || p.name.ar) : p.name;
        const url = p.slug ? `product.html#${p.slug}` : `product.html?id=${p.id}`;
        const pricingRows = p.pricing?.[lang] || p.pricing?.ar || [];
        const price = pricingRows.length ? pricingRows[0].value : '';
        return `
        <div class="wishlist-item" data-id="${id}">
            <img class="wishlist-item-img" src="${p.folder}/${p.main}" alt="${name}" loading="lazy">
            <div class="wishlist-item-info">
                <a href="${url}" class="wishlist-item-name" onclick="closeWishlist()">${name}</a>
                ${price ? `<span class="wishlist-item-price">${lang === 'ar' ? 'يبدأ من' : 'From'} ${price}</span>` : ''}
            </div>
            <button class="wishlist-item-remove" onclick="removeFromWishlist(${id})" aria-label="إزالة">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
        </div>`;
    }).join('');
}

function removeFromWishlist(id) {
    toggleWishlist(id);
    updateWishlistBadge();
    renderWishlistItems();
}

function openWishlist() {
    renderWishlistItems();
    const drawer = document.getElementById('wishlistDrawer');
    document.getElementById('wishlistOverlay')?.classList.add('active');
    if (!drawer) return;
    drawer.classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeWishlist() {
    document.getElementById('wishlistDrawer')?.classList.remove('open');
    document.getElementById('wishlistOverlay')?.classList.remove('active');
    document.body.style.overflow = '';
}

// Update badge on page load
document.addEventListener('DOMContentLoaded', () => {
    updateWishlistBadge();
    // Bind wishlist toggle button
    document.querySelectorAll('#wishlistToggle').forEach(btn => {
        btn.addEventListener('click', openWishlist);
    });
});
