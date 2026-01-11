# API Routes

This directory contains all API route handlers.

## Authentication Routes (`auth.routes.ts`)

### POST /api/auth/signup
Create a new user account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "fullName": "John Doe" // optional
}
```

**Response:**
```json
{
  "success": true,
  "message": "User created successfully",
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "fullName": "John Doe"
    },
    "session": {
      "accessToken": "jwt-token",
      "refreshToken": "refresh-token",
      "expiresIn": 3600
    }
  }
}
```

### POST /api/auth/login
Login with email and password.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "fullName": "John Doe"
    },
    "session": {
      "accessToken": "jwt-token",
      "refreshToken": "refresh-token",
      "expiresIn": 3600
    }
  }
}
```

### POST /api/auth/logout
Logout user (requires authentication).

**Headers:**
```
Authorization: Bearer <access-token>
```

**Response:**
```json
{
  "success": true,
  "message": "Logout successful"
}
```

### POST /api/auth/refresh
Refresh access token.

**Request:**
```json
{
  "refreshToken": "refresh-token"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": {
    "accessToken": "new-jwt-token",
    "refreshToken": "new-refresh-token",
    "expiresIn": 3600
  }
}
```

### POST /api/auth/forgot-password
Request password reset email.

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "If an account exists with this email, a password reset link has been sent"
}
```

### GET /api/auth/me
Get current user information (requires authentication).

**Headers:**
```
Authorization: Bearer <access-token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "fullName": "John Doe"
    }
  }
}
```

## Authentication

Most endpoints require authentication. Include the JWT token in the Authorization header:

```
Authorization: Bearer <your-access-token>
```

## Error Responses

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": {
    "message": "Error message",
    "code": "ERROR_CODE"
  }
}
```

Common error codes:
- `VALIDATION_ERROR` - Invalid input
- `AUTHENTICATION_ERROR` - Authentication failed
- `CONFLICT` - Resource already exists
- `NOT_FOUND` - Resource not found
