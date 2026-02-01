'use client';

import { MessageSquare, Search, FileText } from 'lucide-react';

const steps = [
  {
    icon: MessageSquare,
    title: 'Ask a question',
    description: 'Type what you want to know in plain language.',
  },
  {
    icon: Search,
    title: 'We search your docs and the web',
    description: 'QueryAI finds relevant content from your uploads and the internet.',
  },
  {
    icon: FileText,
    title: 'Get a cited answer',
    description: 'Read the answer and click any source to verify.',
  },
];

export function LandingHowItWorks() {
  return (
    <section id="how-it-works" className="px-4 sm:px-6 py-16 sm:py-20">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center">
          How it works
        </h2>
        <p className="mt-2 text-gray-600 text-center max-w-xl mx-auto">
          Three steps to better research.
        </p>
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6">
          {steps.map(({ icon: Icon, title, description }, i) => (
            <div key={title} className="flex flex-col items-center text-center">
              <div className="flex items-center justify-center w-14 h-14 rounded-full bg-orange-100 text-orange-600">
                <Icon className="w-7 h-7" />
              </div>
              <div className="mt-4 text-sm font-medium text-orange-600">Step {i + 1}</div>
              <h3 className="mt-1 font-semibold text-gray-900">{title}</h3>
              <p className="mt-2 text-sm text-gray-600 max-w-xs">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
