'use client';

import { BookOpen, Zap, Layers } from 'lucide-react';

const useCases = [
  {
    icon: BookOpen,
    title: 'Research for papers',
    description: 'Gather and cite sources for essays, reports, and studies.',
  },
  {
    icon: Zap,
    title: 'Fact-check quickly',
    description: 'Verify claims and get accurate, source-backed answers.',
  },
  {
    icon: Layers,
    title: 'Deep dives on topics',
    description: 'Explore a subject with your documents and the web together.',
  },
];

export function LandingUseCases() {
  return (
    <section className="px-4 sm:px-6 py-16 sm:py-20 bg-gray-50/50">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center">
          Use cases
        </h2>
        <p className="mt-2 text-gray-600 text-center max-w-xl mx-auto">
          Built for how you research.
        </p>
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6">
          {useCases.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm"
            >
              <div className="flex items-center justify-center w-11 h-11 rounded-lg bg-orange-100 text-orange-600">
                <Icon className="w-5 h-5" />
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
