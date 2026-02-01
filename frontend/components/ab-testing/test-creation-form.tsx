'use client';

import React, { useState } from 'react';
import { useABTesting } from '@/lib/hooks/use-ab-testing';
import { CreateABTestInput, VariantConfig } from '@/lib/api-ab-testing';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { X } from 'lucide-react';

interface TestCreationFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export const TestCreationForm: React.FC<TestCreationFormProps> = ({
  onSuccess,
  onCancel,
}) => {
  const { createTest, loading } = useABTesting();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<CreateABTestInput>({
    name: '',
    description: '',
    feature: '',
    variantA: {
      name: 'Variant A',
      description: '',
      configuration: {},
    },
    variantB: {
      name: 'Variant B',
      description: '',
      configuration: {},
    },
    trafficAllocation: 50,
    sampleSize: 1000,
    significanceLevel: 0.05,
  });

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Test name is required';
    }

    if (!formData.feature.trim()) {
      newErrors.feature = 'Feature is required';
    }

    if (!formData.variantA.name.trim()) {
      newErrors.variantA_name = 'Variant A name is required';
    }

    if (!formData.variantB.name.trim()) {
      newErrors.variantB_name = 'Variant B name is required';
    }

    if (formData.trafficAllocation < 0 || formData.trafficAllocation > 100) {
      newErrors.trafficAllocation = 'Traffic allocation must be between 0 and 100';
    }

    if (formData.sampleSize < 1) {
      newErrors.sampleSize = 'Sample size must be at least 1';
    }

    if (formData.significanceLevel < 0 || formData.significanceLevel > 1) {
      newErrors.significanceLevel = 'Significance level must be between 0 and 1';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    const result = await createTest(formData);
    if (result) {
      onSuccess();
    }
  };

  const updateVariantConfig = (
    variant: 'variantA' | 'variantB',
    field: keyof VariantConfig,
    value: any
  ) => {
    setFormData((prev) => ({
      ...prev,
      [variant]: {
        ...prev[variant],
        [field]: value,
      },
    }));
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Create A/B Test</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>

          <Input
            label="Test Name *"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            error={errors.name}
            placeholder="e.g., Homepage CTA Button Color"
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
              rows={3}
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Describe what this test is trying to measure..."
            />
          </div>

          <Input
            label="Feature *"
            value={formData.feature}
            onChange={(e) => setFormData({ ...formData, feature: e.target.value })}
            error={errors.feature}
            placeholder="e.g., homepage_cta_button"
          />
        </div>

        {/* Variant A */}
        <div className="space-y-4 border-t pt-6">
          <h3 className="text-lg font-semibold text-gray-900">Variant A (Control)</h3>

          <Input
            label="Variant A Name *"
            value={formData.variantA.name}
            onChange={(e) =>
              updateVariantConfig('variantA', 'name', e.target.value)
            }
            error={errors.variantA_name}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Variant A Description
            </label>
            <textarea
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
              rows={2}
              value={formData.variantA.description || ''}
              onChange={(e) =>
                updateVariantConfig('variantA', 'description', e.target.value)
              }
              placeholder="Describe variant A..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Variant A Configuration (JSON)
            </label>
            <textarea
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
              rows={4}
              value={JSON.stringify(formData.variantA.configuration, null, 2)}
              onChange={(e) => {
                try {
                  const config = JSON.parse(e.target.value);
                  updateVariantConfig('variantA', 'configuration', config);
                } catch {
                  // Invalid JSON, ignore
                }
              }}
              placeholder='{"color": "blue", "size": "large"}'
            />
          </div>
        </div>

        {/* Variant B */}
        <div className="space-y-4 border-t pt-6">
          <h3 className="text-lg font-semibold text-gray-900">Variant B (Treatment)</h3>

          <Input
            label="Variant B Name *"
            value={formData.variantB.name}
            onChange={(e) =>
              updateVariantConfig('variantB', 'name', e.target.value)
            }
            error={errors.variantB_name}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Variant B Description
            </label>
            <textarea
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
              rows={2}
              value={formData.variantB.description || ''}
              onChange={(e) =>
                updateVariantConfig('variantB', 'description', e.target.value)
              }
              placeholder="Describe variant B..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Variant B Configuration (JSON)
            </label>
            <textarea
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
              rows={4}
              value={JSON.stringify(formData.variantB.configuration, null, 2)}
              onChange={(e) => {
                try {
                  const config = JSON.parse(e.target.value);
                  updateVariantConfig('variantB', 'configuration', config);
                } catch {
                  // Invalid JSON, ignore
                }
              }}
              placeholder='{"color": "green", "size": "large"}'
            />
          </div>
        </div>

        {/* Test Configuration */}
        <div className="space-y-4 border-t pt-6">
          <h3 className="text-lg font-semibold text-gray-900">Test Configuration</h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Traffic Allocation: {formData.trafficAllocation}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={formData.trafficAllocation}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  trafficAllocation: parseInt(e.target.value),
                })
              }
              className="w-full"
            />
            <p className="text-xs text-gray-500 mt-1">
              Percentage of users to include in this test
            </p>
            {errors.trafficAllocation && (
              <p className="mt-1 text-sm text-red-600">{errors.trafficAllocation}</p>
            )}
          </div>

          <Input
            label="Sample Size *"
            type="number"
            min="1"
            value={formData.sampleSize}
            onChange={(e) =>
              setFormData({
                ...formData,
                sampleSize: parseInt(e.target.value) || 0,
              })
            }
            error={errors.sampleSize}
            placeholder="1000"
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Significance Level: {(formData.significanceLevel * 100).toFixed(1)}%
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={formData.significanceLevel}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  significanceLevel: parseFloat(e.target.value),
                })
              }
              className="w-full"
            />
            <p className="text-xs text-gray-500 mt-1">
              Confidence level (e.g., 0.05 = 95% confidence)
            </p>
            {errors.significanceLevel && (
              <p className="mt-1 text-sm text-red-600">{errors.significanceLevel}</p>
            )}
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex justify-end gap-3 border-t pt-6">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Creating...' : 'Create Test'}
          </Button>
        </div>
      </form>
    </div>
  );
};
