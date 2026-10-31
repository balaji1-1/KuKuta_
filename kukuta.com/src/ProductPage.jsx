import React from 'react';

const getCategoryLabel = (category) => {
  const normalizedCategory = String(category || '').trim();
  const labels = {
    'Egg*Chicks': 'Egg & Chicks',
    Cattel: 'Cattle',
  };
  return labels[normalizedCategory] || normalizedCategory || 'Farm Fresh';
};

const ProductPage = React.memo(function ProductPage({ products = [], onAddToCart = () => {}, onContactSeller = () => {}, onViewProduct = () => {}, onToggleWishlist = () => {}, wishlist = [], currentUser = null }) {
  const handleShareProduct = async (event, product) => {
    event.stopPropagation();
    const productName = product?.name || 'Kukuta product';
    const productPrice = product?.price || 'Check it out';
    const productUrl = typeof window !== 'undefined' ? window.location.href : 'https://kukuta.com';
    const shareText = `Check out ${productName} on Kukuta for ${productPrice}.`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: productName,
          text: shareText,
          url: productUrl,
        });
        return;
      }
    } catch (error) {
      if (error && error.name === 'AbortError') return;
    }

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(`${shareText} ${productUrl}`);
        window.alert('Product link copied to clipboard.');
        return;
      }

      const tempInput = document.createElement('textarea');
      tempInput.value = `${shareText} ${productUrl}`;
      document.body.appendChild(tempInput);
      tempInput.select();
      document.execCommand('copy');
      document.body.removeChild(tempInput);
      window.alert('Product link copied to clipboard.');
    } catch (error) {
      window.alert('Sharing is not supported in this browser.');
    }
  };

  if (!products || products.length === 0) {
    return (
      <section className="product-list empty">
        <h2>Products</h2>
        <p>No products available right now.</p>
      </section>
    );
  }
  // display products with newest first by reversing incoming array
  const displayProducts = Array.isArray(products) ? [...products].reverse() : [];

  return (
    <section className="product-grid">
      {displayProducts.map((p) => (
        <article
          key={p.id}
          className="product-card clickable product-grid-card-enter"
          onClick={() => onViewProduct(p.id)}
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onViewProduct(p.id); }}
        >
          <button
            className="share-btn home-share-btn"
            aria-label={`Share ${p.name}`}
            title="Share product"
            onClick={(event) => handleShareProduct(event, p)}
          >
            ↗
          </button>

          {currentUser && (
            <button
              className={`wish-btn home-wish-btn ${wishlist.includes(p.id) ? 'active' : ''}`}
              aria-label={wishlist.includes(p.id) ? `Remove ${p.name} from wishlist` : `Add ${p.name} to wishlist`}
              title={wishlist.includes(p.id) ? 'Remove from wishlist' : 'Add to wishlist'}
              onClick={(e) => {
                e.stopPropagation();
                onToggleWishlist(p);
              }}
            >
              {wishlist.includes(p.id) ? '♥' : '♡'}
            </button>
          )}
          <div className="product-media">{p.image ? <img className="product-image-media" src={p.image} alt={p.name} loading="lazy" decoding="async" /> : <span className="product-placeholder">🥚</span>}</div>
          <div className="product-body">
            <h3 className="product-title">{p.name}</h3>
            <div className="product-meta">
              <span className="product-price">{p.price || formatPrice(p.price)}</span>
              <span className="product-seller">{p.seller || 'Seller'}</span>
            </div>
            {p.category === 'Egg*Chicks' && p.price_per_item && (
              <div className="product-unit-price">
                <span>Each egg/chick</span>
                <strong>{p.price_per_item}</strong>
              </div>
            )}
            <p className="product-description">{p.description}</p>
            {p.category === 'Egg*Chicks' && (p.age || p.days_old) && (
              <div className="product-meta product-meta-livestock">
                {p.age && <span>Age: {p.age}</span>}
                {p.days_old && <span>Days old: {p.days_old}</span>}
              </div>
            )}
          </div>
        </article>
      ))}
    </section>
  );
});

export default ProductPage;
