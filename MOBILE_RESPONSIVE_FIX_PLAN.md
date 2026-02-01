# Mobile Responsive & Performance Fix Plan
**QueryAI Application - Comprehensive Fix Plan**

**Date:** February 1, 2026  
**Status:** Complete Analysis - Ready for Implementation  
**Version:** 1.0

---

## 📊 Executive Summary

This document provides a **complete, unified plan** for fixing all mobile responsiveness, UI layout, performance, and user experience issues in the QueryAI application. It combines:

- **Landing page redesign** requirements
- **Mobile responsiveness** fixes for all device sizes
- **Performance optimizations** for load speed
- **Component-by-component** review and fixes
- **iPhone 7 & small screen** specific issues
- **Implementation timeline** and priorities

**Total Components Reviewed:** 111+  
**Critical Issues:** 12  
**High Priority Issues:** 18  
**Medium Priority Issues:** 15  
**Total Fixes Required:** 45+

**Target:** Excellent user experience on all devices (320px to 2560px+)

---

## 🎯 Quick Reference

### **Priority Levels**
- 🔴 **CRITICAL** - Blocks core functionality, fix immediately (Day 1)
- 🟡 **HIGH** - Major UX issues, fix Week 1-2
- 🟢 **MEDIUM** - Enhancements, fix Week 2-3
- 🔵 **LOW** - Nice to have, fix Week 3-4

### **Device Testing Matrix**
- iPhone SE (1st gen): 320px × 568px
- iPhone 7/8: 375px × 667px ⚠️ **Primary Test Device**
- iPhone 12/13/14: 390px × 844px
- iPhone 14 Pro Max: 430px × 932px
- Samsung Galaxy S21: 360px × 800px
- iPad Mini: 768px × 1024px
- iPad Pro: 1024px × 1366px

---

## 🔴 PHASE 1: CRITICAL FIXES (Week 1 - Days 1-5)

### **Day 1: URGENT - iPhone 7 & Small Screen Fixes** ⚠️

#### **1.1 Sidebar Accessibility** 🔴
**Component:** `components/mobile/mobile-sidebar.tsx`, `app/dashboard/page.tsx`  
**Issue:** Sidebar not easily accessible on mobile  
**Fix:**
```tsx
// Ensure hamburger menu is always visible
{isMobile && (
  <HamburgerMenu 
    onClick={() => setIsMobileSidebarOpen(true)}
    className="fixed top-4 left-4 z-50 bg-white shadow-lg rounded-lg p-2"
  />
)}
```
**Files:** `frontend/app/dashboard/page.tsx`, `frontend/components/mobile/mobile-sidebar.tsx`

---

#### **1.2 Conversation Actions Menu** 🔴
**Component:** `components/chat/conversation-item.tsx`  
**Issue:** Delete/rename options not accessible (menu only shows on hover)  
**Current Code (line 178):**
```tsx
className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded opacity-0 group-hover:opacity-100"
```
**Fixed Code:**
```tsx
import { useMobile } from '@/lib/hooks/use-mobile';

const { isMobile } = useMobile();

<button
  onClick={(e) => {
    e.stopPropagation();
    setShowMenu(!showMenu);
  }}
  className={cn(
    "p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-opacity",
    "min-w-[44px] min-h-[44px] flex items-center justify-center", // Touch target
    isMobile ? "opacity-100" : "opacity-0 group-hover:opacity-100" // Always visible on mobile
  )}
  title="More options"
>
  <MoreVertical className="w-4 h-4" />
</button>
```
**Files:** `frontend/components/chat/conversation-item.tsx`

---

#### **1.3 Citation Settings Modal** 🔴
**Component:** `components/chat/citation-settings.tsx`  
**Issue:** Done button hidden below viewport on iPhone 7 (667px height)  
**Current Code (line 73):**
```tsx
<div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
```
**Fixed Code:**
```tsx
import { useMobile } from '@/lib/hooks/use-mobile';

const { isMobile } = useMobile();

<div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 flex flex-col"
     style={{ 
       maxHeight: isMobile ? 'calc(100vh - 2rem)' : '90vh',
       marginTop: isMobile ? 'env(safe-area-inset-top)' : '0',
       marginBottom: isMobile ? 'env(safe-area-inset-bottom)' : '0'
     }}>
  {/* Header - Fixed */}
  <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-gray-200">
    {/* Header content */}
  </div>
  
  {/* Content - Scrollable */}
  <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
    {/* All content sections */}
  </div>
  
  {/* Footer - Fixed, Always Visible */}
  <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
    <button onClick={reset}>Reset to Defaults</button>
    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 rounded">
      Done
    </button>
  </div>
</div>
```
**Files:** `frontend/components/chat/citation-settings.tsx`

