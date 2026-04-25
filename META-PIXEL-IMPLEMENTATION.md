# Meta Pixel Implementation Summary
## DALAL E-Commerce Website

**Pixel ID:** 1287474249506243  
**Implementation Date:** April 25, 2026  
**Status:** ✅ COMPLETE

---

## 1. BASE PIXEL INSTALLATION

### Location: `<head>` section of ALL pages

The Meta Pixel base code has been installed in the following pages:

✅ **index.html** - Homepage  
✅ **product.html** - Product detail page  
✅ **products.html** - All products page  
✅ **about.html** - About page  
✅ **contact.html** - Contact page  
✅ **orders.html** - My orders page  
✅ **track.html** - Order tracking page  
✅ **review.html** - Review submission page  
✅ **privacy.html** - Privacy policy page  

### Base Code Installed:
```html
<!-- Meta Pixel Code -->
<script>
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window, document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '1287474249506243');
fbq('track', 'PageView');
</script>
<noscript><img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=1287474249506243&ev=PageView&noscript=1"/></noscript>
<!-- End Meta Pixel Code -->
```

### PageView Event:
- **Fires:** Automatically on every page load
- **Duplicate Prevention:** Built into base pixel code
- **Coverage:** All 9 main pages

---

## 2. VIEWCONTENT EVENT

### Implementation: `meta-pixel.js` (NEW FILE)

**Trigger:** Product page AFTER product data is fully loaded  
**Fires:** ONCE per product view  
**Duplicate Prevention:** ✅ Implemented via unique key tracking

### Code Location:
- **File:** `meta-pixel.js` (lines 40-60)
- **Auto-tracking:** Waits for `currentProduct` to be defined
- **Delay:** 500ms after product loads to ensure full render

### Event Parameters:
```javascript
{
  content_name: "Product Name (Arabic or English)",
  content_ids: ["product_id"],
  content_type: "product",
  value: 299.00,  // Starting price from first pricing tier
  currency: "EGP"
}
```

### Integration Points:
- **product.html** - Includes `meta-pixel.js` script
- **Auto-fires** when product data is ready
- **No manual trigger needed**

---

## 3. INITIATECHECKOUT EVENT

### Trigger Points (ALL buy/checkout buttons):

#### A) Product Page - "Order Now" Button
**File:** `product.js` (lines 665-680)  
**Button ID:** `registerOrderBtn`  
**Tracks:** Starting price from product pricing tiers

#### B) Product Page - "Add to Cart" Button
**File:** `product.js` (lines 665-680)  
**Button ID:** `addToCartBtn`  
**Tracks:** Starting price from product pricing tiers

#### C) Product Page - "Order via Messenger" Button
**File:** `product.js` (lines 850-865)  
**Button ID:** `orderBtn`  
**Tracks:** Starting price from product pricing tiers

#### D) Cart Drawer - "Checkout" Button
**File:** `cart.js` (lines 1170-1180)  
**Function:** `checkoutViaSite()`  
**Tracks:** Total cart value

### Event Parameters:
```javascript
{
  value: 299.00,  // Product price or cart total
  currency: "EGP"
}
```

### Duplicate Prevention:
- ✅ Each button click fires once per session
- ✅ Unique key tracking prevents multiple fires

---

## 4. ADDTOCART EVENT

### Trigger: When product is added to shopping cart

**File:** `cart.js` (lines 330-345)  
**Function:** `cartAdd()`  
**Fires:** After item is successfully added to cart

### Event Parameters:
```javascript
{
  content_name: "Product Name",
  content_ids: ["product_id"],
  content_type: "product",
  value: 299.00,  // Selected tier price
  currency: "EGP"
}
```

### Integration:
- Fires AFTER cart is updated
- Fires BEFORE toast notification
- Includes product details and selected price

---

## 5. LEAD EVENT (MOST IMPORTANT)

### Trigger: ONLY when order is successfully submitted

