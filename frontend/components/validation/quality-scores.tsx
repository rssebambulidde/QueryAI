'use client';

import React from 'react';
import { ValidationRun } from '@/lib/api-validation';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface QualityScoresProps {
  run: ValidationRun;
}

export const QualityScores: React.FC<QualityScoresProps> = ({ run }) => {
  const scores = [
    {
      label: 'Overall Score',
      value: run.overallScore,
      color: 'blue',
      icon: run.overallScore >= 80 ? TrendingUp : run.overallScore >= 60 ? Minus : TrendingDown,
    },
    {
      label: 'Retrieval Quality',
      value: run.scores.retrieval,
      color: 'green',
      icon: run.scores.retrieval >= 80 ? TrendingUp : run.scores.retrieval >= 60 ? Minus : TrendingDown,
    },
    {
      label: 'Answer Quality',
      value: run.scores.answer,
      color: 'purple',
      icon: run.scores.answer >= 80 ? TrendingUp : run.scores.answer >= 60 ? Minus : TrendingDown,
    },
    {
      label: 'Citation Accuracy',
      value: run.scores.citation,
      color: 'orange',
      icon: run.scores.citation >= 80 ? TrendingUp : run.scores.citation >= 60 ? Minus : TrendingDown,
    },
  ];

  const getColorClasses = (color: string) => {
    const colors = {
      blue: 'bg-blue-50 border-blue-200 text-blue-900',
      green: 'bg-green-50 border-green-200 text-green-900',
      purple: 'bg-purple-50 border-purple-200 text-purple-900',
      orange: 'bg-orange-50 border-orange-200 text-orange-900',
    };
    return colors[color as keyof typeof colors] || colors.blue;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {scores.map((score) => {
        const Icon = score.icon;
        return (
          <div
            key={score.label}
            className={`rounded-lg border-2 p-6 ${getColorClasses(score.color)}`}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">{score.label}</h3>
              <Icon
                className={`w-5 h-5 ${
                  score.value >= 80
                    ? 'text-green-600'
                    : score.value >= 60
                    ? 'text-yellow-600'
                    : 'text-red-600'
                }`}
              />
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-bold ${getScoreColor(score.value)}`}>
                {score.value.toFixed(1)}
              </span>
              <span className="text-lg text-gray-600">/ 100</span>
            </div>
            <div className="mt-4">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    score.value >= 80
                      ? 'bg-green-600'
                      : score.value >= 60
                      ? 'bg-yellow-600'
                      : 'bg-red-600'
                  }`}
                  style={{ width: `${score.value}%` }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
