# Quick Testing Checklist
## Quick Reference for Day 17-18 Testing

---

## 🎯 Critical: iPhone 7 (375px × 667px) Testing

### ✅ Sidebar Accessibility
- [ ] Hamburger menu visible (top-left)
- [ ] Tap opens sidebar
- [ ] All menu items clickable
- [ ] Close button works
- [ ] No viewport overflow

### ✅ Conversation Actions Menu
- [ ] Three-dot menu visible on conversations
- [ ] Menu opens on tap
- [ ] Delete option works
- [ ] Rename option works
- [ ] Menu closes correctly

### ✅ Citation Settings Modal
- [ ] Modal opens correctly
- [ ] All settings visible
- [ ] Scroll to bottom works
- [ ] "Done" button visible
- [ ] "Done" button clickable (not hidden)
- [ ] Modal closes correctly

### ✅ Settings Navigation
- [ ] Settings page loads
- [ ] All sections accessible
- [ ] Forms work correctly
- [ ] Save buttons work

### ✅ Search Tabs & Features
- [ ] Documents/Web tabs visible
- [ ] Tabs clickable
- [ ] Feature settings display correctly
- [ ] No horizontal overflow

---

## 📱 Device Testing Quick Check

### iPhone SE (320px)
- [ ] Layout doesn't break
- [ ] All buttons accessible
- [ ] Text readable
- [ ] Forms work

### iPhone 7 (375px) ⚠️ PRIMARY
- [ ] All critical items above pass
- [ ] No layout shifts
- [ ] Smooth scrolling

### iPhone 12/13 (390px)
- [ ] Layout works correctly
- [ ] All features accessible

### iPad (768px)
- [ ] Tablet layout appropriate
- [ ] Touch targets adequate

### Desktop (1920px)
- [ ] Full layout displays
- [ ] Hover states work
- [ ] Sidebar always visible

---

## ⚡ Performance Quick Check

### Lighthouse Scores
- [ ] Performance > 90
- [ ] Accessibility > 90
- [ ] Best Practices > 90
- [ ] SEO > 90

### Core Web Vitals
- [ ] LCP < 2.5s
- [ ] FID/INP < 100ms/200ms
- [ ] CLS < 0.1

### Load Times
- [ ] 3G: < 2.5s initial load
- [ ] 4G: < 1.5s initial load
- [ ] WiFi: < 1.0s initial load

---

## 🔧 Functionality Quick Check

### Modals
- [ ] All modals open/close
- [ ] Buttons accessible
- [ ] Safe areas respected

### Forms
- [ ] All inputs 44px height
- [ ] Forms submit correctly
- [ ] Validation works

### Tables
- [ ] Cards on mobile
- [ ] Tables on desktop
- [ ] Actions work

### Navigation
- [ ] All links work
- [ ] Active states correct
- [ ] No broken routes

---

## 🐛 Common Issues to Check

- [ ] No horizontal scrolling on mobile
- [ ] No text overflow
- [ ] All buttons 44x44px minimum
- [ ] No layout shifts
- [ ] Images load correctly
- [ ] Fonts load correctly
- [ ] No console errors
- [ ] No broken images
- [ ] No 404 errors

---

## 📊 Test Results

**Device**: _______________
**Date**: _______________
**Tester**: _______________

**Issues Found**: ___
**Critical**: ___
**High**: ___
**Medium**: ___
**Low**: ___

**Status**: [ ] Pass [ ] Fail [ ] Needs Fixes

---

## 🚀 Quick Test Commands

```bash
# Run Lighthouse
npx lighthouse http://localhost:3000 --view

# Test on iPhone 7 viewport
# Chrome DevTools > Toggle device toolbar > iPhone 7

# Check performance
# Chrome DevTools > Performance tab > Record > Reload
```

---

**Priority**: Focus on iPhone 7 (375px) first, then expand to other devices.