---

#### **1.4 Settings Navigation** 🔴
**Component:** `components/mobile/bottom-navigation.tsx`  
**Issue:** Shows "Settings" but redirects to accounts/profile  
**Option A - Update Label:**
```tsx
{
  id: 'settings',
  label: 'Account', // Changed from 'Settings'
  icon: Settings,
  href: '/dashboard/settings/profile',
}
```
**Option B - Create Settings Index (Recommended):**
```tsx
// Create: frontend/app/dashboard/settings/page.tsx
export default function SettingsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      <div className="space-y-4">
        <Link href="/dashboard/settings/profile">
          <div className="p-4 border rounded-lg hover:bg-gray-50">
            <h2>Profile</h2>
            <p>Manage your account information</p>
          </div>
        </Link>
        <Link href="/dashboard/settings/subscription">
          <div className="p-4 border rounded-lg hover:bg-gray-50">
            <h2>Subscription</h2>
            <p>Manage your subscription and billing</p>
          </div>
        </Link>
        {/* Add more settings links */}
      </div>
    </div>
  );
}
```
**Files:** `frontend/components/mobile/bottom-navigation.tsx`, Create `frontend/app/dashboard/settings/page.tsx`

---

#### **1.5 Search Tabs & Feature Settings** 🔴
**Component:** `components/chat/chat-interface.tsx`, `components/chat/unified-filter-panel.tsx`  
**Issue:** Tabs and settings items not well displayed on small screens  
**Fix:**
```tsx
// For tabs - ensure horizontal scroll if needed
<div className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide">
  {tabs.map(tab => (
    <button className="flex-shrink-0 px-4 py-2 min-w-[44px] min-h-[44px]">{tab.label}</button>
  ))}
</div>

// For settings items - stack vertically on mobile
<div className={cn(
  "grid gap-4",
  isMobile ? "grid-cols-1" : "grid-cols-2 lg:grid-cols-3"
)}>
  {settingsItems.map(item => (
    <div className="p-4 border rounded-lg min-h-[120px]">
      {/* Settings item */}
    </div>
  ))}
</div>
```
**Files:** `frontend/components/chat/chat-interface.tsx`, `frontend/components/chat/unified-filter-panel.tsx`

---

### **Day 2: Modal & Dialog Fixes**

#### **2.1 Confirmation Modal** 🔴
**Component:** `components/ui/confirmation-modal.tsx`  
**Issue:** May overflow on small screens, buttons may stack awkwardly  
**Fix:**
```tsx
<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
  <div className={cn(
    "bg-white rounded-lg shadow-xl flex flex-col",
    isMobile ? "w-full max-w-[90vw] max-h-[90vh]" : "max-w-md w-full"
  )}>
    {/* Header */}
    <div className="flex-shrink-0 flex items-center justify-between p-6 border-b border-gray-200">
      {/* Header content */}
    </div>
    
    {/* Content */}
    <div className="flex-1 overflow-y-auto p-6 min-h-0">
      <p className="text-gray-700">{message}</p>
    </div>
    
    {/* Footer - Stack buttons vertically on mobile */}
    <div className={cn(
      "flex-shrink-0 p-6 border-t border-gray-200",
      isMobile ? "flex-col gap-3" : "flex-row gap-3 justify-end"
    )}>
      <Button variant="outline" onClick={onCancel} className={isMobile ? "w-full" : ""}>
        {cancelText}
      </Button>
      <Button onClick={onConfirm} className={isMobile ? "w-full" : ""}>
        {confirmText}
      </Button>
    </div>
  </div>
</div>
```
**Files:** `frontend/components/ui/confirmation-modal.tsx`

---

#### **2.2 Payment Dialog** 🔴
**Component:** `components/payment/payment-dialog.tsx`  
**Issue:** PayPal buttons and form may not be mobile-optimized  
**Fix:**
- Ensure PayPal SDK mobile compatibility
- Responsive form layout
- Full-screen on mobile if needed
- Test PayPal button rendering on mobile

**Files:** `frontend/components/payment/payment-dialog.tsx`

---

### **Day 3: Table & Data Display Fixes**

