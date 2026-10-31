import React, { useEffect, useRef, useState } from 'react';

const QUICK_TOPICS = [
  'Orders and agreements',
  'Account help',
  'Buying safely',
  'Selling on Kukuta',
];

const getSupportReply = (message) => {
  const text = message.toLowerCase();

  if (/order|booking|agreement|track|status/.test(text)) {
    return 'You can review confirmed orders and agreed amounts in your Buyer Dashboard. Sellers can review sales in the Seller Dashboard. Open your profile menu and choose the matching dashboard.';
  }

  if (/account|login|log in|password|sign.?in|reset/.test(text)) {
    return 'Use Login in the top navigation. If you have forgotten your password, choose “Forgot Password?” in the login window and follow the reset steps.';
  }

  if (/safe|safety|payment|pay|scam|fraud|otp|password/.test(text)) {
    return 'For your safety, keep conversations and payments on Kukuta. Check seller reviews before ordering, and never share your password or one-time verification codes.';
  }

  if (/sell|seller|list|product|listing|upload/.test(text)) {
    return 'To list an item, sign in with a seller account, open your profile menu, and choose “Add product.” Add clear details and photos so buyers can understand your listing.';
  }

  if (/contact|message|chat/.test(text)) {
    return 'To ask about a listing, open the product and choose “Contact Seller.” You need to be signed in to start a buyer-seller conversation.';
  }

  return 'I can help with orders and agreements, account access, buying safely, or selling on Kukuta. Choose a topic above or ask me about one of those.';
};

export default function SupportChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [conversation, setConversation] = useState([
    {
      id: 'welcome',
      sender: 'assistant',
      text: 'Hi! I’m Kukuta’s automated support assistant. I can help with common account, order, safety, and seller questions. This chat does not connect to a live agent.',
    },
  ]);
  const messageListRef = useRef(null);
  const inputRef = useRef(null);
  const messageIdRef = useRef(0);

  useEffect(() => {
    if (!isOpen) return undefined;

    messageListRef.current?.scrollTo({
      top: messageListRef.current.scrollHeight,
      behavior: 'smooth',
    });
    inputRef.current?.focus();
    return undefined;
  }, [conversation, isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const sendMessage = (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const messageId = messageIdRef.current;
    messageIdRef.current += 1;
    setConversation((previous) => [
      ...previous,
      { id: `${messageId}-user`, sender: 'user', text: trimmed },
      { id: `${messageId}-assistant`, sender: 'assistant', text: getSupportReply(trimmed) },
    ]);
    setMessage('');
  };

  return (
    <div className={`support-chat${isOpen ? ' is-open' : ''}`}>
      {isOpen && (
        <section id="support-chat-panel" className="support-chat-panel" role="dialog" aria-modal="false" aria-labelledby="support-chat-title">
          <header className="support-chat-header">
            <div className="support-chat-brand" aria-hidden="true">K</div>
            <div className="support-chat-heading">
              <h2 id="support-chat-title">Kukuta Support</h2>
              <span><i aria-hidden="true" /> Automated help</span>
            </div>
            <button type="button" className="support-chat-close" onClick={() => setIsOpen(false)} aria-label="Close support chat">
              ×
            </button>
          </header>

          <div className="support-chat-messages" ref={messageListRef} role="log" aria-live="polite" aria-relevant="additions">
            {conversation.map((entry) => (
              <div className={`support-chat-message ${entry.sender}`} key={entry.id}>
                {entry.sender === 'assistant' && <span className="support-message-avatar" aria-hidden="true">K</span>}
                <p>{entry.text}</p>
              </div>
            ))}

            {conversation.length === 1 && (
              <div className="support-chat-topics" aria-label="Common help topics">
                {QUICK_TOPICS.map((topic) => (
                  <button type="button" key={topic} onClick={() => sendMessage(topic)}>
                    {topic}
                  </button>
                ))}
              </div>
            )}
          </div>

          <form
            className="support-chat-compose"
            onSubmit={(event) => {
              event.preventDefault();
              sendMessage(message);
            }}
          >
            <label className="visually-hidden" htmlFor="support-chat-message">Ask Kukuta Support</label>
            <input
              id="support-chat-message"
              ref={inputRef}
              type="text"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Ask us a question..."
              maxLength={500}
              autoComplete="off"
            />
            <button type="submit" disabled={!message.trim()} aria-label="Send message">
              <span aria-hidden="true">↑</span>
            </button>
          </form>
          <p className="support-chat-disclaimer">Automated help · Don’t share passwords or verification codes.</p>
        </section>
      )}

      <button
        type="button"
        className="support-chat-launcher"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-controls="support-chat-panel"
        aria-label={isOpen ? 'Close support chat' : 'Open customer support chat'}
      >
        {isOpen ? <span aria-hidden="true">×</span> : <><span className="support-chat-launcher-icon" aria-hidden="true">?</span><span className="support-chat-launcher-label">Help</span></>}
      </button>
    </div>
  );
}
