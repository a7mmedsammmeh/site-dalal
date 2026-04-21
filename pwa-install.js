/* ═══════════════════════════════════════════════════════════════
   DALAL — PWA Install Prompt
   Shows Add to Home Screen prompt after successful order
   ═══════════════════════════════════════════════════════════════ */

(function () {
    'use strict';

    const INSTALL_DISMISSED_KEY = 'dalal-install-dismissed';
    let _deferredPrompt = null;

    // Capture the beforeinstallprompt event (Android/Chrome)
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        _deferredPrompt = e;
    });

    // Detect platform
    function isIOS() {
        return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    }
    function isAndroid() {
        return /Android/i.test(navigator.userAgent);
    }
    function isStandalone() {
        return window.matchMedia('(display-mode: standalone)').matches
            || window.navigator.standalone === true;
    }

    /**
     * Show install prompt popup.
     * Call this after a successful order.
     */
    function showInstallPrompt() {
        // Don't show if already installed or dismissed
        if (isStandalone()) return;
        if (localStorage.getItem(INSTALL_DISMISSED_KEY)) return;

        const lang = localStorage.getItem('dalal-lang') || 'ar';
        const isAr = lang === 'ar';

        // Remove existing prompt if any
        const existing = document.getElementById('dalalInstallPrompt');
        if (existing) existing.remove();

        let instructionsHTML = '';

        if (_deferredPrompt) {
            // Chrome/Android — native prompt available
            instructionsHTML = `
                <p style="font-size:0.88rem;color:var(--text-muted);line-height:1.7;margin-bottom:1.25rem;">
                    ${isAr ? 'أضيفي دلال للشاشة الرئيسية عشان توصلي لينا بسهولة وبدون متفتحي المتصفح!' : 'Add DALAL to your home screen for quick and easy access!'}
                </p>
                <button class="pwa-install-btn" id="pwaInstallNow">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    ${isAr ? 'أضيفي للشاشة الرئيسية' : 'Add to Home Screen'}
                </button>`;
        } else if (isIOS()) {
            // iOS Safari — show manual instructions
            instructionsHTML = `
                <p style="font-size:0.88rem;color:var(--text-muted);line-height:1.7;margin-bottom:1rem;">
                    ${isAr ? 'أضيفي دلال للشاشة الرئيسية عشان توصلي لينا بسرعة!' : 'Add DALAL to your home screen for quick access!'}
                </p>
                <div class="pwa-ios-steps">
                    <div class="pwa-step">
                        <span class="pwa-step-num">1</span>
                        <span>${isAr ? 'اضغطي على زرار المشاركة' : 'Tap the Share button'} 
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="vertical-align:middle;color:var(--gold);"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                        </span>
                    </div>
                    <div class="pwa-step">
                        <span class="pwa-step-num">2</span>
                        <span>${isAr ? 'اختاري "إضافة إلى الشاشة الرئيسية"' : 'Choose "Add to Home Screen"'}</span>
                    </div>
                    <div class="pwa-step">
                        <span class="pwa-step-num">3</span>
                        <span>${isAr ? 'اضغطي "إضافة" وخلاص!' : 'Tap "Add" and you\'re done!'}</span>
                    </div>
                </div>`;
        } else {
            // Desktop or unsupported — don't show
            return;
        }

        const html = `
        <div class="pwa-overlay" id="dalalInstallPrompt">
            <div class="pwa-card">
                <button class="pwa-close" id="pwaClose" aria-label="close">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>

                <div class="pwa-logo-wrap">
                    <img src="images/dalal-logo.png" alt="DALAL" class="pwa-logo">
                </div>

                <h3 class="pwa-title">${isAr ? 'أضيفي دلال لموبايلك!' : 'Add DALAL to your phone!'}</h3>
                <div class="pwa-divider"></div>

                ${instructionsHTML}

                <button class="pwa-dismiss" id="pwaDismiss">
                    ${isAr ? 'لا شكراً' : 'No thanks'}
                </button>
            </div>
        </div>

        <style>
        .pwa-overlay {
            position: fixed; inset: 0; z-index: 99999;
            background: rgba(0,0,0,0.75);
            backdrop-filter: blur(4px);
            display: flex; align-items: flex-end; justify-content: center;
            opacity: 0; visibility: hidden;
            transition: opacity 0.3s ease, visibility 0.3s;
            padding: 0;
        }
        .pwa-overlay.active { opacity: 1; visibility: visible; }

        .pwa-card {
            background: #1A1A1A;
            border: 1px solid rgba(224,192,151,0.2);
            border-radius: 16px 16px 0 0;
            padding: 2rem 1.5rem 1.5rem;
            width: 100%; max-width: 400px;
            text-align: center;
            font-family: 'Tajawal', 'Poppins', sans-serif;
            transform: translateY(100%);
            transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
        }
        .pwa-overlay.active .pwa-card { transform: translateY(0); }

        @media (min-width: 640px) {
            .pwa-overlay { align-items: center; padding: 1.5rem; }
            .pwa-card {
                border-radius: 16px;
                transform: scale(0.95) translateY(12px);
                opacity: 0;
                transition: transform 0.25s cubic-bezier(0.4,0,0.2,1), opacity 0.25s;
            }
            .pwa-overlay.active .pwa-card { transform: scale(1) translateY(0); opacity: 1; }
        }

        .pwa-close {
            position: absolute; top: 0.75rem; left: 0.75rem;
            width: 30px; height: 30px; border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            background: transparent; border: 1px solid rgba(224,192,151,0.15);
            color: #A89B8C; cursor: pointer; transition: all 0.2s;
        }
        .pwa-close:hover { border-color: #C4A67A; color: #E0C097; }

        .pwa-logo-wrap { margin-bottom: 1.25rem; }
        .pwa-logo { width: 56px; height: auto; border-radius: 12px; }

        .pwa-title {
            font-family: 'Playfair Display', serif;
            font-size: 1.15rem; font-weight: 700;
            color: #E0C097; letter-spacing: 0.04em;
            margin-bottom: 0.5rem;
        }

        .pwa-divider {
            width: 50px; height: 1px;
            background: linear-gradient(90deg, transparent, #C4A67A, transparent);
            margin: 0.75rem auto 1rem;
        }

        .pwa-install-btn {
            display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem;
            width: 100%; padding: 0.85rem 1.5rem;
            background: #E0C097; color: #0D0D0D;
            border: none; border-radius: 8px;
            font-family: inherit; font-size: 0.9rem; font-weight: 700;
            letter-spacing: 0.06em; cursor: pointer;
            transition: background 0.3s, transform 0.2s;
        }
        .pwa-install-btn:hover { background: #C4A67A; }
        .pwa-install-btn:active { transform: scale(0.98); }

        .pwa-ios-steps {
            text-align: right; display: flex; flex-direction: column; gap: 0.75rem;
            margin-bottom: 1rem;
        }
        .pwa-step {
            display: flex; align-items: center; gap: 0.75rem;
            font-size: 0.85rem; color: #A89B8C;
        }
        .pwa-step-num {
            width: 26px; height: 26px; border-radius: 50%;
            background: rgba(224,192,151,0.1); border: 1px solid rgba(224,192,151,0.25);
            color: #E0C097; font-size: 0.75rem; font-weight: 700;
            display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }

        .pwa-dismiss {
            display: block; width: 100%;
            margin-top: 0.75rem; padding: 0.6rem;
            background: transparent; border: none;
            color: #6B6158; font-size: 0.78rem;
            font-family: inherit; cursor: pointer;
            transition: color 0.2s;
        }
        .pwa-dismiss:hover { color: #A89B8C; }
        </style>`;

        document.body.insertAdjacentHTML('beforeend', html);
        const overlay = document.getElementById('dalalInstallPrompt');

        // Animate in
        requestAnimationFrame(() => {
            requestAnimationFrame(() => overlay.classList.add('active'));
        });

        // Push history state for back button
        if (typeof DalalModal !== 'undefined') {
            DalalModal.pushState('installPrompt', closePrompt);
        }

        function closePrompt() {
            overlay.classList.remove('active');
            setTimeout(() => overlay.remove(), 350);
            if (typeof DalalModal !== 'undefined') {
                const stack = DalalModal._stack;
                if (stack.length > 0 && stack[stack.length - 1]?.id === 'installPrompt') {
                    DalalModal.popState();
                }
            }
        }

        function dismiss() {
            localStorage.setItem(INSTALL_DISMISSED_KEY, '1');
            closePrompt();
        }

        // Close button
        document.getElementById('pwaClose').addEventListener('click', dismiss);
        document.getElementById('pwaDismiss').addEventListener('click', dismiss);
        overlay.addEventListener('click', e => { if (e.target === overlay) dismiss(); });

        // Native install button (Android/Chrome)
        const installBtn = document.getElementById('pwaInstallNow');
        if (installBtn && _deferredPrompt) {
            installBtn.addEventListener('click', async () => {
                _deferredPrompt.prompt();
                const { outcome } = await _deferredPrompt.userChoice;
                if (outcome === 'accepted') {
                    localStorage.setItem(INSTALL_DISMISSED_KEY, '1');
                }
                _deferredPrompt = null;
                closePrompt();
            });
        }

        // Drag to dismiss
        if (typeof DalalModal !== 'undefined') {
            const card = overlay.querySelector('.pwa-card');
            DalalModal.setupDrag(card, dismiss);
        }
    }

    // Expose globally
    window.showInstallPrompt = showInstallPrompt;

})();
