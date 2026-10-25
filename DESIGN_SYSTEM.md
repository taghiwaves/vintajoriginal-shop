# Vintajoriginal Design System (Initial Direction)

**Note**: This document outlines the initial design direction. Before implementing the full shop, a small representative visual prototype must be created and approved, covering the homepage, product card, product detail page, cart, and checkout. The deep-purple, lavender, and gold palette should be preserved unless the prototype reveals accessibility or usability problems. All customer-facing content must use natural Azerbaijani and display AZN correctly.

## 1. Brand Color Palette
- **Primary**: #2E294E (Deep Purple) - for headers, primary buttons, accents
- **Secondary**: #E6E6FA (Lavender) - for backgrounds, secondary elements
- **Accent**: #D4AF37 (Metallic Gold) - for highlights, sale badges, icons
- **Background**: #FFFFFF (White) - main content background
- **Text Primary**: #212121 (Almost Black) - for headings, body text
- **Text Secondary**: #757575 (Gray) - for subtitles, helper text
- **Success**: #4CAF50 (Green) - for success messages, confirmed actions
- **Warning**: #FF9800 (Amber) - for warnings, limited stock
- **Error**: #F44336 (Red) - for error messages, failed actions
- **Disabled**: #BDBDBD (Light Gray) - for disabled states

*Note: Ensure all color combinations meet WCAG 2.2 AA contrast ratios.*

## 2. Typography
- **Font Family**: 'Inter', sans-serif (or system font stack for performance)
- **Heading 1 (H1)**: 2.5rem (40px), Bold, Letter-spacing -0.5px
- **Heading 2 (H2)**: 2rem (32px), Bold
- **Heading 3 (H3)**: 1.75rem (28px), Semi-bold
- **Heading 4 (H4)**: 1.5rem (24px), Semi-bold
- **Body Text**: 1rem (16px), Regular
- **Small Text**: 0.875rem (14px), Regular
- **Font Weights**: Regular (400), Semi-bold (600), Bold (700)
- **Line Height**: 1.6 for body, 1.2 for headings
- **Language Note**: Ensure proper rendering of Azerbaijani characters (ə, ı, İ, ş, ç, ğ, ö, ü)

## 3. Spacing and Layout
- **Base Unit**: 8px (for consistent spacing)
- **Container Max Width**: 1200px
- **Padding**: 
  - Small: 8px
  - Medium: 16px
  - Large: 24px
  - Extra Large: 32px
- **Gap (between elements)**:
  - Small: 8px
  - Medium: 16px
  - Large: 24px
- **Border Radius**: 
  - Small: 4px
  - Medium: 8px
  - Large: 12px
  - Pill: 50px
- **Shadows**:
  - Small: 0 2px 4px rgba(0,0,0,0.1)
  - Medium: 0 4px 8px rgba(0,0,0,0.1)
  - Large: 0 8px 16px rgba(0,0,0,0.15)

## 4. Button Styles
- **Primary Button**:
  - Background: #2E294E
  - Text: #FFFFFF
  - Padding: 12px 24px
  - Border: none
  - Border Radius: 8px
  - Font Weight: 600
  - Cursor: pointer
  - Transition: all 0.2s ease
  - Hover: Background #1F1C37
  - Active: Background #1A172E
  - Disabled: Background #BDBDBD, Cursor: not-allowed
- **Secondary Button**:
  - Background: transparent
  - Text: #2E294E
  - Border: 2px solid #2E294E
  - Same padding, radius, hover effects as primary
  - Hover: Background rgba(46, 41, 78, 0.05)
- **Outline Button** (for secondary actions):
  - Background: transparent
  - Text: #757575
  - Border: 2px solid #757575
  - Hover: Border color #2E294E, Text color #2E294E
- **Icon Button**: 
  - Size: 40x40px
  - Background: transparent
  - Border: none
  - Color: #212121
  - Hover: Background rgba(0,0,0,0.05)

