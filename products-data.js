/* ═══════════════════════════════════════════════════════════════
   DALAL — Products Data (loaded from products.json)
   ═══════════════════════════════════════════════════════════════ */

/* Global store — populated after fetch */
let DALAL_PRODUCTS     = [];
let DALAL_PRODUCTS_MAP = {};
let DALAL_PRODUCTS_SLUG_MAP = {};
let DALAL_PRODUCTS_STOCK = {}; // Stock status from Supabase

/* ─── Skeleton card HTML ─── */
function createSkeletonCard() {
    const el = document.createElement('div');
    el.className = 'skeleton-card';
    el.innerHTML = `
        <div class="skeleton skeleton-image"></div>
        <div class="skeleton-info">
            <div class="skeleton skeleton-title"></div>
            <div class="skeleton skeleton-price"></div>
            <div class="skeleton skeleton-btn"></div>
        </div>
    `;
    return el;
}

/* ─── Inject skeletons into a grid ─── */
function injectSkeletons(grid, count) {
    for (let i = 0; i < count; i++) {
        grid.appendChild(createSkeletonCard());
    }
}

/* ─── Load products.json then boot the page ─── */
async function loadProductsData() {
    try {
        let data = [];

        // Try loading from Supabase first
        if (typeof fetchAllProducts === 'function') {
            try {
                data = await fetchAllProducts();
            } catch(e) {
                console.warn('Supabase products failed, falling back to JSON:', e);
            }
        }

        // Fallback to products.json if Supabase returned nothing
        if (!data || data.length === 0) {
            const response = await fetch('products.json');
            data = await response.json();
        }

        DALAL_PRODUCTS = data;
        DALAL_PRODUCTS_MAP = {};
        DALAL_PRODUCTS_SLUG_MAP = {};
        data.forEach(p => {
            DALAL_PRODUCTS_MAP[p.id] = p;
            if (p.slug) DALAL_PRODUCTS_SLUG_MAP[p.slug] = p;
        });

        // Load stock status from Supabase
        if (typeof fetchProductStock === 'function') {
            try {
                const stockData = await fetchProductStock();
                DALAL_PRODUCTS_STOCK = {};
                stockData.forEach(s => {
                    DALAL_PRODUCTS_STOCK[s.product_id] = {
                        in_stock: s.in_stock,
                        visibility_status: s.visibility_status || 'visible'
                    };
                });
            } catch (e) {
                console.warn('Could not load product stock:', e);
            }
        }

        document.dispatchEvent(new Event('dalal:products-ready'));
    } catch (err) {
        console.error('Could not load products:', err);
    }
}

loadProductsData();

/* ─── Load card ratings via SECURE RPC (no direct reviews access) ─── */
async function loadCardRatings() {
    const ratingEls = document.querySelectorAll('.product-card-rating[data-product-id]');
    if (!ratingEls.length) return;
    try {
        const db = await getSupabase();
        const ids = [...new Set([...ratingEls].map(el => +el.dataset.productId))];

        // Use RPC — returns only aggregated data: { product_id, avg_rating, review_count }
        const { data: ratings, error } = await db.rpc('get_product_ratings', { p_ids: ids });
        if (error || !ratings?.length) return;

        // Build lookup by product_id
        const byProduct = {};
        ratings.forEach(r => { byProduct[r.product_id] = r; });

        ratingEls.forEach(el => {
            const pid = +el.dataset.productId;
            const r = byProduct[pid];
            if (!r) return;
            const avg = parseFloat(r.avg_rating);
            const star = avg >= 4.5 ? '★★★★★' : avg >= 3.5 ? '★★★★☆' : avg >= 2.5 ? '★★★☆☆' : '★★☆☆☆';
            el.innerHTML = `<span style="color:#E0C097;font-size:0.72rem;letter-spacing:0.05em">${star}</span><span style="color:var(--text-dim)">(${r.review_count})</span>`;
            el.style.display = 'flex';
        });
    } catch { /* silent */ }
}

document.addEventListener('dalal:products-ready', () => {
    // Small delay to let cards render first
    setTimeout(loadCardRatings, 300);
});

/* ─── Helpers ─── */
function getCurrentLang() {
    return localStorage.getItem('dalal-lang') || 'ar';
}

function getProductName(product, lang) {
    lang = lang || getCurrentLang();
    return typeof product.name === 'object' ? (product.name[lang] || product.name.ar) : product.name;
}

