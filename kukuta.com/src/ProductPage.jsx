import React from 'react';

export default function ProductPage({ products = [], onAddToCart = () => {}, onContactSeller = () => {}, onViewProduct = () => {}, onToggleWishlist = () => {}, wishlist = [], currentUser = null }) {
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
          className="product-card clickable"
          onClick={() => onViewProduct(p.id)}
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onViewProduct(p.id); }}
        >
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
          <div className="product-media">{p.image ? <img className="product-image-media" src={p.image} alt={p.name} /> : <span className="product-placeholder">🥚</span>}</div>
          <div className="product-body">
            <h3 className="product-title">{p.name}</h3>
            <div className="product-meta">
              <span className="product-price">{p.price || formatPrice(p.price)}</span>
              <span className="product-seller">{p.seller || 'Seller'}</span>
            </div>
            <p className="product-description">{p.description}</p>
          </div>
        </article>
      ))}
    </section>
  );
}
