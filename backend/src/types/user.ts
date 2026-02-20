export interface User {
  id: string;
  email: string;
  fullName?: string;
  role?: 'user' | 'super_admin';
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UserProfile {
  id: string;
  userId: string;
  email: string;
  fullName?: string;
  role?: 'user' | 'super_admin';
  subscriptionTier?: 'free' | 'starter' | 'premium' | 'pro' | 'enterprise';
  createdAt: Date;
  updatedAt: Date;
}
