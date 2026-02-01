'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DateRange } from './date-range-picker';
import jsPDF from 'jspdf';

interface ExportReportsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  dateRange: DateRange;
  metricsData?: {
    retrieval?: any;
    performance?: any;
    quality?: any;
  };
}

export function ExportReportsDialog({
  isOpen,
  onClose,
  dateRange,
  metricsData,
}: ExportReportsDialogProps) {
  const [exporting, setExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'pdf' | 'csv'>('pdf');

  if (!isOpen) return null;

  const exportToCSV = () => {
    setExporting(true);
    try {
      const rows: string[][] = [];
      
      // Header
      rows.push(['Metric', 'Value', 'Date Range', dateRange.startDate, 'to', dateRange.endDate]);
      rows.push([]);

      // Retrieval metrics
      if (metricsData?.retrieval) {
        rows.push(['Retrieval Metrics']);
        rows.push(['Precision', metricsData.retrieval.averagePrecision?.toFixed(3) || 'N/A']);
        rows.push(['Recall', metricsData.retrieval.averageRecall?.toFixed(3) || 'N/A']);
        rows.push(['F1 Score', metricsData.retrieval.averageF1Score?.toFixed(3) || 'N/A']);
        rows.push(['MRR', metricsData.retrieval.averageMRR?.toFixed(3) || 'N/A']);
        rows.push(['Average Precision', metricsData.retrieval.averageAP?.toFixed(3) || 'N/A']);
        rows.push([]);
      }

      // Performance metrics
      if (metricsData?.performance) {
        rows.push(['Performance Metrics']);
        rows.push(['Avg Response Time', `${metricsData.performance.avg?.toFixed(0) || 'N/A'}ms`]);
        rows.push(['Min Response Time', `${metricsData.performance.min?.toFixed(0) || 'N/A'}ms`]);
        rows.push(['Max Response Time', `${metricsData.performance.max?.toFixed(0) || 'N/A'}ms`]);
        rows.push(['P95 Response Time', `${metricsData.performance.p95?.toFixed(0) || 'N/A'}ms`]);
        rows.push(['P99 Response Time', `${metricsData.performance.p99?.toFixed(0) || 'N/A'}ms`]);
        rows.push(['Throughput', `${metricsData.performance.throughput?.toFixed(2) || 'N/A'} req/s`]);
        rows.push(['Error Rate', `${metricsData.performance.errorRate?.toFixed(2) || 'N/A'}%`]);
        rows.push([]);
      }

      // Quality metrics
      if (metricsData?.quality) {
        rows.push(['Quality Metrics']);
        rows.push(['Answer Quality', metricsData.quality.answerQuality?.toFixed(2) || 'N/A']);
        rows.push(['Citation Accuracy', `${metricsData.quality.citationAccuracy?.toFixed(1) || 'N/A'}%`]);
        rows.push(['Relevance Score', metricsData.quality.relevance?.toFixed(2) || 'N/A']);
      }

      // Convert to CSV
      const csvContent = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
      
      // Download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `analytics-report-${dateRange.startDate}-to-${dateRange.endDate}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error exporting CSV:', error);
      alert('Failed to export CSV. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const exportToPDF = () => {
    setExporting(true);
    try {
      const doc = new jsPDF();
      let yPos = 20;

      // Title
      doc.setFontSize(18);
      doc.text('Analytics Report', 14, yPos);
      yPos += 10;

      // Date Range
      doc.setFontSize(12);
      doc.text(`Date Range: ${dateRange.startDate} to ${dateRange.endDate}`, 14, yPos);
      yPos += 15;

      // Retrieval Metrics
      if (metricsData?.retrieval) {
        doc.setFontSize(14);
        doc.text('Retrieval Metrics', 14, yPos);
        yPos += 8;
        doc.setFontSize(10);
        doc.text(`Precision: ${metricsData.retrieval.averagePrecision?.toFixed(3) || 'N/A'}`, 14, yPos);
        yPos += 6;
        doc.text(`Recall: ${metricsData.retrieval.averageRecall?.toFixed(3) || 'N/A'}`, 14, yPos);
        yPos += 6;
        doc.text(`F1 Score: ${metricsData.retrieval.averageF1Score?.toFixed(3) || 'N/A'}`, 14, yPos);
        yPos += 6;
        doc.text(`MRR: ${metricsData.retrieval.averageMRR?.toFixed(3) || 'N/A'}`, 14, yPos);
        yPos += 6;
        doc.text(`Average Precision: ${metricsData.retrieval.averageAP?.toFixed(3) || 'N/A'}`, 14, yPos);
        yPos += 10;
      }

      // Performance Metrics
      if (metricsData?.performance) {
        if (yPos > 250) {
          doc.addPage();
          yPos = 20;
        }
        doc.setFontSize(14);
        doc.text('Performance Metrics', 14, yPos);
        yPos += 8;
        doc.setFontSize(10);
        doc.text(`Avg Response Time: ${metricsData.performance.avg?.toFixed(0) || 'N/A'}ms`, 14, yPos);
        yPos += 6;
        doc.text(`P95 Response Time: ${metricsData.performance.p95?.toFixed(0) || 'N/A'}ms`, 14, yPos);
        yPos += 6;
        doc.text(`P99 Response Time: ${metricsData.performance.p99?.toFixed(0) || 'N/A'}ms`, 14, yPos);
        yPos += 6;
        doc.text(`Throughput: ${metricsData.performance.throughput?.toFixed(2) || 'N/A'} req/s`, 14, yPos);
        yPos += 6;
        doc.text(`Error Rate: ${metricsData.performance.errorRate?.toFixed(2) || 'N/A'}%`, 14, yPos);
        yPos += 10;
      }

      // Quality Metrics
      if (metricsData?.quality) {
        if (yPos > 250) {
          doc.addPage();
          yPos = 20;
        }
        doc.setFontSize(14);
        doc.text('Quality Metrics', 14, yPos);
        yPos += 8;
        doc.setFontSize(10);
        doc.text(`Answer Quality: ${metricsData.quality.answerQuality?.toFixed(2) || 'N/A'}`, 14, yPos);
        yPos += 6;
        doc.text(`Citation Accuracy: ${metricsData.quality.citationAccuracy?.toFixed(1) || 'N/A'}%`, 14, yPos);
        yPos += 6;
        doc.text(`Relevance Score: ${metricsData.quality.relevance?.toFixed(2) || 'N/A'}`, 14, yPos);
      }

      // Save PDF
      doc.save(`analytics-report-${dateRange.startDate}-to-${dateRange.endDate}.pdf`);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Failed to export PDF. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const handleExport = () => {
    if (exportFormat === 'csv') {
      exportToCSV();
    } else {
      exportToPDF();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Export Report</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Export Format
            </label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="pdf"
                  checked={exportFormat === 'pdf'}
                  onChange={(e) => setExportFormat(e.target.value as 'pdf' | 'csv')}
                  className="mr-2"
                />
                PDF
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="csv"
                  checked={exportFormat === 'csv'}
                  onChange={(e) => setExportFormat(e.target.value as 'pdf' | 'csv')}
                  className="mr-2"
                />
                CSV
              </label>
            </div>
          </div>

          <div className="text-sm text-gray-600">
            <p>Date Range: {dateRange.startDate} to {dateRange.endDate}</p>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onClose} disabled={exporting}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={exporting} isLoading={exporting}>
            Export {exportFormat.toUpperCase()}
          </Button>
        </div>
      </div>
    </div>
  );
}
