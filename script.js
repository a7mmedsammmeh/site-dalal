/* ═══════════════════════════════════════════════════════════════
   DALAL — Main Script
   ═══════════════════════════════════════════════════════════════ */

const LANG_KEY  = 'dalal-lang';
const THEME_KEY = 'dalal-theme';

/* ─── Apply Language ─── */
function applyLanguage(lang) {
    const t = DALAL_I18N[lang];
    if (!t) return;

    document.documentElement.lang = t.langCode;
    document.documentElement.dir  = t.dir;
    document.body.classList.remove('lang-ar', 'lang-en');
    document.body.classList.add(t.fontClass);

    const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };

    /* nav */
    set('navLinkHome', t.navHome);       set('navLinkHomeP', t.navHome);
    set('navLinkCollection', t.navCollection); set('navLinkCollectionP', t.navCollection);
    set('navLinkWhyDalal', t.navWhyDalal);     set('navLinkWhyDalalP', t.navWhyDalal);
    set('navLinkContact', t.navContact);       set('navLinkContactP', t.navContact);
    set('navLinkOrdersP', t.navOrders);        set('navLinkOrders', t.navOrders);

    document.querySelectorAll('.lang-toggle').forEach(btn => {
        btn.textContent = t.langToggleLabel;
    });

    /* hero */
    set('heroTagline', t.heroTagline);
    set('heroSubtitle', t.heroSubtitle);
    set('heroShopNow', t.heroShopNow);

    /* products section */
    set('productsSectionTitle', t.productsTitle);
    set('productsSectionSubtitle', t.productsSubtitle);
    set('showAllProducts', t.showAllProducts);

    /* size filter labels */
    const sfLabel = lang === 'ar' ? 'فلتر بالمقاس:' : 'Filter by size:';
    set('sizeFilterLabelHome', sfLabel);
    set('sizeFilterLabelProducts', sfLabel);
    // Update "All" pill text
    document.querySelectorAll('.size-pill[data-size="all"]').forEach(btn => {
        btn.textContent = lang === 'ar' ? 'الكل' : 'All';
    });

    /* products page */
    set('fullCollectionTitle', t.fullCollectionTitle);
    set('fullCollectionSubtitle', t.fullCollectionSubtitle);
    const backBtn = document.getElementById('backToHome');
    if (backBtn) {
        const svg = backBtn.querySelector('svg');
        backBtn.textContent = t.backToHome;
        if (svg) backBtn.prepend(svg);
    }

    /* why dalal */
    set('whySectionTitle', t.whyTitle);
    set('whySectionSubtitle', t.whySubtitle);
    set('whyFabricsTitle', t.whyFabricsTitle); set('whyFabricsDesc', t.whyFabricsDesc);
    set('whyDesignTitle', t.whyDesignTitle);   set('whyDesignDesc', t.whyDesignDesc);
    set('whyComfortTitle', t.whyComfortTitle); set('whyComfortDesc', t.whyComfortDesc);
    set('whyQualityTitle', t.whyQualityTitle); set('whyQualityDesc', t.whyQualityDesc);

    /* footer */
    set('footerTagline', t.footerTagline);
    set('footerQuickLinks', t.footerQuickLinks);
    set('footerConnect', t.footerConnect);
    set('footerRights', t.footerRights);
    set('footerCraft', t.footerCraft);
    set('footerLinkHome', t.navHome);
    set('footerLinkCollection', t.navCollection);
    set('footerLinkAllProducts', t.footerAllProducts);
    set('footerLinkWhyDalal', t.navWhyDalal);
    set('footerLinkOrders', t.navOrders);
    set('footerLinkTrack', t.footerTrack);
    set('footerLinkAbout',   t.footerAbout);
    set('footerLinkContact', t.footerContact);
    set('footerLinkPrivacy', t.footerPrivacy);
    set('footerBottomAbout',   t.footerAbout);
    set('footerBottomContact', t.footerContact);
    set('footerBottomPrivacy', t.footerPrivacy);

    /* mobile sticky */
    const stickyBtn = document.getElementById('mobileStickyBtn');
    if (stickyBtn) {
        const svg = stickyBtn.querySelector('svg');
        stickyBtn.textContent = t.messageUs;
        if (svg) stickyBtn.prepend(svg);
    }

    /* page title */
    const path = window.location.pathname;
    if (path.includes('products.html')) {
        document.title = t.pageTitles.products;
    } else if (path.includes('product.html')) {
        // product.js handles its own title, skip
    } else {
        document.title = t.pageTitles.home;
    }

    /* whatsapp tooltip */
    document.querySelectorAll('.floating-whatsapp .tooltip').forEach(el => {
        el.textContent = t.comingSoon;
    });

    /* shipping */
    const setS = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
    setS('shippingItem1',  t.shippingItem1);
    setS('shippingItem2',  t.shippingItem2);
    setS('shippingItem3',  t.shippingItem3);
    setS('shippingItem1P', t.shippingItem1);
    setS('shippingItem2P', t.shippingItem2);
    setS('shippingItem3P', t.shippingItem3);

    /* orders & track pages */
    setS('ordersPageTitle', t.ordersPageTitle);
    setS('ordersPageSub',   t.ordersPageSub);
    setS('trackPageTitle',  t.trackPageTitle);
    setS('trackPageSub',    t.trackPageSub);
    setS('trackFromDeviceLabel', t.trackFromDevice);
    setS('trackFromDeviceLink',  t.trackFromDeviceLink);

    /* about page */
    setS('aboutHeroTitle',    t.aboutHeroTitle);
    setS('aboutStoryTitle',   t.aboutStoryTitle);
    setS('aboutStoryP1',      t.aboutStoryP1);
    setS('aboutStoryP2',      t.aboutStoryP2);
    setS('aboutValuesTitle',  t.aboutValuesTitle);
    setS('aboutMissionTitle', t.aboutMissionTitle);
    setS('aboutMissionQuote', t.aboutMissionQuote);
    setS('aboutPromiseTitle', t.aboutPromiseTitle);
    setS('aboutPromiseP1',    t.aboutPromiseP1);
    setS('aboutShopNow',      t.aboutShopNow);
    setS('valueTitle1', t.valueTitle1); setS('valueDesc1', t.valueDesc1);
    setS('valueTitle2', t.valueTitle2); setS('valueDesc2', t.valueDesc2);
    setS('valueTitle3', t.valueTitle3); setS('valueDesc3', t.valueDesc3);

    /* contact page */
    setS('contactHeroTitle',     t.contactHeroTitle);
    setS('contactChannelsTitle', t.contactChannelsTitle);
    setS('contactChannelsDesc',  t.contactChannelsDesc);
    setS('channelName1',   t.channelName1);   setS('channelAction1', t.channelAction1);
    setS('channelName2',   t.channelName2);   setS('channelAction2', t.channelAction2);
    setS('channelName3',   t.channelName3);   setS('channelAction3', t.channelAction3);
    setS('channelName4',   t.channelName4);

    /* privacy page */
    setS('privacyHeroTitle',  t.privacyHeroTitle);
    setS('privacyContactBtn', t.privacyContactBtn);

    /* product cards */
    if (typeof rerenderProducts === 'function') rerenderProducts(lang);

    /* product detail page */
    if (typeof applyProductPageLang === 'function') applyProductPageLang(lang);

    localStorage.setItem(LANG_KEY, lang);
    document.dispatchEvent(new CustomEvent('dalal-lang-change', { detail: lang }));
}