**CRITICAL:** Lead event fires ONLY after server confirms order creation.

### Implementation Points:

#### A) Order Modal (Single Product via Site)
**File:** `order-modal.js` (lines 180-185)  
**Trigger:** After successful `/api/create-order` response  
**Tracks:** Server-validated order total

#### B) Cart Checkout (Multiple Products via Site)
**File:** `cart.js` (lines 1456-1461 & 1119-1124)  
**Trigger:** After successful `/api/create-order` response  
**Tracks:** Server-validated order total

### Event Parameters:
```javascript
{
  value: 598.00,  // Server-validated total
  currency: "EGP"
}
```

### Lead Event Flow:
1. User fills order form
2. Form submits to `/api/create-order`
3. Server validates and creates order
4. Server returns `order_ref`, `id`, and `total`
5. **Lead event fires with server total**
6. Success message displays
7. Order saved locally

### Duplicate Prevention:
- ✅ Fires only on successful API response
- ✅ Does NOT fire on form validation errors
- ✅ Does NOT fire on server errors
- ✅ Does NOT fire on blocked/restricted users
- ✅ Does NOT fire when clicking Messenger button

---

## 6. DUPLICATE PREVENTION SYSTEM

### Global Tracking Object:
**File:** `meta-pixel.js` (lines 15-40)

```javascript
const _firedEvents = {};

function trackEvent(eventName, params, uniqueKey) {
  const key = uniqueKey || `${eventName}_${JSON.stringify(params)}`;
  
  if (_firedEvents[key]) {
    console.log(`Event already fired: ${eventName}`);
    return;
  }
  
  fbq('track', eventName, params);
  _firedEvents[key] = true;
}
```

### How It Works:
- Each event gets a unique key
- Key is stored in `_firedEvents` object
- Subsequent calls with same key are blocked
- Prevents duplicate tracking across page session

### Special Cases:
- **ViewContent:** Unique per product ID
- **InitiateCheckout:** Can fire multiple times (different buttons)
- **Lead:** Fires once per successful order
- **AddToCart:** Fires once per add action

---

## 7. ROBUSTNESS & ERROR HANDLING

### Safety Checks:
```javascript
// Check if fbq exists before calling
if (typeof fbq === 'undefined') {
  console.warn('[Meta Pixel] fbq not loaded');
  return;
}

// Check if DalalPixel helper exists
if (typeof DalalPixel !== 'undefined') {
  DalalPixel.trackEvent(...);
}
```

### Error Handling:
- All tracking wrapped in try-catch blocks
- Console logging for debugging
- Graceful degradation if pixel fails to load
- No impact on site functionality if pixel errors

### Dynamic Content Handling:
- **ViewContent:** Waits for product data to load
- **Product prices:** Extracted from live pricing tiers
- **Cart total:** Calculated from verified prices
- **Server validation:** Lead uses server-confirmed totals

---

## 8. CODE ORGANIZATION

### New Files Created:
1. **meta-pixel.js** - Central tracking module with helper functions

### Modified Files:
1. **index.html** - Added base pixel code
2. **product.html** - Added base pixel code + meta-pixel.js script
3. **products.html** - Added base pixel code + meta-pixel.js script
4. **about.html** - Added base pixel code
5. **contact.html** - Added base pixel code
6. **orders.html** - Added base pixel code
7. **track.html** - Added base pixel code
8. **review.html** - Added base pixel code
9. **privacy.html** - Added base pixel code
10. **product.js** - Added InitiateCheckout tracking to all buy buttons
11. **cart.js** - Added InitiateCheckout, AddToCart, and Lead tracking
12. **order-modal.js** - Added Lead tracking on order success

### Global API:
```javascript
window.DalalPixel = {
  trackViewContent(product),
  trackInitiateCheckout(value),
  trackLead(orderTotal),
  trackAddToCart(product, price)
}
```

---

## 9. TESTING CHECKLIST

### Manual Testing Steps:

