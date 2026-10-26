import React, { useEffect, useMemo, useRef, useState } from 'react';
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

export default function Messenger({ isOpen, onClose, product, products = [], currentUser, recipient, title = 'Messages', onConfirmBooking = () => {}, autoOpenConversation = false }) {
  const [allMessages, setAllMessages] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [sellerReviews, setSellerReviews] = useState([]);
  const [showAllSellerReviews, setShowAllSellerReviews] = useState(false);
  const [isReviewsOpen, setIsReviewsOpen] = useState(false);
  const [text, setText] = useState('');
  const [newChatUsername, setNewChatUsername] = useState('');
  const [newChatError, setNewChatError] = useState('');
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [draftConversation, setDraftConversation] = useState(null);
  const [sendError, setSendError] = useState('');
  const [bookingState, setBookingState] = useState(null);
  const [agreementAccess, setAgreementAccess] = useState(null);
  const [isPriceAgreementOpen, setIsPriceAgreementOpen] = useState(false);
  const [agreedPrice, setAgreedPrice] = useState('');
  const [priceSubmitting, setPriceSubmitting] = useState(false);
  const [priceError, setPriceError] = useState('');
  const startingFreshAgreementRef = useRef(false);
  const agreedPriceInputRef = useRef(null);
  const [selectedKey, setSelectedKey] = useState(null);
  const [selectedByUser, setSelectedByUser] = useState(false);
  const username = currentUser?.username;
  const initialKey = recipient ? `${recipient}::general` : null;

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
    if (initialKey && !grouped.has(initialKey) && recipient) {
      result.unshift({
        key: initialKey,
        contact: recipient,
        productId: product?.id || null,
        productName: product?.name || 'Direct conversation',
        messages: [],
        lastMessage: { content: 'Start a new conversation' },
        timestamp: Date.now(),
        unread: 0,
      });
    }
    if (draftConversation && !result.some((item) => item.key === draftConversation.key)) {
      result.unshift(draftConversation);
    }
    return result.sort((a, b) => b.timestamp - a.timestamp);
  }, [allMessages, draftConversation, initialKey, product, recipient, username]);

  const selectedConversation = selectedByUser
    ? conversations.find((item) => item.key === selectedKey) || null
    : null;
  const productFromConversation = selectedConversation?.productId
    ? products.find((item) => String(item.id) === String(selectedConversation.productId))
    : null;
  const selectedProduct = productFromConversation
    || (product && (!selectedConversation || String(product.id) === String(selectedConversation.productId)) ? product : null)
    || (selectedConversation?.productId
      ? { id: selectedConversation.productId, name: selectedConversation.productName, seller: selectedConversation.contact }
      : null);
  const selectedRecipient = selectedConversation?.contact || recipient || product?.seller || 'User';
  const selectedMessages = selectedConversation?.messages || [];
  const sellerAverage = sellerReviews.length > 0
    ? sellerReviews.reduce((total, review) => total + Number(review.rating || 0), 0) / sellerReviews.length
    : null;
  const currentUserIsAgreementBuyer = String(bookingState?.buyer_name || '').toLowerCase() === String(username || '').toLowerCase();
  const currentUserIsAgreementSeller = String(bookingState?.seller_name || '').toLowerCase() === String(username || '').toLowerCase();
  const priceAcceptedByCurrentUser = currentUserIsAgreementBuyer
    ? bookingState?.buyer_price_accepted
    : currentUserIsAgreementSeller
      ? bookingState?.seller_price_accepted
      : false;
  const priceMatchesAccepted = Number(agreedPrice) === Number(bookingState?.agreed_price);
  const priceLabel = Number(agreedPrice) > 0 ? `₹${Number(agreedPrice).toFixed(2)}` : 'this price';
  const listedPrice = Number(String(selectedProduct?.price || '').replace(/[^0-9.]/g, ''));
  const priceDifference = Number(agreedPrice) - listedPrice;

  useEffect(() => {
    setShowAllSellerReviews(false);
    setIsReviewsOpen(false);
  }, [selectedProduct?.id, selectedProduct?.seller]);

  useEffect(() => {
    setAgreementAccess(null);
    setIsPriceAgreementOpen(false);
    if (!isOpen || !selectedProduct?.id || !selectedRecipient) {
      setAgreementAccess(false);
      return undefined;
    }
    let mounted = true;
    setBookingState(null);
    setPriceError('');
    startingFreshAgreementRef.current = false;
    const params = new URLSearchParams({
      product_id: String(selectedProduct.id),
      participant: selectedRecipient,
    });
    const refreshAgreement = async () => {
      try {
        const response = await apiFetch(`/orders/price-agreement/?${params.toString()}`, { method: 'GET' });
        const data = response.ok ? await response.json() : null;
        if (!mounted) return;
        if (data) {
          setAgreementAccess(true);
          if (startingFreshAgreementRef.current && data.status === 'confirmed') return;
          setBookingState(data);
          if (document.activeElement !== agreedPriceInputRef.current) {
            setAgreedPrice(data.agreed_price != null
              ? String(data.agreed_price)
              : String(selectedProduct.price || '').replace(/[^0-9.]/g, ''));
          }
        } else {
          setAgreementAccess(false);
          setBookingState({ status: 'not_started', buyer_price_accepted: false, seller_price_accepted: false });
          setAgreedPrice(String(selectedProduct.price || '').replace(/[^0-9.]/g, ''));
        }
      } catch (error) {
        if (mounted) {
          setAgreementAccess(false);
          setBookingState({ status: 'not_started', buyer_price_accepted: false, seller_price_accepted: false });
          setAgreedPrice(String(selectedProduct.price || '').replace(/[^0-9.]/g, ''));
        }
      }
    };
    refreshAgreement();
    const timer = window.setInterval(refreshAgreement, 8000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [isOpen, selectedProduct?.id, selectedProduct?.price, selectedRecipient]);

  useEffect(() => {
    if (!isOpen || !currentUser) return undefined;
    let mounted = true;
    const loadMessages = async () => {
      try {
        const response = await apiFetch('/messages/', { method: 'GET' });
        const data = response.ok ? await response.json() : [];
        if (mounted && response.ok) {
          const fetchedMessages = Array.isArray(data) ? data : data.results || [];
          setAllMessages((previous) => [
            ...fetchedMessages,
            ...previous.filter((message) => String(message.id).startsWith('local-')),
          ]);
        }
      } catch (error) {
        if (mounted && allMessages.length === 0) setAllMessages([]);
      }
    };
    loadMessages();
    const timer = window.setInterval(loadMessages, 5000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
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
          setReviews(Array.isArray(productData) ? productData : productData.results || []);
          setSellerReviews(Array.isArray(sellerData) ? sellerData : sellerData.results || []);
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
    if (!text.trim() || !selectedRecipient) return;
    const local = {
      id: `local-${Date.now()}`,
      sender: currentUser?.id,
      sender_name: currentUser?.username || 'You',
      recipient_name: selectedRecipient,
      product: selectedProduct?.id || null,
      product_name: selectedProduct?.name || null,
      content: text.trim(),
      created_at: new Date().toISOString(),
      is_read: true,
    };
    setAllMessages((messages) => [...messages, local]);
    setText('');
    setSendError('');
    try {
      const body = { recipient: selectedRecipient, content: local.content };
      if (selectedProduct?.id) body.product_id = selectedProduct.id;
      const response = await apiFetch('/messages/', {
        method: 'POST',
        body,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setAllMessages((messages) => messages.filter((message) => message.id !== local.id));
        setText(local.content);
        setSendError(data.error || 'Message could not be sent. Check the username and try again.');
        return;
      }
      setAllMessages((messages) => messages.map((message) => message.id === local.id ? data : message));
    } catch (error) {
      setAllMessages((messages) => messages.filter((message) => message.id !== local.id));
      setText(local.content);
      setSendError('Message could not be sent. Check your connection and try again.');
    }
  };

  const startNewChat = (event) => {
    event.preventDefault();
    const contact = newChatUsername.trim();
    if (!contact) {
      setNewChatError('Enter a username to start a chat.');
      return;
    }
    if (contact.toLowerCase() === String(username || '').toLowerCase()) {
      setNewChatError('Choose another user to start a chat.');
      return;
    }
    const conversation = {
      key: `${contact}::general`,
      contact,
      productId: null,
      productName: 'Direct conversation',
      messages: [],
      lastMessage: { content: 'Start a conversation' },
      timestamp: Date.now(),
      unread: 0,
    };
    setDraftConversation(conversation);
    setSelectedKey(conversation.key);
    setSelectedByUser(true);
    setNewChatUsername('');
    setNewChatError('');
    setIsNewChatOpen(false);
    setText('');
    setSendError('');
  };

  const acceptPrice = async () => {
    if (agreementAccess !== true || !Number.isFinite(Number(agreedPrice)) || Number(agreedPrice) <= 0 || priceSubmitting) return;
    setPriceSubmitting(true);
    setPriceError('');
    try {
      const data = await onConfirmBooking(agreedPrice, bookingState?.id);
      if (data) {
        setBookingState(data);
        setAgreedPrice(String(data.agreed_price));
        startingFreshAgreementRef.current = false;
      } else {
        setPriceError('Price acceptance could not be saved. Try again.');
      }
    } finally {
      setPriceSubmitting(false);
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
            <span className="messenger-status"><i /> Private messages</span>
          </div>
        </div>
        <button className="messenger-close" onClick={onClose} aria-label="Close messages">×</button>
      </div>
      <div className={`messenger-layout ${selectedConversation ? 'selected' : 'list-only'}`}>
        {!selectedConversation && <nav className="conversation-list" aria-label="Conversations">
          <div className="conversation-list-heading">
            <strong>Chats</strong>
            <button type="button" className="messenger-new-chat-toggle" onClick={() => { setIsNewChatOpen((open) => !open); setNewChatError(''); }}>
              {isNewChatOpen ? 'Cancel' : '+ New chat'}
            </button>
          </div>
          {isNewChatOpen && (
            <form className="messenger-new-chat-form" onSubmit={startNewChat}>
              <label htmlFor="messenger-new-chat-username">Start a direct message</label>
              <div>
                <input
                  id="messenger-new-chat-username"
                  value={newChatUsername}
                  onChange={(event) => { setNewChatUsername(event.target.value); setNewChatError(''); }}
                  placeholder="Enter username"
                  autoComplete="off"
                  required
                />
                <button type="submit" aria-label="Start chat">Start</button>
              </div>
              {newChatError && <span role="alert">{newChatError}</span>}
            </form>
          )}
          <span className="conversation-count">{conversations.length} conversation{conversations.length === 1 ? '' : 's'}</span>
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
              <div className="messenger-heading"><h2>{selectedRecipient}</h2><span className="messenger-status"><i /> <span className="messenger-role">{selectedProduct?.id ? `Product chat · ${selectedProduct.name}` : 'Direct message'}</span><span className="messenger-last-seen">Last seen recently</span></span></div>
            </div>
            <div className="messenger-chat-actions" aria-label="Conversation actions">
              <button type="button" aria-label="More options" title="More options">⋮</button>
            </div>
          </div>
          {selectedProduct?.id && <div className="messenger-context"><span className="messenger-context-label">Regarding</span><strong>{selectedProduct.name}</strong></div>}
          {selectedProduct?.id && (
            <button
              type="button"
              className="chat-price-toggle"
              aria-expanded={isPriceAgreementOpen}
              aria-controls="chat-price-agreement-panel"
              onClick={() => setIsPriceAgreementOpen((open) => !open)}
            >
              <span>Price agreement</span>
              <span aria-hidden="true">{isPriceAgreementOpen ? '−' : '+'}</span>
            </button>
          )}
          {selectedProduct?.id && isPriceAgreementOpen && agreementAccess === true && (
            <div id="chat-price-agreement-panel" className="booking-confirmation-box">
              <div className="chat-price-agreement-content">
              <div className="booking-confirmation-header">
                <strong>Price agreement</strong>
                <span>{bookingState?.status === 'confirmed' ? 'Order confirmed' : 'Both sides must accept'}</span>
              </div>
              <div className="chat-price-breakdown" aria-label={`Price breakdown for ${selectedProduct.name}`}>
                <div className="chat-price-breakdown-heading">
                  <span>Price breakdown</span>
                  <strong>{selectedProduct.name}</strong>
                </div>
                <div className="chat-price-breakdown-row">
                  <span>Listed price</span>
                  <strong>{selectedProduct.price || 'Not available'}</strong>
                </div>
                {selectedProduct.price_per_item && (
                  <div className="chat-price-breakdown-row">
                    <span>Each egg/chick</span>
                    <strong>{selectedProduct.price_per_item}</strong>
                  </div>
                )}
                {listedPrice > 0 && Number(agreedPrice) > 0 && (
                  <div className="chat-price-breakdown-row chat-price-difference">
                    <span>Difference from listing</span>
                    <strong>
                      {priceDifference === 0
                        ? 'At listing price'
                        : `₹${Math.abs(priceDifference).toFixed(2)} ${priceDifference > 0 ? 'above' : 'below'} listing`}
                    </strong>
                  </div>
                )}
              </div>
              <label className="booking-price-field">
                <span>Agreed amount</span>
                <span className="booking-price-input-wrap">
                  <span aria-hidden="true">₹</span>
                  <input
                    ref={agreedPriceInputRef}
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={agreedPrice}
                    onChange={(event) => setAgreedPrice(event.target.value)}
                    aria-label="Agreed product price"
                    disabled={bookingState?.status === 'confirmed'}
                  />
                </span>
              </label>
              <div className="booking-confirmation-status">
                <span className={bookingState?.buyer_price_accepted ? 'is-accepted' : ''}>{bookingState?.buyer_name || 'Participant 1'}: {bookingState?.buyer_price_accepted ? 'Accepted' : 'Waiting'}</span>
                <span className={bookingState?.seller_price_accepted ? 'is-accepted' : ''}>{bookingState?.seller_name || 'Participant 2'}: {bookingState?.seller_price_accepted ? 'Accepted' : 'Waiting'}</span>
              </div>
              <div className="booking-confirmation-note" role="status">
                {bookingState?.status === 'confirmed'
                  ? 'This confirmed order and agreed amount are now on both dashboards.'
                  : bookingState?.status === 'pending_price'
                    ? 'If either side changes the amount, both sides must accept it again.'
                    : 'The order will appear on both dashboards after both sides accept the same amount.'}
              </div>
              {priceError && <div className="booking-confirmation-note" role="alert">{priceError}</div>}
              </div>
              <button
                type="button"
                className="chat-confirm-btn"
                onClick={acceptPrice}
                disabled={priceSubmitting || bookingState?.status === 'confirmed' || (priceAcceptedByCurrentUser && priceMatchesAccepted) || Number(agreedPrice) <= 0}
              >
                {bookingState?.status === 'confirmed'
                  ? 'Price agreed'
                  : priceAcceptedByCurrentUser && priceMatchesAccepted
                    ? 'You accepted this price'
                    : priceSubmitting ? 'Saving...' : `Accept ${priceLabel}`}
              </button>
              {bookingState?.status === 'confirmed' && (
                <button
                  type="button"
                  className="chat-new-agreement-btn"
                  onClick={() => {
                    startingFreshAgreementRef.current = true;
                    setBookingState({ status: 'not_started', buyer_price_accepted: false, seller_price_accepted: false });
                    setAgreedPrice(String(selectedProduct.price || '').replace(/[^0-9.]/g, ''));
                  }}
                >
                  Start another order
                </button>
              )}
            </div>
          )}
          {selectedProduct?.id && isPriceAgreementOpen && agreementAccess === null && (
            <div id="chat-price-agreement-panel" className="booking-confirmation-box chat-price-unavailable" role="status">
              Checking price agreement access…
            </div>
          )}
          {selectedProduct?.id && isPriceAgreementOpen && agreementAccess === false && (
            <div id="chat-price-agreement-panel" className="booking-confirmation-box chat-price-unavailable">
              <strong>Price discussion for {selectedProduct.name}</strong>
              <div className="chat-price-breakdown-row">
                <span>Listed price</span>
                <strong>{selectedProduct.price || 'Not available'}</strong>
              </div>
              <p>Only this product’s seller and a buyer can accept a price and create an order.</p>
            </div>
          )}
          {selectedProduct?.id && currentUser.role === 'buyer' && (
            <section className="chat-reviews" aria-label={`Reviews for ${selectedProduct.name}`}>
              <button
                type="button"
                className="chat-reviews-toggle"
                aria-expanded={isReviewsOpen}
                aria-controls="chat-reviews-content"
                onClick={() => setIsReviewsOpen((open) => !open)}
              >
                <span>Product reviews</span>
                <span className="chat-reviews-count">{reviews.length}</span>
                <span aria-hidden="true">{isReviewsOpen ? '−' : '+'}</span>
              </button>
              {isReviewsOpen && (
                <div id="chat-reviews-content" className="chat-review-content">
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
                </div>
              )}
            </section>
          )}
          <div className="chat-window">
            <div className="messages-list" aria-live="polite">
              {selectedMessages.length === 0 ? <div className="chat-empty"><div className="chat-empty-icon">✦</div><strong>Start the conversation</strong><span>{selectedProduct?.id ? 'Send a message about this product.' : 'Send a message to start this direct conversation.'}</span></div> : selectedMessages.map((message) => { const senderName = message.sender_name || message.sender; const own = isOwnMessage(message, currentUser); return <div key={message.id} className={`chat-msg ${own ? 'me' : 'them'}`}><div className="msg-sender">{senderName || 'User'}</div><div className="msg-body">{messageText(message)}</div><div className="msg-time">{new Date(message.created_at || message.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</div></div>; })}
            </div>
            {sendError && <div className="messenger-send-error" role="alert">{sendError}</div>}
            <form className="chat-compose" onSubmit={(event) => { event.preventDefault(); sendMessage(); }}><input type="text" value={text} onChange={(event) => { setText(event.target.value); setSendError(''); }} placeholder="Write a message..." aria-label="Message" /><button className="chat-send" type="submit" disabled={!text.trim() || !selectedRecipient} aria-label="Send message" title="Send message">➤</button></form>
          </div>
        </section>}
      </div>
      </aside>
    </>
  );
}
