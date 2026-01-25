# API Testing Interface

## How to Use

After Railway deploys, visit:

```
https://your-app.railway.app/test-api.html
```

## Features

- **Signup** - Create a new user account
- **Login** - Login with email and password
- **Get Current User** - View your profile (requires login)
- **Logout** - Logout from your session
- **Refresh Token** - Refresh your access token
- **Forgot Password** - Request password reset email

## Setup

1. Enter your Railway app URL in the "API Base URL" field
2. Use the interface to test all endpoints
3. Tokens are automatically saved and used for authenticated requests

## Alternative: Use Postman/Insomnia

You can also use API testing tools like:
- [Postman](https://www.postman.com/)
- [Insomnia](https://insomnia.rest/)
- [Thunder Client](https://www.thunderclient.com/) (VS Code extension)

Import the endpoints from `backend/src/routes/README.md`
