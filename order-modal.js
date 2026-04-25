/* ═══════════════════════════════════════════════════════════════
   DALAL — Order Modal
   ═══════════════════════════════════════════════════════════════ */

(function () {
    'use strict';

    const T = {
        ar: {
            title:      'سجّلي طلبك',
            name:       'الاسم',
            namePh:     'اكتب أسمك',
            phone:      'رقم الهاتف',
            phonePh:    '01xxxxxxxxx',
            email:      'البريد الإلكتروني',
            emailHint:  '(اختياري — لتلقي تحديثات الطلب)',
            address:    'العنوان',
            addressPh:  'المحافظة / المدينة / الشارع',
            size:       'المقاس',
            sizePh:     'اختاري المقاس',
            color:      'اللون',
            colorPh:    'مثال: أبيض، أسود، بيج...',
            offer:      'العرض',
            offerPh:    'اختاري العرض',
            submit:     'تأكيد الطلب',
            successMsg: 'تم تأكيد طلبك بنجاح ✓',
            successSub: 'سنتواصل معكِ قريباً لتأكيد التوصيل',
            errorMsg:   'حدث خطأ، يرجى المحاولة مرة أخرى',
            fillAll:    'يرجى ملء جميع الحقول',
            from:       'يبدأ من',
        },
        en: {
            title:      'Place Your Order',
            name:       'Name',
            namePh:     'Your full name',
            phone:      'Phone',
            phonePh:    '01xxxxxxxxx',
            email:      'Email',
            emailHint:  '(optional — to receive order updates)',
            address:    'Address',
            addressPh:  'Governorate / City / Street',
            size:       'Size',
            sizePh:     'Select size',
            color:      'Color',
            colorPh:    'e.g. White, Black, Beige...',
            offer:      'Offer',
            offerPh:    'Select offer',
            submit:     'Confirm Order',
            successMsg: 'Order confirmed successfully ✓',
            successSub: 'We will contact you soon to confirm delivery',
            errorMsg:   'Something went wrong, please try again',
            fillAll:    'Please fill in all fields',
            from:       'From',
        }
    };

    let _injected = false;
    let _product  = null;
    let _dragStartY = 0, _dragCurrentY = 0, _isDragging = false;
    let _formOpenedAt = 0;

    /* ── Inject HTML once ── */
    function inject() {
        if (_injected) return;
        _injected = true;

        const el = document.createElement('div');
        el.innerHTML = `
<div class="order-overlay" id="orderOverlay" role="dialog" aria-modal="true" aria-labelledby="orderModalTitle">
  <div class="order-modal" id="orderModalCard">
    <div class="order-drag-handle" id="orderDragHandle"></div>
    <div class="order-modal-header">
      <h2 class="order-modal-title" id="orderModalTitle"></h2>
      <button class="order-modal-close" id="orderModalClose" aria-label="إغلاق">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
    <div class="order-modal-divider"></div>
    <div class="order-product-preview" id="orderProductPreview">
      <img id="orderProductImg" src="" alt="" width="52" height="52">
      <div>
        <div class="order-product-preview-name" id="orderProductName"></div>
        <div class="order-product-preview-price" id="orderProductPrice"></div>
      </div>
    </div>
    <form id="orderForm" novalidate>
      <div class="order-field">
        <label class="order-label" id="orderLabelName" for="orderInputName"></label>
        <input class="order-input" id="orderInputName" type="text" autocomplete="name" required>
      </div>
      <div class="order-field">
        <label class="order-label" id="orderLabelPhone" for="orderInputPhone"></label>
        <input class="order-input" id="orderInputPhone" type="tel" autocomplete="tel" inputmode="numeric" pattern="[0-9]*" required>
      </div>
      <div class="order-field">
        <label class="order-label" id="orderLabelEmail" for="orderInputEmail"></label>
        <input class="order-input" id="orderInputEmail" type="email" autocomplete="email" placeholder="example@email.com">
        <span class="order-field-hint" id="orderEmailHint">(اختياري — لتلقي تحديثات الطلب)</span>
      </div>
      <div class="order-field">
        <label class="order-label" id="orderLabelAddress" for="orderInputAddress"></label>
        <input class="order-input" id="orderInputAddress" type="text" autocomplete="street-address" required>
      </div>
      <div class="order-field">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
            <label class="order-label" id="orderLabelSize" for="orderSelectSize" style="margin-bottom:0;"></label>
            <button type="button" onclick="if(typeof openSizeGuide === 'function') openSizeGuide();" style="background:transparent; border:none; color:var(--gold); font-size:0.7rem; display:flex; align-items:center; gap:0.2rem; cursor:pointer; text-decoration:none; padding:0;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="12" height="12"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"></path><path d="M4 19.5a2.5 2.5 0 0 0 2.5 2.5H20"></path></svg>
                <span id="orderSizeGuideText" style="border-bottom: 1px dashed var(--gold);">دليل المقاسات</span>
            </button>
        </div>
        <div class="order-select-wrapper">
          <select class="order-select" id="orderSelectSize" required></select>
        </div>
      </div>
      <div class="order-field">
        <label class="order-label" id="orderLabelColor" for="orderInputColor"></label>
        <input class="order-input" id="orderInputColor" type="text">
      </div>
      <div class="order-field">
        <label class="order-label" id="orderLabelOffer" for="orderSelectOffer"></label>
        <div class="order-select-wrapper">
          <select class="order-select" id="orderSelectOffer" required></select>
        </div>
      </div>
      <div class="order-error" id="orderError"></div>
      <button type="submit" class="order-submit-btn" id="orderSubmitBtn">
        <span id="orderSubmitLabel"></span>
      </button>
      ${typeof SpamGuard !== 'undefined' ? SpamGuard.honeypotHTML() : ''}
    </form>
    <div class="order-success" id="orderSuccess">
      <div class="order-success-icon">✓</div>
      <div class="order-success-msg" id="orderSuccessMsg"></div>
      <div class="order-success-sub" id="orderSuccessSub"></div>
    </div>
  </div>
</div>`;
        document.body.appendChild(el.firstElementChild);

        document.getElementById('orderModalClose').addEventListener('click', closeOrderModal);
        document.getElementById('orderOverlay').addEventListener('click', e => {
            if (e.target === e.currentTarget) closeOrderModal();
        });
        document.addEventListener('keydown', e => { if (e.key === 'Escape') closeOrderModal(); });
        document.getElementById('orderForm').addEventListener('submit', handleSubmit);

        /* Numbers only for phone */
        document.getElementById('orderInputPhone').addEventListener('input', function () {
            this.value = this.value.replace(/[^0-9]/g, '');
        });

        /* Drag to dismiss */
        const card = document.getElementById('orderModalCard');
        if (typeof DalalModal !== 'undefined') {
            DalalModal.setupDrag(card, closeOrderModal);
        } else {
            card.addEventListener('touchstart', e => {
                if (window.innerWidth >= 640 || card.scrollTop > 0) return;
                _isDragging = true;
                _dragStartY = e.touches[0].clientY;
                _dragCurrentY = 0;
                card.style.transition = 'none';
            }, { passive: true });
            card.addEventListener('touchmove', e => {
                if (!_isDragging) return;
                const dy = e.touches[0].clientY - _dragStartY;
                if (dy < 0) return;
                _dragCurrentY = dy;
                card.style.transform = `translateY(${dy}px)`;
                e.preventDefault();
            }, { passive: false });
            card.addEventListener('touchend', () => {
                if (!_isDragging) return;
                _isDragging = false;
                card.style.transition = 'transform 0.35s cubic-bezier(0.4,0,0.2,1)';
                if (_dragCurrentY > 120) {
                    card.style.transform = 'translateY(100%)';
                    setTimeout(closeOrderModal, 300);
                } else card.style.transform = '';
            });
        }
    }

    /* ── Input Sanitization ── */
    function sanitize(str, maxLen) {
        if (!str) return '';
        return str
            .replace(/<[^>]*>/g, '')   // strip HTML tags
            .replace(/[<>]/g, '')      // strip any remaining angle brackets
            .replace(/\s+/g, ' ')      // normalize whitespace
            .trim()
            .slice(0, maxLen || 200);
    }
    function sanitizePhone(str) {
        if (!str) return '';
        return str.replace(/[^0-9+]/g, '').slice(0, 20);
    }

    /* ── Open ── */
    function openOrderModal(product) {
        const wasInjected = _injected;
        inject();
        _product = product;

        const lang = localStorage.getItem('dalal-lang') || 'ar';
        const t    = T[lang] || T.ar;

        /* Reset */
        document.getElementById('orderForm').style.display = '';
        document.getElementById('orderSuccess').classList.remove('is-visible');
        document.getElementById('orderError').classList.remove('is-visible');
        document.getElementById('orderForm').reset();
        document.getElementById('orderModalCard').style.transform = '';
        document.getElementById('orderInputEmail') && (document.getElementById('orderInputEmail').value = '');
        const btn = document.getElementById('orderSubmitBtn');
        btn.disabled = false;
        document.getElementById('orderSubmitLabel').textContent = t.submit;

        /* Texts */
        document.getElementById('orderModalTitle').textContent   = t.title;
        document.getElementById('orderLabelName').textContent    = t.name;
        document.getElementById('orderInputName').placeholder    = t.namePh;
        document.getElementById('orderLabelPhone').textContent   = t.phone;
        document.getElementById('orderInputPhone').placeholder   = t.phonePh;
        document.getElementById('orderLabelEmail').textContent   = t.email;
        document.getElementById('orderEmailHint').textContent    = t.emailHint;
        document.getElementById('orderLabelAddress').textContent = t.address;
        document.getElementById('orderInputAddress').placeholder = t.addressPh;
        document.getElementById('orderLabelSize').textContent    = t.size;
        document.getElementById('orderSizeGuideText').textContent = lang === 'ar' ? 'دليل المقاسات' : 'Size Guide';
        document.getElementById('orderLabelColor').textContent   = t.color;
        document.getElementById('orderInputColor').placeholder   = t.colorPh;
        document.getElementById('orderLabelOffer').textContent   = t.offer;
        document.getElementById('orderSubmitLabel').textContent  = t.submit;
        document.getElementById('orderSuccessMsg').textContent   = t.successMsg;
        document.getElementById('orderSuccessSub').textContent   = t.successSub;

        /* Product preview */
        const name        = typeof product.name === 'object' ? (product.name[lang] || product.name.ar) : product.name;
        const pricingRows = product.pricing?.[lang] || product.pricing?.ar || [];
        const startPrice  = pricingRows.length ? pricingRows[0].value : '';
        // Use main_image_url if available, otherwise fallback to folder/main
        const imgSrc = product.main_image_url || `${product.folder}/${product.main}`;
        document.getElementById('orderProductImg').src           = imgSrc;
        document.getElementById('orderProductImg').alt           = name;
        document.getElementById('orderProductName').textContent  = name;
        document.getElementById('orderProductPrice').textContent = startPrice ? `${t.from} ${startPrice}` : '';

        /* Sizes */
        const sizeSelect = document.getElementById('orderSelectSize');
        sizeSelect.innerHTML = `<option value="">${t.sizePh}</option>`;
        (product.sizes || []).forEach(s => {
            const opt = document.createElement('option');
            opt.value = s; opt.textContent = s;
            sizeSelect.appendChild(opt);
        });

        /* Offers */
        const offerSelect = document.getElementById('orderSelectOffer');
        offerSelect.innerHTML = `<option value="">${t.offerPh}</option>`;
        pricingRows.forEach((row, i) => {
            const opt = document.createElement('option');
            opt.value = i;
            opt.textContent = `${row.label} — ${row.value}`;
            offerSelect.appendChild(opt);
        });

        /* Open — if just injected, wait one rAF so the browser paints the element
           before adding is-open, otherwise the CSS transition won't fire */
        const doOpen = () => {
            document.getElementById('orderOverlay').classList.add('is-open');
            if (typeof DalalModal !== 'undefined') {
                DalalModal.lock();
                DalalModal.pushState('orderModal', closeOrderModal);
            } else {
                document.body.style.overflow = 'hidden';
            }
            setTimeout(() => document.getElementById('orderInputName').focus(), 400);
        };

        if (!wasInjected) {
            requestAnimationFrame(() => requestAnimationFrame(doOpen));
        } else {
            doOpen();
        }
        _formOpenedAt = Date.now();
    }

    /* ── Close ── */
    function closeOrderModal() {
        const overlay = document.getElementById('orderOverlay');
        if (!overlay) return;
        overlay.classList.remove('is-open');
        if (typeof DalalModal !== 'undefined') {
            DalalModal.unlock();
            // Pop history state (unless this was triggered by browser back)
            const stack = DalalModal._stack;
            if (stack.length > 0 && stack[stack.length - 1]?.id === 'orderModal') {
                DalalModal.popState();
            }
        } else {
            document.body.style.overflow = '';
        }
    }

    /* ── Submit ── */
    async function handleSubmit(e) {
        e.preventDefault();
        const lang = localStorage.getItem('dalal-lang') || 'ar';
        const t    = T[lang] || T.ar;

        const name     = sanitize(document.getElementById('orderInputName').value, 100);
        const phone    = sanitizePhone(document.getElementById('orderInputPhone').value);
        const email    = (document.getElementById('orderInputEmail').value || '').trim().slice(0, 254);
        const address  = sanitize(document.getElementById('orderInputAddress').value, 300);
        const sizeVal  = sanitize(document.getElementById('orderSelectSize').value, 20);
        const colorVal = sanitize(document.getElementById('orderInputColor').value, 50);
        const offerIdx = document.getElementById('orderSelectOffer').value;

        if (!name || !phone || !address || !sizeVal || offerIdx === '') {
            if (!name)    shakeInput('orderInputName');
            if (!phone)   shakeInput('orderInputPhone');
            if (!address) shakeInput('orderInputAddress');
            if (!sizeVal || offerIdx === '') {
                document.querySelectorAll('.order-select').forEach(s => {
                    if (!s.value) { s.classList.add('input-error'); setTimeout(() => s.classList.remove('input-error'), 600); }
                });
            }
            hideError();
            return;
        }

        const btn   = document.getElementById('orderSubmitBtn');
        const label = document.getElementById('orderSubmitLabel');
        btn.disabled = true;

        /* ── Spam Guard ── */
        if (typeof SpamGuard !== 'undefined') {
            const guard = SpamGuard.check(_formOpenedAt);
            if (guard.blocked) {
                btn.disabled = false;
                const errEl = document.getElementById('orderError');
                errEl.innerHTML = SpamGuard.errorMsg(guard.reason, lang);
                errEl.classList.add('is-visible');
                return;
            }
        }

        /* ── Honeypot value (for server-side check) ── */
        const honeypotEl = document.getElementById('dalal_website');
        const honeypotVal = honeypotEl ? honeypotEl.value : '';

        label.innerHTML = `<span class="order-loading-dots"><span></span><span></span><span></span></span>`;

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
                    items: [{
                        product_id: _product.id,
                        offer_index: parseInt(offerIdx),
                        qty: 1,
                        size: sizeVal,
                        color: colorVal || '',
                        notes: '',
                        code: _product.code || ''
                    }],
                    fingerprint: (typeof DalalFingerprint !== 'undefined') ? await DalalFingerprint.get() : null,
                    dalal_website: honeypotVal
                }),
                signal: AbortSignal.timeout(15000)
            });

            /* ── Parse response safely (handles Vercel crash pages) ── */
            let result;
            const ct = response.headers.get('content-type') || '';
            if (ct.includes('application/json')) {
                result = await response.json();
            } else {
                // Server returned HTML/text error (crash page)
                throw new Error('Server error');
            }

            if (!response.ok) {
                if (result.error === 'access_restricted' || result.error === 'phone_blocked' ||
                    result.error === 'ip_blocked' || result.error === 'device_blocked') {
                    btn.disabled = false;
                    label.textContent = t.submit;
                    const errEl = document.getElementById('orderError');
                    errEl.textContent = lang === 'ar'
                        ? 'عذراً، لا يمكنك إتمام الطلب. للاستفسار تواصل معنا.'
                        : 'Sorry, you cannot place an order. Please contact us.';
                    errEl.classList.add('is-visible');
                    return;
                }
                if (result.error === 'out_of_stock') {
                    btn.disabled = false;
                    label.textContent = t.submit;
                    const pName = typeof _product.name === 'object' ? (lang === 'ar' ? _product.name.ar : (_product.name.en || _product.name.ar)) : _product.name;
                    alert(lang === 'ar' ? `عذراً، "${pName}" غير متوفر حالياً.` : `Sorry, "${pName}" is currently out of stock.`);
                    return;
                }
                if (result.error === 'rate_limited' || result.error === 'duplicate') {
                    console.warn('[ORDER BLOCKED]', result.reason || 'UNKNOWN', result);
                    btn.disabled = false;
                    label.textContent = t.submit;
                    const errEl = document.getElementById('orderError');
                    errEl.textContent = lang === 'ar'
                        ? 'لقد أرسلت عدة طلبات في وقت قصير. يرجى الانتظار قليلاً.'
                        : 'Too many orders in a short time. Please wait a moment.';
                    errEl.classList.add('is-visible');
                    return;
                }
                throw new Error(result.message || 'Order failed');
            }

            const orderRef = result.order_ref;
            const savedId = result.id;
            const serverTotal = result.total;

            // Track Lead event (successful order) with enhanced data
            if (typeof DalalPixel !== 'undefined') {
                DalalPixel.trackLead({
                    total: serverTotal,
                    orderId: orderRef,
                    items: result.products || []
                });
            }

            if (typeof saveOrderLocally === 'function') {
                saveOrderLocally({
                    ref: orderRef, dbId: savedId, name, phone,
                    products: result.products || [],
                    total: serverTotal, status: 'pending',
                    date: new Date().toISOString()
                });
            }

            document.getElementById('orderForm').style.display = 'none';
            const lang2 = localStorage.getItem('dalal-lang') || 'ar';
            const t2    = T[lang2] || T.ar;
            document.getElementById('orderSuccessMsg').textContent = t2.successMsg;
            document.getElementById('orderSuccessSub').innerHTML =
                `${t2.successSub}<br>
                <span style="font-size:0.8rem;color:var(--text-dim);margin-top:0.4rem;display:block">
                    ${lang2 === 'ar' ? 'رقم طلبك' : 'Order ID'}: <strong style="color:var(--gold)">${orderRef}</strong>
                </span>
                <a href="track.html?ref=${orderRef}" style="color:var(--gold);text-decoration:underline;font-size:0.82rem;margin-top:0.4rem;display:inline-block">
                    ${lang2 === 'ar' ? 'تتبع طلبك ←' : 'Track your order ←'}
                </a>`;
            document.getElementById('orderSuccess').classList.add('is-visible');
            if (typeof playSuccessSound === 'function') playSuccessSound();
            // Show PWA install prompt after success
            setTimeout(() => {
                if (typeof showInstallPrompt === 'function') showInstallPrompt();
            }, 2000);
            setTimeout(closeOrderModal, 5000);
        } catch (err) {
            console.error('Order error:', err);
            btn.disabled = false;
            label.textContent = t.submit;
            showError(t.errorMsg);
        }
    }

    function showError(msg) {
        const el = document.getElementById('orderError');
        el.textContent = msg;
        el.classList.add('is-visible');
    }
    function hideError() {
        document.getElementById('orderError').classList.remove('is-visible');
    }

    function shakeInput(id) {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.remove('input-error');
        void el.offsetWidth; // reflow to restart animation
        el.classList.add('input-error');
        setTimeout(() => el.classList.remove('input-error'), 600);
    }

    window.openOrderModal  = openOrderModal;
    window.closeOrderModal = closeOrderModal;

})();
