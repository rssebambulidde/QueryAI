import { toast } from 'sonner';

/**
 * Download a document by ID via the backend API.
 * Falls back to opening the source URL in a new tab if download fails.
 */
export async function downloadDocument(
  documentId: string,
  filename: string,
  sourceUrl?: string,
): Promise<void> {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  try {
    const response = await fetch(`${API_URL}/api/documents/${documentId}/download`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || 'document';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      return;
    }

    throw new Error(`Download returned status ${response.status}`);
  } catch (error) {
    console.error('Failed to download document:', error);
    if (sourceUrl) {
      toast.error('Download failed \u2014 opening in browser');
      window.open(sourceUrl, '_blank');
    } else {
      toast.error('Failed to download document');
    }
  }
}
