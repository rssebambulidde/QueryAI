'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const faqItems = [
  {
    question: 'What is QueryAI?',
    answer: 'QueryAI is a fact research assistant that helps you find accurate, verified information quickly. It combines real-time web search with document analysis to deliver comprehensive, source-cited answers.',
  },
  {
    question: 'Is there a free tier?',
    answer: 'Yes. QueryAI offers a free tier so you can start researching immediately. No credit card required.',
  },
  {
    question: 'How are sources used?',
    answer: 'Answers include inline citations to the sources they use—your uploaded documents or web pages. You can click through to read the original and verify.',
  },
  {
    question: 'What happens to my data?',
    answer: 'Your documents and conversations are stored securely. We use your uploads only to answer your questions and to improve the service within our privacy policy.',
  },
  {
    question: 'Can I use my own documents?',
    answer: 'Yes. Upload PDFs, Word docs, and other supported files. QueryAI will search them and cite them in answers alongside web results.',
  },
  {
    question: 'Where is QueryAI based?',
    answer: 'QueryAI is built by SamaBrains Solution Company, based in Kampala, Uganda.',
  },
];

export function LandingFaq() {
  const [openId, setOpenId] = useState<number | null>(0);

  return (
    <section id="faq" className="px-4 sm:px-6 py-16 sm:py-20 bg-gray-50/50">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center">
          Frequently asked questions
        </h2>
        <div className="mt-10 space-y-2">
          {faqItems.map((item, i) => (
            <div
              key={item.question}
              className="bg-white rounded-lg border border-gray-200 overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setOpenId(openId === i ? null : i)}
                className="w-full flex items-center justify-between gap-3 px-4 py-4 text-left font-medium text-gray-900 hover:bg-gray-50 transition-colors touch-manipulation min-h-[56px]"
                aria-expanded={openId === i}
              >
                {item.question}
                <ChevronDown
                  className={cn('w-5 h-5 flex-shrink-0 text-gray-500 transition-transform', openId === i && 'rotate-180')}
                />
              </button>
              {openId === i && (
                <div className="px-4 pb-4 pt-0 text-sm text-gray-600 border-t border-gray-100">
                  {item.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