/* ─── DOM Ready ─── */
document.addEventListener('DOMContentLoaded', () => {

    /* Theme */
    if (localStorage.getItem(THEME_KEY) === 'light') {
        document.body.classList.add('light-mode');
    }
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            document.body.classList.toggle('light-mode');
            localStorage.setItem(THEME_KEY, document.body.classList.contains('light-mode') ? 'light' : 'dark');
        });
    }

    /* Language */
    document.querySelectorAll('.lang-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            applyLanguage(localStorage.getItem(LANG_KEY) === 'en' ? 'ar' : 'en');
        });
    });

    /* Scroll reveal — declared early so products-ready can use it */
    const revealObs = new IntersectionObserver((entries) => {
        entries.forEach((entry, i) => {
            if (entry.isIntersecting) {
                setTimeout(() => entry.target.classList.add('revealed'), i * 80);
                revealObs.unobserve(entry.target);
            }
        });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    const observeReveal = () => document.querySelectorAll('.scroll-reveal:not(.revealed)').forEach(el => revealObs.observe(el));
    observeReveal();
    setTimeout(observeReveal, 200);

    /* Apply saved language for static content */
    applyLanguage(localStorage.getItem(LANG_KEY) || 'ar');

    /* Product grids — wait for JSON to load */
    document.addEventListener('dalal:products-ready', () => {
        const homepageGrid    = document.getElementById('productsGrid');
        const allProductsGrid = document.getElementById('allProductsGrid');

        if (homepageGrid) {
            // clear skeletons
            homepageGrid.innerHTML = '';
            const featured = DALAL_PRODUCTS.filter(p => p.featured);
            featured.forEach(p => {
                const card = createProductCard(p);
                card.classList.add('content-fade-in');
                homepageGrid.appendChild(card);
            });
            // Build size pills for homepage
            buildSizePills('sizeFilterPillsHome', featured, 'filterBySizeHome');
        }

        if (allProductsGrid) {
            allProductsGrid.innerHTML = '';
            DALAL_PRODUCTS.forEach(p => {
                const card = createProductCard(p);
                card.classList.add('content-fade-in');
                allProductsGrid.appendChild(card);
            });
            // Build size pills for products page
            buildSizePills('sizeFilterPillsProducts', DALAL_PRODUCTS, 'filterBySizeProducts');
        }

        /* re-apply language to newly rendered cards */
        applyLanguage(localStorage.getItem(LANG_KEY) || 'ar');

        /* observe new cards for scroll reveal */
        setTimeout(() => observeReveal(), 50);
    });

    /* inject skeletons immediately while fetch is pending */
    const homepageGrid    = document.getElementById('productsGrid');
    const allProductsGrid = document.getElementById('allProductsGrid');
    if (homepageGrid)    injectSkeletons(homepageGrid, 12);
    if (allProductsGrid) injectSkeletons(allProductsGrid, 12);
    const header = document.getElementById('header');
    const onScroll = () => header && header.classList.toggle('scrolled', window.scrollY > 50);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    /* Mobile nav */
    const navToggle = document.getElementById('navToggle');
    const navLinks  = document.getElementById('navLinks');
    const closeMobileNav = () => {
        navToggle && navToggle.classList.remove('active');
        navLinks  && navLinks.classList.remove('active');
        document.body.style.overflow = '';
    };
    if (navToggle) {
        navToggle.addEventListener('click', () => {
            const open = navToggle.classList.toggle('active');
            navLinks && navLinks.classList.toggle('active', open);
            document.body.style.overflow = open ? 'hidden' : '';
        });
    }
    document.addEventListener('keydown', e => e.key === 'Escape' && closeMobileNav());

    /* Smooth scroll */
    document.querySelectorAll('a[href^="#"]').forEach(a => {
        a.addEventListener('click', e => {
            const target = document.querySelector(a.getAttribute('href'));
            if (target) { e.preventDefault(); closeMobileNav(); target.scrollIntoView({ behavior: 'smooth' }); }
        });
    });

    /* WhatsApp disabled */
    const wa = document.getElementById('floatingWhatsApp');
    if (wa) wa.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); });

    /* Mobile sticky visibility */
    const mobileSticky = document.getElementById('mobileSticky');
    const heroSection  = document.getElementById('hero');
    if (mobileSticky && heroSection) {
        new IntersectionObserver(([entry]) => {
            mobileSticky.style.opacity       = entry.isIntersecting ? '0' : '1';
            mobileSticky.style.pointerEvents = entry.isIntersecting ? 'none' : 'auto';
        }, { threshold: 0.3 }).observe(heroSection);
    }
});


