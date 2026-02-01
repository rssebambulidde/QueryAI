'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Palette, Upload, Save } from 'lucide-react';
import { useToast } from '@/lib/hooks/use-toast';

export default function WhiteLabel() {
  const { toast } = useToast();
  const [logo, setLogo] = useState<string | null>(null);
  const [primaryColor, setPrimaryColor] = useState('#FF6B35');
  const [secondaryColor, setSecondaryColor] = useState('#004E89');
  const [brandName, setBrandName] = useState('QueryAI');

  const handleSave = async () => {
    try {
      // TODO: Implement API call to save white label settings
      toast.success('White label settings saved successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save white label settings');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-xl font-semibold text-gray-900">White Label Settings</h3>
        <p className="text-sm text-gray-600 mt-1">Customize branding and appearance</p>
      </div>

      {/* Brand Name */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h4 className="text-lg font-semibold text-gray-900 mb-4">Brand Name</h4>
        <Input
          placeholder="Enter brand name"
          value={brandName}
          onChange={(e) => setBrandName(e.target.value)}
          className="max-w-md"
        />
      </div>

      {/* Logo Upload */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h4 className="text-lg font-semibold text-gray-900 mb-4">Logo</h4>
        <div className="flex items-center gap-4">
          {logo && (
            <img src={logo} alt="Logo" className="h-16 w-auto" />
          )}
          <Button variant="outline">
            <Upload className="w-4 h-4 mr-2" />
            Upload Logo
          </Button>
        </div>
      </div>

      {/* Colors */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h4 className="text-lg font-semibold text-gray-900 mb-4">Color Scheme</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Primary Color
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="h-10 w-20 rounded border border-gray-300"
              />
              <Input
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="flex-1"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Secondary Color
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                className="h-10 w-20 rounded border border-gray-300"
              />
              <Input
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                className="flex-1"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave}>
          <Save className="w-4 h-4 mr-2" />
          Save Settings
        </Button>
      </div>
    </div>
  );
}
