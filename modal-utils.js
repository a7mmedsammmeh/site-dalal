/* ═══════════════════════════════════════════════════════════════
   DALAL — Modal Utilities
   Body scroll lock + drag-to-dismiss + browser back button
   ═══════════════════════════════════════════════════════════════ */

(function () {
    'use strict';

    let _lockCount = 0;
    let _touchBlocker = null;

    /* ─── Modal Stack (for browser back button) ─── */
    let _modalStack = [];

    /**
     * Push a modal state onto the history stack.
     * When user presses Back, the modal will close instead of navigating away.
     * @param {string} modalId - Unique identifier for this modal
     * @param {Function} closeFn - Function to call to close this modal
     */
    function pushModalState(modalId, closeFn) {
        _modalStack.push({ id: modalId, close: closeFn });
        history.pushState({ dalalModal: modalId }, '');
    }

    /**
     * Pop a modal state when modal is closed programmatically (not via back button).
     * This prevents the back button from firing a stale close.
     */
    function popModalState() {
        if (_modalStack.length > 0) {
            _modalStack.pop();
            // Go back to remove the state we pushed — but silently (flag to ignore popstate)
            _ignoreNextPop = true;
            history.back();
        }
    }

    let _ignoreNextPop = false;

    // Listen for browser back button
    window.addEventListener('popstate', function (e) {
        if (_ignoreNextPop) {
            _ignoreNextPop = false;
            return;
        }
        // If we have a modal on the stack, close it
        if (_modalStack.length > 0) {
            const modal = _modalStack.pop();
            if (modal && typeof modal.close === 'function') {
                modal._fromBack = true; // flag so close fn doesn't call popModalState again
                modal.close();
            }
        }
    });

    /**
     * Lock body scroll — prevents page scrolling behind modals.
     * Uses overflow:hidden on html+body (no position:fixed = no jump).
     * Also blocks touch-scroll on the page behind the modal.
     */
    function lockBodyScroll() {
        if (_lockCount === 0) {
            // Save current scrollbar width to avoid layout shift
            const scrollbarW = window.innerWidth - document.documentElement.clientWidth;
            document.documentElement.style.overflow = 'hidden';
            document.body.style.overflow = 'hidden';
            if (scrollbarW > 0) {
                document.body.style.paddingRight = scrollbarW + 'px';
            }

            // Block touch scrolling on the page behind modal (iOS fix)
            _touchBlocker = function (e) {
                // Allow scrolling inside modal content, block everything else
                const modal = e.target.closest(
                    '.modal, .order-modal, .od-drawer, .cart-drawer'
                );
                if (!modal) {
                    e.preventDefault();
                }
            };
            document.addEventListener('touchmove', _touchBlocker, { passive: false });
        }
        _lockCount++;
    }

    /**
     * Unlock body scroll — restores normal scrolling.
     * No jump because we never moved the page.
     */
    function unlockBodyScroll() {
        _lockCount = Math.max(0, _lockCount - 1);
        if (_lockCount === 0) {
            document.documentElement.style.overflow = '';
            document.body.style.overflow = '';
            document.body.style.paddingRight = '';

            if (_touchBlocker) {
                document.removeEventListener('touchmove', _touchBlocker);
                _touchBlocker = null;
            }
        }
    }

    /**
     * Force unlock — resets all locks (safety net).
     */
    function forceUnlockBodyScroll() {
        _lockCount = 0;
        document.documentElement.style.overflow = '';
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';

        if (_touchBlocker) {
            document.removeEventListener('touchmove', _touchBlocker);
            _touchBlocker = null;
        }
    }

    /**
     * Drag-to-dismiss setup for modal cards.
     * Works on touch devices — swipe down to close.
     * 
     * @param {HTMLElement} card - The modal card element that gets dragged
     * @param {Function} onClose - Function to call when dismissed
     * @param {Object} opts - Options
     * @param {number} opts.threshold - Pixels to drag before dismissing (default: 120)
     * @param {boolean} opts.desktopToo - Allow on desktop too (default: false, mobile only < 640px)
     */
    function setupDragToDismiss(card, onClose, opts = {}) {
        const threshold = opts.threshold || 120;
        const desktopToo = opts.desktopToo || false;

        let startY = 0, currentY = 0, dragging = false;

        function onTouchStart(e) {
            if (!desktopToo && window.innerWidth >= 640) return;
            // Only allow drag when scrolled to top of modal
            if (card.scrollTop > 0) return;
            startY = e.touches[0].clientY;
            currentY = 0;
            dragging = true;
            card.style.transition = 'none';
        }

        function onTouchMove(e) {
            if (!dragging) return;
            const dy = e.touches[0].clientY - startY;
            if (dy < 0) { // upward — let the modal scroll normally
                dragging = false;
                card.style.transition = '';
                card.style.transform = '';
                return;
            }
            currentY = dy;
            // Apply resistance for visual feedback
            const dampened = dy * 0.85;
            card.style.transform = `translateY(${dampened}px)`;
            // Set opacity on overlay parent for visual feedback
            const overlay = card.closest('.modal-overlay, .order-overlay, .od-overlay, #orderModal');
            if (overlay) {
                const progress = Math.min(dy / (threshold * 2), 0.5);
                overlay.style.background = `rgba(0,0,0,${0.75 - progress})`;
            }
            e.preventDefault();
        }

        function onTouchEnd() {
            if (!dragging) return;
            dragging = false;
            card.style.transition = 'transform 0.35s cubic-bezier(0.4,0,0.2,1)';

            // Reset overlay opacity
            const overlay = card.closest('.modal-overlay, .order-overlay, .od-overlay, #orderModal');
            if (overlay) {
                overlay.style.background = '';
            }

            if (currentY > threshold) {
                // Dismiss — animate out smoothly
                card.style.transform = 'translateY(100%)';
                setTimeout(() => {
                    onClose();
                    // Reset transform after close
                    setTimeout(() => {
                        card.style.transform = '';
                        card.style.transition = '';
                    }, 50);
                }, 300);
            } else {
                // Snap back
                card.style.transform = '';
            }
        }

        card.addEventListener('touchstart', onTouchStart, { passive: true });
        // IMPORTANT: passive: false to allow e.preventDefault() which stops background scroll
        card.addEventListener('touchmove', onTouchMove, { passive: false });
        card.addEventListener('touchend', onTouchEnd, { passive: true });

        // Return cleanup function
        return function cleanup() {
            card.removeEventListener('touchstart', onTouchStart);
            card.removeEventListener('touchmove', onTouchMove);
            card.removeEventListener('touchend', onTouchEnd);
        };
    }

    /**
     * Check if the close was triggered by the browser back button.
     * Used internally so close functions don't double-pop the state.
     */
    function isBackClose() {
        // Check the last popped modal for back flag
        return false; // default
    }

    // Expose globally
    window.DalalModal = {
        lock: lockBodyScroll,
        unlock: unlockBodyScroll,
        forceUnlock: forceUnlockBodyScroll,
        setupDrag: setupDragToDismiss,
        pushState: pushModalState,
        popState: popModalState,
        _stack: _modalStack  // exposed for internal checks
    };

})();