/* ─── Help Popover ─── */
(function () {
    let _activePopover = null;

    window.showHelpPopover = function(btn, contentHTML, title) {
        // Close existing
        if (_activePopover) {
            _activePopover.classList.remove('show');
            setTimeout(() => _activePopover?.remove(), 200);
            if (_activePopover._btn === btn) { _activePopover = null; return; }
        }

        const pop = document.createElement('div');
        pop.className = 'help-popover';
        pop._btn = btn;
        pop.innerHTML = `
            <button class="help-popover-close" onclick="this.closest('.help-popover').classList.remove('show');setTimeout(()=>this.closest('.help-popover')?.remove(),200)">✕</button>
            <div class="help-popover-title">💡 ${title || 'كيف يعمل؟'}</div>
            ${contentHTML}`;
        document.body.appendChild(pop);
        _activePopover = pop;

        // Position near button
        const rect = btn.getBoundingClientRect();
        const popW = 280;
        let left = rect.left + rect.width / 2 - popW / 2;
        left = Math.max(12, Math.min(left, window.innerWidth - popW - 12));
        let top = rect.bottom + 8;
        if (top + 200 > window.innerHeight) top = rect.top - 210;

        pop.style.left = left + 'px';
        pop.style.top  = top + 'px';

        requestAnimationFrame(() => pop.classList.add('show'));

        // Close on outside click
        setTimeout(() => {
            document.addEventListener('click', function handler(e) {
                if (!pop.contains(e.target) && e.target !== btn) {
                    pop.classList.remove('show');
                    setTimeout(() => pop.remove(), 200);
                    _activePopover = null;
                    document.removeEventListener('click', handler);
                }
            });
        }, 10);
    };
})();



