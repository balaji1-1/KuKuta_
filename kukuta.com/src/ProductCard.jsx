import React from 'react';

const getProductImage = (product) => {
  const imageUrl = product.image || product.image_url || product.images?.[0]?.image_url || product.images?.[0]?.image;
  const safeImageUrl = typeof imageUrl === 'string' ? imageUrl.trim() : '';

  if (safeImageUrl && /^https?:\/\//i.test(safeImageUrl)) {
    return <img src={safeImageUrl} alt={product.name || 'Product'} className="product-image-media" onError={(e) => { e.currentTarget.style.display = 'none'; }} />;
  }
  if (safeImageUrl && safeImageUrl.startsWith('/')) {
    return <img src={safeImageUrl} alt={product.name || 'Product'} className="product-image-media" onError={(e) => { e.currentTarget.style.display = 'none'; }} />;
  }
  if (safeImageUrl && safeImageUrl.includes('/media/')) {
    return <img src={safeImageUrl} alt={product.name || 'Product'} className="product-image-media" onError={(e) => { e.currentTarget.style.display = 'none'; }} />;
  }
  return <span className="product-image-emoji">{safeImageUrl || '🥚'}</span>;
};

export default function ProductCard({ product, isWishlisted, onToggleWishlist, onSelect, onAddToCart, onOrderNow, onContactSeller, currentUser }) {
  return (
    <div
      className="product-card clickable"
      onClick={() => onSelect && onSelect(product.id)}
    >
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
        <span className="product-category-badge">{product.category || 'Farm Fresh'}</span>
      </div>

      <div className="product-content">
        <div className="product-heading-row">
          <div>
            <span className="product-kicker">{product.category || 'Farm Fresh'}</span>
            <h3>{product.name}</h3>
          </div>
          <span className="price">{product.price}</span>
        </div>

        {product.seller && <p className="seller-info">by {product.seller}</p>}
        <p className="product-description">{product.description}</p>

        <div className="product-meta-row">
          <span className="product-quantity">Qty: {product.quantity ?? 1}</span>
          <span className="product-stock">Premium</span>
        </div>

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
}
