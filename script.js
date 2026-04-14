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

    /* mobile sticky */
    const stickyBtn = document.getElementById('mobileStickyBtn');
    if (stickyBtn) {
        const svg = stickyBtn.querySelector('svg');
        stickyBtn.textContent = t.messageUs;
        if (svg) stickyBtn.prepend(svg);
    }

    /* whatsapp tooltip */
    document.querySelectorAll('.floating-whatsapp .tooltip').forEach(el => {
        el.textContent = t.comingSoon;
    });

    /* product cards */
    if (typeof rerenderProducts === 'function') rerenderProducts(lang);

    /* product detail page */
    if (typeof applyProductPageLang === 'function') applyProductPageLang(lang);

    localStorage.setItem(LANG_KEY, lang);
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
            DALAL_PRODUCTS.filter(p => p.featured).slice(0, 8).forEach(p => {
                const card = createProductCard(p);
                card.classList.add('content-fade-in');
                homepageGrid.appendChild(card);
            });
        }

        if (allProductsGrid) {
            allProductsGrid.innerHTML = '';
            DALAL_PRODUCTS.forEach(p => {
                const card = createProductCard(p);
                card.classList.add('content-fade-in');
                allProductsGrid.appendChild(card);
            });
        }

        /* re-apply language to newly rendered cards */
        applyLanguage(localStorage.getItem(LANG_KEY) || 'ar');

        /* observe new cards for scroll reveal */
        setTimeout(() => observeReveal(), 50);
    });

    /* inject skeletons immediately while fetch is pending */
    const homepageGrid    = document.getElementById('productsGrid');
    const allProductsGrid = document.getElementById('allProductsGrid');
    if (homepageGrid)    injectSkeletons(homepageGrid, 8);
    if (allProductsGrid) injectSkeletons(allProductsGrid, 8);
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