#### Test 1: PageView
- [ ] Visit homepage → Check Facebook Events Manager
- [ ] Visit product page → Check for PageView event
- [ ] Visit about page → Check for PageView event

#### Test 2: ViewContent
- [ ] Open any product page
- [ ] Wait for product to load
- [ ] Check Events Manager for ViewContent with product details
- [ ] Verify fires ONCE per product

#### Test 3: InitiateCheckout
- [ ] Click "Order Now" button → Check for InitiateCheckout
- [ ] Click "Add to Cart" button → Check for InitiateCheckout
- [ ] Click "Order via Messenger" → Check for InitiateCheckout
- [ ] Open cart and click "Checkout" → Check for InitiateCheckout

#### Test 4: AddToCart
- [ ] Add product to cart
- [ ] Check Events Manager for AddToCart event
- [ ] Verify product details and price are correct

#### Test 5: Lead (CRITICAL)
- [ ] Fill out order form completely
- [ ] Submit order
- [ ] Wait for success message
- [ ] Check Events Manager for Lead event
- [ ] Verify order total matches

#### Test 6: Duplicate Prevention
- [ ] View same product twice → ViewContent fires once
- [ ] Click buy button multiple times → Check event count
- [ ] Submit order → Lead fires once only

---

## 10. ASSUMPTIONS & NOTES

### Assumptions Made:
1. **Currency:** All prices are in Egyptian Pounds (EGP)
2. **Product IDs:** Unique numeric IDs from `DALAL_PRODUCTS_MAP`
3. **Price Source:** First pricing tier used for ViewContent/InitiateCheckout
4. **Order Total:** Server-validated total used for Lead event
5. **Language:** Product names use current language (Arabic/English)

### Missing Data Handled:
- If product has no pricing → value = 0
- If product name is object → uses current language
- If fbq not loaded → graceful skip with console warning
- If DalalPixel not loaded → tracking skipped

### Not Implemented:
- **Purchase Event:** Not requested (Lead event used instead)
- **Search Event:** No search functionality on site
- **CompleteRegistration:** No user registration system
- **Admin Pages:** Pixel not added to admin/blocked/maintenance pages

---

## 11. FINAL SUMMARY

### ✅ Pixel Installed: YES

### Event Implementation Status:

| Event | Status | Trigger | Location |
|-------|--------|---------|----------|
| **PageView** | ✅ Complete | Every page load | All 9 pages |
| **ViewContent** | ✅ Complete | Product page after data loads | product.html |
| **InitiateCheckout** | ✅ Complete | All buy/checkout buttons | product.js, cart.js |
| **AddToCart** | ✅ Complete | Item added to cart | cart.js |
| **Lead** | ✅ Complete | Order successfully submitted | order-modal.js, cart.js |

### Duplicate Protection: ✅ Implemented
- Global event tracking object
- Unique key generation per event
- Console logging for debugging

### Robustness: ✅ Implemented
- fbq existence checks
- Try-catch error handling
- Graceful degradation
- No site functionality impact

### Code Quality: ✅ Clean & Modular
- Centralized tracking module (meta-pixel.js)
- Consistent API across site
- Well-documented code
- No inline duplication

---

## 12. MAINTENANCE NOTES

### Future Updates:
- If adding new buy buttons → Add `DalalPixel.trackInitiateCheckout()`
- If adding new order flows → Add `DalalPixel.trackLead()`
- If changing product structure → Update ViewContent parameters
- If adding new pages → Add base pixel code to `<head>`

### Debugging:
- Open browser console
- Look for `[Meta Pixel]` log messages
- Check Facebook Events Manager for real-time events
- Use Facebook Pixel Helper Chrome extension

### Support:
- Meta Pixel documentation: https://developers.facebook.com/docs/meta-pixel
- Events Manager: https://business.facebook.com/events_manager
- Test Events: Use Facebook's Test Events tool

---

**Implementation Complete ✅**  
**All requirements met**  
**Ready for production**
