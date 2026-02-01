'use client';

import { MessageCircle, FileSearch, Globe, BadgeCheck } from 'lucide-react';

const features = [
  {
    icon: MessageCircle,
    title: 'Ask in plain language',
    description: 'Type your question naturally. No need for special syntax or filters.',
  },
  {
    icon: FileSearch,
    title: 'Your documents + the web',
    description: 'We search your uploaded files and the web to give you a complete picture.',
  },
  {
    icon: BadgeCheck,
    title: 'Answers with sources',
    description: 'Every answer includes citations so you can verify and dig deeper.',
  },
  {
    icon: Globe,
    title: 'Citations you can verify',
    description: 'Click through to the original source—documents or web pages.',
  },
];

export function LandingFeatures() {
  return (
    <section id="features" className="px-4 sm:px-6 py-16 sm:py-20 bg-gray-50/50">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center">
          Why QueryAI
        </h2>
        <p className="mt-2 text-gray-600 text-center max-w-xl mx-auto">
          A fact research assistant that fits how you work.
        </p>
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
          {features.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-orange-100 text-orange-600">
                <Icon className="w-6 h-6" />
              </div>
              <h3 className="mt-4 font-semibold text-gray-900">{title}</h3>
              <p className="mt-2 text-sm text-gray-600">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
