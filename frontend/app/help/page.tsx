import type { Metadata } from 'next';
import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import { Logo } from '@/components/logo';

export const metadata: Metadata = {
  title: 'User Guide | QueryAI',
  description: 'How to use QueryAI: for students, researchers, professionals, and more. Chat, documents, topics, citations, and settings.',
};

const sections = [
  { id: 'getting-started', title: 'Getting started' },
  { id: 'who-its-for', title: 'Who it\'s for' },
  { id: 'chat-research', title: 'Chat & research' },
  { id: 'conversations', title: 'Conversations' },
  { id: 'documents', title: 'Documents' },
  { id: 'topics', title: 'Topics' },
  { id: 'settings', title: 'Settings' },
  { id: 'account', title: 'Account & privacy' },
] as const;

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Logo href="/" showName size="sm" />
            <Link href="/" className="text-sm text-gray-600 hover:text-gray-900">Back to Home</Link>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 rounded-lg bg-orange-100">
            <BookOpen className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">User Guide</h1>
            <p className="text-sm text-gray-500 mt-0.5">How to use QueryAI</p>
          </div>
        </div>

        {/* Quick nav */}
        <nav className="mb-10 p-4 rounded-xl bg-white border border-gray-200 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Contents</h2>
          <ul className="flex flex-wrap gap-2">
            {sections.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="text-sm text-orange-600 hover:text-orange-700 hover:underline"
                >
                  {s.title}
                </a>
                {s.id !== sections[sections.length - 1].id && (
                  <span className="text-gray-300 mx-1.5">·</span>
                )}
              </li>
            ))}
          </ul>
        </nav>

        <div className="prose prose-gray max-w-none space-y-10 text-gray-700">
          <section id="getting-started" className="scroll-mt-8">
            <h2 className="text-xl font-semibold text-gray-900 border-b border-gray-200 pb-2">
              1. Getting started
            </h2>
            <p>
              After you sign in, you land on the <strong>dashboard</strong>. The dashboard has two main tabs in the sidebar: <strong>Query Assistant</strong> (chat) and <strong>Collections</strong>. Under <strong>Query Assistant</strong>, type your question in the box at the bottom and press Enter or click Send. QueryAI searches the web and your uploaded documents (if any) and returns an answer with citations.
            </p>
            <p>
              Use the <strong>sidebar</strong> to switch between the Query Assistant and Collections tabs, open or search conversations, start a new chat, or filter by topic. Your <strong>account menu</strong> (avatar, top right) gives access to Profile, Settings, Subscription, and Sign out.
            </p>
          </section>

          <section id="who-its-for" className="scroll-mt-8">
            <h2 className="text-xl font-semibold text-gray-900 border-b border-gray-200 pb-2">
              2. Who it&apos;s for: how different users benefit
            </h2>
            <p className="mb-4">
              QueryAI is a fact research assistant that combines web search and your documents. Here is how different kinds of users can get the most from it:
            </p>
            <ul className="list-none space-y-4 pl-0">
              <li>
                <strong className="text-gray-900">University students</strong>
                <span className="block text-gray-600 mt-1">
                  Use QueryAI for essays, assignments, and papers: ask questions in plain language, get answers with citations you can cite. Upload lecture notes, readings, or PDFs and turn on <strong>Docs</strong> so answers draw from your course materials as well as the web. Create <strong>topics</strong> per course or assignment (e.g. &quot;Economics 101&quot;, &quot;Research methods&quot;) and use research mode to keep conversations focused. Export conversations to PDF or text for your references.
                </span>
              </li>
              <li>
                <strong className="text-gray-900">Researchers &amp; academics</strong>
                <span className="block text-gray-600 mt-1">
                  Upload papers, reports, or datasets and combine them with web search for literature and context. Use <strong>topics</strong> to scope each conversation to a project or subfield. Rely on citations to verify and trace claims. Use <strong>Advanced RAG</strong> in Settings to tune how many document chunks and web results are used. Organize work with <strong>Collections</strong> and pin important conversations.
                </span>
              </li>
              <li>
                <strong className="text-gray-900">Professionals &amp; business users</strong>
                <span className="block text-gray-600 mt-1">
                  Fact-check claims, prepare briefs, or summarize internal docs. Upload policy docs, contracts, or reports and ask questions that mix your documents with the web. Use <strong>Search preferences</strong> and <strong>Citation preferences</strong> in Settings to match your workflow. Enterprise users can use <strong>Team collaboration</strong> for shared research and documents.
                </span>
              </li>
              <li>
                <strong className="text-gray-900">General users &amp; lifelong learners</strong>
                <span className="block text-gray-600 mt-1">
                  Use QueryAI to explore any topic with source-backed answers. Turn on <strong>Web</strong> for broad fact-checking and learning; add <strong>Docs</strong> when you have PDFs or notes you want included. Follow-up questions help you go deeper. No special syntax needed—just ask in plain language.
                </span>
              </li>
            </ul>
          </section>

          <section id="chat-research" className="scroll-mt-8">
            <h2 className="text-xl font-semibold text-gray-900 border-b border-gray-200 pb-2">
              3. Chat &amp; research
            </h2>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Ask anything</strong> – Type your question; answers stream in with source citations.</li>
              <li><strong>Web vs Docs</strong> – Use the source toggles (Web / Docs) above the input to include or exclude web search and your uploaded documents. At least one source is always on.</li>
              <li><strong>Citations</strong> – Click a citation number in the answer to open the source panel and see the exact snippet or link. Use the citation settings (gear icon) to change how citations appear.</li>
              <li><strong>Follow-up questions</strong> – After an answer, suggested follow-ups may appear; click one to ask it in the same conversation.</li>
              <li><strong>Research mode / topics</strong> – You can focus a conversation on a specific topic. When a topic is set, the assistant keeps answers scoped to that topic.</li>
            </ul>
          </section>

          <section id="conversations" className="scroll-mt-8">
            <h2 className="text-xl font-semibold text-gray-900 border-b border-gray-200 pb-2">
              4. Conversations
            </h2>
            <p>
              Each chat is a <strong>conversation</strong>. In the sidebar under Query Assistant you can:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>New chat</strong> – Start a new conversation.</li>
              <li><strong>Search</strong> – Search your conversations by title or content.</li>
              <li><strong>Rename</strong> – Open a conversation and edit its title if needed.</li>
              <li><strong>Pin</strong> – Pin important conversations so they stay at the top.</li>
              <li><strong>Delete</strong> – Remove a conversation from the list.</li>
              <li><strong>Export</strong> – Export the current conversation (e.g. as PDF or text) from the chat area.</li>
            </ul>
            <p className="mt-3">
              Use the <strong>Collections</strong> tab to group conversations into collections (e.g. by project or subject). You can save a conversation to a collection from the chat area.
            </p>
          </section>

          <section id="documents" className="scroll-mt-8">
            <h2 className="text-xl font-semibold text-gray-900 border-b border-gray-200 pb-2">
              5. Documents
            </h2>
            <p>
              Upload documents so QueryAI can search them and cite them in answers. Go to{' '}
              <Link href="/dashboard/settings/documents" className="text-orange-600 hover:underline">Settings → Documents</Link> to:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Upload</strong> – Add PDFs, Word docs, and other supported files. They are processed (extracted and indexed) before they appear in search.</li>
              <li><strong>View & metadata</strong> – Open a document to view it and edit its filename or metadata.</li>
              <li><strong>Delete</strong> – Remove a document from your library.</li>
              <li><strong>Clear processing</strong> – Clear extracted text and chunks for a document (e.g. to re-process). The file stays in storage.</li>
              <li><strong>Topics</strong> – Tag documents with topics to better organize and filter them.</li>
            </ul>
          </section>

          <section id="topics" className="scroll-mt-8">
            <h2 className="text-xl font-semibold text-gray-900 border-b border-gray-200 pb-2">
              6. Topics
            </h2>
            <p>
              <strong>Topics</strong> help you organize research (e.g. &quot;Legal&quot;, &quot;Market data&quot;). Manage them under{' '}
              <Link href="/dashboard/settings/topics" className="text-orange-600 hover:underline">Settings → Topics</Link>:
              create, edit, or delete topics. You can assign a topic to a conversation or to documents so that
              answers and search stay focused when you use topic filters.
            </p>
          </section>

          <section id="settings" className="scroll-mt-8">
            <h2 className="text-xl font-semibold text-gray-900 border-b border-gray-200 pb-2">
              7. Settings
            </h2>
            <p>
              Open <strong>Settings</strong> from your account menu or the sidebar. Available sections:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Profile</strong> – Name, email, and account details.</li>
              <li><strong>Search preferences</strong> – Default search and web/document options.</li>
              <li><strong>Citation preferences</strong> – How citations look (e.g. numbers, style).</li>
              <li><strong>Advanced RAG</strong> – Fine-tune document retrieval (chunks, scoring).</li>
              <li><strong>Subscription</strong> – Plan and billing.</li>
              <li><strong>Documents</strong> – Upload and manage documents.</li>
              <li><strong>Topics</strong> – Create and manage topics.</li>
              <li><strong>Team collaboration</strong> – For Enterprise plans: manage team members and collaboration.</li>
            </ul>
          </section>

          <section id="account" className="scroll-mt-8">
            <h2 className="text-xl font-semibold text-gray-900 border-b border-gray-200 pb-2">
              8. Account &amp; privacy
            </h2>
            <p>
              Click your <strong>avatar</strong> (top right) to open the account menu. From there you can go to
              Profile, Settings, Subscription, and <strong>Sign out</strong>. You can also toggle{' '}
              <strong>Private mode</strong> so that your activity is not used for product improvements (when available).
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            Need more? Check our{' '}
            <Link href="/terms" className="text-orange-600 hover:underline">Terms</Link>,{' '}
            <Link href="/privacy" className="text-orange-600 hover:underline">Privacy</Link>, and{' '}
            <Link href="/cookie-policy" className="text-orange-600 hover:underline">Cookie policy</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