## 5. Form Elements
- **Input Fields**:
  - Height: 48px
  - Padding: 0 16px
  - Border: 2px solid #E0E0E0
  - Border Radius: 8px
  - Font Size: 1rem
  - Background: #FFFFFF
  - Focus: Border color #2E294E, Box-shadow: 0 0 0 3px rgba(46, 41, 78, 0.2)
  - Error: Border color #F44336
  - Disabled: Background #F5F5F5, Color #BDBDBD
- **Textarea**: Same as input, with vertical resize
- **Select Dropdown**: Same styling as input, with arrow icon
- **Checkbox/Radio**: 
  - Size: 20x20px
  - Border: 2px solid #E0E0E0
  - Border Radius: 4px
  - Checked State: Background #2E294E, Checkmark color #FFFFFF
  - Hover: Border color #2E294E
- **Labels**: 
  - Font Size: 0.875rem
  - Font Weight: 600
  - Margin Bottom: 8px
  - Color: #212121
- **Helper Text**: 
  - Font Size: 0.75rem
  - Color: #757575
  - Margin Top: 4px
- **Error Message**: 
  - Font Size: 0.75rem
  - Color: #F44336
  - Margin Top: 4px

## 6. Card Components
- **Product Card**:
  - Background: #FFFFFF
  - Border Radius: 12px
  - Overflow: hidden
  - Shadow: Medium
  - Padding: 16px
  - Display: flex
  - Flex Direction: column
  - Height: 100% (for grid uniformity)
  - Hover: Shadow: Large, Transform: translateY(-4px)
  - Image Container: Aspect ratio 4:5, Background #F8F9FA, Overflow hidden
  - Image: Width 100%, Height 100%, Object-fit: contain
  - Content: Flex-grow: 1, Display: flex, Flex direction: column
  - Name: Font size 1.125rem, Font weight 600, Margin: 12px 0 4px
  - Price: Font size 1.25rem, Font weight 700, Color #2E294E, Margin: 4px 0
  - Badges (if any): Position absolute, top 8px, left 8px, Background rgba(212,175,55,0.9), Color white, Padding 4px 8px, Border radius 4px, Font size 0.75rem
  - Out of Stock Overlay: Background rgba(0,0,0,0.5), Color white, Padding 12px, Text align center, Font weight 600

## 7. Navigation and Header
- **Header**:
  - Height: 64px
  - Background: #FFFFFF
  - Border Bottom: 1px solid #E0E0E0
  - Display: flex
  - Align Items: center
  - Justify Content: space-between
  - Padding: 0 24px
- **Logo**: 
  - Height: 40px
  - Width: auto
- **Navigation Menu** (Desktop):
  - Display: flex
  - Gap: 32px
  - Font size: 1rem
  - Font weight: 500
  - Color: #212121
  - Hover: Color #2E294E
  - Active: Color #2E294E, Font weight 600
- **Mobile Navigation**:
  - Hamburger Icon: 24x24px, Color #212121
  - Drawer: Width 280px, Background white, Box shadow: left medium
  - Menu Items: Padding 16px 24px, Border bottom 1px solid #F0F0F0
  - Last Item: No border bottom
- **Search Bar** (in header on desktop):
  - Width: 280px
  - Height: 40px
  - Border: 2px solid #E0E0E0
  - Border Radius: 8px
  - Padding: 0 16px
  - Focus: Border color #2E294E

## 8. Footer
- **Background**: #F8F9FA
- **Padding**: 48px 24px 24px
- **Border Top**: 1px solid #E0E0E0
- **Text Color**: #757575
- **Link Color**: #757575, Hover: #2E294E
- **Heading**: Font size 1.125rem, Font weight 600, Color #212121, Margin bottom 16px

