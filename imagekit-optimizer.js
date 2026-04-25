/* ═══════════════════════════════════════════════════════════════
   DALAL — ImageKit Automatic Image Optimization
   
   Automatically converts Supabase and local images to ImageKit CDN
   with WebP conversion and responsive transformations
   
   ImageKit Config:
   - URL Endpoint: https://ik.imagekit.io/zpwmqysui
   - Endpoint Path: /dalal
   - Origin: Supabase Storage
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

    // Track processed images to avoid reprocessing
    const processedImages = new WeakSet();

    /**
     * Check if URL should be optimized
     */
    function shouldOptimize(url) {
        if (!url || typeof url !== 'string') return false;
        
        // Skip if already using ImageKit
        if (url.includes('ik.imagekit.io')) return false;
        
        // Skip SVG files
        if (url.endsWith('.svg')) return false;
        
        // Skip data URLs
        if (url.startsWith('data:')) return false;
        
        // Skip external CDNs (except Supabase)
        if (url.startsWith('http') && 
            !url.includes('supabase.co') && 
            !url.includes('dalalwear.shop')) {
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
     */
    function getTransformation(img) {
        const classList = img.classList;
        const parent = img.parentElement;
        
        // Thumbnails - smaller size, lower quality
        if (classList.contains('thumb') || 
            classList.contains('cart-item-img') ||
            parent?.classList.contains('thumb-wrap')) {
            return 'tr=w-150,q-70,f-webp';
        }
        
        // Product card images
        if (classList.contains('product-card-img')) {
            return 'tr=w-400,q-80,f-webp';
        }
        
        // Main product images
        if (classList.contains('main-image')) {
            return 'tr=w-1200,q-85,f-webp';
        }
        
        // Hero/background images
        if (classList.contains('hero-bg-img') || 
            classList.contains('hero-logo')) {
            return 'tr=w-1920,q-85,f-webp';
        }
        
        // Footer/small logos
        if (classList.contains('footer-logo') || 
            classList.contains('hero-logo')) {
            return 'tr=w-300,q-80,f-webp';
        }
        
        // Default transformation
        return 'tr=w-800,q-80,f-webp';
    }

    /**
     * Convert URL to ImageKit format
     */
    function convertToImageKit(url, transformation = 'tr=w-800,q-80,f-webp') {
        if (!shouldOptimize(url)) return url;
        
        const path = extractPath(url);
        
        // Build ImageKit URL
        const imagekitUrl = `${IMAGEKIT_CONFIG.urlEndpoint}${IMAGEKIT_CONFIG.endpointPath}${path}`;
        
        // Add transformation
        return `${imagekitUrl}?${transformation}`;
    }

    /**
     * Optimize a single image element
     */
    function optimizeImage(img) {
        // Skip if already processed
        if (processedImages.has(img)) return;
        
        // Get current src
        const originalSrc = img.src || img.dataset.src || img.getAttribute('src');
        if (!originalSrc || !shouldOptimize(originalSrc)) return;
        
        // Determine transformation
        const transformation = getTransformation(img);
        
        // Convert to ImageKit
        const optimizedSrc = convertToImageKit(originalSrc, transformation);
        
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
        
        // Mark as processed
        processedImages.add(img);
        img.dataset.imagekitOptimized = 'true';
    }

    /**
     * Optimize all images on the page
     */
    function optimizeAllImages() {
        const images = document.querySelectorAll('img:not([data-imagekit-optimized])');
        let count = 0;
        
        images.forEach(img => {
            try {
                optimizeImage(img);
                count++;
            } catch (err) {
                console.warn('[ImageKit] Failed to optimize image:', err);
            }
        });
        
        if (count > 0) {
            console.log(`[ImageKit] ✓ Optimized ${count} images`);
        }
    }

    /**
     * Override Image.prototype.src setter to intercept dynamic images
     */
    function interceptImageSetter() {
        const originalSrcDescriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
        
        Object.defineProperty(HTMLImageElement.prototype, 'src', {
            get: function() {
                return originalSrcDescriptor.get.call(this);
            },
            set: function(value) {
                if (shouldOptimize(value) && !processedImages.has(this)) {
                    const transformation = getTransformation(this);
                    const optimizedValue = convertToImageKit(value, transformation);
                    
                    if (!this.dataset.originalSrc) {
                        this.dataset.originalSrc = value;
                    }
                    
                    processedImages.add(this);
                    this.dataset.imagekitOptimized = 'true';
                    
                    return originalSrcDescriptor.set.call(this, optimizedValue);
                }
                return originalSrcDescriptor.set.call(this, value);
            },
            configurable: true
        });
    }

    /**
     * Watch for dynamically added images
     */
    function watchDynamicImages() {
        const observer = new MutationObserver((mutations) => {
            let hasNewImages = false;
            
            mutations.forEach(mutation => {
                // Check added nodes
                mutation.addedNodes.forEach(node => {
                    if (node.nodeName === 'IMG') {
                        optimizeImage(node);
                        hasNewImages = true;
                    } else if (node.querySelectorAll) {
                        const images = node.querySelectorAll('img:not([data-imagekit-optimized])');
                        if (images.length > 0) {
                            images.forEach(optimizeImage);
                            hasNewImages = true;
                        }
                    }
                });
                
                // Check attribute changes (src updates)
                if (mutation.type === 'attributes' && 
                    mutation.attributeName === 'src' && 
                    mutation.target.nodeName === 'IMG') {
                    optimizeImage(mutation.target);
                    hasNewImages = true;
                }
            });
            
            if (hasNewImages) {
                console.log('[ImageKit] ✓ Optimized dynamic images');
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['src']
        });
        
        return observer;
    }

    /**
     * Public API
     */
    window.ImageKitOptimizer = {
        /**
         * Manually optimize a URL
         */
        optimizeUrl: function(url, width = 800, quality = 80) {
            const transformation = `tr=w-${width},q-${quality},f-webp`;
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
            processedImages.clear();
            document.querySelectorAll('img[data-imagekit-optimized]').forEach(img => {
                img.removeAttribute('data-imagekit-optimized');
            });
            optimizeAllImages();
        },
        
        /**
         * Get ImageKit URL for a path
         */
        getImageKitUrl: function(path, transformation = 'tr=w-800,q-80,f-webp') {
            return `${IMAGEKIT_CONFIG.urlEndpoint}${IMAGEKIT_CONFIG.endpointPath}${path}?${transformation}`;
        }
    };

    /**
     * Initialize
     */
    function init() {
        console.log('[ImageKit] Initializing optimizer...');
        
        // Intercept image src setter for dynamic images
        interceptImageSetter();
        
        // Optimize existing images
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', optimizeAllImages);
        } else {
            optimizeAllImages();
        }
        
        // Watch for dynamic images
        watchDynamicImages();
        
        // Re-optimize on page show (back/forward cache)
        window.addEventListener('pageshow', (event) => {
            if (event.persisted) {
                optimizeAllImages();
            }
        });
        
        console.log('[ImageKit] ✓ Optimizer ready');
    }

    // Start
    init();

})();
