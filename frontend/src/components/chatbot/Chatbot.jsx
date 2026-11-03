import { useEffect, useRef, useState } from 'react';
import { sendChatMessage } from '../../services/chatService';

const initialMessage = {
  role: 'assistant',
  content:
    "Hi! I'm AiDocInsight. Ask me anything about your project analysis, architecture, folder structure, recommendations, or test cases.",
};

export default function Chatbot({ projectId }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([initialMessage]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const handleSubmit = async (event) => {
    event?.preventDefault();
    const question = input.trim();

    if (!question || sending) return;

    setError('');
    setInput('');
    setMessages((current) => [...current, { role: 'user', content: question }]);
    setSending(true);

    try {
      const answer = await sendChatMessage(projectId, question);
      setMessages((current) => [
        ...current,
        { role: 'assistant', content: answer || 'The assistant returned an empty response.' },
      ]);
    } catch (requestError) {
      const message = requestError.message || 'Unable to get an AI response right now.';
      setError(message);
      setMessages((current) => [
        ...current,
        { role: 'assistant', content: `I couldn't answer that: ${message}` },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit(event);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 sm:bottom-6 sm:right-6">
      <section
        aria-label="AiDocInsight AI Project Assistant"
        className={`absolute bottom-16 right-0 w-[calc(100vw-2rem)] max-w-[390px] origin-bottom-right overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl transition-all duration-200 sm:bottom-20 ${
          open
            ? 'pointer-events-auto translate-y-0 scale-100 opacity-100'
            : 'pointer-events-none translate-y-3 scale-95 opacity-0'
        }`}
      >
        <header className="flex items-center justify-between bg-teal-700 px-4 py-3 text-white">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-xl" aria-hidden="true">
              🤖
            </span>
            <div>
              <h2 className="text-sm font-semibold">AiDocInsight</h2>
              <p className="text-xs text-teal-100">AI Project Assistant</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close AI assistant"
            className="rounded-full p-2 text-lg leading-none text-teal-100 hover:bg-white/10 hover:text-white"
          >
            ×
          </button>
        </header>

        <div className="h-[min(430px,calc(100vh-12rem))] overflow-y-auto bg-slate-50 p-4" aria-live="polite">
          <div className="space-y-3">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${
                    message.role === 'user'
                      ? 'rounded-br-sm bg-teal-700 text-white'
                      : 'rounded-bl-sm border border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}

            {sending ? (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                  <span className="mr-1 inline-block animate-pulse">●</span>
                  <span className="mr-1 inline-block animate-pulse [animation-delay:150ms]">●</span>
                  <span className="inline-block animate-pulse [animation-delay:300ms]">●</span>
                  <span className="sr-only">Analyzing your project...</span>
                </div>
              </div>
            ) : null}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {error ? (
          <p className="border-t border-red-100 bg-red-50 px-4 py-2 text-xs text-red-700" role="alert">
            {error}
          </p>
        ) : null}

        <form onSubmit={handleSubmit} className="flex items-end gap-2 border-t border-slate-200 bg-white p-3">
          <label className="sr-only" htmlFor="project-chat-message">Ask about this project</label>
          <textarea
            id="project-chat-message"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            disabled={sending}
            rows={2}
            maxLength={2000}
            placeholder="Ask me anything about your project..."
            className="min-h-11 flex-1 resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-50"
          />
          <button
            type="submit"
            aria-label="Send message"
            disabled={sending || !input.trim()}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-teal-700 text-lg text-white hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            ➤
          </button>
        </form>
      </section>

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label={open ? 'Close AI assistant' : 'Open AI assistant'}
        aria-expanded={open}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-700 text-2xl text-white shadow-lg ring-4 ring-white transition-transform duration-200 hover:scale-105 hover:bg-teal-600 focus:outline-none focus:ring-4 focus:ring-teal-200"
      >
        {open ? '×' : '🤖'}
      </button>
    </div>
  );
}
