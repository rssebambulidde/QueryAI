# QueryAI Design Quick Reference

Quick reference guide for implementing the branding and design updates.

## 🎨 Color Palette

### Primary Colors
```css
--primary-blue: #2563EB;      /* Blue-600 - Main brand color */
--primary-blue-dark: #1E40AF; /* Blue-700 - Darker variant */
--primary-blue-light: #3B82F6; /* Blue-500 - Lighter variant */
```

### Accent Colors
```css
--accent-orange: #F97316;      /* Orange-500 - CTAs, highlights */
--accent-orange-light: #FB923C; /* Orange-400 - Hover states */
--success-green: #10B981;      /* Emerald-500 - Success states */
--warning-amber: #F59E0B;     /* Amber-500 - Warnings */
```

### Neutral Colors
```css
--gray-900: #0F172A;  /* Slate-900 - Primary text */
--gray-800: #1E293B;  /* Slate-800 - Secondary text */
--gray-600: #475569;  /* Slate-600 - Tertiary text */
--gray-400: #94A3B8;  /* Slate-400 - Placeholders, borders */
--gray-100: #F1F5F9;  /* Slate-100 - Backgrounds */
--white: #FFFFFF;     /* Pure white */
```

### Tailwind Classes
```css
Primary: bg-blue-600, text-blue-600, border-blue-600
Accent: bg-orange-500, text-orange-500
Success: bg-emerald-500, text-emerald-500
Warning: bg-amber-500, text-amber-500
```

## 📝 Typography

### Font Family
- **Primary:** Geist Sans (already configured)
- **Mono:** Geist Mono (for code)

### Font Sizes
```css
Hero H1: text-5xl md:text-7xl (48-72px), font-extrabold (800)
Section H2: text-3xl md:text-4xl (36-48px), font-bold (700)
Subsection H3: text-2xl md:text-3xl (24-30px), font-semibold (600)
Card Title H4: text-xl (20px), font-semibold (600)
Body Large: text-lg (18px), font-normal (400)
Body Base: text-base (16px), font-normal (400)
Body Small: text-sm (14px), font-normal (400)
```

### Line Heights
- Headings: 1.1-1.3
- Body: 1.6

## 🎯 Button Styles

### Primary Button
```tsx
className="bg-gradient-to-r from-blue-600 to-blue-700 text-white 
           hover:from-blue-700 hover:to-blue-800 
           shadow-lg hover:shadow-xl 
           transition-all duration-200"
```

### Secondary Button
```tsx
className="border-2 border-blue-600 text-blue-600 
           hover:bg-blue-50 
           transition-colors duration-200"
```

### Ghost Button
```tsx
className="text-gray-700 hover:bg-gray-100 
           transition-colors duration-200"
```

## 🃏 Card Styles

### Elevated Card
```tsx
className="bg-white rounded-lg shadow-md hover:shadow-lg 
           transition-shadow duration-200 p-6"
```

### Outlined Card
```tsx
className="bg-white border border-gray-200 rounded-lg p-6"
```

### Gradient Card
```tsx
className="bg-gradient-to-br from-blue-50 to-orange-50 
           rounded-lg shadow-md p-6"
```

## 📐 Spacing System

Use Tailwind's spacing scale:
- `p-4` = 16px
- `p-6` = 24px
- `p-8` = 32px
- `gap-4` = 16px
- `gap-6` = 24px
- `gap-8` = 32px

## 🎬 Animation Durations

```css
Fast: 150ms (micro-interactions)
Normal: 200-300ms (most transitions)
Slow: 500ms (page transitions)
```

## 📱 Breakpoints

```css
sm: 640px   /* Mobile landscape */
md: 768px   /* Tablet portrait */
lg: 1024px  /* Tablet landscape / Small desktop */
xl: 1280px  /* Desktop */
2xl: 1536px /* Large desktop */
```

## 🎨 Gradient Presets

### Hero Gradient
```css
bg-gradient-to-br from-blue-600 via-blue-500 to-orange-500
```

### Button Gradient
```css
bg-gradient-to-r from-blue-600 to-blue-700
```

### Card Gradient
```css
bg-gradient-to-br from-blue-50 to-orange-50
```

## 🔤 Landing Page Headlines

### Hero Section
- **H1:** "Your Fact Research Assistant"
- **Subheadline:** "Find accurate, verified information quickly. Research questions using real-time web search and your documents. Get source-cited answers."

### Section Headlines
- Features: "Powerful Research Features"
- How It Works: "How QueryAI Works"
- Use Cases: "Perfect for Research and Fact-Checking"
- Pricing: "Simple, Transparent Pricing"
- FAQ: "Frequently Asked Questions"

## 🎯 CTA Text

- Primary: "Get Started Free"
- Secondary: "Watch Demo" or "Learn More"
- Tertiary: "Contact Sales" (Enterprise)

## 📊 SEO Meta Tags Template

```html
<title>QueryAI - Fact Research Assistant | Find Verified Information Fast</title>
<meta name="description" content="QueryAI is a fact research assistant that helps you find accurate, verified information quickly. Research questions using real-time web search and document analysis. Get source-cited answers.">
<meta name="keywords" content="fact research assistant, research tool, verified information, document research, fact-checking, source-cited research">
```

## 🎭 Component States

### Button States
- Default: Full opacity, normal shadow
- Hover: Scale 1.02, increased shadow
- Active: Scale 0.98
- Disabled: Opacity 50%, no pointer events
- Loading: Spinner icon, disabled state

### Input States
- Default: Border gray-300
- Focus: Border blue-600, ring blue-500
- Error: Border red-500, text red-600
- Success: Border green-500

## 🌙 Dark Mode Colors

```css
Background: #0F172A (Slate-900)
Surface: #1E293B (Slate-800)
Text: #F1F5F9 (Slate-100)
Border: #334155 (Slate-700)
```

## 📋 Implementation Checklist

### Phase 1: Foundation
- [ ] Update Tailwind config with new colors
- [ ] Create CSS variables for colors
- [ ] Update button component
- [ ] Update card components
- [ ] Add logo component

### Phase 2: Landing Page
- [ ] Hero section redesign
- [ ] Features section
- [ ] How It Works section
- [ ] Use Cases section
- [ ] FAQ section
- [ ] Final CTA section

### Phase 3: SEO
- [ ] Update meta tags
- [ ] Add structured data
- [ ] Optimize images
- [ ] Create sitemap
- [ ] Set up analytics

### Phase 4: Dashboard
- [ ] Sidebar redesign
- [ ] Chat interface updates
- [ ] Component library updates
- [ ] Dark mode implementation

## 🔗 Useful Links

- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Geist Font](https://vercel.com/font)
- [Lucide Icons](https://lucide.dev)
- [WCAG Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

---

**Quick Tip:** Keep this file open while implementing design changes for quick reference!
