/* ═══════════════════════════════════════════════════════════════
   DALAL — ImageKit Automatic Image Optimization (Production-Hardened)
   
   Automatically converts Supabase and local images to ImageKit CDN
   with automatic format optimization and responsive transformations
   
   ImageKit Config:
   - URL Endpoint: https://ik.imagekit.io/zpwmqysui
   - Endpoint Path: /dalal
   - Origin: Supabase Storage
   
   PRODUCTION OPTIMIZATIONS:
   - Removed risky HTMLImageElement.prototype.src override
   - Simplified transformations (ImageKit auto-handles format)
   - Optimized MutationObserver (childList only, no attributes)
   - Enhanced skip logic (logos, icons, small UI images)
   - Performance improvements (WeakSet + dataset flags)
   ═══════════════════════════════════════════════════════════════ */

(function() {
    'use strict';

    // ImageKit Configuration
    const IMAGEKIT_CONFIG = {
        urlEndpoint: 'https://ik.imagekit.io/zpwmqysui',
        endpointPath: '/dalal',
        supabaseOrigin: 'https://wnzueymobiwecuikwcgx.supabase.co/storage/v1/object/public',
        localOrigin: 'https://www.dalalwear.shop'
    };

    // Track processed images to avoid reprocessing (memory-efficient)
    const processedImages = new WeakSet();

    /**
     * Check if URL should be optimized
     * ENHANCED: Skip logos, icons, and small UI images
     * FIXED: Only optimize Supabase images, skip local images
     */
    function shouldOptimize(url) {
        if (!url || typeof url !== 'string') return false;
        
        // Skip if already using ImageKit
        if (url.includes('ik.imagekit.io')) return false;
        
        // Skip SVG files
        if (url.endsWith('.svg')) return false;
        
        // Skip logos and icons (common patterns)
        const skipPatterns = ['logo', 'icon', 'favicon', 'avatar'];
        const lowerUrl = url.toLowerCase();
        if (skipPatterns.some(pattern => lowerUrl.includes(pattern))) {
            return false;
        }
        
        // Skip data URLs and blobs
        if (url.startsWith('data:') || url.startsWith('blob:')) return false;
        
        // ONLY optimize Supabase images (skip local images)
        // Local images like images/hero-lingerie.png are not on ImageKit
        if (!url.includes('supabase.co')) {
            return false;
        }
        
        return true;
    }

    /**
     * Extract path from Supabase or local URL
     */
    function extractPath(url) {
        // Handle Supabase URLs
        if (url.includes('supabase.co/storage/v1/object/public')) {
            const parts = url.split('/storage/v1/object/public');
            return parts[1] || '';
        }
        
        // Handle local URLs
        if (url.includes('dalalwear.shop')) {
            try {
                const urlObj = new URL(url);
                return urlObj.pathname;
            } catch (e) {
                return url;
            }
        }
        
        // Handle relative URLs
        if (url.startsWith('/')) {
            return url;
        }
        
        // Handle relative paths without leading slash
        if (!url.startsWith('http')) {
            return '/' + url;
        }
        
        return url;
    }

    /**
     * Determine optimal transformation based on image context
     * SIMPLIFIED: Removed f-webp (ImageKit auto-handles format)
     */
    function getTransformation(img) {
        const classList = img.classList;
        const parent = img.parentElement;
        
        // Thumbnails - smaller size, lower quality
        if (classList.contains('thumb') || 
            classList.contains('cart-item-img') ||
            parent?.classList.contains('thumb-wrap')) {
            return 'tr=w-150,q-70';
        }
        
        // Product card images
        if (classList.contains('product-card-img')) {
            return 'tr=w-400,q-80';
        }
        
        // Main product images
        if (classList.contains('main-image')) {
            return 'tr=w-1200,q-85';
        }
        
        // Hero/background images
        if (classList.contains('hero-bg-img')) {
            return 'tr=w-1920,q-85';
        }
        
        // Default transformation
        return 'tr=w-800,q-80';
    }

    /**
     * Convert URL to ImageKit format
     * SIMPLIFIED: Let ImageKit handle format automatically
     */
    function convertToImageKit(url, transformation = 'tr=w-800,q-80') {
        if (!shouldOptimize(url)) return url;
        
        const path = extractPath(url);
        
        // Build ImageKit URL
        const imagekitUrl = `${IMAGEKIT_CONFIG.urlEndpoint}${IMAGEKIT_CONFIG.endpointPath}${path}`;
        
        // Add transformation
        return `${imagekitUrl}?${transformation}`;
    }

    /**
     * Optimize a single image element
     * PERFORMANCE: Double-check with dataset flag + WeakSet
     */
    function optimizeImage(img) {
        // Skip if already processed (double-check for safety)
        if (img.dataset.imagekitOptimized === 'true' || processedImages.has(img)) {
            return;
        }
        
        // Get current src
        const originalSrc = img.src || img.dataset.src || img.getAttribute('src');
        if (!originalSrc || !shouldOptimize(originalSrc)) return;
        
        // Determine transformation
        const transformation = getTransformation(img);
        
        // Convert to ImageKit
        const optimizedSrc = convertToImageKit(originalSrc, transformation);
        
        // If no change needed, skip
        if (optimizedSrc === originalSrc) return;
        
        // Store original for reference
        if (!img.dataset.originalSrc) {
            img.dataset.originalSrc = originalSrc;
        }
        
        // Update src
        if (img.dataset.src) {
            img.dataset.src = optimizedSrc;
        }
        img.src = optimizedSrc;
        
        // Handle srcset if present
        if (img.srcset) {
            const srcsetParts = img.srcset.split(',').map(part => {
                const [url, descriptor] = part.trim().split(/\s+/);
                if (shouldOptimize(url)) {
                    return `${convertToImageKit(url, transformation)} ${descriptor || ''}`.trim();
                }
                return part;
            });
            img.srcset = srcsetParts.join(', ');
        }
        
        // Add lazy loading if not present
        if (!img.loading) {
            img.loading = 'lazy';
        }
        
        // Mark as processed (both methods for redundancy)
        processedImages.add(img);
        img.dataset.imagekitOptimized = 'true';
    }

    /**
     * Optimize all images on the page
     * PERFORMANCE: Only process unoptimized images
     */
    function optimizeAllImages() {
        const images = document.querySelectorAll('img:not([data-imagekit-optimized])');
        let count = 0;
        
        images.forEach(img => {
            try {
                const beforeSrc = img.src;
                optimizeImage(img);
                // Only count if actually changed
                if (img.src !== beforeSrc) count++;
            } catch (err) {
                console.warn('[ImageKit] Failed to optimize image:', err);
            }
        });
        
        if (count > 0) {
            console.log(`[ImageKit] ✓ Optimized ${count} images`);
        }
    }

    /**
     * Watch for dynamically added images
     * OPTIMIZED: Only watches childList (no attributes - handled in code)
     * SAFER: No HTMLImageElement.prototype override (removed risky code)
     */
    function watchDynamicImages() {
        const observer = new MutationObserver((mutations) => {
            let newImages = [];
            
            mutations.forEach(mutation => {
                // Only process added nodes
                mutation.addedNodes.forEach(node => {
                    if (node.nodeName === 'IMG') {
                        newImages.push(node);
                    } else if (node.querySelectorAll) {
                        const images = node.querySelectorAll('img:not([data-imagekit-optimized])');
                        if (images.length > 0) {
                            newImages.push(...images);
                        }
                    }
                });
            });
            
            // Batch process new images
            if (newImages.length > 0) {
                newImages.forEach(img => {
                    try {
                        optimizeImage(img);
                    } catch (err) {
                        console.warn('[ImageKit] Failed to optimize dynamic image:', err);
                    }
                });
                console.log(`[ImageKit] ✓ Optimized ${newImages.length} dynamic images`);
            }
        });
        
        // OPTIMIZED: Only watch childList (src changes handled in product.js)
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        return observer;
    }

    /**
     * Public API
     * SIMPLIFIED: Removed f-webp from all methods
     */
    window.ImageKitOptimizer = {
        /**
         * Manually optimize a URL
         */
        optimizeUrl: function(url, width = 800, quality = 80) {
            const transformation = `tr=w-${width},q-${quality}`;
            return convertToImageKit(url, transformation);
        },
        
        /**
         * Manually optimize an image element
         */
        optimizeElement: function(img) {
            optimizeImage(img);
        },
        
        /**
         * Re-optimize all images
         */
        reoptimize: function() {
            // Clear WeakSet (can't actually clear, but reset dataset flags)
            document.querySelectorAll('img[data-imagekit-optimized]').forEach(img => {
                img.removeAttribute('data-imagekit-optimized');
            });
            optimizeAllImages();
        },
        
        /**
         * Get ImageKit URL for a path
         */
        getImageKitUrl: function(path, transformation = 'tr=w-800,q-80') {
            return `${IMAGEKIT_CONFIG.urlEndpoint}${IMAGEKIT_CONFIG.endpointPath}${path}?${transformation}`;
        }
    };

    /**
     * Initialize
     * REMOVED: interceptImageSetter() - risky prototype override removed
     */
    function init() {
        console.log('[ImageKit] Initializing production-hardened optimizer...');
        
        // Optimize existing images
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', optimizeAllImages);
        } else {
            optimizeAllImages();
        }
        
        // Watch for dynamic images (MutationObserver only)
        watchDynamicImages();
        
        // Re-optimize on page show (back/forward cache)
        window.addEventListener('pageshow', (event) => {
            if (event.persisted) {
                optimizeAllImages();
            }
        });
        
        console.log('[ImageKit] ✓ Production optimizer ready');
    }

    // Start
    init();

})();
