'use client';

import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Mail, Shield, Trash2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { useAuthStore } from '@/lib/store/auth-store';
import { subscriptionApi } from '@/lib/api';

export default function TeamCollaborationPage() {
  const { user } = useAuthStore();
  const [subscriptionTier, setSubscriptionTier] = useState<'free' | 'starter' | 'premium' | 'pro' | 'enterprise'>('free');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    const loadSubscription = async () => {
      try {
        const response = await subscriptionApi.get();
        if (response.success && response.data?.subscription?.tier) {
          setSubscriptionTier(response.data.subscription.tier);
        }
      } catch (error) {
        console.error('Failed to load subscription:', error);
      } finally {
        setLoading(false);
      }
    };
    loadSubscription();
  }, []);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      setError('Please enter an email address');
      return;
    }

    setInviting(true);
    setError(null);
    try {
      // TODO: Implement team invitation API endpoint
      // const response = await teamApi.invite({ email: inviteEmail });
      // For now, show a placeholder message
      alert(`Team collaboration feature is coming soon! Invitation to ${inviteEmail} would be sent.`);
      setInviteEmail('');
    } catch (err: any) {
      setError(err.message || 'Failed to send invitation');
    } finally {
      setInviting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
          <p className="mt-4 text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (subscriptionTier !== 'enterprise') {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <Alert variant="error" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <span className="ml-2">Team Collaboration is only available for Enterprise plan subscribers.</span>
        </Alert>
        <p className="text-gray-600 mb-4">
          Upgrade to Enterprise to unlock team collaboration features, including:
        </p>
        <ul className="list-disc list-inside text-gray-600 space-y-2 mb-6">
          <li>Invite team members to collaborate</li>
          <li>Share topics and documents with your team</li>
          <li>Manage team permissions and access</li>
          <li>Team-wide analytics and insights</li>
        </ul>
        <Button onClick={() => window.location.href = '/dashboard/settings/subscription'}>
          Upgrade to Enterprise
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-3 mb-6">
          <Users className="w-6 h-6 text-indigo-600" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Team Collaboration</h2>
            <p className="text-sm text-gray-500 mt-1">Manage your team members and permissions</p>
          </div>
        </div>

        {error && (
          <Alert variant="error" className="mb-4">
            {error}
          </Alert>
        )}

        {/* Invite Team Member */}
        <div className="border-b border-gray-200 pb-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Invite Team Member</h3>
          <div className="flex gap-3">
            <Input
              type="email"
              placeholder="Enter email address"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="flex-1"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleInvite();
                }
              }}
            />
            <Button onClick={handleInvite} disabled={inviting}>
              <UserPlus className="w-4 h-4 mr-2" />
              {inviting ? 'Sending...' : 'Send Invitation'}
            </Button>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            Team members will receive an email invitation to join your workspace.
          </p>
        </div>

        {/* Team Members List */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Team Members</h3>
          {teamMembers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p>No team members yet. Invite someone to get started!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {teamMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                      <Mail className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{member.email}</p>
                      <p className="text-sm text-gray-500">{member.role || 'Member'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {member.role === 'admin' && (
                      <Shield className="w-4 h-4 text-indigo-600" />
                    )}
                    <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Feature Notice */}
        <Alert className="mt-6 bg-blue-50 border-blue-200">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <div className="ml-2">
            <p className="text-sm text-blue-800 font-medium">Feature Coming Soon</p>
            <p className="text-sm text-blue-700 mt-1">
              Team collaboration features are currently under development. Full functionality including team invitations,
              shared workspaces, and permission management will be available soon.
            </p>
          </div>
        </Alert>
      </div>
    </div>
  );
}
