/* ═══════════════════════════════════════════════════════════════
   DALAL — Enhanced Product Form with Dynamic Fields
   ═══════════════════════════════════════════════════════════════ */

// Global state for form
let _pfSizes = [];
let _pfPricingAr = [];
let _pfPricingEn = [];
let _pfGalleryImages = []; // {file: File|null, url: string, order: number, id: string}

/* ─── Sizes Management ─── */
window.initSizesManager = function() {
    const container = document.getElementById('pfSizesContainer');
    if (!container) return;
    
    container.innerHTML = `
        <div class="pf-sizes" style="margin-bottom:0.75rem;">
            ${['L','XL','2XL','3XL','4XL','5XL','6XL','7XL','8XL'].map(s => 
                `<input type="checkbox" id="pfSize_${s}" class="pf-size-cb" ${_pfSizes.includes(s)?'checked':''}><label for="pfSize_${s}" class="pf-size-label">${s}</label>`
            ).join('')}
        </div>
        <div id="pfCustomSizes"></div>
        <button type="button" class="pf-add-btn" onclick="addCustomSize()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            إضافة مقاس مخصص
        </button>
    `;
    
    // Render custom sizes
    renderCustomSizes();
    
    // Add change listeners
    ['L','XL','2XL','3XL','4XL','5XL','6XL','7XL','8XL'].forEach(s => {
        const cb = document.getElementById(`pfSize_${s}`);
        if (cb) cb.addEventListener('change', updateSizesArray);
    });
};

function renderCustomSizes() {
    const container = document.getElementById('pfCustomSizes');
    if (!container) return;
    
    const customSizes = _pfSizes.filter(s => !['L','XL','2XL','3XL','4XL','5XL','6XL','7XL','8XL'].includes(s));
    
    container.innerHTML = customSizes.map((size, i) => `
        <div class="pf-dynamic-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="color:var(--text-dim);flex-shrink:0;"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
            <input type="text" value="${size}" onchange="updateCustomSize(${i}, this.value)" placeholder="مثال: XXL، Free Size">
            <button type="button" onclick="removeCustomSize(${i})" title="حذف">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
        </div>
    `).join('');
}

function updateSizesArray() {
    const standardSizes = ['L','XL','2XL','3XL','4XL','5XL','6XL','7XL','8XL'].filter(s => 
        document.getElementById(`pfSize_${s}`)?.checked
    );
    const customSizes = _pfSizes.filter(s => !['L','XL','2XL','3XL','4XL','5XL','6XL','7XL','8XL'].includes(s));
    _pfSizes = [...standardSizes, ...customSizes];
}

window.addCustomSize = function() {
    _pfSizes.push('');
    renderCustomSizes();
};

window.updateCustomSize = function(index, value) {
    const standardSizes = ['L','XL','2XL','3XL','4XL','5XL','6XL','7XL','8XL'].filter(s => 
        document.getElementById(`pfSize_${s}`)?.checked
    );
    const customSizes = _pfSizes.filter(s => !['L','XL','2XL','3XL','4XL','5XL','6XL','7XL','8XL'].includes(s));
    customSizes[index] = value.trim();
    _pfSizes = [...standardSizes, ...customSizes.filter(s => s)];
};

window.removeCustomSize = function(index) {
    const customSizes = _pfSizes.filter(s => !['L','XL','2XL','3XL','4XL','5XL','6XL','7XL','8XL'].includes(s));
    customSizes.splice(index, 1);
    const standardSizes = ['L','XL','2XL','3XL','4XL','5XL','6XL','7XL','8XL'].filter(s => 
        document.getElementById(`pfSize_${s}`)?.checked
    );
    _pfSizes = [...standardSizes, ...customSizes];
    renderCustomSizes();
};

/* ─── Pricing Management ─── */
window.initPricingManager = function() {
    renderPricing('ar');
    renderPricing('en');
};

