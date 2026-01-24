# Analytics Date Filtering Fix

## 🔴 Problem Identified

When users change the time period (7 days, 30 days, 90 days) in the analytics dashboard, the statistics were **not being filtered correctly**. The statistics always showed:
- **This Month**: Current calendar month (regardless of selected period)
- **Last Month**: Previous calendar month (regardless of selected period)
- **This Week**: Last 7 days (correct, but confusing when other stats don't match)

The `days` parameter was only being used for the chart data (`getUsageByDate`), but **not** for the main statistics cards.

## ✅ Root Cause

In `backend/src/services/analytics.service.ts`:

1. **`getAnalyticsOverview`** received the `days` parameter but only passed it to `getUsageByDate`
2. **`getQueryStatistics`**, **`getAPIUsageMetrics`**, and **`getDocumentUploadStats`** were **not** using the `days` parameter
3. These functions always calculated month-based statistics regardless of the selected time period

## 🛠️ Fix Applied

### 1. Updated Statistics Functions to Accept `days` Parameter

All statistics functions now accept and use the `days` parameter:

- **`getQueryStatistics`**: Now accepts `days` parameter and calculates period-based stats
- **`getAPIUsageMetrics`**: Now accepts `days` parameter and calculates period-based stats  
- **`getDocumentUploadStats`**: Now accepts `days` parameter and calculates period-based stats

### 2. Period-Based Calculations

When `days` is provided:
- **Current Period**: Last N days (where N = selected days)
- **Previous Period**: Previous N days (before current period)
- **Total**: All time (unchanged)

When `days` is NOT provided (default):
- Falls back to month-based calculations (backward compatible)

### 3. Fixed Date Range Calculations

- Added proper start/end of day handling (`setHours(0, 0, 0, 0)` and `setHours(23, 59, 59, 999)`)
- Fixed previous period calculation to avoid gaps or overlaps
- Updated `getUserUsageCount` to support both start and end dates

### 4. Updated `getAnalyticsOverview`

Now passes `days` parameter and calculated date ranges to all statistics functions:

```typescript
const now = new Date();
const end = new Date(now);
end.setHours(23, 59, 59, 999);
const start = new Date(now);
start.setDate(start.getDate() - days);
start.setHours(0, 0, 0, 0);

const [queryStatistics, topQueries, apiUsageMetrics, usageByDate, documentUploads] =
  await Promise.all([
    this.getQueryStatistics(userId, start, end, days),
    this.getTopQueries(userId, 10, start, end),
    this.getAPIUsageMetrics(userId, start, end, days),
    this.getUsageByDate(userId, days, start, end),
    this.getDocumentUploadStats(userId, days),
  ]);
```

## 📊 What This Fixes

### Before Fix:
- **7 Days Selected**: 
  - This Month: Current month (WRONG - should be last 7 days)
  - Last Month: Previous month (WRONG - should be previous 7 days)
- **30 Days Selected**:
  - This Month: Current month (WRONG - should be last 30 days)
  - Last Month: Previous month (WRONG - should be previous 30 days)

### After Fix:
- **7 Days Selected**:
  - This Month: Last 7 days ✅
  - Last Month: Previous 7 days ✅
- **30 Days Selected**:
  - This Month: Last 30 days ✅
  - Last Month: Previous 30 days ✅
- **90 Days Selected**:
  - This Month: Last 90 days ✅
  - Last Month: Previous 90 days ✅

## 🧪 Testing

After deploying this fix:

1. **Select "7 Days"** in analytics dashboard
   - Verify "This Month" shows last 7 days
   - Verify "Last Month" shows previous 7 days
   - Verify chart shows 7 days of data

2. **Select "30 Days"** in analytics dashboard
   - Verify "This Month" shows last 30 days
   - Verify "Last Month" shows previous 30 days
   - Verify chart shows 30 days of data

3. **Select "90 Days"** in analytics dashboard
   - Verify "This Month" shows last 90 days
   - Verify "Last Month" shows previous 90 days
   - Verify chart shows 90 days of data

## 📋 Summary

- ✅ **Fixed:** Statistics now filter by selected time period
- ✅ **Fixed:** Date range calculations use proper start/end of day
- ✅ **Fixed:** Previous period calculation is accurate
- ✅ **Result:** Analytics statistics are now accurate for all time periods

## 🔍 Related Files

- `backend/src/services/analytics.service.ts` - Analytics service (fixed)
- `backend/src/services/database.service.ts` - Database service (updated to support end date)
