'use client';

import React, { useState } from 'react';
import { Users, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { authApi } from '@/lib/api';
import { useToast } from '@/lib/hooks/use-toast';

export default function TeamCollaborationPage() {
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      setError('Please enter an email address');
      return;
    }

    setInviting(true);
    setError(null);
    try {
      const response = await authApi.inviteUser(inviteEmail.trim());
      if (response.success) {
        toast.success('Invitation sent. They will receive an email to set up their account.');
        setInviteEmail('');
      } else {
        setError(response.error?.message ?? response.message ?? 'Failed to send invitation');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send invitation';
      setError(msg);
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-3 mb-6">
          <Users className="w-6 h-6 text-orange-600" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Team Collaboration</h2>
            <p className="text-sm text-gray-500 mt-1">Invite team members to your workspace</p>
          </div>
        </div>

        {error && (
          <Alert variant="error" className="mb-4">
            {error}
          </Alert>
        )}

        {/* Invite Team Member */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Invite Team Member</h3>
          <div className="flex gap-3">
            <Input
              type="email"
              placeholder="Enter email address"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="flex-1"
              onKeyDown={(e) => {
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
            They will receive an email with a link to set a password and join your workspace.
          </p>
        </div>

      </div>
    </div>
  );
}