function buildMessengerOrderURL(product) {
    const name = getProductName(product, 'en');
    const msg  = `I want to order ${name}`;
    return `https://m.me/dalal.lingerie?text=${encodeURIComponent(msg)}`;
}

/* ─── Product Card ─── */
function createProductCard(product) {
    // Check product visibility status
    const stockInfo = DALAL_PRODUCTS_STOCK[product.id] || { in_stock: true, visibility_status: 'visible' };
    
    // Don't render hidden products
    if (stockInfo.visibility_status === 'hidden') {
        const article = document.createElement('article');
        article.style.display = 'none';
        return article;
    }

    const lang  = getCurrentLang();
    const name  = getProductName(product, lang);
    const isOutOfStock = stockInfo.visibility_status === 'out_of_stock';
    
    // Use main_image_url if available (from Supabase), otherwise fallback to folder/main
    const cover = product.main_image_url || `${product.folder}/${product.main}`;

    // get starting price (first pricing row)
    const pricingRows = product.pricing?.[lang] || product.pricing?.ar || [];
    const startPrice  = pricingRows.length ? pricingRows[0].value : '';

    const productUrl = product.slug ? `product.html#${product.slug}` : `product.html?id=${product.id}`;

    const article = document.createElement('article');
    article.className = 'product-card scroll-reveal';
    article.setAttribute('data-product-id', product.id);

    // Out of stock banner
    const outOfStockBanner = isOutOfStock ? `
        <div class="product-out-of-stock-banner">
            ${lang === 'ar' ? 'غير متوفر' : 'Out of Stock'}
        </div>
    ` : '';

    article.innerHTML = `
        <a href="${productUrl}" class="product-card-link">
            <div class="product-image-wrapper">
                ${outOfStockBanner}
                <img src="${cover}" alt="${name} — DALAL" class="product-image" loading="lazy"
                     style="opacity:0;transition:opacity 0.4s ease, transform 0.6s cubic-bezier(0.25,0.46,0.45,0.94);"
                     onerror="this.style.opacity='0.3';this.closest('.product-image-wrapper').classList.add('loaded')"
                     onload="this.style.opacity='1';this.closest('.product-image-wrapper').classList.add('loaded')">
                <div class="product-image-overlay"></div>
            </div>
            <div class="product-info">
                <h3 class="product-name">${name}</h3>
                <div class="product-card-meta">
                    ${startPrice ? `<p class="product-start-price">${lang === 'ar' ? 'يبدأ من' : 'From'} <span>${startPrice}</span></p>` : ''}
                    <div class="product-card-rating" data-product-id="${product.id}" style="display:none"></div>
                </div>
            </div>
        </a>
        <div class="product-info-actions">
        </div>
    `;

    return article;
}

/* ─── Re-render cards on language switch ─── */
function rerenderProducts(lang) {
    const orderLabel   = lang === 'ar' ? 'اطلبي الآن' : 'Order Now';
    const addCartLabel = lang === 'ar' ? 'أضيفي للسلة' : 'Add to Cart';
    const fromLabel    = lang === 'ar' ? 'يبدأ من' : 'From';
    document.querySelectorAll('.product-card').forEach(card => {
        const id      = parseInt(card.getAttribute('data-product-id'));
        const product = DALAL_PRODUCTS_MAP[id];
        if (!product) return;
        const name        = getProductName(product, lang);
        const pricingRows = product.pricing?.[lang] || product.pricing?.ar || [];
        const startPrice  = pricingRows.length ? pricingRows[0].value : '';
        const nameEl      = card.querySelector('.product-name');
        const priceEl     = card.querySelector('.product-start-price');
        const btnEl       = card.querySelector('.product-card-btns .btn-order');
        const imgEl       = card.querySelector('.product-image');
        const addCartEl   = card.querySelector('.btn-cart-add');
        if (nameEl)    nameEl.textContent  = name;
        if (priceEl)   priceEl.innerHTML   = `${fromLabel} <span>${startPrice}</span>`;
        if (btnEl)     btnEl.textContent   = orderLabel;
        if (imgEl)     imgEl.alt           = `${name} — DALAL`;
        if (addCartEl) {
            // keep the svg, update text node
            const svg = addCartEl.querySelector('svg');
            addCartEl.textContent = addCartLabel;
            if (svg) addCartEl.prepend(svg);
        }
    });
}