#### **3.1 Document Manager Tables** 🔴
**Component:** `components/documents/document-manager.tsx`  
**Issue:** Tables overflow on mobile, no horizontal scroll  
**Fix:**
```tsx
// Mobile: Card layout, Desktop: Table
{isMobile ? (
  <div className="space-y-4">
    {documents.map(doc => (
      <div className="border rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium">{doc.name}</h3>
          <DocumentStatusBadge status={doc.status} />
        </div>
        <div className="text-sm text-gray-600 space-y-1">
          <div>Size: {formatBytes(doc.size)}</div>
          <div>Type: {doc.mimeType}</div>
          <div>Uploaded: {formatDate(doc.created_at)}</div>
        </div>
        <div className="mt-3 flex gap-2">
          <Button size="sm" onClick={() => handleView(doc)}>View</Button>
          <Button size="sm" variant="outline" onClick={() => handleDelete(doc.id)}>Delete</Button>
        </div>
      </div>
    ))}
  </div>
) : (
  <div className="overflow-x-auto">
    <table className="w-full">
      {/* Table content */}
    </table>
  </div>
)}
```
**Files:** `frontend/components/documents/document-manager.tsx`

---

#### **3.2 Subscription Manager Tables** 🔴
**Component:** `components/subscription/subscription-manager.tsx`  
**Issue:** Billing history table overflows on mobile  
**Fix:** Same pattern as Document Manager - card layout on mobile  
**Files:** `frontend/components/subscription/subscription-manager.tsx`

---

#### **3.3 Analytics Tables** 🟡
**Component:** `components/analytics/*.tsx`, `components/super-admin/*.tsx`  
**Issue:** Multiple tables overflow on mobile  
**Fix:** Card-based layout or horizontal scroll wrapper  
**Files:** All analytics and admin components with tables

---

### **Day 4: Forms & Inputs**

#### **4.1 Input Component** 🔴
**Component:** `components/ui/input.tsx`  
**Issue:** Height too small (h-10 = 40px, should be 44px)  
**Fix:**
```tsx
<input
  className={cn(
    'flex w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm',
    'min-h-[44px]', // Mobile touch target
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500',
    error && 'border-red-500',
    className
  )}
  {...props}
/>
```
**Files:** `frontend/components/ui/input.tsx`

---

#### **4.2 Chat Input** 🟡
**Component:** `components/chat/chat-input.tsx`  
**Issue:** Send button text hidden on mobile (`hidden sm:inline`)  
**Fix:**
```tsx
<Button
  onClick={handleSend}
  disabled={disabled || !message.trim()}
  className="px-6 py-3 bg-gradient-to-r from-orange-600 to-orange-700"
  aria-label="Send message"
>
  <Send className="w-4 h-4" />
  {!isMobile && <span>Send</span>}
</Button>
```
**Files:** `frontend/components/chat/chat-input.tsx`

---

#### **4.3 Settings Forms** 🟡
**Component:** `components/settings/*.tsx`  
**Issue:** Forms may not adapt to mobile keyboards  
**Fix:**
- Ensure proper input types (email, tel, etc.)
- Larger input fields (min 44px height)
- Sticky save button on mobile
- Proper form structure

**Files:** All settings components

---

### **Day 5: Chat & Messaging**

#### **5.1 Chat Message** 🟡
**Component:** `components/chat/chat-message.tsx`  
**Issues:**
- Long messages may overflow
- Code blocks may not scroll horizontally
- Action buttons may be too small

**Fix:**
```tsx
// Ensure word-wrap for long text
<div className="break-words overflow-wrap-anywhere">
  {content}
</div>

// Add horizontal scroll for code blocks
<pre className="overflow-x-auto max-w-full">
  <code>{codeContent}</code>
</pre>

// Increase touch target sizes for action buttons
<button className="min-w-[44px] min-h-[44px] flex items-center justify-center">
  {/* Action */}
</button>
```
**Files:** `frontend/components/chat/chat-message.tsx`

---

#### **5.2 Source Panel** 🟡
**Component:** `components/chat/source-panel.tsx`  
**Issue:** Sidebar panel may not be mobile-friendly  
**Fix:** Full-screen overlay on mobile, bottom sheet style  
**Files:** `frontend/components/chat/source-panel.tsx`

---

#### **5.3 Account Dropdown** 🟡
**Component:** `components/sidebar/account-dropdown.tsx`  
**Issue:** Dropdown width `w-[340px]` may overflow on small screens  
**Fix:**
```tsx
className="absolute z-50 bg-white rounded-xl shadow-2xl border border-gray-100 w-[340px] min-w-[300px] max-w-[90vw] overflow-hidden"
```
**Files:** `frontend/components/sidebar/account-dropdown.tsx`

