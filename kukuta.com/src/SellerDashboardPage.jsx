import React, { useMemo } from 'react';
import { VirtualList } from './performance.jsx';

const CURRENCY_SYMBOL = '₹';

const parsePrice = (price) => parseFloat(String(price).replace(/[^0-9.-]+/g, '')) || 0;
const formatPrice = (amount) => `${CURRENCY_SYMBOL}${Number(amount).toFixed(2)}`;

export function BuyerOrderHistoryPage({ orders, currentUsername, onClose, onOpenInvoice }) {
  const totalSpent = useMemo(() => orders.reduce((sum, order) => sum + parsePrice(order.price), 0), [orders]);
  const totalOrders = orders.length;

  return (
    <section className="dashboard-section buyer-history">
      <div className="dashboard-header">
        <div className="dashboard-title-block">
          <span className="dashboard-eyebrow">Purchase activity</span>
          <h2>Buyer Dashboard</h2>
          <p>Review your confirmed orders and agreed amounts.</p>
        </div>
        <button className="close-dashboard-btn" onClick={onClose}>× Back to products</button>
      </div>
      <div className="dashboard-panel">
        <div className="dashboard-summary">
          <div className="dashboard-metric">
            <span>Confirmed orders</span>
            <strong>{totalOrders}</strong>
          </div>
          <div className="dashboard-metric">
            <span>Total agreed value</span>
            <strong>{formatPrice(totalSpent)}</strong>
          </div>
        </div>
      </div>
      <div className="dashboard-panel">
        <h3>Your Orders</h3>
        {orders.length > 0 ? (
          <table className="orders-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Product</th>
                <th>Other participant</th>
                <th>Agreed amount</th>
                <th>Date</th>
                <th>Status</th>
                <th>Invoice</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td data-label="Order">{order.id}</td>
                  <td data-label="Product">{order.productName}</td>
                  <td data-label="Other participant">{order.buyer === currentUsername ? order.seller : order.buyer}</td>
                  <td data-label="Agreed amount">{order.price}</td>
                  <td data-label="Date">{order.date}</td>
                  <td data-label="Status">{order.status}</td>
                  <td data-label="Invoice">
                    {order.invoice ? (
                      <button className="auth-btn secondary chat-order-btn" onClick={() => onOpenInvoice(order.invoice)}>
                        View invoice
                      </button>
                    ) : (
                      <span className="invoice-disabled">Livestock</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="dashboard-empty-state">No confirmed orders yet. Your completed purchases will appear here.</p>
        )}
      </div>
    </section>
  );
}

const SellerDashboardPage = React.memo(function SellerDashboardPage({
  sellerUsername,
  products,
  orders,
  onDeleteProduct,
  onUpdateProduct,
  onContactBuyer,
  onOpenInvoice,
  onAddProduct,
  onClose,
}) {
  const totalRevenue = useMemo(() => orders.reduce((sum, order) => sum + parsePrice(order.price), 0), [orders]);
  const [editingProductId, setEditingProductId] = React.useState(null);
  const [editValues, setEditValues] = React.useState({});
  const [editImage, setEditImage] = React.useState(null);

  const startEditing = React.useCallback((product) => {
    setEditingProductId(product.id);
    setEditImage(null);
    setEditValues({
      name: product.name || '',
      price: product.price || '',
      quantity: product.quantity || 1,
      description: product.description || '',
      category: product.category || 'Feed & Nutrition',
      bird_type: product.bird_type || '',
    });
  }, []);

  const updateEditValue = React.useCallback((field, value) => {
    setEditValues((current) => ({ ...current, [field]: value }));
  }, []);

  const saveProduct = React.useCallback(async (event) => {
    event.preventDefault();
    const payload = new FormData();

    Object.entries(editValues).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        payload.append(key, value);
      }
    });

    if (editImage) {
      payload.append('image', editImage);
    }

    const saved = await onUpdateProduct(editingProductId, payload);
    if (saved) {
      setEditingProductId(null);
      setEditValues({});
      setEditImage(null);
    }
  }, [editImage, editValues, editingProductId, onUpdateProduct]);

  const salesRows = useMemo(() => orders.map((order) => ({
    ...order,
    otherParticipant: order.buyer === sellerUsername ? order.seller : order.buyer,
    rowId: `order-${order.id}`,
  })), [orders, sellerUsername]);

  return (
    <section className="dashboard-section seller-dashboard">
      <div className="dashboard-header">
        <div className="dashboard-title-block">
          <span className="dashboard-eyebrow">Store operations</span>
          <h2>Seller Dashboard</h2>
          <p>Manage your catalog and keep track of sales activity.</p>
        </div>
        <div className="seller-dashboard-actions">
          <button className="dashboard-add-product-btn" type="button" onClick={onAddProduct}>
            + Add product
          </button>
          <button className="close-dashboard-btn" onClick={onClose}>× Back to products</button>
        </div>
      </div>
      <div className="dashboard-panel">
        <div className="dashboard-summary">
          <div className="dashboard-metric seller-metric">
            <span>Account</span>
            <strong>{sellerUsername}</strong>
          </div>
          <div className="dashboard-metric">
            <span>Products listed</span>
            <strong>{products.length}</strong>
          </div>
          <div className="dashboard-metric">
            <span>Confirmed agreements</span>
            <strong>{orders.length}</strong>
          </div>
          <div className="dashboard-metric">
            <span>Total agreed value</span>
            <strong>{formatPrice(totalRevenue)}</strong>
          </div>
        </div>
      </div>
      <div className="dashboard-panel">
        <div className="dashboard-panel-heading">
          <div>
            <span className="dashboard-eyebrow">Catalog</span>
            <h3>Your Products</h3>
          </div>
          <span className="dashboard-panel-count">{products.length} item{products.length === 1 ? '' : 's'}</span>
        </div>
        {products.length > 0 ? (
          <ul className="dashboard-list">
            {products.map((product) => (
              <li key={product.id}>
                {editingProductId === product.id ? (
                  <form className="dashboard-product-edit" onSubmit={saveProduct}>
                    <div className="dashboard-product-edit-fields">
                      <input value={editValues.name} onChange={(event) => updateEditValue('name', event.target.value)} aria-label="Product name" required />
                      <input value={editValues.price} onChange={(event) => updateEditValue('price', event.target.value)} aria-label="Product price" required />
                      <input type="number" min="1" value={editValues.quantity} onChange={(event) => updateEditValue('quantity', event.target.value)} aria-label="Product quantity" required />
                      <select value={editValues.category} onChange={(event) => updateEditValue('category', event.target.value)} aria-label="Product category">
                        <option>Feed & Nutrition</option>
                        <option>Health & Care</option>
                        <option>Housing & Shelter</option>
                        <option>Equipment & Tools</option>
                        <option>Bird</option>
                        <option>Egg*Chicks</option>
                        <option>Cattel</option>
                      </select>
                      {editValues.category === 'Bird' && (
                        <input value={editValues.bird_type} onChange={(event) => updateEditValue('bird_type', event.target.value)} aria-label="Bird type" placeholder="Bird type" required />
                      )}
                      <label className="dashboard-product-image-upload">
                        <span>Product image</span>
                        <input type="file" accept="image/*" onChange={(event) => setEditImage(event.target.files?.[0] || null)} />
                      </label>
                      <textarea value={editValues.description} onChange={(event) => updateEditValue('description', event.target.value)} aria-label="Product description" required />
                    </div>
                    <div className="dashboard-product-actions">
                      <button className="dashboard-save-btn" type="submit">Save changes</button>
                      <button className="dashboard-cancel-btn" type="button" onClick={() => setEditingProductId(null)}>Cancel</button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="dashboard-product-main">
                      <div className="dashboard-product-thumb">
                        {product.image && product.image !== '🥚' ? <img src={product.image} alt={product.name} /> : <span aria-hidden="true">🥚</span>}
                      </div>
                      <div>
                        <strong>{product.name}</strong>
                        <span>{product.price} · {product.quantity || 1} in stock</span>
                      </div>
                    </div>
                    <div className="dashboard-product-actions">
                      <button className="dashboard-edit-btn" onClick={() => startEditing(product)}>Edit</button>
                      <button className="delete-btn" onClick={() => onDeleteProduct(product.id)}>Delete</button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="dashboard-empty-state">No products listed yet. Add products from your account menu to start building your catalog.</p>
        )}
      </div>
      <div className="dashboard-panel">
        <div className="dashboard-panel-heading">
          <div>
            <span className="dashboard-eyebrow">Activity</span>
            <h3>Confirmed Agreements</h3>
          </div>
          <span className="dashboard-panel-count">{orders.length} order{orders.length === 1 ? '' : 's'}</span>
        </div>
        {orders.length > 0 ? (
          salesRows.length > 12 ? (
            <VirtualList
              items={salesRows}
              itemHeight={54}
              containerHeight={340}
              renderItem={(order) => (
                <div className="dashboard-sales-row" style={{ display: 'flex', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>{order.id}</span>
                  <span>{order.productName}</span>
                  <span>{order.otherParticipant}</span>
                  <span>{order.price}</span>
                  <span>{order.date}</span>
                  <button className="auth-btn secondary chat-order-btn" onClick={() => order.invoice ? onOpenInvoice(order.invoice) : null}>
                    {order.invoice ? 'View invoice' : 'Livestock'}
                  </button>
                  <button className="auth-btn secondary chat-order-btn" onClick={() => onContactBuyer(order)}>
                    Chat
                  </button>
                </div>
              )}
            />
          ) : (
            <table className="orders-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Product</th>
                  <th>Other participant</th>
                  <th>Price</th>
                  <th>Date</th>
                  <th>Invoice</th>
                  <th>Chat</th>
                </tr>
              </thead>
              <tbody>
                {salesRows.map((order) => (
                  <tr key={order.id}>
                    <td data-label="Order">{order.id}</td>
                    <td data-label="Product">{order.productName}</td>
                    <td data-label="Other participant">{order.otherParticipant}</td>
                    <td data-label="Agreed amount">{order.price}</td>
                    <td data-label="Date">{order.date}</td>
                    <td data-label="Invoice">
                      {order.invoice ? (
                        <button className="auth-btn secondary chat-order-btn" onClick={() => onOpenInvoice(order.invoice)}>
                          View invoice
                        </button>
                      ) : (
                        <span className="invoice-disabled">Livestock</span>
                      )}
                    </td>
                    <td data-label="Chat">
                      <button className="auth-btn secondary chat-order-btn" onClick={() => onContactBuyer(order)}>
                        Chat
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : (
          <p className="dashboard-empty-state">No confirmed agreements yet. Sales and buyer conversations will appear here.</p>
        )}
      </div>
    </section>
  );
});

export default SellerDashboardPage;
