import { Conversation, Message, Source } from '@/lib/api';
import { exportToPdf } from '@/lib/export-pdf';

export interface ExportOptions {
  includeSources?: boolean;
  includeCitations?: boolean;
  format?: 'pdf' | 'markdown' | 'json';
}

/**
 * Export conversation to Markdown format
 */
export function exportConversationToMarkdown(
  conversation: Conversation,
  messages: Message[],
  options: ExportOptions = {}
): string {
  const { includeSources = true, includeCitations = true } = options;
  
  let markdown = `# ${conversation.title || 'Untitled Conversation'}\n\n`;
  markdown += `**Created:** ${new Date(conversation.created_at).toLocaleString()}\n`;
  if (conversation.updated_at) {
    markdown += `**Last Updated:** ${new Date(conversation.updated_at).toLocaleString()}\n`;
  }
  markdown += `\n---\n\n`;

  messages.forEach((message, index) => {
    if (message.role === 'user') {
      markdown += `## Question ${Math.floor(index / 2) + 1}\n\n`;
      markdown += `${message.content}\n\n`;
    } else if (message.role === 'assistant') {
      markdown += `### Answer\n\n`;
      
      let content = message.content;
      
      // Process citations if enabled
      if (includeCitations && message.sources && message.sources.length > 0) {
        // Replace citation patterns with markdown links
        const sources = message.sources as Source[];
        sources.forEach((source, idx) => {
          const citationPattern = new RegExp(`\\[(Web Source|Document)\\s+${idx + 1}\\]`, 'gi');
          const linkText = source.title || (source.type === 'web' ? 'Web Source' : 'Document');
          const url = source.url || '#';
          content = content.replace(citationPattern, `[${linkText}](${url})`);
        });
      }
      
      markdown += `${content}\n\n`;
      
      // Add sources section if enabled
      if (includeSources && message.sources && message.sources.length > 0) {
        markdown += `#### Sources\n\n`;
        const sources = message.sources as Source[];
        sources.forEach((source, idx) => {
          const num = idx + 1;
          const title = source.title || `Source ${num}`;
          const url = source.url || '';
          markdown += `${num}. [${title}](${url})\n`;
          if (source.snippet) {
            markdown += `   > ${source.snippet}\n`;
          }
          markdown += `\n`;
        });
        markdown += `\n`;
      }
      
      markdown += `---\n\n`;
    }
  });

  return markdown;
}

/**
 * Export conversation to JSON format
 */
export function exportConversationToJson(
  conversation: Conversation,
  messages: Message[],
  options: ExportOptions = {}
): string {
  const { includeSources = true } = options;
  
  const exportData = {
    conversation: {
      id: conversation.id,
      title: conversation.title,
      created_at: conversation.created_at,
      updated_at: conversation.updated_at,
      topic_id: conversation.topic_id,
    },
    messages: messages.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      created_at: message.created_at,
      ...(includeSources && message.sources ? { sources: message.sources } : {}),
      ...(message.metadata ? { metadata: message.metadata } : {}),
    })),
    exported_at: new Date().toISOString(),
    export_options: options,
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * Export conversation to PDF format
 */
export async function exportConversationToPdf(
  conversation: Conversation,
  messages: Message[],
  options: ExportOptions = {}
): Promise<void> {
  const { includeSources = true } = options;
  
  // Export each Q&A pair as a separate PDF or combine them
  // For now, we'll export the first Q&A pair or combine all
  const userMessages = messages.filter(m => m.role === 'user');
  const assistantMessages = messages.filter(m => m.role === 'assistant');
  
  if (userMessages.length === 0) {
    throw new Error('No questions found in conversation');
  }

  // Export each Q&A pair
  for (let i = 0; i < userMessages.length; i++) {
    const question = userMessages[i].content;
    const answer = assistantMessages[i]?.content || 'No answer available';
    const sources = includeSources && assistantMessages[i]?.sources 
      ? (assistantMessages[i].sources as Source[])
      : [];

    exportToPdf({
      question: `${conversation.title || 'Untitled'} - Question ${i + 1}: ${question}`,
      answer,
      sources,
    });
    
    // Add a small delay between exports to avoid browser blocking
    if (i < userMessages.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
}

/**
 * Main export function that handles all formats
 */
export async function exportConversation(
  conversation: Conversation,
  messages: Message[],
  options: ExportOptions = {}
): Promise<void> {
  const { format = 'pdf' } = options;
  
  switch (format) {
    case 'markdown':
      const markdown = exportConversationToMarkdown(conversation, messages, options);
      downloadFile(markdown, `${sanitizeFilename(conversation.title || 'conversation')}.md`, 'text/markdown');
      break;
    
    case 'json':
      const json = exportConversationToJson(conversation, messages, options);
      downloadFile(json, `${sanitizeFilename(conversation.title || 'conversation')}.json`, 'application/json');
      break;
    
    case 'pdf':
    default:
      await exportConversationToPdf(conversation, messages, options);
      break;
  }
}

/**
 * Download a file
 */
function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Sanitize filename
 */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 50);
}