---

## 🟡 PHASE 2: HIGH PRIORITY ENHANCEMENTS (Week 2)

### **Day 6-7: Document Management**

#### **6.1 Document Viewer** 🟡
**Component:** `components/documents/document-viewer.tsx`  
**Fix:** Mobile-optimized PDF viewer, bottom sheet controls  
**Files:** `frontend/components/documents/document-viewer.tsx`

#### **6.2 Upload Progress** 🟡
**Component:** `components/documents/upload-progress.tsx`  
**Fix:** Larger progress indicators, prominent cancel button  
**Files:** `frontend/components/documents/upload-progress.tsx`

#### **6.3 Document Search** 🟡
**Component:** `components/documents/document-search.tsx`  
**Fix:** Scrollable results list, mobile-friendly layout  
**Files:** `frontend/components/documents/document-search.tsx`

---

### **Day 8-9: Collections & Topics**

#### **8.1 Collection Manager** 🟡
**Component:** `components/collections/collection-manager.tsx`  
**Fix:** Stack vertically on mobile, ensure touch targets  
**Files:** `frontend/components/collections/collection-manager.tsx`

#### **8.2 Topic Manager** 🟡
**Component:** `components/topics/topic-manager.tsx`  
**Fix:** Scrollable list, full-screen modal for forms  
**Files:** `frontend/components/topics/topic-manager.tsx`

#### **8.3 Save Dialogs** 🟡
**Component:** `components/collections/save-to-collection-dialog.tsx`  
**Fix:** Scrollable list, full-screen form on mobile  
**Files:** All collection dialogs

---

### **Day 10: Analytics & Charts**

#### **10.1 Charts** 🟡
**Component:** `components/analytics/charts/*.tsx`  
**Fix:** Responsive chart containers, mobile-specific chart types  
**Files:** All chart components

#### **10.2 Date Range Picker** 🟡
**Component:** `components/analytics/date-range-picker.tsx`  
**Fix:** Mobile-native date picker, larger touch targets  
**Files:** `frontend/components/analytics/date-range-picker.tsx`

#### **10.3 Export Dialogs** 🟡
**Component:** `components/analytics/export-reports-dialog.tsx`  
**Fix:** Stack options vertically, larger selection buttons  
**Files:** All export dialogs

---

## 🟢 PHASE 3: MEDIUM PRIORITY (Week 3)

### **Day 11-12: Advanced Features**

#### **11.1 RAG Settings** 🟢
**Component:** `components/settings/advanced-rag-settings.tsx`  
**Fix:** Break into steps/accordion on mobile, larger slider controls  
**Files:** `frontend/components/settings/advanced-rag-settings.tsx`

#### **11.2 Token Usage** 🟢
**Component:** `components/advanced/token-usage-display.tsx`  
**Fix:** Responsive text sizing, mobile-friendly layout  
**Files:** `frontend/components/advanced/token-usage-display.tsx`

#### **11.3 Cost Estimation** 🟢
**Component:** `components/advanced/cost-estimation.tsx`  
**Fix:** Mobile layout, responsive display  
**Files:** `frontend/components/advanced/cost-estimation.tsx`

---

### **Day 13-14: Component Refinements**

#### **13.1 All Buttons** 🟢
**Fix:** Verify all buttons have 44x44px touch targets  
**Files:** All components with buttons

#### **13.2 All Inputs** 🟢
**Fix:** Verify all inputs are 44px height, proper keyboard types  
**Files:** All components with inputs

#### **13.3 All Modals** 🟢
**Fix:** Verify safe areas, proper mobile structure  
**Files:** All modal/dialog components

#### **13.4 All Tables** 🟢
**Fix:** Verify mobile layouts (cards or scroll)  
**Files:** All components with tables

---

## 🔵 PHASE 4: PERFORMANCE & POLISH (Week 4)

### **Day 15-16: Performance Optimizations**

#### **15.1 Next.js Configuration** 🔵
**File:** `frontend/next.config.ts`  
**Fix:**
```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  swcMinify: true,
  
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
  },
  
  experimental: {
    optimizeCss: true,
    optimizePackageImports: ['lucide-react'],
  },
  
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
        ],
      },
    ];
  },
};

export default nextConfig;
```

---

#### **15.2 Font Optimization** 🔵
**File:** `frontend/app/layout.tsx`  
**Fix:**
```typescript
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: 'swap', // Add this for faster text rendering
  preload: true,
});
```