/* ─── Visitor Tracking (server-side via /api/track-visitor) ─── */
(async function trackVisitor() {
    try {
        // Don't track admin page
        if (window.location.pathname.includes('admin')) return;

        // Gather device info (non-sensitive — server handles IP/geo)
        const ua        = navigator.userAgent;
        const lang      = navigator.language || '';
        const screen_w  = window.screen.width;
        const screen_h  = window.screen.height;
        const referrer  = document.referrer || null;
        const page      = window.location.pathname + window.location.hash;
        const tz        = Intl.DateTimeFormat().resolvedOptions().timeZone || null;

        // Device type
        const isMobile  = /Mobi|Android|iPhone|iPad/i.test(ua);
        const isTablet  = /iPad|Tablet/i.test(ua) || (isMobile && screen_w >= 768);
        const device_type = isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop';

        // OS
        let os = 'Unknown';
        if (/Windows/i.test(ua))      os = 'Windows';
        else if (/Mac OS X/i.test(ua)) os = 'macOS';
        else if (/Android/i.test(ua)) os = 'Android';
        else if (/iPhone|iPad/i.test(ua)) os = 'iOS';
        else if (/Linux/i.test(ua))   os = 'Linux';

        // Browser
        let browser = 'Unknown';
        if (/Edg\//i.test(ua))        browser = 'Edge';
        else if (/OPR|Opera/i.test(ua)) browser = 'Opera';
        else if (/Chrome/i.test(ua))  browser = 'Chrome';
        else if (/Firefox/i.test(ua)) browser = 'Firefox';
        else if (/Safari/i.test(ua))  browser = 'Safari';

        // Check blocked status via /api/check-blocked (server-side, every page load)
        // NOTE: /api/check-blocked never returns raw IP — only blocked/country/city
        let blocked = false;
        try {
            const fp = (typeof DalalFingerprint !== 'undefined') ? await DalalFingerprint.get() : null;
            const fpParam = fp ? `?fp=${encodeURIComponent(fp)}` : '';

            const statusRes = await fetch('/api/check-blocked' + fpParam, {
                signal: AbortSignal.timeout(8000),
                headers: { 'Accept': 'application/json' }
            });
            if (statusRes.ok) {
                const status = await statusRes.json();
                if (status.blocked) {
                    window.location.replace('/blocked.html');
                    return;
                }
            }
        } catch (e) { /* silent */ }

        // Session dedup — track visit once per session per page (not per load)
        const sessionKey = 'dalal-tracked-' + window.location.pathname;
        if (sessionStorage.getItem(sessionKey)) return;
        sessionStorage.setItem(sessionKey, '1');

        // Send tracking data to server-side endpoint
        // Server handles: IP extraction, geolocation, rate limiting, bot detection
        const fp = (typeof DalalFingerprint !== 'undefined') ? await DalalFingerprint.get() : null;
        fetch('/api/track-visitor', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fingerprint: fp,
                device_type, os, browser,
                screen_res: `${screen_w}x${screen_h}`,
                lang,
                timezone: tz,
                page,
                referrer
            }),
            signal: AbortSignal.timeout(5000)
        }).catch(() => { /* silent fail — never break the site */ });

    } catch (e) { /* silent fail — never break the site */ }
})();


