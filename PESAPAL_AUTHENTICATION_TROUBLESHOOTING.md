# Pesapal Authentication Troubleshooting Guide

## Error: "Pesapal authentication failed: Invalid authentication response from Pesapal"

This error occurs when the backend cannot authenticate with the Pesapal API. Follow these steps to resolve it:

## Step 1: Verify Environment Variables

Ensure the following environment variables are set in your Railway backend:

1. **PESAPAL_CONSUMER_KEY** - Your Pesapal Consumer Key
2. **PESAPAL_CONSUMER_SECRET** - Your Pesapal Consumer Secret
3. **PESAPAL_ENVIRONMENT** - Set to `sandbox` for testing or `production` for live

### How to Check in Railway:
1. Go to your Railway project dashboard
2. Select your backend service
3. Click on the "Variables" tab
4. Verify all three variables are set correctly

## Step 2: Verify Pesapal Credentials

### For Sandbox (Testing):
1. Log in to your Pesapal account
2. Go to **Developers** → **Sandbox**
3. Copy your **Consumer Key** and **Consumer Secret**
4. Ensure they match what's in Railway

### For Production:
1. Log in to your Pesapal account
2. Go to **Developers** → **Production**
3. Copy your **Consumer Key** and **Consumer Secret**
4. Ensure they match what's in Railway

## Step 3: Check API Endpoints

The system uses these endpoints:
- **Sandbox**: `https://cybqa.pesapal.com/pesapalv3/api`
- **Production**: `https://pay.pesapal.com/v3/api`

Ensure your `PESAPAL_ENVIRONMENT` variable matches:
- `sandbox` → Uses sandbox endpoint
- `production` → Uses production endpoint

## Step 4: Common Issues and Solutions

### Issue 1: Credentials Not Set
**Error**: "Pesapal credentials are not configured"
**Solution**: Add `PESAPAL_CONSUMER_KEY` and `PESAPAL_CONSUMER_SECRET` to Railway environment variables

### Issue 2: Invalid Credentials
**Error**: "Pesapal authentication failed: Invalid consumer key or secret"
**Solution**: 
- Verify credentials are correct (no extra spaces)
- Ensure you're using the right credentials for your environment (sandbox vs production)
- Regenerate credentials in Pesapal dashboard if needed

### Issue 3: Wrong Environment
**Error**: Authentication fails with 401
**Solution**: 
- Ensure `PESAPAL_ENVIRONMENT` is set to `sandbox` for testing
- Use production credentials only when `PESAPAL_ENVIRONMENT=production`

### Issue 4: Network/Connection Issues
**Error**: "Unable to connect to Pesapal API"
**Solution**:
- Check Railway service logs for network errors
- Verify Pesapal service status
- Check if Railway has internet access

## Step 5: Check Backend Logs

After making changes, check your Railway backend logs:

1. Go to Railway dashboard
2. Select your backend service
3. Click on "Deployments" → Latest deployment → "View Logs"
4. Look for lines containing "Pesapal authentication"
5. Check for detailed error messages

The improved logging will show:
- Which API endpoint is being used
- Whether credentials are present
- The full response from Pesapal
- Specific error details

## Step 6: Test Authentication

After fixing the issue, try initiating a payment again. The system will:
1. Validate credentials are set
2. Attempt authentication with Pesapal
3. Log detailed information for debugging
4. Provide specific error messages if it fails

## Additional Notes

- **Sandbox credentials** only work with the sandbox environment
- **Production credentials** only work with the production environment
- Credentials are case-sensitive
- Remove any trailing spaces when copying credentials
- Wait a few minutes after updating environment variables for changes to take effect

## Getting Help

If the issue persists after following these steps:
1. Check Railway logs for detailed error messages
2. Verify your Pesapal account is active
3. Contact Pesapal support if credentials are correct but authentication still fails
4. Review Pesapal API documentation for any recent changes