## 9. Interactive States
- **Hover**: As defined per component
- **Focus**: Outline: 2px solid #2E294E, Outline offset: 2px (or use custom focus ring matching border)
- **Active/Pressed**: Scale: 0.98, or background color shift as defined
- **Loading**: 
  - Button: Text changes to loading spinner (size 16px, stroke 2px, color #FFFFFF for primary button)
  - Page: Skeleton loader or full-screen overlay with spinner
- **Disabled**: As defined per component

## 10. Animations and Transitions
- **Button**: all 0.2s ease
- **Card hover**: all 0.3s ease
- **Menu drawer**: transform and opacity 0.3s ease
- **Alerts**: slide down/up 0.3s ease
- **Modals**: fade in/out 0.3s ease, scale 0.95 to 1
- **Preference**: Respect `prefers-reduced-motion` media query (reduce or disable animations)

## 11. Image Guidelines
- **Product Images**: Minimum 800x800px, square or 4:5 aspect ratio, WebP format preferred
- **Placeholders**: Use solid background color with text "Prodakt Şəkli Yüklənir" or similar in Azerbaijani
- **Optimization**: Compress images, use responsive `srcset` where appropriate
- **Lazy Loading**: Apply to images below the fold

## 12. Azerbaijani Language Specifics
- **Text Direction**: Left-to-right (ltr)
- **Special Characters**: Ensure fonts support ə, ı, İ, ş, ç, ğ, ö, ü
- **Date Format**: DD.MM.YYYY (e.g., 19.10.2026)
- **Number Format**: Space as thousand separator, comma as decimal (e.g., 1 234,50 AZN)
- **Currency Symbol**: ₼ (manat) or AZN code, placed after number (e.g., 123,50 ₼)
- **Pluralization**: Account for Azerbaijani plural rules in UI strings

## 13. Accessibility (WCAG 2.2 AA)
- **Keyboard Navigation**: All interactive elements accessible via Tab
- **Focus Visible**: Clear focus indicators on all interactive elements
- **ARIA Labels**: Use for icons, buttons without text, dynamic content
- **Form Labels**: Explicit `<label>` for all form inputs
- **Error Identification**: Clearly identify and describe errors in text
- **Contrast**: Minimum 4.5:1 for normal text, 3:1 for large text
- **Touch Targets**: Minimum 44x44px for interactive elements
- **Page Title**: Unique and descriptive for each page
- **Landmarks**: Use header, nav, main, footer, aside appropriately
- **Skip Links**: Provide "Skip to main content" link at top

## 14. Representative Page Layouts (Described for Prototype)

### Home Page Layout
- Header (as defined)
- Hero Section: 
  - Background image or solid color with overlay
  - Heading: "vintajoriginal - Günlük Giyimdə Unikal Stil"
  - Subheading: "Baku'daki seçilmiş vintage vrouwen giysi kolleksiyası"
  - Primary Button: "Kolleksiyona bax"
  - Secondary Button: "Haqqımızda bax"
- Categories Section:
  - Heading: "Kateqoriyalariňa baxış"
  - Horizontal scroll or grid of category cards (image + name)
- Featured Products:
  - Heading: "Təklif olunan məhsullar"
  - Grid of product cards (3-4 per row on desktop, 2 on tablet, 1 on mobile)
  - View all button
- New Arrivals:
  - Similar to Featured Products
- Brand Story:
  - Two columns: image on left, text on right (stacked on mobile)
  - Heading: "Vintajoriginal Tarixi"
  - Paragraph text
  - Button: "Tam verhaalı oxu"
- Footer (as defined)

### Product Listing Page
- Header
- Filters Bar (optional): 
  - Sort dropdown (Popularity, Price low-high, Price high-low, Newest)
  - Filter by category (if on category page)
  - Filter by price range
  - Button: "Filtrə təbiq et"
- Product Grid: 
  - Grid of product cards (same as home)
  - Pagination or "Load more" button at bottom
- Sidebar (optional on desktop): 
  - Category tree (accordion style)
  - Price range slider
  - Color swatches
  - Size options
  - Brand filters
  - Condition filters
- Footer

### Product Detail Page
- Header
- Main Content: Two columns on desktop, stacked on mobile
  - Left Column (Image Gallery):
    - Main image (large)
    - Thumbnail strip below (click to change main image)
    - Zoom on hover/click
  - Right Column:
    - Product Name (H1)
    - Price (prominent)
    - Stock status (In stock/X left/Out of stock badge)
    - SKU display
    - Description section (heading + text)
    - Variants (if applicable): 
      - Size: Radio buttons or dropdown
      - Color: Swatches
      - Material: Text or badge
    - Condition: Badge or text
    - Quantity selector: 
      - Minus button, input, plus button (min 1, max stock)
      - Or simple dropdown
    - Primary Button: "Səbətə əlavə et"
    - Secondary Button: "Istilahisə əlavə et" (wishlist)
    - Sharing buttons (optional)
    - Tabbed section below: 
      - Tab 1: Tafsilotlar (description, material, care instructions)
      - Tab 2: Ölçüler (size chart, measurements)
      - Tab 3: Rey və Maryamlar (if reviews enabled)
- Related Products: "Bu məhsulu gostərə bilənlər"
- Footer

### Cart Page
- Header
- Empty State: 
  - Image (empty cart illustration)
  - Heading: "Səbətiniz boşdur"
  - Text: "Hələə heçbə məhsul əlavə etməmisiniz."
  - Button: "Alış-verişə başla"
- Filled State:
  - Heading: "Səbətiniz"
  - Cart Items: 
    - Each item: 
      - Thumbnail image (50x50px)
      - Name
      - Variant info (size, color)
      - Quantity selector (same as product detail)
      - Price per unit
      - Total price for item
      - Remove button (icon only, tooltip: "Silmə")
  - Summary Section:
    - Subtotal: 
    - Shipping Cost: (calculated or flat rate)
    - Tax: (if applicable)
    - Total: (prominent, large text)
    - Button: "Ödənişə geç" (primary, disabled if cart empty)
    - Link: "Alış-verişə davam et"
- Footer

### Checkout Page
- Header
- Progress Steps: 
  - 1. Əlaqə məlumatları
  - 2. Üzvəyyət və təcili
  - 3. Ödəniş
  - (Show current step highlighted)
- Section 1: Contact Information
  - Form: 
    - Email (required)
    - Phone (required)
    - Save to account? (checkbox)
- Section 2: Shipping Information
  - Form: 
    - Full Name (required)
    - Address Line 1 (required)
    - Address Line 2 (optional)
    - City (required, default Baku)
    - State/Region (dropdown)
    - ZIP Code (optional)
    - Country (disabled, Azerbaijan)
    - Phone (auto-filled from contact)
    - Shipping Method: Radio buttons (e.g., Standard Delivery, Express)
    - Estimated Delivery Date
- Section 3: Payment Information
  - Form: 
    - Payment Method: Radio buttons (options from provider)
    - Card Details (if card): 
      - Card Number
      - Expiry Date
      - CVV
    - Or redirect to provider
    - Terms and Conditions checkbox: "Ödəniş şərtlərini və qaytarma siyasətini oxudum və qəbul ediyorum."
    - Primary Button: "Safهز əmalsını tamamla" (disabled until form valid)
- Order Summary Sidebar (static on desktop, bottom on mobile):
  - Order Items (mini cart)
  - Summary: Subtotal, Shipping, Tax, Total
  - Place Order button (same as main)
- Footer

### Account Pages (brief for prototype)
- Account Dashboard:
  - Heading: "Salam, [Name]!"
  - Overview cards: 
    - Order History (last 3 orders)
    - Saved Addresses
    - Wishlist count
  - Buttons: 
    - "Sifarişlərimı bax"
    - "Profili redaktə et"
    - "Adreslərimə bax"

## 15. Implementation Notes
- Start with mobile-first CSS
- Use CSS custom properties for colors, spacing, etc.
- Keep JavaScript vanilla unless specific requirement justifies library
- All Azerbaijani text to be reviewed by native speaker before launch
- Placeholders clearly marked as such (e.g., "Yerləşdirilməmiş şəkil")
- Design system to be implemented as CSS classes and reusable components in JS

---
*Bu dizayn sistemi, vintajoriginal üçün esastır və təqdim olunmuş mötəqədät들에 əsasən hazırlanmışdır. Nümayənə nümayəndə lik loyiha nəzərdə tutulmalıdır.*