---

#### **15.3 Resource Hints** 🔵
**File:** `frontend/app/layout.tsx`  
**Fix:** Add to `<head>`:
```tsx
<link rel="preconnect" href={process.env.NEXT_PUBLIC_API_URL} />
<link rel="dns-prefetch" href={process.env.NEXT_PUBLIC_API_URL} />
```

---

#### **15.4 Landing Page Redesign** 🔵
**File:** `frontend/app/page.tsx`  
**Enhancements:**
- Hero section with compelling headline and CTA
- Features section with icons
- Social proof section
- Use cases/examples
- Pricing preview
- Enhanced footer

---

### **Day 17-18: Testing & Validation**

#### **17.1 Device Testing** 🔵
- [ ] Test on iPhone SE (320px)
- [ ] Test on iPhone 7 (375px) ⚠️ **Primary**
- [ ] Test on iPhone 12/13 (390px)
- [ ] Test on iPad (768px)
- [ ] Test on Desktop (1920px)

#### **17.2 Functionality Testing** 🔵
- [ ] All modals open and close correctly
- [ ] All forms submit correctly
- [ ] All tables display correctly
- [ ] All navigation works
- [ ] All actions (delete, rename, etc.) work

#### **17.3 Performance Testing** 🔵
- [ ] Lighthouse score > 90
- [ ] Core Web Vitals pass
- [ ] Load time < 2.5s on 3G
- [ ] No layout shifts

---

## 📱 Mobile-First Component Standards

### **Touch Targets**
- **Minimum Size:** 44x44px (iOS) / 48x48px (Material)
- **Spacing:** Minimum 8px between touch targets
- **Visual Feedback:** Clear pressed/active states

### **Typography**
- **Base Size:** 16px minimum (prevents iOS zoom)
- **Line Height:** 1.5 minimum for readability
- **Contrast:** WCAG AA minimum (4.5:1 for normal text)

### **Layout**
- **Padding:** Minimum 16px on mobile
- **Max Width:** Use `max-w-[90vw]` for modals/dialogs
- **Safe Areas:** Account for iOS safe area insets

### **Forms**
- **Input Height:** Minimum 44px
- **Input Types:** Use proper types (email, tel, etc.)
- **Labels:** Always visible, not placeholder-only
- **Errors:** Clear, visible error messages

### **Modals & Dialogs**
- **Structure:** Flexbox with sticky footer
- **Max Height:** `calc(100vh - 2rem)` on mobile
- **Scroll:** Content area scrollable, footer fixed
- **Close:** Always accessible close button

### **Tables**
- **Mobile:** Card-based layout or horizontal scroll
- **Headers:** Sticky headers if scrolling
- **Actions:** Swipe actions or prominent buttons

---

## 🎯 Implementation Checklist

### **Week 1: Critical Fixes**
- [ ] Day 1: iPhone 7 fixes (sidebar, conversation actions, citation modal, settings nav, search tabs)
- [ ] Day 2: Modal & dialog fixes (confirmation modal, payment dialog)
- [ ] Day 3: Table fixes (document manager, subscription manager, analytics tables)
- [ ] Day 4: Form & input fixes (input component, chat input, settings forms)
- [ ] Day 5: Chat & messaging fixes (chat message, source panel, account dropdown)

### **Week 2: High Priority**
- [ ] Day 6-7: Document management enhancements
- [ ] Day 8-9: Collections & topics enhancements
- [ ] Day 10: Analytics & charts enhancements

### **Week 3: Medium Priority**
- [ ] Day 11-12: Advanced features enhancements
- [ ] Day 13-14: Component refinements

### **Week 4: Performance & Polish**
- [ ] Day 15-16: Performance optimizations
- [ ] Day 17-18: Testing & validation

---

## 📊 Success Metrics

### **Performance Targets**
- **LCP (Largest Contentful Paint):** < 2.5s
- **FID (First Input Delay):** < 100ms
- **CLS (Cumulative Layout Shift):** < 0.1
- **FCP (First Contentful Paint):** < 1.8s
- **TTI (Time to Interactive):** < 3.8s
- **Bundle Size:** < 200KB (initial JS)

### **Mobile Experience Metrics**
- **Mobile Usability Score:** 100/100 (Google Search Console)
- **Touch Target Size:** All interactive elements ≥ 44x44px
- **Text Readability:** All text ≥ 16px on mobile
- **Form Completion Rate:** > 80%

