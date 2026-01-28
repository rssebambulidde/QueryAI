'use client';

import React, { useState, useEffect, useRef } from 'react';
import { User, Mail, Lock, Save, Upload, X, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/lib/hooks/use-toast';
import { useAuthStore } from '@/lib/store/auth-store';
import { authApi } from '@/lib/api';
import { cn } from '@/lib/utils';

interface ProfileEditorProps {
  className?: string;
}

export const ProfileEditor: React.FC<ProfileEditorProps> = ({
  className,
}) => {
  const { user, setUser } = useAuthStore();
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [avatar, setAvatar] = useState<string | null>(user?.avatar_url || null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isChangingEmail, setIsChangingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setEmail(user.email || '');
      setAvatar(user.avatar_url || null);
    }
  }, [user]);

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file');
        return;
      }
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image must be less than 5MB');
        return;
      }
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatar(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      // Upload avatar if changed
      let avatarUrl = avatar;
      if (avatarFile) {
        // Note: Avatar upload endpoint may need to be implemented
        // For now, we'll use the data URL
        // In a real implementation: avatarUrl = await uploadAvatar(avatarFile);
      }

      const response = await authApi.updateProfile({
        full_name: fullName,
        avatar_url: avatarUrl || undefined,
      });

      if (response.success && response.data) {
        setUser(response.data.user);
        setAvatarFile(null);
        toast.success('Profile updated successfully');
      } else {
        throw new Error(response.message || 'Failed to update profile');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangeEmail = async () => {
    if (!newEmail || newEmail === email) {
      toast.error('Please enter a new email address');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      toast.error('Please enter a valid email address');
      return;
    }

    setIsChangingEmail(true);
    try {
      const response = await authApi.changeEmail({ newEmail });
      if (response.success) {
        toast.success('Email change request sent. Please check your new email for confirmation.');
        setIsChangingEmail(false);
        setNewEmail('');
      } else {
        throw new Error(response.message || 'Failed to change email');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to change email');
    } finally {
      setIsChangingEmail(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      toast.error('Please fill in all password fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters long');
      return;
    }

    setIsChangingPassword(true);
    try {
      const response = await authApi.changePassword({
        currentPassword,
        newPassword,
      });
      if (response.success) {
        toast.success('Password changed successfully');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setIsChangingPassword(false);
      } else {
        throw new Error(response.message || 'Failed to change password');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to change password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Profile Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Profile Settings</h2>
        <p className="text-sm text-gray-500">Manage your account information and preferences</p>
      </div>

      {/* Avatar Upload */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <label className="block text-sm font-medium text-gray-900 mb-3">
          Profile Picture
        </label>
        <div className="flex items-center gap-4">
          <div className="relative">
            {avatar ? (
              <img
                src={avatar}
                alt="Profile"
                className="w-20 h-20 rounded-full object-cover border-2 border-gray-200"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center border-2 border-gray-200">
                <User className="w-10 h-10 text-gray-400" />
              </div>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 p-1.5 bg-orange-600 text-white rounded-full hover:bg-orange-700 transition-colors shadow-lg"
              title="Change avatar"
            >
              <Camera className="w-4 h-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarSelect}
              className="hidden"
            />
          </div>
          <div className="flex-1">
            <p className="text-sm text-gray-600 mb-1">
              Upload a profile picture (JPG, PNG, max 5MB)
            </p>
            {avatarFile && (
              <p className="text-xs text-gray-500">{avatarFile.name}</p>
            )}
          </div>
          {avatarFile && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setAvatarFile(null);
                setAvatar(user?.avatar_url || null);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
            >
              <X className="w-4 h-4 mr-1" />
              Cancel
            </Button>
          )}
        </div>
      </div>

      {/* Basic Information */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Full Name
            </label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Enter your full name"
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <div className="flex items-center gap-2">
              <Input
                value={email}
                disabled
                className="w-full bg-gray-50"
              />
              <Button
                variant="outline"
                onClick={() => setIsChangingEmail(true)}
                disabled={isChangingEmail}
              >
                <Mail className="w-4 h-4 mr-2" />
                Change
              </Button>
            </div>
          </div>
        </div>

        {/* Change Email Form */}
        {isChangingEmail && (
          <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              New Email Address
            </label>
            <div className="flex items-center gap-2">
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="Enter new email"
                className="flex-1"
              />
              <Button
                onClick={handleChangeEmail}
                disabled={!newEmail || newEmail === email}
                className="bg-orange-600 hover:bg-orange-700 text-white"
              >
                Save
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsChangingEmail(false);
                  setNewEmail('');
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        <div className="mt-6 pt-6 border-t border-gray-200">
          <Button
            onClick={handleSaveProfile}
            disabled={isSaving}
            className="bg-orange-600 hover:bg-orange-700 text-white"
          >
            {isSaving ? (
              <>
                <Save className="w-4 h-4 mr-2 animate-pulse" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Password Change */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Password</h3>
            <p className="text-sm text-gray-500 mt-1">Change your account password</p>
          </div>
          <Button
            variant="outline"
            onClick={() => setIsChangingPassword(!isChangingPassword)}
          >
            {isChangingPassword ? 'Cancel' : 'Change Password'}
          </Button>
        </div>

        {isChangingPassword && (
          <div className="space-y-4 pt-4 border-t border-gray-200">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Current Password
              </label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                New Password
              </label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (min 8 characters)"
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Confirm New Password
              </label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="w-full"
              />
            </div>
            <Button
              onClick={handleChangePassword}
              disabled={isChangingPassword || !currentPassword || !newPassword || newPassword !== confirmPassword}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              <Lock className="w-4 h-4 mr-2" />
              Update Password
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