/* ─── Size Guide Global Modal ─── */
(function initGlobalSizeGuide() {
    // Inject Size Guide Modal into body
    const sizeGuideHTML = `
    <div class="modal-overlay" id="sizeGuideModal" role="dialog" aria-modal="true" aria-labelledby="sizeGuideTitle" style="z-index: 9999 !important;">
        <div class="modal" style="max-width: 480px; padding: 1.5rem 1.2rem 2rem;">
            <button class="modal-close" id="sizeGuideClose" aria-label="إغلاق">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
            <h2 class="modal-title" id="sizeGuideTitle" style="font-size:1.15rem; color:var(--gold); margin-bottom:1rem; text-align:center; display:flex; align-items:center; justify-content:center; gap:0.4rem;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="18" height="18"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"></path><path d="M4 19.5a2.5 2.5 0 0 0 2.5 2.5H20"></path></svg>
                <span id="sgTitleText">دليل المقاسات</span>
            </h2>
            <div class="modal-divider"></div>
            
            <div style="overflow-x:auto; margin-top:0.5rem; background:var(--bg-light); border-radius:var(--r-lg); border:1px solid var(--border);">
                <table style="width:100%; border-collapse:collapse; text-align:center; font-size:0.85rem; color:var(--text);">
                    <thead>
                        <tr style="border-bottom:1px solid var(--border); color:var(--text-muted); background:rgba(224,192,151,0.03);">
                            <th style="padding:0.8rem; font-weight:600; width:45%; border-inline-end:1px solid var(--border);" id="sgThSize">المقاس</th>
                            <th style="padding:0.8rem; font-weight:600;" id="sgThWeight">الوزن التقريبي (كجم)</th>
                        </tr>
                    </thead>
                    <tbody id="sgTbody">
                        <!-- Populated dynamically based on language -->
                    </tbody>
                </table>
            </div>
            <p id="sgDisclaimer" style="font-size:0.75rem; color:var(--text-dim); text-align:center; margin-top:1.2rem; line-height:1.6;">
                * هذه المقاسات تقريبية للوزن وقد تختلف قليلاً حسب تصميم الموديل ونوع القماش.
            </p>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', sizeGuideHTML);

    const renderSizeTable = (lang) => {
        const tbody = document.getElementById('sgTbody');
        if (!tbody) return;
        const unit = lang === 'ar' ? 'كجم' : 'kg';
        const rows = [
            { size: 'Free Size', weight: `50 - 75 ${unit}` },
            { size: 'L', weight: `60 - 69 ${unit}` },
            { size: 'XL', weight: `70 - 79 ${unit}` },
            { size: '2XL', weight: `80 - 89 ${unit}` },
            { size: '3XL', weight: `90 - 99 ${unit}` },
            { size: '4XL', weight: `100 - 109 ${unit}` },
            { size: '5XL', weight: `110 - 119 ${unit}` },
            { size: '6XL', weight: `120 - 129 ${unit}` },
            { size: '7XL', weight: `130 - 139 ${unit}` },
            { size: '8XL', weight: `140 - 150 ${unit}` }
        ];
        
        tbody.innerHTML = rows.map((r, i) => `
            <tr ${i < rows.length - 1 ? 'style="border-bottom:1px solid rgba(224,192,151,0.05);"' : ''}>
                <td style="padding:0.8rem; font-weight:bold; color:var(--gold); border-inline-end:1px solid rgba(224,192,151,0.05);">${r.size}</td>
                <td style="padding:0.8rem; color:var(--text-muted);">${r.weight}</td>
            </tr>
        `).join('');
    };

    // Initial render
    renderSizeTable(localStorage.getItem('dalal-lang') || 'ar');

    window.openSizeGuide = function() {
        const overlay = document.getElementById('sizeGuideModal');
        if (!overlay) return;
        overlay.classList.add('active');
        if (typeof DalalModal !== 'undefined') {
            DalalModal.lock();
            DalalModal.pushState('sizeGuideModal', closeSizeGuide);
        } else {
            document.body.style.overflow = 'hidden';
        }
    };

    window.closeSizeGuide = function() {
        const overlay = document.getElementById('sizeGuideModal');
        if (!overlay) return;
        overlay.classList.remove('active');
        if (typeof DalalModal !== 'undefined') {
            DalalModal.unlock();
            const stack = DalalModal._stack;
            if (stack && stack.length > 0 && stack[stack.length - 1]?.id === 'sizeGuideModal') {
                DalalModal.popState();
            }
        } else {
            document.body.style.overflow = '';
        }
    };

    // Close button
    document.getElementById('sizeGuideClose')?.addEventListener('click', closeSizeGuide);
    // Overlay click
    document.getElementById('sizeGuideModal')?.addEventListener('click', e => {
        if (e.target === e.currentTarget) closeSizeGuide();
    });

    // Language update hook
    document.addEventListener('dalal-lang-change', (e) => {
        const lang = e.detail;
        const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
        set('sgTitleText', lang === 'ar' ? 'دليل المقاسات' : 'Size Guide');
        set('sgThSize', lang === 'ar' ? 'المقاس' : 'Size');
        set('sgThWeight', lang === 'ar' ? 'الوزن التقريبي (كجم)' : 'Approx. Weight (kg)');
        set('sgDisclaimer', lang === 'ar' ? '* هذه المقاسات تقريبية للوزن وقد تختلف قليلاً حسب تصميم الموديل ونوع القماش.' : '* These are approximate weights and may vary slightly based on design and fabric.');
        renderSizeTable(lang);
    });

    // Setup Mobile Drag to Dismiss for Size Guide
    const sgOverlay = document.getElementById('sizeGuideModal');
    const sgModal = sgOverlay?.querySelector('.modal');
    if (sgModal) {
        if (typeof DalalModal !== 'undefined' && DalalModal.setupDrag) {
            DalalModal.setupDrag(sgModal, closeSizeGuide);
        } else {
            let startY = 0, currentY = 0, dragging = false;
            sgModal.addEventListener('touchstart', e => {
                if (sgModal.scrollTop > 0) return;
                startY = e.touches[0].clientY; currentY = 0; dragging = true;
                sgModal.style.transition = 'none';
            }, { passive: true });
            sgModal.addEventListener('touchmove', e => {
                if (!dragging) return;
                const dy = e.touches[0].clientY - startY;
                if (dy < 0) return;
                currentY = dy; sgModal.style.transform = `translateY(${dy}px)`;
                e.preventDefault();
            }, { passive: false });
            sgModal.addEventListener('touchend', () => {
                if (!dragging) return; dragging = false;
                sgModal.style.transition = 'transform 0.35s cubic-bezier(0.4,0,0.2,1)';
                if (currentY > 120) {
                    sgModal.style.transform = `translateY(100%)`;
                    setTimeout(() => { closeSizeGuide(); sgModal.style.transform = ''; }, 300);
                } else { sgModal.style.transform = ''; }
            });
        }
    }
})();

/* ═══════════════════════════════════════════════════════════════
   SIZE FILTER — Global (Home + Products Page)
   ═══════════════════════════════════════════════════════════════ */
(function initSizeFilter() {
    const STANDARD_SIZES = ['M','L','XL','2XL','3XL','4XL','5XL','6XL','7XL','8XL'];

    /* Build size pills into a container */
    window.buildSizePills = function(containerId, products, onClickFn) {
        const container = document.getElementById(containerId);
        if (!container) return;
        const lang = localStorage.getItem('dalal-lang') || 'ar';

        // Collect all unique sizes from products
        const sizeSet = new Set();
        products.forEach(p => {
            if (p.sizes && Array.isArray(p.sizes)) {
                p.sizes.forEach(s => sizeSet.add(s));
            }
        });

        // Order: standard sizes first (in order), then custom
        const orderedSizes = STANDARD_SIZES.filter(s => sizeSet.has(s));
        sizeSet.forEach(s => { if (!orderedSizes.includes(s)) orderedSizes.push(s); });

        // Build HTML
        const allLabel = lang === 'ar' ? 'الكل' : 'All';
        let html = `<button class="size-pill active" data-size="all" onclick="${onClickFn}('all')">${allLabel}</button>`;
        orderedSizes.forEach(size => {
            html += `<button class="size-pill" data-size="${size}" onclick="${onClickFn}('${size}')">${size}</button>`;
        });
        container.innerHTML = html;
    };

    /* Render filtered products into a grid */
    function renderFilteredGrid(gridId, products, activeSize) {
        const grid = document.getElementById(gridId);
        if (!grid) return;
        grid.innerHTML = '';
        const lang = localStorage.getItem('dalal-lang') || 'ar';

        const filtered = activeSize === 'all'
            ? products
            : products.filter(p => p.sizes && Array.isArray(p.sizes) && p.sizes.includes(activeSize));

        if (filtered.length === 0) {
            grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:3rem 1rem;color:var(--text-dim);font-size:0.9rem;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" height="40" style="opacity:0.3;margin-bottom:0.75rem;display:block;margin-inline:auto;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                ${lang === 'ar' ? 'لا توجد منتجات بهذا المقاس' : 'No products in this size'}
            </div>`;
        } else {
            filtered.forEach(p => {
                const card = createProductCard(p);
                card.classList.add('content-fade-in', 'scroll-reveal', 'revealed');
                grid.appendChild(card);
            });
        }

        /* re-apply language to newly rendered cards */
        if (typeof rerenderProducts === 'function') rerenderProducts(lang);
    }

    /* Filter by size — homepage */
    window.filterBySizeHome = function(size) {
        const container = document.getElementById('sizeFilterPillsHome');
        if (container) {
            container.querySelectorAll('.size-pill').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.size === size);
            });
        }
        renderFilteredGrid('productsGrid', DALAL_PRODUCTS.filter(p => p.featured), size);
    };

    /* Filter by size — products page */
    window.filterBySizeProducts = function(size) {
        const container = document.getElementById('sizeFilterPillsProducts');
        if (container) {
            container.querySelectorAll('.size-pill').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.size === size);
            });
        }
        renderFilteredGrid('allProductsGrid', DALAL_PRODUCTS, size);
    };
})();
