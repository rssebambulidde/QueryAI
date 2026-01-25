export interface User {
  id: string;
  email: string;
  fullName?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UserProfile {
  id: string;
  userId: string;
  email: string;
  fullName?: string;
  subscriptionTier?: 'free' | 'premium' | 'pro';
  createdAt: Date;
  updatedAt: Date;
}
