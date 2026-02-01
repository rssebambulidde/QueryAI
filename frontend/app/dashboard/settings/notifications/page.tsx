'use client';

import React, { useState } from 'react';
import { Bell, Mail, MessageSquare, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/lib/hooks/use-toast';

export default function NotificationsPage() {
  const { toast } = useToast();
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(false);
  const [conversationUpdates, setConversationUpdates] = useState(true);
  const [systemUpdates, setSystemUpdates] = useState(true);

  const handleSave = () => {
    // TODO: Implement API call to save notification preferences
    toast.success('Notification preferences saved');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Notifications</h2>
        <p className="text-sm text-gray-500 mt-1">
          Manage how you receive notifications
        </p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
        {/* Email Notifications */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Mail className="w-5 h-5 text-gray-500" />
            <div>
              <h3 className="text-sm font-medium text-gray-900">Email Notifications</h3>
              <p className="text-xs text-gray-500">Receive notifications via email</p>
            </div>
          </div>
          <button
            onClick={() => setEmailNotifications(!emailNotifications)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              emailNotifications ? 'bg-orange-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                emailNotifications ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Push Notifications */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bell className="w-5 h-5 text-gray-500" />
            <div>
              <h3 className="text-sm font-medium text-gray-900">Push Notifications</h3>
              <p className="text-xs text-gray-500">Receive browser push notifications</p>
            </div>
          </div>
          <button
            onClick={() => setPushNotifications(!pushNotifications)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              pushNotifications ? 'bg-orange-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                pushNotifications ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Conversation Updates */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MessageSquare className="w-5 h-5 text-gray-500" />
            <div>
              <h3 className="text-sm font-medium text-gray-900">Conversation Updates</h3>
              <p className="text-xs text-gray-500">Get notified about conversation activity</p>
            </div>
          </div>
          <button
            onClick={() => setConversationUpdates(!conversationUpdates)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              conversationUpdates ? 'bg-orange-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                conversationUpdates ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* System Updates */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-gray-500" />
            <div>
              <h3 className="text-sm font-medium text-gray-900">System Updates</h3>
              <p className="text-xs text-gray-500">Receive updates about system changes</p>
            </div>
          </div>
          <button
            onClick={() => setSystemUpdates(!systemUpdates)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              systemUpdates ? 'bg-orange-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                systemUpdates ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave}>Save Preferences</Button>
      </div>
    </div>
  );
}