### **Device Coverage**
- ✅ iPhone SE (320px) - Works perfectly
- ✅ iPhone 7 (375px) - Works perfectly ⚠️ **Primary Test**
- ✅ iPhone 12/13 (390px) - Works perfectly
- ✅ iPad (768px) - Works perfectly
- ✅ Desktop (1920px) - Works perfectly

---

## 🔧 Code Patterns & Examples

### **Responsive Breakpoints**
```typescript
const breakpoints = {
  xs: '320px',   // Small phones
  sm: '375px',   // Standard phones
  md: '480px',   // Large phones
  lg: '768px',   // Tablets
  xl: '1024px',  // Desktop
  '2xl': '1280px' // Large desktop
}
```

### **Mobile Detection Hook**
```typescript
// Use existing useMobile hook
import { useMobile } from '@/lib/hooks/use-mobile';

const { isMobile, isTablet, screenWidth } = useMobile();
```

### **Modal Pattern**
```tsx
<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
  <div className={cn(
    "bg-white rounded-lg shadow-xl flex flex-col",
    isMobile ? "w-full max-w-[90vw] max-h-[90vh]" : "max-w-2xl w-full"
  )}>
    {/* Header - Fixed */}
    <div className="flex-shrink-0">...</div>
    
    {/* Content - Scrollable */}
    <div className="flex-1 overflow-y-auto min-h-0">...</div>
    
    {/* Footer - Fixed */}
    <div className="flex-shrink-0">...</div>
  </div>
</div>
```

### **Table Pattern**
```tsx
{isMobile ? (
  <div className="space-y-4">
    {items.map(item => (
      <div className="border rounded-lg p-4">
        {/* Card content */}
      </div>
    ))}
  </div>
) : (
  <div className="overflow-x-auto">
    <table className="w-full">
      {/* Table content */}
    </table>
  </div>
)}
```

### **Touch-Optimized Button**
```tsx
<button
  className={cn(
    "px-4 py-2 rounded-lg",
    "min-w-[44px] min-h-[44px] flex items-center justify-center", // Touch target
    "touch-manipulation" // Optimize for touch
  )}
>
  {/* Content */}
</button>
```

---

## ✅ Definition of Done

### **For Each Component:**
- [ ] Works on iPhone SE (320px width)
- [ ] Works on iPhone 7 (375px width) ⚠️ **Primary Test**
- [ ] Works on iPad (768px width)
- [ ] All touch targets ≥ 44x44px
- [ ] No horizontal scrolling (unless intentional)
- [ ] Forms work with mobile keyboards
- [ ] Modals fit within viewport
- [ ] Tables are readable/usable
- [ ] Text is readable (≥16px base)
- [ ] Tested in portrait and landscape

### **For Each Fix:**
- [ ] Code implemented
- [ ] Tested on iPhone 7
- [ ] Tested on at least 2 other devices
- [ ] No regressions introduced
- [ ] Accessibility verified
- [ ] Performance impact assessed

---

## 📝 Notes

- **Progressive Enhancement:** Ensure core functionality works without JS
- **Touch First:** Design for touch, enhance for mouse
- **Performance:** Mobile users may have slower connections
- **Accessibility:** Not optional - must meet WCAG AA
- **Testing:** Test on real devices, not just emulators
- **Iteration:** Start with critical fixes, then iterate

---

## 🚀 Quick Start

### **Immediate Actions (Today)**
1. Fix Citation Settings Modal (Done button)
2. Fix Conversation Actions Menu (always visible on mobile)
3. Fix Sidebar Accessibility (hamburger menu)
4. Fix Settings Navigation (label or create index page)
5. Fix Search Tabs Display (mobile layout)

### **This Week**
- Complete all Day 1-5 critical fixes
- Test on iPhone 7 after each fix
- Verify no regressions

### **Next Week**
- Continue with high priority fixes
- Performance optimizations
- Landing page redesign

---

**Last Updated:** February 1, 2026  
**Status:** Ready for Implementation ✅  
**Version:** 1.0  
**Total Issues:** 45+  
**Estimated Time:** 4 weeks  
**Priority:** CRITICAL

---

## 📚 Related Files

- Original analysis: `MOBILE_RESPONSIVE_UI_PERFORMANCE_PLAN.md`
- Component review: `COMPONENT_MOBILE_REVIEW.md`
- This merged plan: `MOBILE_RESPONSIVE_FIX_PLAN.md` ✅ **USE THIS ONE**

---

**This is the single, unified fix plan. All fixes are documented here with specific code examples and file paths.**
