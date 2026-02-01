'use client';

import React, { useState } from 'react';
import { ValidationReport } from '@/lib/api-validation';
import { validationApi } from '@/lib/api-validation';
import { Button } from '@/components/ui/button';
import { FileText, FileCode, Download } from 'lucide-react';
import { useToast } from '@/lib/hooks/use-toast';

interface ReportExportProps {
  report: ValidationReport;
}

export const ReportExport: React.FC<ReportExportProps> = ({ report }) => {
  const [exporting, setExporting] = useState<'pdf' | 'markdown' | null>(null);
  const { toast } = useToast();

  const handleExport = async (format: 'pdf' | 'markdown') => {
    try {
      setExporting(format);
      const blob = await validationApi.exportReport(report.id, format);

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const extension = format === 'pdf' ? 'pdf' : 'md';
      a.download = `validation-report-${report.testSuiteName}-${new Date().toISOString()}.${extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success(`${format.toUpperCase()} export downloaded successfully`);
    } catch (error: any) {
      toast.error(error.message || `Failed to export ${format.toUpperCase()}`);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        onClick={() => handleExport('pdf')}
        disabled={exporting !== null}
      >
        {exporting === 'pdf' ? (
          <>
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-2" />
            Exporting...
          </>
        ) : (
          <>
            <FileText className="w-4 h-4 mr-2" />
            Export PDF
          </>
        )}
      </Button>
      <Button
        variant="outline"
        onClick={() => handleExport('markdown')}
        disabled={exporting !== null}
      >
        {exporting === 'markdown' ? (
          <>
            <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin mr-2" />
            Exporting...
          </>
        ) : (
          <>
            <FileCode className="w-4 h-4 mr-2" />
            Export Markdown
          </>
        )}
      </Button>
    </div>
  );
};
