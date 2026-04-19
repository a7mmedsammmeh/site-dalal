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
        <label class="order-label" id="orderLabelSize" for="orderSelectSize"></label>
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
            if (typeof DalalModal !== 'undefined') DalalModal.lock();
            else document.body.style.overflow = 'hidden';
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
        if (typeof DalalModal !== 'undefined') DalalModal.unlock();
        else document.body.style.overflow = '';
    }

    /* ── Submit ── */
    async function handleSubmit(e) {
        e.preventDefault();
        const lang = localStorage.getItem('dalal-lang') || 'ar';
        const t    = T[lang] || T.ar;

        const name     = document.getElementById('orderInputName').value.trim();
        const phone    = document.getElementById('orderInputPhone').value.trim();
        const email    = document.getElementById('orderInputEmail').value.trim();
        const address  = document.getElementById('orderInputAddress').value.trim();
        const sizeVal  = document.getElementById('orderSelectSize').value;
        const colorVal = document.getElementById('orderInputColor').value.trim();
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

        /* ── Check Stock Before Submit (Race Condition - LIVE DB FETCH) ── */
        if (_product && typeof getProductStock === 'function') {
            try {
                const stock = await getProductStock(_product.id);
                if (stock && stock.visibility_status !== 'visible') {
                    const isAr = lang === 'ar';
                    const pName = typeof _product.name === 'object' ? (isAr ? _product.name.ar : (_product.name.en || _product.name.ar)) : _product.name;
                    alert(isAr ? `عذراً، "${pName}" غير متوفر حالياً ولا يمكن إتمام الطلب.` : `Sorry, "${pName}" is currently out of stock.`);
                    return;
                }
            } catch (e) { /* ignore db errors and proceed */ }
        }

        const pricingRows   = _product.pricing?.[lang] || _product.pricing?.ar || [];
        const selectedOffer = pricingRows[parseInt(offerIdx)];
        const numericPrice  = parseFloat((selectedOffer?.value || '0').replace(/[^\d.]/g, '')) || 0;

        const orderRef = (typeof generateOrderRef === 'function') ? generateOrderRef() : ('DL-' + Math.random().toString(36).slice(2,7).toUpperCase());

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

        /* ── Phone Block Check (server-side) ── */
        try {
            const phoneCheck = await fetch(`/api/check-phone?phone=${encodeURIComponent(phone)}`, {
                signal: AbortSignal.timeout(5000)
            });
            if (phoneCheck.ok) {
                const pd = await phoneCheck.json();
                if (pd.blocked) {
                    btn.disabled = false;
                    const errEl = document.getElementById('orderError');
                    errEl.textContent = lang === 'ar'
                        ? 'عذراً، لا يمكنك إتمام الطلب. للاستفسار تواصل معنا.'
                        : 'Sorry, you cannot place an order. Please contact us.';
                    errEl.classList.add('is-visible');
                    return;
                }
            }
        } catch (e) { /* silent — don't block order if check fails */ }

        /* ── Fetch IP ── */
        let clientIP = null, clientCountry = null, clientCity = null;
        if (typeof SpamGuard !== 'undefined') {
            const geo = await SpamGuard.getClientIP();
            clientIP      = geo.ip;
            clientCountry = geo.country;
            clientCity    = geo.city;
        }

        const orderData = {
            name,
            phone,
            email: email || null,
            address,
            lang: lang,
            products: JSON.parse(JSON.stringify([{
                id:    _product.id,
                code:  _product.code || '',
                name:  typeof _product.name === 'object'
                    ? (lang === 'ar' ? _product.name.ar : (_product.name.en || _product.name.ar))
                    : _product.name,
                size:  sizeVal,
                color: colorVal || '',
                offer: selectedOffer?.label || '',
                price: selectedOffer?.value || '',
                qty:   1
            }])),
            total:     numericPrice,
            status:    'pending',
            order_ref: orderRef,
            client_ip: clientIP,
            client_country: clientCountry,
            client_city: clientCity
        };
        label.innerHTML = `<span class="order-loading-dots"><span></span><span></span><span></span></span>`;

        try {
            const result = await insertOrder(orderData);
            const savedId = result?.[0]?.id || null;

            if (typeof SpamGuard !== 'undefined') SpamGuard.recordOrder();

            if (typeof saveOrderLocally === 'function') {
                saveOrderLocally({
                    ref: orderRef, dbId: savedId, name, phone,
                    products: orderData.products,
                    total: numericPrice, status: 'pending',
                    date: new Date().toISOString()
                });
            }

            document.getElementById('orderForm').style.display = 'none';
            const lang = localStorage.getItem('dalal-lang') || 'ar';
            const t    = T[lang] || T.ar;
            document.getElementById('orderSuccessMsg').textContent = t.successMsg;
            document.getElementById('orderSuccessSub').innerHTML =
                `${t.successSub}<br>
                <span style="font-size:0.8rem;color:var(--text-dim);margin-top:0.4rem;display:block">
                    ${lang === 'ar' ? 'رقم طلبك' : 'Order ID'}: <strong style="color:var(--gold)">${orderRef}</strong>
                </span>
                <a href="track.html?ref=${orderRef}" style="color:var(--gold);text-decoration:underline;font-size:0.82rem;margin-top:0.4rem;display:inline-block">
                    ${lang === 'ar' ? 'تتبع طلبك ←' : 'Track your order ←'}
                </a>`;
            document.getElementById('orderSuccess').classList.add('is-visible');
            if (typeof playSuccessSound === 'function') playSuccessSound();
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
