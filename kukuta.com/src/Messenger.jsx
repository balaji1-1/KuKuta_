import React, { useEffect, useMemo, useState } from 'react';
import apiFetch from './api';

const threadKey = (message, username) => {
  const sender = message.sender_name || message.sender;
  const recipient = message.recipient_name || message.recipient;
  const other = String(sender) === String(username) ? recipient : sender;
  return `${other || 'User'}::general`;
};

const messageText = (message) => message.content || message.message || '';

const isOwnMessage = (message, currentUser) => (
  String(message.sender_name || message.sender) === String(currentUser?.username)
  || String(message.sender) === String(currentUser?.id)
);

export default function Messenger({ isOpen, onClose, product, currentUser, recipient, title = 'Messages', bookingStatus = null, onConfirmBooking = () => {}, autoOpenConversation = false }) {
  const [allMessages, setAllMessages] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [sellerReviews, setSellerReviews] = useState([]);
  const [showAllSellerReviews, setShowAllSellerReviews] = useState(false);
  const [text, setText] = useState('');
  const [selectedKey, setSelectedKey] = useState(null);
  const [selectedByUser, setSelectedByUser] = useState(false);
  const username = currentUser?.username;
  const initialKey = product && recipient ? `${recipient}::general` : null;

  const conversations = useMemo(() => {
    const grouped = new Map();
    allMessages.forEach((message) => {
      const key = threadKey(message, username);
      const sender = message.sender_name || message.sender;
      const recipientName = message.recipient_name || message.recipient;
      const timestamp = new Date(message.created_at || message.at || 0).getTime();
      const existing = grouped.get(key);
      if (!existing) {
        grouped.set(key, {
          key,
          contact: String(sender) === String(username) ? recipientName : sender,
          productId: message.product || message.product_id || null,
          productName: message.product_name || 'General conversation',
          messages: [message],
          lastMessage: message,
          timestamp,
          unread: message.is_read === false && String(recipientName) === String(username) ? 1 : 0,
        });
      } else {
        existing.messages.push(message);
        if (timestamp >= existing.timestamp) {
          existing.timestamp = timestamp;
          existing.lastMessage = message;
          existing.productName = message.product_name || existing.productName;
        }
        if (message.is_read === false && String(recipientName) === String(username)) existing.unread += 1;
      }
    });
    const result = Array.from(grouped.values());
    if (initialKey && !grouped.has(initialKey) && product && recipient) {
      result.unshift({
        key: initialKey,
        contact: recipient,
        productId: product.id,
        productName: product.name,
        messages: [],
        lastMessage: { content: 'Start a new conversation' },
        timestamp: Date.now(),
        unread: 0,
      });
    }
    return result.sort((a, b) => b.timestamp - a.timestamp);
  }, [allMessages, initialKey, product, recipient, username]);

  const selectedConversation = selectedByUser
    ? conversations.find((item) => item.key === selectedKey) || null
    : null;
  const selectedProduct = product && selectedConversation?.contact === recipient
    ? product
    : selectedConversation?.productId
      ? { id: selectedConversation.productId, name: selectedConversation.productName, seller: selectedConversation.contact }
      : product;
  const selectedRecipient = selectedConversation?.contact || recipient || product?.seller || 'User';
  const selectedMessages = selectedConversation?.messages || [];
  const otherRole = currentUser?.role === 'seller' ? 'Buyer' : 'Seller';
  const sellerAverage = sellerReviews.length > 0
    ? sellerReviews.reduce((total, review) => total + Number(review.rating || 0), 0) / sellerReviews.length
    : null;
  const bookingState = bookingStatus || { buyerConfirmed: false, sellerConfirmed: false, status: 'Waiting for both sides to confirm this order.' };

  useEffect(() => {
    setShowAllSellerReviews(false);
  }, [selectedProduct?.id, selectedProduct?.seller]);

  useEffect(() => {
    if (!isOpen || !currentUser) return undefined;
    let mounted = true;
    (async () => {
      try {
        const response = await apiFetch('/messages/', { method: 'GET' });
        const data = response.ok ? await response.json() : [];
        if (mounted) setAllMessages(Array.isArray(data) ? data : []);
      } catch (error) {
        if (mounted) setAllMessages([]);
      }
    })();
    return () => { mounted = false; };
  }, [isOpen, currentUser]);

  useEffect(() => {
    if (!isOpen || !selectedProduct?.id) return undefined;
    let mounted = true;
    (async () => {
      try {
        const [productResponse, sellerResponse] = await Promise.all([
          apiFetch(`/reviews/?product=${selectedProduct.id}`, { method: 'GET' }),
          apiFetch(`/reviews/?seller=${encodeURIComponent(selectedProduct.seller || '')}`, { method: 'GET' }),
        ]);
        const productData = productResponse.ok ? await productResponse.json() : [];
        const sellerData = sellerResponse.ok ? await sellerResponse.json() : [];
        if (mounted) {
          setReviews(Array.isArray(productData) ? productData : []);
          setSellerReviews(Array.isArray(sellerData) ? sellerData : []);
        }
      } catch (error) {
        if (mounted) {
          setReviews([]);
          setSellerReviews([]);
        }
      }
    })();
    return () => { mounted = false; };
  }, [isOpen, selectedProduct?.id, selectedProduct?.seller]);

  useEffect(() => {
    setSelectedKey(initialKey);
    setSelectedByUser(autoOpenConversation);
  }, [autoOpenConversation, initialKey]);

  const sendMessage = async () => {
    if (!text.trim() || !selectedRecipient || !selectedProduct?.id) return;
    const local = {
      id: `local-${Date.now()}`,
      sender: currentUser?.id,
      sender_name: currentUser?.username || 'You',
      recipient_name: selectedRecipient,
      product: selectedProduct.id,
      product_name: selectedProduct.name,
      content: text.trim(),
      created_at: new Date().toISOString(),
      is_read: true,
    };
    setAllMessages((messages) => [...messages, local]);
    setText('');
    try {
      const response = await apiFetch('/messages/', {
        method: 'POST',
        body: { recipient: selectedRecipient, content: local.content, product_id: selectedProduct.id },
      });
      const data = await response.json();
      if (response.ok) setAllMessages((messages) => messages.map((message) => message.id === local.id ? data : message));
    } catch (error) {
      // Keep the optimistic message visible if the network is unavailable.
    }
  };

  if (!isOpen || !currentUser) return null;

  return (
    <>
      <button type="button" className="messenger-backdrop" onClick={onClose} aria-label="Close messages" tabIndex="-1" />
      <aside className="messenger-panel" aria-label="Messages">
      <div className="messenger-header">
        <div className="messenger-identity">
          <div className="messenger-avatar" aria-hidden="true">✦</div>
          <div className="messenger-heading">
            <h2>{title}</h2>
            <span className="messenger-status"><i /> Separate conversations</span>
          </div>
        </div>
        <button className="messenger-close" onClick={onClose} aria-label="Close messages">×</button>
      </div>
      <div className={`messenger-layout ${selectedConversation ? 'selected' : 'list-only'}`}>
        {!selectedConversation && <nav className="conversation-list" aria-label="Conversations">
          <div className="conversation-list-heading"><strong>Chats</strong><span>{conversations.length}</span></div>
          {conversations.length === 0 ? (
            <div className="conversation-empty">Your conversations will appear here.</div>
          ) : conversations.map((conversation) => (
            <button type="button" key={conversation.key} className="conversation-item" onClick={() => { setSelectedKey(conversation.key); setSelectedByUser(true); }}>
              <span className="conversation-avatar">{conversation.contact?.charAt(0).toUpperCase() || '?'}</span>
              <span className="conversation-copy">
                <span className="conversation-topline"><strong>{conversation.contact || 'User'}</strong><time>{conversation.timestamp ? new Date(conversation.timestamp).toLocaleDateString() : ''}</time></span>
                <span className="conversation-product">{conversation.productName}</span>
                <span className="conversation-preview">{messageText(conversation.lastMessage)}</span>
              </span>
              {conversation.unread > 0 && <span className="conversation-unread">{conversation.unread}</span>}
            </button>
          ))}
        </nav>}
        {selectedConversation && <section className="conversation-detail" aria-label={`Conversation with ${selectedRecipient}`}>
          <div className="conversation-detail-header">
            <button type="button" className="conversation-back" onClick={() => { setSelectedKey(null); setSelectedByUser(false); }} aria-label="Back to chats">← <span>Chats</span></button>
            <div className="messenger-identity">
              <div className="messenger-avatar" aria-hidden="true">{selectedRecipient.charAt(0).toUpperCase()}</div>
              <div className="messenger-heading"><h2>{selectedRecipient}</h2><span className="messenger-status"><i /> <span className="messenger-role">{otherRole} · {selectedProduct?.name || 'Conversation'}</span><span className="messenger-last-seen">Last seen recently</span></span></div>
            </div>
            <div className="messenger-chat-actions" aria-label="Conversation actions">
              <button type="button" aria-label="More options" title="More options">⋮</button>
            </div>
          </div>
          {selectedProduct && <div className="messenger-context"><span className="messenger-context-label">Regarding</span><strong>{selectedProduct.name}</strong></div>}
          {selectedProduct && (
            <div className="booking-confirmation-box">
              <div className="booking-confirmation-header"><strong>Order booking</strong><button type="button" className="chat-confirm-btn" onClick={onConfirmBooking} disabled={bookingState.buyerConfirmed && bookingState.sellerConfirmed}>{bookingState.buyerConfirmed && bookingState.sellerConfirmed ? 'Booked & confirmed' : currentUser.role === 'buyer' ? (bookingState.buyerConfirmed ? 'Confirmed' : 'Confirm booking') : (bookingState.sellerConfirmed ? 'Confirmed' : 'Confirm order')}</button></div>
              <div className="booking-confirmation-status"><span>Buyer: {bookingState.buyerConfirmed ? 'Confirmed' : 'Pending'}</span><span>Seller: {bookingState.sellerConfirmed ? 'Confirmed' : 'Pending'}</span></div>
              <div className="booking-confirmation-note">{bookingState.status}</div>
            </div>
          )}
          {selectedProduct && currentUser.role === 'buyer' && <section className="chat-reviews" aria-label={`Reviews for ${selectedProduct.name}`}>
            <div className="chat-reviews-heading"><strong>Product reviews</strong><span>{reviews.length}</span></div>
            {reviews.length > 0 ? <div className="chat-reviews-list">{reviews.map((review) => <article className="chat-review" key={review.id}><div className="chat-review-meta"><strong>{review.buyer_name || 'Buyer'}</strong><span>{'★'.repeat(review.rating)}</span></div><p>{review.comment}</p></article>)}</div> : <span className="chat-reviews-empty">No reviews yet.</span>}
            <div className="chat-seller-review-summary">
              <div className="chat-reviews-heading"><strong>Seller rating</strong><span>{sellerReviews.length} review{sellerReviews.length === 1 ? '' : 's'}</span></div>
              <div className="chat-seller-rating-value">{sellerAverage !== null ? <>★ {sellerAverage.toFixed(1)}<small>/5</small></> : 'No rating yet'}</div>
              {sellerAverage !== null && sellerAverage < 3 && <div className="seller-fraud-alert chat-seller-caution" role="alert">
                <span className="seller-fraud-alert-icon" aria-hidden="true">!</span>
                <div>
                  <span className="seller-fraud-alert-label">Buyer safety notice</span>
                  <strong>Caution: low-rated seller</strong>
                  <span>Review the seller feedback carefully before booking.</span>
                </div>
              </div>}
              {sellerReviews.length > 0 && <button type="button" className="chat-view-reviews" onClick={() => setShowAllSellerReviews((visible) => !visible)}>{showAllSellerReviews ? 'Hide seller reviews' : 'View all seller reviews'}</button>}
            </div>
            {showAllSellerReviews && <div className="chat-reviews-list">{sellerReviews.map((review) => <article className="chat-review" key={`seller-${review.id}`}><div className="chat-review-meta"><strong>{review.buyer_name || 'Buyer'}</strong><span>{'★'.repeat(review.rating)}</span></div><p>{review.comment}</p></article>)}</div>}
          </section>}
          <div className="chat-window">
            <div className="messages-list" aria-live="polite">
              {selectedMessages.length === 0 ? <div className="chat-empty"><div className="chat-empty-icon">✦</div><strong>Start the conversation</strong><span>Send a message about this product.</span></div> : selectedMessages.map((message) => { const senderName = message.sender_name || message.sender; const own = isOwnMessage(message, currentUser); return <div key={message.id} className={`chat-msg ${own ? 'me' : 'them'}`}><div className="msg-sender">{senderName || 'User'}</div><div className="msg-body">{messageText(message)}</div><div className="msg-time">{new Date(message.created_at || message.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</div></div>; })}
            </div>
            <form className="chat-compose" onSubmit={(event) => { event.preventDefault(); sendMessage(); }}><button type="button" className="chat-compose-icon" aria-label="Add emoji" title="Add emoji">☺</button><input type="text" value={text} onChange={(event) => setText(event.target.value)} placeholder="Write a message..." aria-label="Message" /><button type="button" className="chat-compose-icon" aria-label="Attach file" title="Attach file">⌕</button><button className="chat-send" type="submit" disabled={!text.trim() || !selectedRecipient} aria-label="Send message" title="Send message">➤</button></form>
          </div>
        </section>}
      </div>
      </aside>
    </>
  );
}
