'use client';

import { TopicManager } from '@/components/topics/topic-manager';

export default function TopicsSettingsPage() {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <TopicManager />
    </div>
  );
}
