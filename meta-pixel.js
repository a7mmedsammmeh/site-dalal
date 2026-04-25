/* ═══════════════════════════════════════════════════════════════
   DALAL — Meta Pixel Tracking (OPTIMIZED)
   Pixel ID: 1287474249506243
   
   OPTIMIZATIONS:
   - Selective duplicate prevention (ViewContent + Lead only)
   - Removed artificial delays
   - Consistent product data structure
   - Enhanced Lead event
   - Safe tracking wrapper
   ═══════════════════════════════════════════════════════════════ */

(function() {
    'use strict';

    // Selective duplicate tracking - ONLY for ViewContent and Lead
    const _viewedProducts = new Set();
    const _submittedOrders = new Set();

    /**
     * Safe tracking wrapper - ensures fbq exists
     */
    function safeTrack(eventName, params = {}) {
        if (typeof fbq === 'undefined') {
            console.warn('[Meta Pixel] fbq not loaded, skipping:', eventName);
            return false;
        }

        try {
            fbq('track', eventName, params);
            console.log(`[Meta Pixel] ✓ ${eventName}`, params);
            return true;
        } catch (err) {
            console.error('[Meta Pixel] Error:', eventName, err);
            return false;
        }
    }

    /**
     * Get product name in current language
     */
    function getProductName(product) {
        if (!product) return '';
        const lang = localStorage.getItem('dalal-lang') || 'ar';
        return typeof product.name === 'object' 
            ? (product.name[lang] || product.name.ar || product.name.en || '')
            : String(product.name || '');
    }

    /**
     * Get product price from pricing tiers
     */
    function getProductPrice(product) {
        if (!product || !product.pricing) return 0;
        const lang = localStorage.getItem('dalal-lang') || 'ar';
        const pricingRows = product.pricing[lang] || product.pricing.ar || [];
        if (!pricingRows.length) return 0;
        const priceStr = pricingRows[0].value || '0';
        return parseFloat(priceStr.replace(/[^\d.]/g, '')) || 0;
    }

    /**
     * Build consistent product data object
     */
    function buildProductData(product, value = null) {
        if (!product || !product.id) return null;

        return {
            content_name: getProductName(product),
            content_ids: [String(product.id)],
            content_type: 'product',
            value: value !== null ? value : getProductPrice(product),
            currency: 'EGP'
        };
    }

    /**
     * Track ViewContent event
     * Duplicate prevention: ONCE per product.id per session
     */
    function trackViewContent(product) {
        if (!product || !product.id) {
            console.warn('[Meta Pixel] ViewContent: Invalid product');
            return;
        }

        // Duplicate check - only for ViewContent
        if (_viewedProducts.has(product.id)) {
            console.log(`[Meta Pixel] ViewContent already tracked for product ${product.id}`);
            return;
        }

        const data = buildProductData(product);
        if (!data) return;

        if (safeTrack('ViewContent', data)) {
            _viewedProducts.add(product.id);
        }
    }

    /**
     * Track AddToCart event
     * NO duplicate prevention - users can add same item multiple times
     */
    function trackAddToCart(product, price = null) {
        if (!product || !product.id) {
            console.warn('[Meta Pixel] AddToCart: Invalid product');
            return;
        }

        const data = buildProductData(product, price);
        if (!data) return;

        safeTrack('AddToCart', data);
    }

    /**
     * Track InitiateCheckout event
     * NO duplicate prevention - users can click checkout multiple times
     * 
     * @param {object|number} data - Product object, cart data, or numeric value
     */
    function trackInitiateCheckout(data) {
        let params = {
            currency: 'EGP'
        };

        // Handle different input types
        if (typeof data === 'number') {
            // Simple value
            params.value = data;
        } else if (data && typeof data === 'object') {
            if (data.id) {
                // Single product
                const productData = buildProductData(data);
                if (productData) {
                    params = { ...params, ...productData };
                }
            } else if (data.items && Array.isArray(data.items)) {
                // Cart with multiple items
                params.content_ids = data.items.map(item => String(item.id || item.product_id));
                params.content_type = 'product';
                params.value = data.total || 0;
                params.num_items = data.items.length;
            } else if (data.value !== undefined) {
                // Object with value
                params.value = data.value;
                if (data.content_ids) params.content_ids = data.content_ids;
                if (data.content_type) params.content_type = data.content_type;
            }
        }

        // Ensure value exists
        if (params.value === undefined) params.value = 0;

        safeTrack('InitiateCheckout', params);
    }

    /**
     * Track Lead event (Order Submission)
     * Duplicate prevention: ONCE per order.id
     * Enhanced with product context
     * 
     * @param {object} orderData - { total, orderId, items }
     */
    function trackLead(orderData) {
        let params = {
            currency: 'EGP',
            content_type: 'product'
        };

        // Handle different input formats
        if (typeof orderData === 'number') {
            // Legacy: just a number
            params.value = orderData;
        } else if (orderData && typeof orderData === 'object') {
            params.value = orderData.total || orderData.value || 0;
            
            // Duplicate check - only for Lead
            const orderId = orderData.orderId || orderData.order_ref || orderData.id;
            if (orderId) {
                if (_submittedOrders.has(orderId)) {
                    console.log(`[Meta Pixel] Lead already tracked for order ${orderId}`);
                    return;
                }
            }

            // Add product context if available
            if (orderData.items && Array.isArray(orderData.items)) {
                params.content_ids = orderData.items.map(item => 
                    String(item.product_id || item.id)
                );
                params.num_items = orderData.items.length;
            }

            // Track order and mark as submitted
            if (orderId && safeTrack('Lead', params)) {
                _submittedOrders.add(orderId);
            } else {
                safeTrack('Lead', params);
            }
            return;
        }

        safeTrack('Lead', params);
    }

    // Expose tracking API globally
    window.DalalPixel = {
        trackViewContent,
        trackAddToCart,
        trackInitiateCheckout,
        trackLead,
        // Utility for manual tracking
        safeTrack
    };

    console.log('[Meta Pixel] Tracking module loaded ✓');

})();
