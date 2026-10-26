import React from 'react';

const getCategoryLabel = (category) => {
  const normalizedCategory = String(category || '').trim();
  const labels = {
    'Egg*Chicks': 'Egg & Chicks',
    Cattel: 'Cattle',
  };
  return labels[normalizedCategory] || normalizedCategory || 'Farm Fresh';
};

const getProductImage = (product) => {
  const imageUrl = product.image || product.image_url || product.images?.[0]?.image_url || product.images?.[0]?.image;
  const safeImageUrl = typeof imageUrl === 'string' ? imageUrl.trim() : '';

  if (safeImageUrl && /^https?:\/\//i.test(safeImageUrl)) {
    return <img src={safeImageUrl} alt={product.name || 'Product'} className="product-image-media" loading="lazy" decoding="async" fetchPriority="low" onError={(e) => { e.currentTarget.style.display = 'none'; }} />;
  }
  if (safeImageUrl && safeImageUrl.startsWith('/')) {
    return <img src={safeImageUrl} alt={product.name || 'Product'} className="product-image-media" loading="lazy" decoding="async" fetchPriority="low" onError={(e) => { e.currentTarget.style.display = 'none'; }} />;
  }
  if (safeImageUrl && safeImageUrl.includes('/media/')) {
    return <img src={safeImageUrl} alt={product.name || 'Product'} className="product-image-media" loading="lazy" decoding="async" fetchPriority="low" onError={(e) => { e.currentTarget.style.display = 'none'; }} />;
  }
  return <span className="product-image-emoji">{safeImageUrl || '🥚'}</span>;
};

const ProductCard = React.memo(function ProductCard({ product, isWishlisted, onToggleWishlist, onSelect, onAddToCart, onOrderNow, onContactSeller, currentUser }) {
  const handleShareProduct = async (event) => {
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

  return (
    <div
      className="product-card clickable"
      onClick={() => onSelect && onSelect(product.id)}
    >
      <button
        className="share-btn"
        aria-label={`Share ${product?.name || 'product'}`}
        title="Share product"
        onClick={handleShareProduct}
      >
        ↗
      </button>

      {currentUser && (
        <button
          className={`wish-btn ${isWishlisted ? 'active' : ''}`}
          aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          onClick={(e) => {
            e.stopPropagation();
            onToggleWishlist && onToggleWishlist(product);
          }}
        >
          {isWishlisted ? '♥' : '♡'}
        </button>
      )}

      <div className="product-image-wrap">
        <div className="product-image">{getProductImage(product)}</div>
        <span className="product-category-badge">{getCategoryLabel(product.category)}</span>
      </div>

      <div className="product-content">
        <div className="product-heading-row">
          <div>
            <span className="product-kicker">{getCategoryLabel(product.category)}</span>
            <h3>{product.name}</h3>
          </div>
          <span className="price">{product.price}</span>
        </div>

        {product.category === 'Egg*Chicks' && product.price_per_item && (
          <div className="product-unit-price">
            <span>Each egg/chick</span>
            <strong>{product.price_per_item}</strong>
          </div>
        )}

        {product.seller && <p className="seller-info">by {product.seller}</p>}
        <p className="product-description">{product.description}</p>

        <div className="product-meta-row">
          <span className="product-quantity">Qty: {product.quantity ?? 1}</span>
          <span className="product-stock">Premium</span>
        </div>

        {product.category === 'Egg*Chicks' && (product.age || product.days_old) && (
          <div className="product-meta-row livestock-meta-row">
            {product.age && <span className="product-age">Age: {product.age}</span>}
            {product.days_old && <span className="product-age">Days old: {product.days_old}</span>}
          </div>
        )}

        <div className="product-card-actions">
          {currentUser ? (
            <>
              <button
                className="shop-btn primary"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddToCart && onAddToCart(product);
                }}
              >
                Add to Cart
              </button>
              <button
                className="shop-btn secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  onOrderNow && onOrderNow(product);
                }}
              >
                Order Now
              </button>
            </>
          ) : (
            <span style={{ color: '#999', fontSize: '0.9rem', textAlign: 'center' }}>Login to shop</span>
          )}
        </div>

        {currentUser?.role === 'buyer' && (
          <button
            className="shop-btn link"
            onClick={(e) => {
              e.stopPropagation();
              onContactSeller && onContactSeller(product);
            }}
          >
            Contact Seller
          </button>
        )}
      </div>
    </div>
  );
});

export default ProductCard;
