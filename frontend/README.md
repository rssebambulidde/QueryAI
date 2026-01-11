# QueryAI Frontend

Modern Next.js frontend for QueryAI - AI Knowledge Hub.

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create `.env.local` file:
```bash
cp .env.local.example .env.local
```

3. Update `.env.local` with your API URL:
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
# For production:
# NEXT_PUBLIC_API_URL=https://your-app.railway.app
```

### Development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build

Build for production:

```bash
npm run build
npm start
```

## 📁 Project Structure

```
frontend/
├── app/                    # Next.js App Router pages
│   ├── login/             # Login page
│   ├── signup/            # Signup page
│   ├── forgot-password/   # Password reset page
│   ├── dashboard/          # Protected dashboard
│   └── page.tsx           # Home page
├── components/             # React components
│   └── ui/                # Reusable UI components
├── lib/                   # Utilities and configurations
│   ├── api.ts             # API client
│   ├── store/             # Zustand stores
│   └── utils.ts           # Utility functions
└── middleware.ts          # Next.js middleware
```

## 🔐 Authentication

The frontend uses:
- **Zustand** for state management
- **React Hook Form** + **Zod** for form validation
- **Axios** for API calls
- Token-based authentication with JWT

### Auth Flow

1. User signs up/logs in
2. Tokens stored in Zustand store and localStorage
3. Axios interceptor adds token to requests
4. Protected routes check auth status client-side

## 🎨 UI Components

Built with:
- **Tailwind CSS** for styling
- Custom UI components (Button, Input, Alert)
- Responsive design

## 🔗 API Integration

The frontend connects to the backend API at:
- Development: `http://localhost:3001`
- Production: Your Railway domain

### Available Endpoints

- `POST /api/auth/signup` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh` - Refresh token
- `POST /api/auth/forgot-password` - Password reset
- `GET /api/auth/me` - Get current user

## 📝 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API URL | `http://localhost:3001` |
| `NEXT_PUBLIC_APP_NAME` | App name | `QueryAI` |

## 🧪 Testing

To test the authentication:

1. Start the backend server (port 3001)
2. Start the frontend: `npm run dev`
3. Navigate to http://localhost:3000
4. Try signing up a new user
5. Login with credentials
6. Access the dashboard

## 🚢 Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

### Other Platforms

The app can be deployed to any platform that supports Next.js:
- Netlify
- Railway
- AWS Amplify
- Cloudflare Pages

## 📚 Tech Stack

- **Next.js 16** - React framework
- **React 19** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Zustand** - State management
- **React Hook Form** - Form handling
- **Zod** - Schema validation
- **Axios** - HTTP client

## 🔄 Next Steps

- [ ] Add chat interface
- [ ] Add document upload
- [ ] Add AI query interface
- [ ] Add user profile page
- [ ] Add settings page
- [ ] Add error boundaries
- [ ] Add loading states
- [ ] Add toast notifications

## 📖 Documentation

See the main project README for more information.