function renderPricing(lang) {
    const container = document.getElementById(`pfPricing${lang === 'ar' ? 'Ar' : 'En'}Container`);
    if (!container) return;
    
    const pricing = lang === 'ar' ? _pfPricingAr : _pfPricingEn;
    const labelPlaceholder = lang === 'ar' ? 'مثال: قطعة واحدة' : 'e.g. 1 Piece';
    const valuePlaceholder = lang === 'ar' ? 'مثال: 120 جنيه' : 'e.g. 120 EGP';
    
    container.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:0.5rem;">
            ${pricing.map((p, i) => `
                <div class="pf-dynamic-item">
                    <span style="font-size:0.75rem;color:var(--text-dim);width:20px;flex-shrink:0;">${i+1}</span>
                    <input type="text" value="${p.label}" onchange="updatePricing('${lang}', ${i}, 'label', this.value)" placeholder="${labelPlaceholder}" style="flex:1.5;">
                    <input type="text" value="${p.value}" onchange="updatePricing('${lang}', ${i}, 'value', this.value)" placeholder="${valuePlaceholder}" style="flex:1;">
                    <button type="button" onclick="movePricing('${lang}', ${i}, -1)" ${i===0?'disabled':''} title="تحريك لأعلى" style="${i===0?'opacity:0.3;cursor:not-allowed;':''}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="18 15 12 9 6 15"/></svg>
                    </button>
                    <button type="button" onclick="movePricing('${lang}', ${i}, 1)" ${i===pricing.length-1?'disabled':''} title="تحريك لأسفل" style="${i===pricing.length-1?'opacity:0.3;cursor:not-allowed;':''}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                    <button type="button" onclick="removePricing('${lang}', ${i})" title="حذف">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
            `).join('')}
        </div>
        <button type="button" class="pf-add-btn" onclick="addPricing('${lang}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            ${lang === 'ar' ? 'إضافة عرض سعر' : 'Add Price Offer'}
        </button>
    `;
}

window.updatePricing = function(lang, index, field, value) {
    const pricing = lang === 'ar' ? _pfPricingAr : _pfPricingEn;
    pricing[index][field] = value.trim();
};

window.addPricing = function(lang) {
    const pricing = lang === 'ar' ? _pfPricingAr : _pfPricingEn;
    pricing.push({ label: '', value: '' });
    renderPricing(lang);
};

window.removePricing = function(lang, index) {
    const pricing = lang === 'ar' ? _pfPricingAr : _pfPricingEn;
    pricing.splice(index, 1);
    renderPricing(lang);
};

window.movePricing = function(lang, index, direction) {
    const pricing = lang === 'ar' ? _pfPricingAr : _pfPricingEn;
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= pricing.length) return;
    [pricing[index], pricing[newIndex]] = [pricing[newIndex], pricing[index]];
    renderPricing(lang);
};

/* ─── Gallery Images Management ─── */
window.initGalleryManager = function() {
    renderGallery();
};

function renderGallery() {
    const container = document.getElementById('pfGalleryPreview');
    if (!container) return;
    
    container.innerHTML = _pfGalleryImages.map((img, i) => `
        <div class="pf-gallery-item" draggable="true" data-index="${i}" 
             ondragstart="handleGalleryDragStart(event, ${i})" 
             ondragover="handleGalleryDragOver(event)" 
             ondrop="handleGalleryDrop(event, ${i})" 
             ondragend="handleGalleryDragEnd(event)">
            <img src="${img.url}" alt="صورة ${i+1}">
            <button type="button" class="pf-gallery-item-delete" onclick="removeGalleryImage(${i})">✕</button>
            <div class="pf-gallery-item-order">${i+1}</div>
        </div>
    `).join('');
}

window.handleGalleryFiles = function(input) {
    const files = Array.from(input.files);
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = e => {
            _pfGalleryImages.push({
                file: file,
                url: e.target.result,
                order: _pfGalleryImages.length + 1,
                id: Date.now() + Math.random()
            });
            renderGallery();
        };
        reader.readAsDataURL(file);
    });
    input.value = ''; // Reset input
};

window.removeGalleryImage = function(index) {
    _pfGalleryImages.splice(index, 1);
    // Update orders
    _pfGalleryImages.forEach((img, i) => img.order = i + 1);
    renderGallery();
};

let _draggedIndex = null;

window.handleGalleryDragStart = function(e, index) {
    _draggedIndex = index;
    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
};

window.handleGalleryDragOver = function(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
};

window.handleGalleryDrop = function(e, dropIndex) {
    e.preventDefault();
    if (_draggedIndex === null || _draggedIndex === dropIndex) return;
    
    // Reorder array
    const [removed] = _pfGalleryImages.splice(_draggedIndex, 1);
    _pfGalleryImages.splice(dropIndex, 0, removed);
    
    // Update orders
    _pfGalleryImages.forEach((img, i) => img.order = i + 1);
    
    renderGallery();
};

window.handleGalleryDragEnd = function(e) {
    e.target.classList.remove('dragging');
    _draggedIndex = null;
};

/* ─── Load existing product data ─── */
window.loadProductDataToForm = function(product) {
    if (!product) {
        // New product - set defaults
        _pfSizes = ['L','XL','2XL','3XL','4XL'];
        _pfPricingAr = [
            {label:'قطعة واحدة',value:''},
            {label:'عرض 3 قطع',value:''},
            {label:'عرض 6 قطع (نص دستة)',value:''},
            {label:'عرض 12 قطعة (دستة كاملة)',value:''}
        ];
        _pfPricingEn = [
            {label:'1 Piece',value:''},
            {label:'3 Pieces',value:''},
            {label:'6 Pieces',value:''},
            {label:'12 Pieces',value:''}
        ];
        _pfGalleryImages = [];
    } else {
        // Edit product - load existing data
        _pfSizes = product.sizes || [];
        _pfPricingAr = product.pricing?.ar || [];
        _pfPricingEn = product.pricing?.en || [];
        _pfGalleryImages = (product.gallery || []).map((url, i) => ({
            file: null,
            url: url,
            order: i + 1,
            id: `existing-${i}`
        }));
    }
    
    initSizesManager();
    initPricingManager();
    initGalleryManager();
};

/* ─── Get form data ─── */
window.getProductFormData = function() {
    updateSizesArray(); // Ensure sizes are up to date
    
    return {
        sizes: _pfSizes.filter(s => s.trim()),
        pricingAr: _pfPricingAr.filter(p => p.label && p.value),
        pricingEn: _pfPricingEn.filter(p => p.label && p.value),
        galleryImages: _pfGalleryImages
    };
};
