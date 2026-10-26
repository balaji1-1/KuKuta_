import React, { lazy, Suspense, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import RoosterSplash from './RoosterSplash';
import ProductCard from './ProductCard';
import Messenger from './Messenger';
import apiFetch, { storeAuthTokens } from './api';
import { LazyBoundary, useDebounce } from './performance.jsx';

const ForgotPasswordPage = lazy(() => import('./ForgotPassword'));
const ProductPage = lazy(() => import('./ProductPage'));
const SellerDashboardPage = lazy(() => import('./SellerDashboardPage'));
const BuyerOrderHistoryPage = lazy(() => import('./SellerDashboardPage').then((module) => ({ default: module.BuyerOrderHistoryPage })));

const PRODUCT_CATEGORY_OPTIONS = [
  { value: 'Egg*Chicks', label: 'Egg & Chicks' },
  { value: 'Bird', label: 'Bird' },
  { value: 'Feed & Nutrition', label: 'Feed & Nutrition' },
  { value: 'Housing & Shelter', label: 'Housing & Shelter' },
  { value: 'Equipment & Tools', label: 'Equipment & Tools' },
  { value: 'Health & Care', label: 'Health & Care' },
  { value: 'Cattel', label: 'Cattle' },
];

const categories = PRODUCT_CATEGORY_OPTIONS.map((option) => option.value);

const categoryGroups = [
  { title: 'Livestock', subtitle: 'Birds and farm animals', categories: ['Egg*Chicks', 'Bird', 'Cattel'] },
  { title: 'Care & Nutrition', subtitle: 'Feed, health and medication', categories: ['Feed & Nutrition', 'Health & Care'] },
  { title: 'Housing & Tools', subtitle: 'Shelter and farm equipment', categories: ['Housing & Shelter', 'Equipment & Tools'] },
];

const getCategoryLabel = (category) => {
  const option = PRODUCT_CATEGORY_OPTIONS.find((item) => item.value === category);
  return option ? option.label : (category || 'Product');
};

const birdTypeOptions = [
  'Breeding Hen',
  'Breeding Rooster',
  'Fighting Roosters',
  'Cockerels',
  'Pullet',
];

const livestockAgeOptions = [
  '2 weeks',
  '1 month',
  '2 months',
  '3 months',
  '4 months',
  '5 months',
  '6 months',
  '8 months',
  '10 months',
  '12 months',
  '1 year',
  '2 years',
  '3 years',
  '4+ years',
];
const breedingBirdAgeOptions = livestockAgeOptions.filter((option) =>
  ['1 year', '2 years', '3 years', '4+ years'].includes(option)
);

const LIVESTOCK_CATEGORIES = new Set(['Egg*Chicks', 'Bird', 'Cattel']);
const CURRENCY_SYMBOL = '₹';
const MAX_PRODUCT_VIDEO_SIZE = 100 * 1024 * 1024;

const parsePrice = (price) => parseFloat(String(price).replace(/[^0-9.-]+/g, '')) || 0;
const formatPrice = (amount) => `${CURRENCY_SYMBOL}${Number(amount).toFixed(2)}`;
const isLivestockProduct = (product) => {
  const category = String(product?.category || '').trim();
  return LIVESTOCK_CATEGORIES.has(category);
};

const createInvoiceForOrder = (order, product = null) => {
  if (!order || !product || isLivestockProduct(product)) {
    return null;
  }

  const amount = parsePrice(order.price);
  const invoiceNumber = `INV-${String(order.id || Date.now()).padStart(5, '0')}`;

  return {
    id: order.id,
    invoiceNumber,
    issuedAt: new Date().toISOString(),
    productName: order.productName || product.name || 'Product',
    buyer: order.buyer || 'Customer',
    seller: order.seller || 'Seller',
    category: product.category || 'General',
    amount,
    status: order.status || 'Confirmed',
    notes: 'Thank you for your purchase. This invoice is for this transaction only.',
  };
};

const mapAgreedOrder = (record) => {
  const price = formatPrice(Number(record.agreed_price));
  const product = {
    id: record.product,
    name: record.product_name || 'Product',
    category: record.product_category || 'General',
  };
  const order = {
    id: record.id,
    productId: record.product,
    productName: product.name,
    price,
    seller: record.seller_name || 'Seller',
    buyer: record.buyer_name || 'Buyer',
    date: record.created_at ? new Date(record.created_at).toLocaleDateString() : new Date().toLocaleDateString(),
    status: 'Confirmed',
  };
  return { ...order, invoice: createInvoiceForOrder(order, product) };
};

const getProductImage = (product, { isPriority = false } = {}) => {
  const imageUrl = product.image || product.image_url || product.images?.[0]?.image_url || product.images?.[0]?.image;
  const safeImageUrl = typeof imageUrl === 'string' ? imageUrl.trim() : '';
  const loading = isPriority ? 'eager' : 'lazy';
  const fetchPriority = isPriority ? 'high' : 'low';

  if (safeImageUrl && /^https?:\/\//i.test(safeImageUrl)) {
    return <img src={safeImageUrl} alt={product.name || 'Product'} className="product-image-media" loading={loading} decoding="async" fetchPriority={fetchPriority} onError={(e) => { e.currentTarget.style.display = 'none'; }} />;
  }
  if (safeImageUrl && safeImageUrl.startsWith('/')) {
    return <img src={safeImageUrl} alt={product.name || 'Product'} className="product-image-media" loading={loading} decoding="async" fetchPriority={fetchPriority} onError={(e) => { e.currentTarget.style.display = 'none'; }} />;
  }
  if (safeImageUrl && safeImageUrl.includes('/media/')) {
    return <img src={safeImageUrl} alt={product.name || 'Product'} className="product-image-media" loading={loading} decoding="async" fetchPriority={fetchPriority} onError={(e) => { e.currentTarget.style.display = 'none'; }} />;
  }
  return <span className="product-image-emoji">{safeImageUrl || '🥚'}</span>;
};

function LoginModal({ isOpen, onClose, onSwitchToSignin, onLogin, onForgotPassword }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [identifierError, setIdentifierError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [formError, setFormError] = useState('');
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIdentifierError('');
    setPasswordError('');
    setFormError('');

    let hasError = false;
    if (!identifier.trim()) {
      setIdentifierError('Username, email, or mobile number is required.');
      hasError = true;
    }
    if (!password) {
      setPasswordError('Password is required.');
      hasError = true;
    }
    if (hasError) return;

    try {
      const response = await apiFetch('/login/', {
        method: 'POST',
        auth: false,
        body: { identifier: identifier.trim(), password },
      });
      const data = await response.json();
      if (response.ok) {
        // store JWT tokens
        if (data.tokens) {
          storeAuthTokens(data.tokens.access, data.tokens.refresh);
        }

        onLogin({
          name: data.user.username,
          username: data.user.username,
          email: data.user.email,
          role: data.user.role || 'buyer',
          tokens: data.tokens || null,
        });
        setIdentifier('');
        setPassword('');
        onClose();
      } else {
        const errorMessage =
          (data && typeof data.detail === 'string' && data.detail) ||
          (data && typeof data.error === 'string' && data.error) ||
          (data && typeof data.message === 'string' && data.message) ||
          (data && data.non_field_errors &&
            (Array.isArray(data.non_field_errors) ? data.non_field_errors[0] : data.non_field_errors)) ||
          (data && data.errors && (() => {
            const first = Object.values(data.errors)[0];
            return Array.isArray(first) ? first[0] : first;
          })()) ||
          'Login failed. Please check your details.';
        setFormError(errorMessage);
      }
    } catch (error) {
      setFormError('Login failed. Please try again.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal scroll-reveal${isVisible ? ' visible' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Login</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-description">Access your Kukuta account securely and continue managing orders.</div>
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="identifier">Username, Email or Mobile</label>
            <input
              id="identifier"
              type="text"
              className={identifierError ? 'input-error' : ''}
              value={identifier}
              onChange={(e) => {
                setIdentifier(e.target.value);
                if (identifierError) setIdentifierError('');
              }}
              placeholder="Enter username, email, or mobile number"
              required
            />
            {identifierError && <div className="field-error">{identifierError}</div>}
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              className={passwordError ? 'input-error' : ''}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (passwordError) setPasswordError('');
              }}
              placeholder="••••••••"
              required
            />
            {passwordError && <div className="field-error">{passwordError}</div>}
            <label className="show-password-toggle">
              <input
                type="checkbox"
                checked={showPassword}
                onChange={(e) => setShowPassword(e.target.checked)}
              />
              Show password
            </label>
          </div>
          {formError && <div className="form-error">{formError}</div>}
          <button type="submit" className="auth-btn">Login</button>
          <p className="auth-switch">
            Don't have an account? <button type="button" onClick={() => { onClose(); onSwitchToSignin(); }}>Sign Up</button>
          </p>
          <p className="auth-switch">
            <button type="button" onClick={() => { onClose(); onForgotPassword(); }}>Forgot Password?</button>
          </p>
        </form>
      </div>
    </div>
  );
}

function ConfirmModal({ dialog, onClose }) {
  if (!dialog) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Confirm</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-description">{dialog.message}</div>
        <div style={{ padding: '1rem', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button className="auth-btn secondary" onClick={onClose}>Cancel</button>
          <button className="auth-btn" onClick={() => { dialog.onConfirm && dialog.onConfirm(); }}>
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

function ContactSellerModal({ isOpen, onClose, product }) {
  if (!isOpen || !product) return null;

  const handleEmail = () => {
    const address = product.seller_email || 'seller@kukuta.com';
    const subject = encodeURIComponent(`Inquiry about ${product.name}`);
    window.location.href = `mailto:${address}?subject=${subject}`;
    onClose();
  };

  const handleCall = () => {
    const phone = product.seller_phone;
    if (!phone) {
      window.alert('This seller has not shared a phone number yet.');
      return;
    }
    window.location.href = `tel:${phone}`;
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Contact Seller</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-description">
          Reach out to {product.seller || 'the seller'} about {product.name}.
        </div>
        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <button className="auth-btn" onClick={handleEmail}>
            Email Seller
          </button>
          <button className="auth-btn secondary" onClick={handleCall}>
            Call Seller
          </button>
          <button className="auth-btn secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function PasswordResetConfirmPage({ uid, token, expiresAt, onClose, onOpenLogin, onRequestNewOtp }) {
  const [identifier, setIdentifier] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [identifierError, setIdentifierError] = useState('');
  const [otpError, setOtpError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [message, setMessage] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(() => {
    const expiryTime = Date.parse(expiresAt || '');
    return Number.isFinite(expiryTime) ? Math.max(0, Math.ceil((expiryTime - Date.now()) / 1000)) : null;
  });

  useEffect(() => {
    const expiryTime = Date.parse(expiresAt || '');
    if (!Number.isFinite(expiryTime)) {
      setSecondsRemaining(null);
      return undefined;
    }

    const updateCountdown = () => {
      setSecondsRemaining(Math.max(0, Math.ceil((expiryTime - Date.now()) / 1000)));
    };
    updateCountdown();
    const intervalId = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(intervalId);
  }, [expiresAt]);

  const countdownText = secondsRemaining === null
    ? 'Expiry countdown unavailable; the server will validate your code.'
    : secondsRemaining === 0
      ? 'OTP expired. Request a new code.'
      : `OTP expires in ${String(Math.floor(secondsRemaining / 60)).padStart(2, '0')}:${String(secondsRemaining % 60).padStart(2, '0')}`;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIdentifierError('');
    setOtpError('');
    setPasswordError('');
    setConfirmPasswordError('');
    setMessage('');

    let hasError = false;
    if (!identifier.trim()) {
      setIdentifierError('Email or phone number is required.');
      hasError = true;
    }
    if (!otp.trim()) {
      setOtpError('OTP is required.');
      hasError = true;
    }
    if (!newPassword) {
      setPasswordError('New password is required.');
      hasError = true;
    }
    if (!confirmPassword) {
      setConfirmPasswordError('Please confirm your password.');
      hasError = true;
    }
    if (newPassword && confirmPassword && newPassword !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match.');
      hasError = true;
    }
    if (hasError) return;

    try {
      const response = await apiFetch(`/password-reset-confirm/${uid}/${token}/`, {
        method: 'POST',
        auth: false,
        body: { identifier: identifier.trim(), otp: otp.trim(), new_password: newPassword },
      });
      const data = await response.json();
      if (response.ok) {
        setMessage('Password reset successful. Please login with your new password.');
        setIdentifier('');
        setOtp('');
        setNewPassword('');
        setConfirmPassword('');
        setResetSuccess(true);
      } else {
        setMessage(data.error || 'Failed to reset password.');
      }
    } catch (error) {
      setMessage('Failed to reset password. Please try again.');
    }
  };

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <h2>Reset Your Password</h2>
          <p>Enter a new secure password for your account.</p>
        </div>
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="forgot-reset-identifier">Email or Phone Number</label>
            <input
              id="forgot-reset-identifier"
              type="text"
              className={identifierError ? 'input-error' : ''}
              value={identifier}
              onChange={(e) => {
                setIdentifier(e.target.value);
                if (identifierError) setIdentifierError('');
              }}
              placeholder="your@email.com or 08012345678"
              required
            />
            {identifierError && <div className="field-error">{identifierError}</div>}
          </div>
          <div className="form-group">
            <label htmlFor="forgot-reset-otp">OTP</label>
            <input
              id="forgot-reset-otp"
              type="text"
              className={otpError ? 'input-error' : ''}
              value={otp}
              onChange={(e) => {
                setOtp(e.target.value);
                if (otpError) setOtpError('');
              }}
              placeholder="Enter OTP"
              required
            />
            {otpError && <div className="field-error">{otpError}</div>}
            <div className={`otp-expiry-timer${secondsRemaining === 0 ? ' is-expired' : ''}`} role="status" aria-live="polite">
              {countdownText}
            </div>
            {secondsRemaining === 0 && onRequestNewOtp && (
              <button
                type="button"
                className="otp-resend-btn"
                onClick={async () => {
                  const result = await onRequestNewOtp(identifier);
                  if (result?.message) {
                    setMessage(result.message);
                  }
                }}
              >
                Request a new code
              </button>
            )}
          </div>
          <div className="form-group">
            <label htmlFor="new-password-confirm">New Password</label>
            <input
              id="new-password-confirm"
              type={showPasswords ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                if (passwordError) setPasswordError('');
              }}
              placeholder="••••••••"
              className={passwordError ? 'input-error' : ''}
              required
            />
            {passwordError && <div className="field-error">{passwordError}</div>}
          </div>
          <div className="form-group">
            <label htmlFor="confirm-new-password-confirm">Confirm New Password</label>
            <input
              id="confirm-new-password-confirm"
              type={showPasswords ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (confirmPasswordError) setConfirmPasswordError('');
              }}
              placeholder="••••••••"
              className={confirmPasswordError ? 'input-error' : ''}
              required
            />
            {confirmPasswordError && <div className="field-error">{confirmPasswordError}</div>}
          </div>
          <label className="show-password-toggle">
            <input
              type="checkbox"
              checked={showPasswords}
              onChange={(e) => setShowPasswords(e.target.checked)}
            />
            Show passwords
          </label>
          {!resetSuccess && <button type="submit" className="auth-btn" disabled={secondsRemaining === 0}>Reset Password</button>}
          {message && <div className="form-message">{message}</div>}
          <div className="form-actions">
            {resetSuccess && onOpenLogin && (
              <button type="button" className="auth-btn" onClick={onOpenLogin}>
                Login
              </button>
            )}
            <button type="button" className="auth-btn secondary" onClick={onClose}>
              Back to home
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

function SigninModal({ isOpen, onClose, onSwitchToLogin, onSignup }) {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [nameError, setNameError] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [formError, setFormError] = useState('');
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setNameError('');
    setUsernameError('');
    setEmailError('');
    setPasswordError('');
    setConfirmPasswordError('');
    setFormError('');

    let hasError = false;
    if (!name.trim()) {
      setNameError('Full name is required.');
      hasError = true;
    }
    if (!username.trim()) {
      setUsernameError('Username is required.');
      hasError = true;
    }
    if (!email.trim()) {
      setEmailError('Email is required.');
      hasError = true;
    }
    if (!password) {
      setPasswordError('Password is required.');
      hasError = true;
    }
    if (!confirmPassword) {
      setConfirmPasswordError('Please confirm your password.');
      hasError = true;
    }
    if (password && confirmPassword && password !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match.');
      hasError = true;
    }
    if (hasError) return;

    try {
      const response = await apiFetch('/signup/', {
        method: 'POST',
        auth: false,
        body: { name, username, email, password },
      });
      const data = await response.json();
      if (response.ok) {
        // store tokens if returned
        if (data.tokens) {
          storeAuthTokens(data.tokens.access, data.tokens.refresh);
        }

        onSignup({
          name: data.user.username,
          username: data.user.username,
          role: data.user?.role || 'buyer',
          tokens: data.tokens || null,
        });
        setName('');
        setUsername('');
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        onClose();
      } else {
        if (data && data.errors) {
          const errorForField = (field) => {
            const value = data.errors[field];
            return Array.isArray(value) ? value[0] : value;
          };

          const usernameMsg = errorForField('username');
          const emailMsg = errorForField('email');
          const passwordMsg = errorForField('password');
          const nameMsg = errorForField('name');
          const nonField = Array.isArray(data.errors)
            ? data.errors[0]
            : Object.values(data.errors)[0];

          if (usernameMsg) setUsernameError(usernameMsg);
          if (emailMsg) setEmailError(emailMsg);
          if (passwordMsg) setPasswordError(passwordMsg);
          if (nameMsg) setNameError(nameMsg);
          if (!usernameMsg && !emailMsg && !passwordMsg && !nameMsg) {
            setFormError(Array.isArray(nonField) ? nonField[0] : nonField);
          }
        } else {
          const errorMessage =
            (data && typeof data.detail === 'string' && data.detail) ||
            (data && typeof data.error === 'string' && data.error) ||
            (data && typeof data.message === 'string' && data.message) ||
            (data && data.non_field_errors &&
              (Array.isArray(data.non_field_errors)
                ? data.non_field_errors[0]
                : data.non_field_errors)) ||
            'Signup failed. Please try again.';
          setFormError(errorMessage);
        }
      }
    } catch (error) {
      setFormError('Signup failed. Please try again.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal scroll-reveal${isVisible ? ' visible' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Sign Up</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-description">Create your account to buy fresh farm products and sell with confidence.</div>
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="name">Full Name</label>
            <input
              id="name"
              type="text"
              className={nameError ? 'input-error' : ''}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError('');
              }}
              placeholder="John Doe"
              required
            />
            {nameError && <div className="field-error">{nameError}</div>}
          </div>
          <div className="form-group">
            <label htmlFor="signup-username">Username</label>
            <input
              id="signup-username"
              type="text"
              className={usernameError ? 'input-error' : ''}
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                if (usernameError) setUsernameError('');
              }}
              placeholder="your username"
              required
            />
            {usernameError && <div className="field-error">{usernameError}</div>}
          </div>
          <div className="form-group">
            <label htmlFor="signup-email">Email</label>
            <input
              id="signup-email"
              type="email"
              className={emailError ? 'input-error' : ''}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError('');
              }}
              placeholder="your@email.com"
              required
            />
            {emailError && <div className="field-error">{emailError}</div>}
          </div>
          <div className="form-group">
            <label htmlFor="signup-password">Password</label>
            <input
              id="signup-password"
              type={showPasswords ? 'text' : 'password'}
              className={passwordError ? 'input-error' : ''}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (passwordError) setPasswordError('');
              }}
              placeholder="••••••••"
              required
            />
            {passwordError && <div className="field-error">{passwordError}</div>}
          </div>
          <div className="form-group">
            <label htmlFor="confirm-password">Confirm Password</label>
            <input
              id="confirm-password"
              type={showPasswords ? 'text' : 'password'}
              className={confirmPasswordError ? 'input-error' : ''}
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (confirmPasswordError) setConfirmPasswordError('');
              }}
              placeholder="••••••••"
              required
            />
            {confirmPasswordError && <div className="field-error">{confirmPasswordError}</div>}
          </div>
          <label className="show-password-toggle">
            <input
              type="checkbox"
              checked={showPasswords}
              onChange={(e) => setShowPasswords(e.target.checked)}
            />
            Show passwords
          </label>
          {formError && <div className="form-error">{formError}</div>}
          <button type="submit" className="auth-btn">Sign Up</button>
          <p className="auth-switch">
            Already have an account? <button type="button" onClick={() => { onClose(); onSwitchToLogin(); }}>Login</button>
          </p>
        </form>
      </div>
    </div>
  );
}

function ProfileModal({ isOpen, onClose, currentUser, onRoleToggle, onOpenDashboard, onOpenOrderHistory, onLogout }) {
  if (!isOpen || !currentUser) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Profile</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-description">Manage your account and access role-based tools.</div>
        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div className="user-info">
            <div><strong>{currentUser.name || currentUser.username || 'User'}</strong></div>
            <div>Username: {currentUser.username || '—'}</div>
            <div>Email: {currentUser.email || '—'}</div>
            <div>Role: {currentUser.role || 'buyer'}</div>
          </div>
          <button
            className="auth-btn"
            onClick={() => {
              onRoleToggle(currentUser.role === 'seller' ? 'buyer' : 'seller');
              onClose();
            }}
          >
            Switch to {currentUser.role === 'seller' ? 'Buyer' : 'Seller'}
          </button>
          {currentUser.role === 'seller' && (
            <button className="auth-btn" onClick={() => { onOpenDashboard(); onClose(); }}>
              Open Seller Dashboard
            </button>
          )}
          {currentUser.role === 'buyer' && (
            <button className="auth-btn" onClick={() => { onOpenOrderHistory(); onClose(); }}>
              Open Buyer Dashboard
            </button>
          )}
          <button className="auth-btn secondary" onClick={() => { onLogout(); onClose(); }}>
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}

function InvoiceModal({ invoice, onClose }) {
  if (!invoice) return null;

  const downloadPdf = async () => {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    doc.setFillColor(240, 245, 240);
    doc.rect(0, 0, pageWidth, 60, 'F');
    doc.setFontSize(22);
    doc.setTextColor(24, 67, 41);
    doc.text('Kukuta Invoice', 14, 22);

    doc.setFontSize(11);
    doc.setTextColor(60, 75, 63);
    doc.text(`Invoice #: ${invoice.invoiceNumber}`, 14, 34);
    doc.text(`Date: ${new Date(invoice.issuedAt).toLocaleDateString()}`, 14, 42);

    doc.setDrawColor(200, 220, 205);
    doc.line(14, 52, pageWidth - 14, 52);

    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(`Buyer: ${invoice.buyer}`, 14, 70);
    doc.text(`Seller: ${invoice.seller}`, 14, 78);
    doc.text(`Category: ${invoice.category}`, 14, 86);
    doc.text(`Product: ${invoice.productName}`, 14, 94);

    doc.setFontSize(14);
    doc.text('Amount Due', 14, 116);
    doc.setFontSize(18);
    doc.text(`${formatPrice(invoice.amount)}`, 14, 126);

    doc.setFontSize(11);
    doc.text(invoice.notes, 14, 146, { maxWidth: pageWidth - 28 });

    doc.setDrawColor(220, 220, 220);
    doc.line(14, 165, pageWidth - 14, 165);
    doc.setTextColor(90, 90, 90);
    doc.text('Thank you for doing business with Kukuta.', 14, 178);

    if (pageHeight < 220) {
      doc.addPage();
    }

    doc.save(`${invoice.invoiceNumber}.pdf`);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="invoice-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h2>Invoice</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="invoice-summary">
          <div>
            <span className="invoice-label">Invoice Number</span>
            <strong>{invoice.invoiceNumber}</strong>
          </div>
          <div>
            <span className="invoice-label">Date</span>
            <strong>{new Date(invoice.issuedAt).toLocaleDateString()}</strong>
          </div>
        </div>

        <div className="invoice-meta-grid">
          <div className="invoice-meta-box">
            <span className="invoice-label">Buyer</span>
            <strong>{invoice.buyer}</strong>
          </div>
          <div className="invoice-meta-box">
            <span className="invoice-label">Seller</span>
            <strong>{invoice.seller}</strong>
          </div>
        </div>

        <table className="invoice-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Category</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{invoice.productName}</td>
              <td>{invoice.category}</td>
              <td>{formatPrice(invoice.amount)}</td>
            </tr>
          </tbody>
        </table>

        <div className="invoice-total-row">
          <span>Total</span>
          <strong>{formatPrice(invoice.amount)}</strong>
        </div>
        <p className="invoice-note">{invoice.notes}</p>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
          <button className="auth-btn secondary" type="button" onClick={() => window.print()}>Print</button>
          <button className="auth-btn" type="button" onClick={downloadPdf}>Download PDF</button>
        </div>
      </div>
    </div>
  );
}

function CartPanel({ isOpen, onClose, cartItems, onRemove, onQuantityChange, onCheckout, total }) {
  if (!isOpen) return null;
  return (
    <div className="panel-overlay" onClick={onClose}>
      <aside className="cart-panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel-header">
          <h2>Shopping Cart</h2>
          <button className="panel-close" onClick={onClose}>×</button>
        </div>
        {cartItems.length === 0 ? (
          <div className="panel-empty">Your cart is currently empty.</div>
        ) : (
          <div className="panel-body">
            {cartItems.map((item) => (
              <div key={item.id} className="cart-item">
                <div className="cart-item-info">
                  <strong>{item.name}</strong>
                  <span>{item.price}</span>
                </div>
                <div className="cart-item-meta">
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => onQuantityChange(item.id, e.target.value)}
                  />
                  <button className="remove-item-btn" onClick={() => onRemove(item.id)}>Remove</button>
                </div>
              </div>
            ))}
            <div className="panel-summary">
              <span>Total</span>
              <strong>{formatPrice(total)}</strong>
            </div>
            <button className="checkout-btn" onClick={onCheckout}>Checkout</button>
          </div>
        )}
      </aside>
    </div>
  );
}

function WishlistPanel({ isOpen, onClose, items, onRemove, onAddToCart, onOrder }) {
  if (!isOpen) return null;
  return (
    <div className="panel-overlay" onClick={onClose}>
      <aside className="wishlist-panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel-header">
          <h2>Saved Wishlist</h2>
          <button className="panel-close" onClick={onClose}>×</button>
        </div>
        {items.length === 0 ? (
          <div className="panel-empty">No products saved yet.</div>
        ) : (
          <div className="panel-body">
            {items.map((item) => (
              <div key={item.id} className="wishlist-item">
                <div>
                  <strong>{item.name}</strong>
                  <span>{item.price}</span>
                </div>
                <div className="wishlist-actions">
                  <button className="cart-add-btn" onClick={() => onAddToCart(item)}>Add to Cart</button>
                  <button className="remove-item-btn" onClick={() => onRemove(item)}>Remove</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}

function AddProductModal({ isOpen, onClose, onAddProduct, userName }) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('0');
  const [pricePerItem, setPricePerItem] = useState('0');
  const [quantity, setQuantity] = useState(0);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Feed & Nutrition');
  const [birdType, setBirdType] = useState('Breeding Hen');
  const [age, setAge] = useState('');
  const [daysOld, setDaysOld] = useState('');
  const [breederHenMedia, setBreederHenMedia] = useState([]);
  const [breederRoosterMedia, setBreederRoosterMedia] = useState([]);
  const [images, setImages] = useState([]);
  const [videos, setVideos] = useState([]);
  const [videoUploadError, setVideoUploadError] = useState('');
  const [imageUrls, setImageUrls] = useState([]);
  const [videoUrls, setVideoUrls] = useState([]);
  const [audioUrls, setAudioUrls] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [formSuccess, setFormSuccess] = useState('');

  const getFieldError = (field) => fieldErrors[field] || '';

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    setImages(prev => [...prev, ...files]);
  };

  const handleVideoUpload = (e) => {
    const files = Array.from(e.target.files);
    const acceptedFiles = files.filter((file) => file.size <= MAX_PRODUCT_VIDEO_SIZE);
    const oversizedFiles = files.filter((file) => file.size > MAX_PRODUCT_VIDEO_SIZE);
    setVideos((previous) => [...previous, ...acceptedFiles]);
    setVideoUploadError(oversizedFiles.length
      ? `${oversizedFiles.map((file) => file.name).join(', ')} ${oversizedFiles.length === 1 ? 'is' : 'are'} larger than the 100 MB limit and ${oversizedFiles.length === 1 ? 'was' : 'were'} not added.`
      : '');
    e.target.value = '';
  };

  const handleBreederMediaUpload = (setMedia, e) => {
    const files = Array.from(e.target.files);
    const oversizedVideos = files.filter((file) =>
      file.type.startsWith('video/') && file.size > MAX_PRODUCT_VIDEO_SIZE
    );
    const acceptedFiles = files.filter((file) =>
      !file.type.startsWith('video/') || file.size <= MAX_PRODUCT_VIDEO_SIZE
    );
    setMedia((previous) => [...previous, ...acceptedFiles]);
    setVideoUploadError(oversizedVideos.length
      ? `${oversizedVideos.map((file) => file.name).join(', ')} ${oversizedVideos.length === 1 ? 'is' : 'are'} larger than the 100 MB video limit and ${oversizedVideos.length === 1 ? 'was' : 'were'} not added.`
      : '');
    e.target.value = '';
  };

  const removeImage = (index) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const removeVideo = (index) => {
    setVideos(prev => prev.filter((_, i) => i !== index));
  };

  const removeBreederMedia = (setMedia, index) => {
    setMedia(prev => prev.filter((_, i) => i !== index));
  };

  const addImageUrl = () => {
    setImageUrls(prev => [...prev, '']);
  };

  const updateImageUrl = (index, url) => {
    setImageUrls(prev => prev.map((item, i) => i === index ? url : item));
  };

  const removeImageUrl = (index) => {
    setImageUrls(prev => prev.filter((_, i) => i !== index));
  };

  const addVideoUrl = () => {
    setVideoUrls(prev => [...prev, '']);
  };

  const updateVideoUrl = (index, url) => {
    setVideoUrls(prev => prev.map((item, i) => i === index ? url : item));
  };

  const removeVideoUrl = (index) => {
    setVideoUrls(prev => prev.filter((_, i) => i !== index));
  };

  const addAudioUrl = () => {
    setAudioUrls(prev => [...prev, '']);
  };

  const updateAudioUrl = (index, url) => {
    setAudioUrls(prev => prev.map((item, i) => i === index ? url : item));
  };

  const removeAudioUrl = (index) => {
    setAudioUrls(prev => prev.filter((_, i) => i !== index));
  };

  const showDaysOldField = category === 'Egg*Chicks';
  const isBreedingBird = category === 'Bird'
    && ['Breeding Hen', 'Breeding Rooster'].includes(birdType);
  const availableLivestockAgeOptions = isBreedingBird
    ? breedingBirdAgeOptions
    : livestockAgeOptions;

  const calculateEggTotal = (unitPrice, itemQuantity) => {
    if (!unitPrice.trim()) return '';
    const unitPriceInCents = Math.round(Number(unitPrice) * 100);
    if (!Number.isFinite(unitPriceInCents)) return '';
    return (unitPriceInCents * itemQuantity / 100).toFixed(2);
  };

  const handlePricePerItemChange = (value) => {
    setPricePerItem(value);
    setPrice(calculateEggTotal(value, quantity));
  };

  const handleQuantityChange = (value) => {
    const nextQuantity = Math.max(0, Number(value) || 0);
    setQuantity(nextQuantity);
    if (showDaysOldField) {
      setPrice(calculateEggTotal(pricePerItem, nextQuantity));
    }
  };

  const handlePriceFocus = () => {
    if (Number(price) === 0) setPrice('');
  };

  const handlePriceBlur = () => {
    if (price === '') setPrice('0');
  };

  const handlePricePerItemFocus = () => {
    if (Number(pricePerItem) === 0) {
      setPricePerItem('');
      setPrice('');
    }
  };

  const handlePricePerItemBlur = () => {
    if (pricePerItem === '') {
      setPricePerItem('0');
      setPrice(calculateEggTotal('0', quantity));
    }
  };

  const handleQuantityFocus = () => {
    if (Number(quantity) === 0) setQuantity('');
  };

  const handleQuantityBlur = () => {
    if (quantity === '') handleQuantityChange(0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFieldErrors({});
    setFormSuccess('');

    if (quantity < 1) {
      setFieldErrors({ quantity: 'Enter a quantity of at least 1 before adding this product.' });
      return;
    }

    const isLivestockCategory = ['Bird', 'Cattel', 'Egg*Chicks'].includes(category);
    if (category === 'Egg*Chicks' && !pricePerItem.trim()) {
      setFieldErrors({ price_per_item: 'Please specify the price for each egg or chick.' });
      return;
    }

    if (isLivestockCategory && !birdType) {
      setFieldErrors({ bird_type: 'Please select a bird type.' });
      return;
    }

    if (isLivestockCategory && !age.trim()) {
      setFieldErrors({ age: 'Please specify the age for this livestock listing.' });
      return;
    }

    if (showDaysOldField && !daysOld.trim()) {
      setFieldErrors({ days_old: 'Please specify the number of days old for this Egg*Chicks listing.' });
      return;
    }

    setIsSubmitting(true);
    const formData = new FormData();
    formData.append('name', name);
    formData.append('price', `${CURRENCY_SYMBOL}${price}`);
    if (category === 'Egg*Chicks') {
      formData.append('price_per_item', `${CURRENCY_SYMBOL}${pricePerItem.trim()}`);
    }
    formData.append('quantity', quantity);
    formData.append('description', description);
    formData.append('category', category);
    if (isLivestockCategory) {
      formData.append('bird_type', birdType);
      formData.append('age', age.trim());
    }
    if (showDaysOldField) {
      formData.append('days_old', daysOld.trim());
    }
    formData.append('seller', userName);
    // Add uploaded images
    images.forEach((image, index) => {
      formData.append('images', image);
    });

    // Add image URLs
    imageUrls.filter(url => url.trim()).forEach((url, index) => {
      formData.append(`image_urls[${index}]`, url);
    });

    // Add uploaded videos
    videos.forEach((video, index) => {
      formData.append('videos', video);
    });

    breederHenMedia.forEach((media) => {
      formData.append(media.type.startsWith('video/') ? 'breeder_hen_videos' : 'breeder_hen_images', media);
    });
    breederRoosterMedia.forEach((media) => {
      formData.append(media.type.startsWith('video/') ? 'breeder_rooster_videos' : 'breeder_rooster_images', media);
    });

    // Add video URLs
    videoUrls.filter(url => url.trim()).forEach((url, index) => {
      formData.append(`video_urls[${index}]`, url);
    });

    audioUrls.filter(url => url.trim()).forEach((url, index) => {
      formData.append(`audio_urls[${index}]`, url);
    });

    const success = await onAddProduct(formData);
    if (!success || success.success === false) {
      const errors = success?.errors || {};
      const nextFieldErrors = Object.fromEntries(
        Object.entries(errors)
          .filter(([field]) => field !== 'non_field_errors' && field !== 'detail')
          .map(([field, value]) => [field, Array.isArray(value) ? value[0] : value])
      );
      setFieldErrors(nextFieldErrors);
      setFormError(errors.non_field_errors?.[0] || errors.detail || (!Object.keys(nextFieldErrors).length ? 'Unable to add product. Please verify all fields and try again.' : ''));
      setIsSubmitting(false);
      return;
    }

    setFormSuccess('Product added successfully.');
    setName('');
    setPrice('0');
    setPricePerItem('0');
    setQuantity(0);
    setBetterHenModel(null);
    setRoosterModel(null);
    setBreederHenMedia([]);
    setBreederRoosterMedia([]);
    setDescription('');
    setImages([]);
    setVideos([]);
    setImageUrls([]);
    setVideoUrls([]);
    setAudioUrls([]);
    setBirdType('Breeding Hen');
    setAge('');
    setDaysOld('');
    setIsSubmitting(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal product-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add New Product</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit} className="auth-form product-form" encType="multipart/form-data">
          <div className="product-form-grid">
            <div className="form-group form-span-2">
              <label htmlFor="product-name">Product Name</label>
              <input
                id="product-name"
                type="text"
                value={name}
                className={getFieldError('name') ? 'input-error' : ''}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Fresh Organic Eggs"
                required
              />
              {getFieldError('name') && <div className="field-error">{getFieldError('name')}</div>}
            </div>

            {!showDaysOldField && (
              <div className="form-group">
                <label htmlFor="product-price">Price (₹)</label>
                <input
                  id="product-price"
                  type="number"
                  value={price}
                  className={getFieldError('price') ? 'input-error' : ''}
                  onChange={(e) => setPrice(e.target.value)}
                  onFocus={handlePriceFocus}
                  onBlur={handlePriceBlur}
                  placeholder="29"
                  step="0.01"
                  required
                />
                {getFieldError('price') && <div className="field-error">{getFieldError('price')}</div>}
              </div>
            )}

            {category === 'Egg*Chicks' && (
              <div className="form-group per-item-price-field">
                <label htmlFor="product-price-per-item">Price per egg/chick (₹)</label>
                <div className={`money-input-control ${getFieldError('price_per_item') ? 'input-error' : ''}`}>
                  <span className="money-input-prefix" aria-hidden="true">₹</span>
                  <input
                    id="product-price-per-item"
                    type="number"
                    min="0"
                    step="0.01"
                    value={pricePerItem}
                    onChange={(e) => handlePricePerItemChange(e.target.value)}
                    onFocus={handlePricePerItemFocus}
                    onBlur={handlePricePerItemBlur}
                    placeholder="0.00"
                    required
                  />
                </div>
                <span className="field-hint">Shown to buyers for one egg or chick.</span>
                {getFieldError('price_per_item') && <div className="field-error">{getFieldError('price_per_item')}</div>}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="product-quantity">Quantity</label>
              <div className="quantity-control">
                <button
                  type="button"
                  className="quantity-stepper-button"
                  aria-label="Decrease quantity"
                  title="Decrease quantity"
                  disabled={quantity <= 0}
                  onClick={() => handleQuantityChange(quantity - 1)}
                >
                  <span aria-hidden="true">−</span>
                </button>
                <input
                  id="product-quantity"
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  value={quantity}
                  className={`quantity-input ${getFieldError('quantity') ? 'input-error' : ''}`}
                  onChange={(e) => handleQuantityChange(e.target.value)}
                  onFocus={handleQuantityFocus}
                  onBlur={handleQuantityBlur}
                  required
                />
                <button
                  type="button"
                  className="quantity-stepper-button"
                  aria-label="Increase quantity"
                  title="Increase quantity"
                  onClick={() => handleQuantityChange(quantity + 1)}
                >
                  <span aria-hidden="true">+</span>
                </button>
              </div>
              {getFieldError('quantity') && <div className="field-error">{getFieldError('quantity')}</div>}
            </div>

            {showDaysOldField && (
              <div className="form-group form-span-2 total-price-field">
                <label htmlFor="product-price">Total price</label>
                <div className={`money-input-control total-price-control ${getFieldError('price') ? 'input-error' : ''}`}>
                  <span className="money-input-prefix" aria-hidden="true">₹</span>
                  <input
                    id="product-price"
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    step="0.01"
                    readOnly
                    required
                  />
                </div>
                <span className="field-hint">Price per egg/chick multiplied by quantity.</span>
                {getFieldError('price') && <div className="field-error">{getFieldError('price')}</div>}
              </div>
            )}

            <div className="form-group form-span-2">
              <label htmlFor="product-category">Category</label>
              <select
                id="product-category"
                value={category}
                className={getFieldError('category') ? 'input-error' : ''}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setAge('');
                }}
              >
                {PRODUCT_CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {getFieldError('category') && <div className="field-error">{getFieldError('category')}</div>}
              {category === 'Egg*Chicks' && (
                <div className="field-note">Hen and rooster models are optional.</div>
              )}
              {['Bird', 'Cattel'].includes(category) && (
                <div className="field-note">Select the livestock type and age for this listing.</div>
              )}
            </div>

            {['Bird', 'Cattel', 'Egg*Chicks'].includes(category) && (
              <>
                <div className="form-group">
                  <label htmlFor="product-bird-type">Bird Type</label>
                  <select
                    id="product-bird-type"
                    value={birdType}
                    className={getFieldError('bird_type') ? 'input-error' : ''}
                    onChange={(e) => {
                      setBirdType(e.target.value);
                      setAge('');
                    }}
                  >
                    {birdTypeOptions.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                  {getFieldError('bird_type') && <div className="field-error">{getFieldError('bird_type')}</div>}
                </div>

                <div className="form-group">
                  <label htmlFor="product-age">Age</label>
                  <select
                    id="product-age"
                    className={`age-select ${getFieldError('age') ? 'input-error' : ''}`}
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    required
                  >
                    <option value="" disabled>Select age</option>
                    {availableLivestockAgeOptions.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                  {getFieldError('age') && <div className="field-error">{getFieldError('age')}</div>}
                </div>

                {showDaysOldField && (
                  <div className="form-group">
                    <label htmlFor="product-days-old">Days Old</label>
                    <input
                      id="product-days-old"
                      type="number"
                      min="1"
                      value={daysOld}
                      className={getFieldError('days_old') ? 'input-error' : ''}
                      onChange={(e) => setDaysOld(e.target.value)}
                      placeholder="e.g. 24"
                    />
                    {getFieldError('days_old') && <div className="field-error">{getFieldError('days_old')}</div>}
                  </div>
                )}
              </>
            )}

            {category === 'Egg*Chicks' && (
              <>
                <div className="form-group breeder-media-section">
                  <label htmlFor="breeder-hen-media">Breeder Hen Photos/Videos</label>
                  <div className="file-upload-section">
                    <input
                      id="breeder-hen-media"
                      type="file"
                      multiple
                      accept="image/*,video/*"
                      onChange={(e) => handleBreederMediaUpload(setBreederHenMedia, e)}
                      style={{ display: 'none' }}
                    />
                    <label htmlFor="breeder-hen-media" className="file-upload-btn">Choose Hen Media</label>
                  </div>
                  {breederHenMedia.length > 0 && (
                    <div className="uploaded-files">
                      {breederHenMedia.map((media, index) => (
                        <div className="file-item" key={`${media.name}-${index}`}>
                          <span>{media.name}</span>
                          <button type="button" aria-label={`Remove ${media.name}`} onClick={() => removeBreederMedia(setBreederHenMedia, index)}>Remove</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="form-group breeder-media-section">
                  <label htmlFor="breeder-rooster-media">Breeder Rooster Photos/Videos</label>
                  <div className="file-upload-section">
                    <input
                      id="breeder-rooster-media"
                      type="file"
                      multiple
                      accept="image/*,video/*"
                      onChange={(e) => handleBreederMediaUpload(setBreederRoosterMedia, e)}
                      style={{ display: 'none' }}
                    />
                    <label htmlFor="breeder-rooster-media" className="file-upload-btn">Choose Rooster Media</label>
                  </div>
                  {breederRoosterMedia.length > 0 && (
                    <div className="uploaded-files">
                      {breederRoosterMedia.map((media, index) => (
                        <div className="file-item" key={`${media.name}-${index}`}>
                          <span>{media.name}</span>
                          <button type="button" aria-label={`Remove ${media.name}`} onClick={() => removeBreederMedia(setBreederRoosterMedia, index)}>Remove</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
            {formError && (
              <div className="form-message-row">
                <div className="form-error" role="alert">{formError}</div>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="product-description">Description</label>
              <textarea
                id="product-description"
                value={description}
                className={getFieldError('description') ? 'input-error' : ''}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your product..."
                rows="4"
                required
              />
              {getFieldError('description') && <div className="field-error">{getFieldError('description')}</div>}
            </div>

            {/* Image Upload Section */}
            <div className="form-group">
              <label>Product Images</label>
              <div className="file-upload-section">
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleImageUpload}
                  style={{ display: 'none' }}
                  id="image-upload"
                />
                <label htmlFor="image-upload" className="file-upload-btn">
                  📷 Choose Images
                </label>
                <button type="button" onClick={addImageUrl} className="url-add-btn">
                  🔗 Add Image URL
                </button>
              </div>
              {images.length > 0 && (
                <div className="field-note">{images.length} image{images.length === 1 ? '' : 's'} selected. You can select more images to add them.</div>
              )}

              {/* Display uploaded images */}
              {images.length > 0 && (
                <div className="uploaded-files">
                  <h4>Uploaded Images:</h4>
                  {images.map((image, index) => (
                    <div key={index} className="file-item">
                      <span>{image.name}</span>
                      <button type="button" onClick={() => removeImage(index)}>❌</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Image URLs */}
              {imageUrls.map((url, index) => (
                <div key={index} className="url-input-group">
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => updateImageUrl(index, e.target.value)}
                    placeholder="https://example.com/image.jpg"
                  />
                  <button type="button" onClick={() => removeImageUrl(index)}>❌</button>
                </div>
              ))}
            </div>

            {/* Video Upload Section */}
            <div className="form-group">
              <label>Product Videos</label>
              <div className="file-upload-section">
                <input
                  type="file"
                  multiple
                  accept="video/mp4,video/webm,video/ogg,.mp4,.webm,.ogv"
                  onChange={handleVideoUpload}
                  style={{ display: 'none' }}
                  id="video-upload"
                />
                <label htmlFor="video-upload" className="file-upload-btn">
                  🎥 Choose Videos
                </label>
                <button type="button" onClick={addVideoUrl} className="url-add-btn">
                  🔗 Add Video URL
                </button>
              </div>
              <span className="field-hint">Maximum uploaded video size: 100 MB per file.</span>
              {videoUploadError && <div className="field-error" role="alert" aria-live="assertive">{videoUploadError}</div>}

              {/* Display uploaded videos */}
              {videos.length > 0 && (
                <div className="uploaded-files">
                  <h4>Uploaded Videos:</h4>
                  {videos.map((video, index) => (
                    <div key={index} className="file-item">
                      <span>{video.name}</span>
                      <button type="button" onClick={() => removeVideo(index)}>❌</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Video URLs */}
              {videoUrls.map((url, index) => (
                <div key={index} className="url-input-group">
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => updateVideoUrl(index, e.target.value)}
                    placeholder="https://example.com/video.mp4"
                  />
                  <button type="button" onClick={() => removeVideoUrl(index)}>❌</button>
                </div>
              ))}
            </div>

            <div className="form-group">
              <label>Product Audio URL</label>
              <div className="file-upload-section">
                <button type="button" onClick={addAudioUrl} className="url-add-btn">
                  🔗 Add Audio URL
                </button>
              </div>
              <span className="field-hint">Audio files can no longer be uploaded here; add a publicly accessible audio URL instead.</span>
              {audioUrls.map((url, index) => (
                <div className="url-input-group" key={`audio-url-${index}`}>
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => updateAudioUrl(index, e.target.value)}
                    placeholder="https://example.com/audio.mp3"
                    aria-label={`Product audio URL ${index + 1}`}
                  />
                  <button type="button" aria-label={`Remove audio URL ${index + 1}`} onClick={() => removeAudioUrl(index)}>×</button>
                </div>
              ))}
            </div>
          </div>

          <div className="form-actions">
            {formSuccess && <div className="form-success" role="status">{formSuccess}</div>}
            <button type="submit" className="auth-btn" disabled={isSubmitting} aria-busy={isSubmitting}>
              {isSubmitting ? 'Adding product…' : 'Add Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const HeroSlider = React.memo(function HeroSlider({ products = [], onSelectProduct, selectedCategory = null, search = '', wishlist = [], orders = [] }) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const touchStartX = React.useRef(null);

  const getSellerStats = (product) => {
    const sellerName = String(product?.seller || 'Kukuta Farm').trim() || 'Kukuta Farm';
    const orderCount = orders.filter((order) => {
      const seller = order?.seller || order?.seller_name || order?.sellerName || '';
      return String(seller).toLowerCase() === sellerName.toLowerCase();
    }).length;

    const seed = sellerName.split('').reduce((total, char) => total + char.charCodeAt(0), 0);
    const rating = Number((4.2 + ((seed % 9) * 0.08)).toFixed(1));
    return {
      rating: Math.min(5, rating),
      orders: orderCount,
    };
  };

  const fallbackSlides = [
    {
      title: 'Fresh farm essentials for every day living.',
      subtitle: 'Curated poultry, feed, and healthy-living products chosen for quality, value, and trust.',
      gradient: 'linear-gradient(135deg, #10291a 0%, #1d472a 34%, #5a8948 100%)',
      emoji: '🐔',
    },
    {
      title: 'Smart nutrition for stronger flocks.',
      subtitle: 'Premium feed, poultry care, and daily essentials designed for healthy growth and better yields.',
      gradient: 'linear-gradient(135deg, #7a4d0d 0%, #d39d3f 42%, #f7e5b8 100%)',
      emoji: '🥚',
    },
    {
      title: 'Better sourcing. Better outcomes.',
      subtitle: 'From trusted sellers to faster delivery, every order is built around reliability and care.',
      gradient: 'linear-gradient(135deg, #0e3d38 0%, #216f6d 36%, #a6d7ca 100%)',
      emoji: '🌿',
    },
  ];

  const normalizedSearch = search.trim().toLowerCase();
  const productSlides = React.useMemo(() => {
    return [...products]
      .map((product) => {
        const searchableText = `${product.name || ''} ${product.description || ''} ${product.seller || ''}`.toLowerCase();
        let score = 0;
        if (selectedCategory && product.category === selectedCategory) score += 5;
        if (normalizedSearch && searchableText.includes(normalizedSearch)) score += 4;
        if (wishlist.includes(product.id)) score += 3;
        return { product, score };
      })
      .sort((left, right) => right.score - left.score || right.product.id - left.product.id)
      .slice(0, 3)
      .map(({ product }, index) => ({
        title: product.name,
        subtitle: `${getCategoryLabel(product.category) || 'Farm product'} from ${product.seller || 'Kukuta Farm'}`,
        seller: product.seller || 'Kukuta Farm',
        productId: product.id,
        product,
        gradient: fallbackSlides[index % fallbackSlides.length].gradient,
        emoji: fallbackSlides[index % fallbackSlides.length].emoji,
      }));
  }, [products, selectedCategory, normalizedSearch, wishlist]);

  const slides = productSlides.length > 0 ? productSlides : fallbackSlides;

  React.useEffect(() => {
    if (slides.length < 2 || isHovered || isFocused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return undefined;
    }
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [slides.length, isHovered, isFocused]);

  React.useEffect(() => {
    setCurrentSlide((slide) => Math.min(slide, slides.length - 1));
  }, [slides.length]);

  const getSlideSellerStats = (slide) => slide.product ? getSellerStats(slide.product) : { rating: 4.9, orders: 1200 };

  const goToSlide = (index) => setCurrentSlide(index);
  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % slides.length);
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  const handleTouchStart = (event) => {
    touchStartX.current = event.changedTouches[0]?.clientX ?? null;
  };
  const handleTouchEnd = (event) => {
    if (touchStartX.current === null) return;
    const distance = (event.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(distance) < 48) return;
    distance < 0 ? nextSlide() : prevSlide();
  };

  return (
    <section
      className="hero-slider scroll-reveal"
      aria-label="Featured products"
      aria-roledescription="carousel"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocusCapture={() => setIsFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsFocused(false);
      }}
    >
      {slides.map((slide, index) => {
        const sellerStats = getSlideSellerStats(slide);
        return (
          <div
            key={slide.productId ?? slide.title}
            className={`hero-slide ${index === currentSlide ? 'active' : ''}`}
            style={{ background: slide.gradient }}
            role="group"
            aria-roledescription="slide"
            aria-label={`${index + 1} of ${slides.length}`}
            aria-hidden={index !== currentSlide}
            inert={index !== currentSlide}
          >
            <div className="hero-slide-inner">
              <div className="hero-copy">
                <span className="hero-badge">Fresh from Kukuta</span>
                <h2>{slide.title}</h2>
                <p>{slide.subtitle}</p>

                <div className="hero-seller-meta">
                  <span className="seller-star">★</span>
                  <strong>{sellerStats.rating.toFixed(1)}/5</strong>
                  <span>buyer rating</span>
                  <span>•</span>
                  <span>{sellerStats.orders} orders</span>
                </div>

                <div className="hero-actions">
                  <button className="slide-primary" onClick={() => slide.productId && onSelectProduct?.(slide.productId)}>
                    {slide.productId ? 'View product' : 'Explore products'}
                  </button>
                  <span className="slide-secondary">{slide.seller ? `Sold by ${slide.seller}` : 'Meet our farmers'}</span>
                </div>
              </div>

              <div className="hero-visual">
                <div className="hero-visual-card">
                  {slide.product ? (
                    <button
                      type="button"
                      className="hero-product-image"
                      onClick={() => onSelectProduct?.(slide.productId)}
                      aria-label={`View ${slide.title}`}
                    >
                      {getProductImage(slide.product, { isPriority: index === currentSlide })}
                    </button>
                  ) : (
                    <div className="hero-emoji">{slide.emoji}</div>
                  )}

                  <div className="hero-mini-card">
                    <span className="mini-label">Featured</span>
                    <strong>{slide.product ? slide.product.name : 'Trusted farm picks'}</strong>
                    <small>{slide.product ? `${slide.product.category || 'Farm essentials'}` : 'Healthy living essentials'}</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      <button className="slider-btn prev-btn" type="button" onClick={prevSlide} aria-label="Previous slide">‹</button>
      <button className="slider-btn next-btn" type="button" onClick={nextSlide} aria-label="Next slide">›</button>
      <div className="slider-dots">
        {slides.map((_, index) => (
          <button
            key={index}
            className={`dot ${index === currentSlide ? 'active' : ''}`}
            onClick={() => goToSlide(index)}
            aria-label={`Go to slide ${index + 1}`}
            aria-current={index === currentSlide ? 'true' : undefined}
          />
        ))}
      </div>
    </section>
  );
});

function ProductDetail({ product, relatedProducts, onBack, onOrder, onViewRelated, currentUser, onToggleWishlist, isWishlisted, onAddToCart, onContactSeller }) {
  const [reviews, setReviews] = useState([]);
  const [sellerReviews, setSellerReviews] = useState([]);
  const [reviewRating, setReviewRating] = useState('5');
  const [reviewComment, setReviewComment] = useState('');
  const [reviewImages, setReviewImages] = useState([]);
  const [editingReviewId, setEditingReviewId] = useState(null);
  const [editReviewRating, setEditReviewRating] = useState('5');
  const [editReviewComment, setEditReviewComment] = useState('');
  const [reviewError, setReviewError] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [orderNotice, setOrderNotice] = useState('');
  const touchStartX = React.useRef(null);
  const isOwnProduct = currentUser?.role === 'seller'
    && String(product?.seller || '').trim().toLowerCase() === String(currentUser?.username || '').trim().toLowerCase();

  useEffect(() => {
    setOrderNotice('');
  }, [product?.id]);

  const productMedia = useMemo(() => {
    if (!product) return [];

    const imageItems = Array.isArray(product.images) ? product.images.map((item, index) => ({
      id: item?.id ?? `${product.id}-image-${index}`,
      type: 'image',
      url: item?.image_url || item?.image || '',
      alt: item?.alt_text || product.name || 'Product image',
    })) : [];

    const videoItems = Array.isArray(product.videos) ? product.videos.map((item, index) => ({
      id: item?.id ?? `${product.id}-video-${index}`,
      type: 'video',
      url: item?.video_url || item?.video || '',
      alt: item?.title || `${product.name || 'Product'} video`,
    })) : [];

    const audioItems = Array.isArray(product.audios) ? product.audios.map((item, index) => ({
      id: item?.id ?? `${product.id}-audio-${index}`,
      type: 'audio',
      url: item?.audio_url || item?.audio || '',
      alt: item?.title || `${product.name || 'Product'} audio`,
    })) : [];

    const merged = [...imageItems, ...videoItems, ...audioItems];

    if (merged.length === 0) {
      const primaryImage = typeof product.image === 'string' && product.image && product.image !== '🥚' ? product.image : '';
      return primaryImage ? [{ id: `${product.id}-primary-image`, type: 'image', url: primaryImage, alt: product.name || 'Product image' }] : [];
    }

    return merged;
  }, [product]);

  useEffect(() => {
    setCurrentMediaIndex(0);
  }, [product?.id]);

  const currentMedia = productMedia[currentMediaIndex] || productMedia[0] || null;
  const displayMediaCount = productMedia.length;

  const goToMedia = (direction) => {
    if (!productMedia.length) return;
    setCurrentMediaIndex((previous) => {
      if (direction === 'next') return (previous + 1) % productMedia.length;
      return (previous - 1 + productMedia.length) % productMedia.length;
    });
  };

  const handleMediaTouchStart = (event) => {
    touchStartX.current = event.changedTouches[0]?.clientX ?? null;
  };

  const handleMediaTouchEnd = (event) => {
    if (touchStartX.current === null) return;
    const distance = (event.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(distance) < 48) return;
    goToMedia(distance < 0 ? 'next' : 'prev');
  };

  const handleShareProduct = async (product) => {
    const productName = product?.name || 'Kukuta product';
    const productPrice = product?.price || 'Check it out';
    const shareText = `Check out ${productName} on Kukuta for ${productPrice}.`;
    const shareUrl = typeof window !== 'undefined' ? window.location.href : 'https://kukuta.com';

    try {
      if (navigator.share) {
        await navigator.share({
          title: productName,
          text: shareText,
          url: shareUrl,
        });
        return;
      }
    } catch (error) {
      if (error && error.name === 'AbortError') return;
    }

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
        window.alert('Product link copied to clipboard.');
        return;
      }

      const tempInput = document.createElement('textarea');
      tempInput.value = `${shareText} ${shareUrl}`;
      document.body.appendChild(tempInput);
      tempInput.select();
      document.execCommand('copy');
      document.body.removeChild(tempInput);
      window.alert('Product link copied to clipboard.');
    } catch (error) {
      window.alert('Sharing is not supported in this browser.');
    }
  };

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      apiFetch(`/reviews/?product=${product.id}`, { method: 'GET' }),
      apiFetch(`/reviews/?seller=${encodeURIComponent(product.seller || '')}`, { method: 'GET' }),
    ])
      .then(async ([productResult, sellerResult]) => {
        const productData = productResult.status === 'fulfilled' && productResult.value.ok
          ? await productResult.value.json()
          : [];
        const sellerData = sellerResult.status === 'fulfilled' && sellerResult.value.ok
          ? await sellerResult.value.json()
          : [];
        if (active) {
          setReviews(Array.isArray(productData) ? productData : productData.results || []);
          setSellerReviews(Array.isArray(sellerData) ? sellerData : sellerData.results || []);
        }
      })
      .catch(() => {
        if (active) {
          setSellerReviews([]);
        }
      });
    return () => { active = false; };
  }, [product.id]);

  const sellerAverage = sellerReviews.length > 0
    ? sellerReviews.reduce((total, review) => total + Number(review.rating || 0), 0) / sellerReviews.length
    : null;

  const handleReviewSubmit = async (event) => {
    event.preventDefault();
    setReviewError('');
    if (!currentUser) {
      setReviewError('Please sign in as a buyer to add a review.');
      return;
    }
    if (currentUser.role !== 'buyer') {
      setReviewError('Only buyers can add product reviews.');
      return;
    }
    if (!reviewComment.trim()) {
      setReviewError('Please write a review before submitting.');
      return;
    }

    setReviewSubmitting(true);
    try {
      const reviewBody = new FormData();
      reviewBody.append('product', product.id);
      reviewBody.append('rating', Number(reviewRating));
      reviewBody.append('comment', reviewComment.trim());
      reviewImages.forEach((image) => reviewBody.append('images', image));
      const response = await apiFetch('/reviews/', {
        method: 'POST',
        body: reviewBody,
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.non_field_errors?.[0] || data?.detail || 'Unable to add review.');
      }
      setReviews((previous) => [data, ...previous]);
      setReviewComment('');
      setReviewImages([]);
    } catch (error) {
      setReviewError(error.message || 'Unable to add review.');
    } finally {
      setReviewSubmitting(false);
    }
  };

  const startEditingReview = (review) => {
    setEditingReviewId(review.id);
    setEditReviewRating(String(review.rating));
    setEditReviewComment(review.comment || '');
    setReviewError('');
  };

  const handleReviewUpdate = async (event, reviewId) => {
    event.preventDefault();
    if (!editReviewComment.trim()) {
      setReviewError('Please write a review before saving.');
      return;
    }
    setReviewSubmitting(true);
    setReviewError('');
    try {
      const response = await apiFetch(`/reviews/${reviewId}/`, {
        method: 'PATCH',
        body: { rating: Number(editReviewRating), comment: editReviewComment.trim() },
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.detail || 'Unable to update review.');
      }
      setReviews((previous) => previous.map((review) => review.id === reviewId ? { ...review, ...data } : review));
      setEditingReviewId(null);
      setEditReviewComment('');
    } catch (error) {
      setReviewError(error.message || 'Unable to update review.');
    } finally {
      setReviewSubmitting(false);
    }
  };

  return (
    <section className="product-detail-page">
      <button className="back-button" onClick={onBack}>← Back to products</button>
      <div className="product-detail-layout">
        <div className="product-detail-card">
          <div
            className="product-detail-gallery"
            onTouchStart={handleMediaTouchStart}
            onTouchEnd={handleMediaTouchEnd}
          >
            <div className="product-detail-image">
              <button
                className="product-detail-share-btn"
                type="button"
                onClick={() => handleShareProduct(product)}
                aria-label={`Share ${product.name}`}
                title="Share product"
              >
                <span aria-hidden="true">↗</span>
              </button>
              {currentMedia ? (
                currentMedia.type === 'video' ? (
                  <video src={currentMedia.url} controls playsInline preload="metadata" aria-label={currentMedia.alt || `${product.name} video`} poster={product.image && product.image !== '🥚' ? product.image : undefined}>
                    <source src={currentMedia.url} />
                  </video>
                ) : currentMedia.type === 'audio' ? (
                  <div className="product-detail-audio">
                    <span className="product-detail-audio-icon" aria-hidden="true">♫</span>
                    <strong>{currentMedia.alt || `${product.name} audio`}</strong>
                    <audio src={currentMedia.url} controls preload="metadata" aria-label={currentMedia.alt || `${product.name} audio`}>
                      <source src={currentMedia.url} />
                      Your browser does not support audio playback.
                    </audio>
                  </div>
                ) : (
                  <img src={currentMedia.url} alt={currentMedia.alt || product.name || 'Product image'} loading="eager" decoding="async" />
                )
              ) : (
                getProductImage(product)
              )}
            </div>

            {displayMediaCount > 1 && (
              <div className="product-detail-media-toolbar">
                <div className="product-detail-media-nav">
                  <button type="button" className="product-detail-media-button" onClick={() => goToMedia('prev')} aria-label="Previous media">← Prev</button>
                  <span className="product-detail-media-counter">{currentMediaIndex + 1} / {displayMediaCount}</span>
                  <button type="button" className="product-detail-media-button" onClick={() => goToMedia('next')} aria-label="Next media">Next →</button>
                </div>
                <div className="product-detail-media-thumbs">
                  {productMedia.map((media, index) => {
                    const mediaLabel = media.alt || `${media.type === 'video' ? 'Product video' : media.type === 'audio' ? 'Product audio' : 'Product image'} ${index + 1}`;
                    return (
                      <button
                        key={media.id || `${media.type}-${index}`}
                        type="button"
                        className={`product-detail-media-thumb ${index === currentMediaIndex ? 'is-active' : ''}`}
                        onClick={() => setCurrentMediaIndex(index)}
                        aria-label={`View ${mediaLabel}`}
                      >
                        <span className="product-detail-media-thumb-visual">
                          {media.type === 'video' ? (
                            <video src={media.url} muted playsInline preload="metadata" aria-hidden="true" />
                          ) : media.type === 'audio' ? (
                            <span className="product-detail-audio-thumb" aria-hidden="true">♫</span>
                          ) : (
                            <img src={media.url} alt="" loading="lazy" decoding="async" />
                          )}
                          <span className={`product-detail-media-kind ${media.type}`} aria-hidden="true">
                            {media.type === 'video' ? 'Video' : media.type === 'audio' ? 'Audio' : 'Photo'}
                          </span>
                        </span>
                        <span className="product-detail-media-thumb-caption" title={mediaLabel}>{mediaLabel}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="product-detail-info">
            <h2>{product.name}</h2>
            {product.seller && <p className="seller-info">Sold by {product.seller}</p>}
            <p className="product-description">{product.description}</p>
            <div className="product-detail-price">{product.price}</div>
            {product.category === 'Egg*Chicks' && product.price_per_item && (
              <div className="product-detail-unit-price">
                <span>Price of each egg/chick</span>
                <strong>{product.price_per_item}</strong>
              </div>
            )}
            {currentUser?.role === 'buyer' && sellerAverage !== null && sellerAverage < 3 && (
              <div className="seller-fraud-alert" role="alert" aria-live="assertive">
                <span className="seller-fraud-alert-icon" aria-hidden="true">⚠</span>
                <div>
                  <span className="seller-fraud-alert-label">Buyer safety notice</span>
                  <strong>Caution: low-rated seller</strong>
                  <span>Rated {sellerAverage.toFixed(1)}/5. Check previous buyers' feedback before ordering and use secure payment methods.</span>
                </div>
              </div>
            )}
            <div className="product-detail-actions">
              <button className="cart-add-btn" onClick={() => onAddToCart(product)}>
                Add to Cart
              </button>
              <button className="add-cart-btn" onClick={() => {
                setOrderNotice('');
                if (isOwnProduct) {
                  setOrderNotice('This is your product. You cannot order or start a chat for your own listing.');
                  return;
                }
                onOrder(product);
              }}>
                Order Now
              </button>
            </div>
            {orderNotice && (
              <div className="seller-fraud-alert" role="alert" aria-live="polite">
                <span className="seller-fraud-alert-icon" aria-hidden="true">!</span>
                <div>
                  <span className="seller-fraud-alert-label">Order notice</span>
                  <strong>This is your product</strong>
                  <span>You cannot order or start a chat for your own listing.</span>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
      <section className="product-reviews-panel">
        <div className="reviews-heading">
          <div>
            <span className="reviews-kicker">Customer feedback</span>
            <h3>Reviews for {product.name}</h3>
          </div>
          <span className="reviews-count">{reviews.length} review{reviews.length === 1 ? '' : 's'}</span>
        </div>
        {reviews.length > 0 ? (
          <div className="reviews-list">
            {reviews.map((review) => (
              <article className="review-item" key={review.id}>
                {editingReviewId === review.id ? (
                  <form className="review-edit-form" onSubmit={(event) => handleReviewUpdate(event, review.id)}>
                    <div className="review-edit-heading">Edit your review</div>
                    <div className="rating-stars" role="radiogroup" aria-label="Edit product rating">
                      {[1, 2, 3, 4, 5].map((rating) => (
                        <button key={rating} type="button" className={rating <= Number(editReviewRating) ? 'selected' : ''} onClick={() => setEditReviewRating(String(rating))} role="radio" aria-checked={Number(editReviewRating) === rating} aria-label={`${rating} star${rating === 1 ? '' : 's'}`}>★</button>
                      ))}
                    </div>
                    <textarea value={editReviewComment} onChange={(event) => setEditReviewComment(event.target.value)} rows="3" aria-label="Edit review comment" />
                    <div className="review-edit-actions">
                      <button className="auth-btn review-submit" type="submit" disabled={reviewSubmitting}>{reviewSubmitting ? 'Saving...' : 'Save review'}</button>
                      <button className="review-edit-cancel" type="button" onClick={() => setEditingReviewId(null)}>Cancel</button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="review-item-header">
                      <strong>{review.buyer_name || 'Buyer'}</strong>
                      <span className="review-stars" aria-label={`${review.rating} out of 5 stars`}>{'★'.repeat(review.rating)}<span>{'★'.repeat(5 - review.rating)}</span></span>
                    </div>
                    <p>{review.comment}</p>
                    {review.images?.length > 0 && (
                      <div className="review-images">
                        {review.images.map((image, index) => (
                          <img key={`${review.id}-image-${index}`} src={image} alt={`Review photo ${index + 1}`} />
                        ))}
                      </div>
                    )}
                    {currentUser?.role === 'buyer' && (review.buyer === currentUser.id || review.buyer_name === currentUser.username) && (
                      <button className="review-edit-btn" type="button" onClick={() => startEditingReview(review)}>Edit review</button>
                    )}
                  </>
                )}
              </article>
            ))}
          </div>
        ) : (
          <p className="reviews-empty">No reviews yet. Be the first buyer to share your experience.</p>
        )}
        <form className="review-form" onSubmit={handleReviewSubmit}>
          <div className="review-form-heading">Review this product and seller</div>
          <div className="review-form-row">
            <fieldset className="rating-input" disabled={!currentUser || currentUser.role !== 'buyer'}>
              <legend>Rating</legend>
              <div className="rating-stars" role="radiogroup" aria-label="Product rating">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    key={rating}
                    type="button"
                    className={rating <= Number(reviewRating) ? 'selected' : ''}
                    onClick={() => setReviewRating(String(rating))}
                    role="radio"
                    aria-checked={Number(reviewRating) === rating}
                    aria-label={`${rating} star${rating === 1 ? '' : 's'}`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </fieldset>
            <textarea
              value={reviewComment}
              onChange={(event) => setReviewComment(event.target.value)}
              placeholder="Tell other buyers about this product and seller."
              rows="3"
              disabled={!currentUser || currentUser.role !== 'buyer'}
            />
            <label className="review-image-picker">
              <span>Add photos</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                onChange={(event) => setReviewImages(Array.from(event.target.files || []).slice(0, 5))}
                disabled={!currentUser || currentUser.role !== 'buyer'}
              />
              {reviewImages.length > 0 && <small>{reviewImages.length} photo{reviewImages.length === 1 ? '' : 's'} selected</small>}
            </label>
            <button className="auth-btn review-submit" type="submit" disabled={reviewSubmitting || !currentUser || currentUser.role !== 'buyer'}>
              {reviewSubmitting ? 'Posting...' : 'Post review'}
            </button>
          </div>
          {reviewError && <div className="form-error" role="alert">{reviewError}</div>}
          {!currentUser && <div className="review-note">Sign in as a buyer to leave a review.</div>}
        </form>
      </section>
      <div className="related-products-panel">
        <h3>Related products</h3>
        {relatedProducts.length > 0 ? (
          <div className="related-products-grid">
            {relatedProducts.map((related) => (
              <div key={related.id} className="related-product-card" onClick={() => onViewRelated(related.id)}>
                <div className="related-product-image">{getProductImage(related)}</div>
                <div>
                  <h4>{related.name}</h4>
                  <p>{related.price}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p>No related products available.</p>
        )}
      </div>
      <section className="seller-reviews-panel">
        <div className="reviews-heading">
          <div>
            <span className="reviews-kicker">Seller feedback</span>
            <h3>Reviews for {product.seller || 'this seller'}</h3>
          </div>
          <span className="reviews-count">
            {sellerReviews.length} review{sellerReviews.length === 1 ? '' : 's'}
            {sellerAverage !== null ? ` · ${sellerAverage.toFixed(1)}/5` : ''}
          </span>
        </div>
        {sellerReviews.length > 0 ? (
          <div className="reviews-list">
            {sellerReviews.map((review) => (
              <article className="review-item" key={`seller-${review.id}`}>
                <div className="review-item-header">
                  <strong>{review.buyer_name || 'Buyer'}</strong>
                  <span className="review-stars" aria-label={`${review.rating} out of 5 stars`}>{'★'.repeat(review.rating)}<span>{'★'.repeat(5 - review.rating)}</span></span>
                </div>
                <p>{review.comment}</p>
                {review.images?.length > 0 && (
                  <div className="review-images">
                    {review.images.map((image, index) => (
                      <img key={`${review.id}-seller-image-${index}`} src={image} alt={`Review photo ${index + 1}`} />
                    ))}
                  </div>
                )}
                <small>About {review.product_name || 'a product from this seller'}</small>
              </article>
            ))}
          </div>
        ) : (
          <p className="reviews-empty">No seller reviews yet.</p>
        )}
      </section>
    </section>
  );
}

export default function App() {
  const [showRoosterAnimation, setShowRoosterAnimation] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isSigninOpen, setIsSigninOpen] = useState(false);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isForgotPasswordPage, setIsForgotPasswordPage] = useState(false);
  const [isResetPasswordPage, setIsResetPasswordPage] = useState(false);
  const [resetUid, setResetUid] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [resetExpiresAt, setResetExpiresAt] = useState('');
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [isBuyerHistoryOpen, setIsBuyerHistoryOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('kukutaCurrentUser');
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        if (parsed && parsed.username) {
          setCurrentUser(parsed);
        }
      }
    } catch (e) {
      // ignore malformed persisted session
    }
  }, []);

  useEffect(() => {
    if (!currentUser) {
      try { localStorage.removeItem('kukutaCurrentUser'); } catch (e) {}
      return;
    }

    try {
      localStorage.setItem('kukutaCurrentUser', JSON.stringify(currentUser));
    } catch (e) {
      // ignore storage errors
    }
  }, [currentUser]);
  const [allProducts, setAllProducts] = useState([]);
  const [orders, setOrders] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('kukutaOrders') || '[]');
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cartItems, setCartItems] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('kukutaCart') || '[]');
    } catch {
      return [];
    }
  });
  const [wishlist, setWishlist] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('kukutaWishlist') || '[]');
    } catch {
      return [];
    }
  });
  const [theme, setTheme] = useState(() => localStorage.getItem('kukutaTheme') || 'light');
  const [sortOption, setSortOption] = useState('Newest');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isWishlistOpen, setIsWishlistOpen] = useState(false);
  const [flash, setFlash] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [contactProduct, setContactProduct] = useState(null);
  const [chatRecipient, setChatRecipient] = useState('');
  const [messagePanelOpen, setMessagePanelOpen] = useState(false);
  const [messageDraft, setMessageDraft] = useState('');
  const [messageHistory, setMessageHistory] = useState([]);
  const [unreadMessages, setUnreadMessages] = useState([]);
  const [activeInvoice, setActiveInvoice] = useState(null);
  const productsSectionRef = useRef(null);

  const showFlash = (message, type = 'info', duration = 5000) => {
    setFlash({ message, type });
    setTimeout(() => setFlash(null), duration);
  };

  useEffect(() => {
    if (showRoosterAnimation) return undefined;
    const timer = setTimeout(() => {
      showFlash('Welcome to Kukuta. Explore trusted farm products and essentials.', 'success', 5000);
    }, 350);
    return () => clearTimeout(timer);
  }, [showRoosterAnimation]);

  const handleThemeToggle = useCallback(() => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    showFlash(`Switched to ${nextTheme} mode`, 'success', 3000);
  }, [theme, showFlash]);

  const handleAddToCart = useCallback((product) => {
    setCartItems((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    setIsCartOpen(true);
    showFlash(`${product.name} added to cart`, 'success');
  }, [showFlash]);

  const handleRemoveFromCart = (productId) => {
    setCartItems((prev) => prev.filter((item) => item.id !== productId));
    showFlash('Removed from cart', 'info');
  };

  const handleUpdateCartQuantity = (productId, value) => {
    const quantity = Math.max(1, Number(value) || 1);
    setCartItems((prev) => prev.map((item) => item.id === productId ? { ...item, quantity } : item));
  };

  const cartTotal = cartItems.reduce((sum, item) => sum + parsePrice(item.price) * item.quantity, 0);

  const handleToggleWishlist = useCallback((product) => {
    setWishlist((prev) => {
      if (prev.includes(product.id)) {
        showFlash(`${product.name} removed from wishlist`, 'info');
        return prev.filter((id) => id !== product.id);
      }
      setIsWishlistOpen(true);
      showFlash(`${product.name} added to wishlist`, 'success');
      return [...prev, product.id];
    });
  }, [showFlash]);

  const handleCheckout = () => {
    if (cartItems.length === 0) {
      showFlash('Your cart is empty', 'error');
      return;
    }

    const checkoutOrders = cartItems
      .filter((item) => !isLivestockProduct(item))
      .map((item, index) => {
        const order = {
          id: Date.now() + index,
          productId: item.id,
          productName: item.name,
          price: item.price,
          seller: item.seller || 'Farm',
          buyer: currentUser?.username || 'Guest',
          date: new Date().toLocaleDateString(),
          status: 'Confirmed',
          invoice: createInvoiceForOrder({
            id: Date.now() + index,
            productName: item.name,
            buyer: currentUser?.username || 'Guest',
            seller: item.seller || 'Farm',
            price: item.price,
            status: 'Confirmed',
          }, item),
        };

        return order;
      });

    if (checkoutOrders.length > 0) {
      setOrders((prev) => [...checkoutOrders, ...prev]);
      setActiveInvoice(checkoutOrders[0].invoice);
    }

    setCartItems([]);
    setIsCartOpen(false);
    showFlash(
      checkoutOrders.length > 0
        ? 'Checkout complete! Invoice generated for your non-livestock order.'
        : 'Checkout complete! Your order is now processing.',
      'success'
    );
  };

  const toggleWishlistPanel = () => setIsWishlistOpen((prev) => !prev);

  useEffect(() => {
    localStorage.setItem('kukutaCart', JSON.stringify(cartItems));
  }, [cartItems]);

  useEffect(() => {
    localStorage.setItem('kukutaWishlist', JSON.stringify(wishlist));
  }, [wishlist]);

  useEffect(() => {
    localStorage.setItem('kukutaOrders', JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    if (!currentUser?.username) return undefined;
    let active = true;
    const loadAcceptedOrders = async () => {
      try {
        const response = await apiFetch('/orders/', { method: 'GET' });
        if (!response.ok) return;
        const payload = await response.json();
        const records = Array.isArray(payload) ? payload : payload.results || [];
        const acceptedOrders = records
          .filter((record) => record.agreed_price !== null && record.agreed_price !== undefined
            && record.buyer_price_accepted && record.seller_price_accepted)
          .map(mapAgreedOrder);
        if (!active || acceptedOrders.length === 0) return;
        setOrders((previous) => {
          const acceptedIds = new Set(acceptedOrders.map((order) => order.id));
          return [...acceptedOrders, ...previous.filter((order) => !acceptedIds.has(order.id))];
        });
      } catch (error) {
        // Keep locally completed checkout orders available when the API is offline.
      }
    };
    loadAcceptedOrders();
    const timer = window.setInterval(loadAcceptedOrders, 12000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [currentUser?.username, allProducts]);

  useEffect(() => {
    if (!currentUser?.username) {
      setUnreadMessages([]);
      return undefined;
    }

    let active = true;
    let knownMessageIds = null;

    const pollMessages = async () => {
      try {
        const response = await apiFetch('/messages/', { method: 'GET' });
        if (!response.ok || !active) return;
        const data = await response.json();
        const incoming = Array.isArray(data)
          ? data.filter((message) => message.is_read === false && (
              message.recipient_name === currentUser.username || message.recipient === currentUser.username
            ))
          : [];
        const incomingIds = new Set(incoming.map((message) => message.id));
        const newMessages = knownMessageIds === null
          ? incoming
          : incoming.filter((message) => !knownMessageIds.has(message.id));

        if (newMessages.length > 0) {
          const senderName = newMessages[0].sender_name || 'A user';
          showFlash(
            `${senderName} sent ${newMessages.length} new message${newMessages.length === 1 ? '' : 's'}.`,
            'info',
            7000
          );
        }
        knownMessageIds = incomingIds;
        setUnreadMessages(incoming);
      } catch (error) {
        // Notification polling should not interrupt the storefront.
      }
    };

    pollMessages();
    const interval = window.setInterval(pollMessages, 15000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [currentUser?.role, currentUser?.username]);

  useEffect(() => {
    localStorage.setItem('kukutaTheme', theme);
    document.body.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    fetchProducts();

    const updateRoute = () => {
      const path = window.location.pathname;
      if (path === '/forgot-password') {
        setIsForgotPasswordPage(true);
        setIsResetPasswordPage(false);
      } else {
        setIsForgotPasswordPage(false);
      }

      const resetMatch = path.match(/^\/password-reset-confirm\/([^\/]+)\/([^\/]+)\/?$/);
      if (resetMatch) {
        setResetUid(resetMatch[1]);
        setResetToken(resetMatch[2]);
        setResetExpiresAt(new URLSearchParams(window.location.search).get('expires_at') || '');
        setIsResetPasswordPage(true);
      } else {
        setIsResetPasswordPage(false);
        setResetExpiresAt('');
      }
    };

    updateRoute();
    window.addEventListener('popstate', updateRoute);
    return () => window.removeEventListener('popstate', updateRoute);
  }, []);

  // Handle clicking outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.profile-container') && !event.target.closest('.role-dropdown-container')) {
        setIsProfileOpen(false);
        setIsRoleDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const reveal = () => {
      const elements = document.querySelectorAll('.scroll-reveal');
      elements.forEach((el) => el.classList.add('visible'));
    };

    const frame = window.requestAnimationFrame(reveal);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const navigateToForgotPassword = () => {
    window.history.pushState(null, '', '/forgot-password');
    setIsForgotPasswordPage(true);
    setIsResetPasswordPage(false);
    setResetExpiresAt('');
  };

  const handleRequestNewOtp = async (identifier) => {
    const trimmedIdentifier = (identifier || '').trim();
    if (!trimmedIdentifier) {
      return { ok: false, message: 'Email or phone number is required to request a new code.' };
    }

    try {
      const response = await apiFetch('/password-reset/', {
        method: 'POST',
        auth: false,
        body: { identifier: trimmedIdentifier },
      });
      const data = await response.json();

      if (!response.ok) {
        return {
          ok: false,
          message: data?.error || data?.message || 'Unable to send a new OTP right now.',
        };
      }

      if (!data?.uid || !data?.token) {
        return {
          ok: false,
          message: data?.message || 'The reset request could not be refreshed.',
        };
      }

      const expiryQuery = data.expires_at ? `?${new URLSearchParams({ expires_at: data.expires_at })}` : '';
      const path = `/password-reset-confirm/${data.uid}/${data.token}/${expiryQuery}`;
      window.history.pushState(null, '', path);
      setResetUid(data.uid);
      setResetToken(data.token);
      setResetExpiresAt(data.expires_at || '');
      setIsResetPasswordPage(true);
      setIsForgotPasswordPage(false);
      return { ok: true, message: data.message || 'A fresh OTP has been sent.' };
    } catch (error) {
      return { ok: false, message: 'Unable to send a new OTP. Please try again.' };
    }
  };

  const navigateToResetConfirm = (uid, token, expiresAt) => {
    const expiryQuery = expiresAt ? `?${new URLSearchParams({ expires_at: expiresAt })}` : '';
    const path = `/password-reset-confirm/${uid}/${token}/${expiryQuery}`;
    window.history.pushState(null, '', path);
    setResetUid(uid);
    setResetToken(token);
    setResetExpiresAt(expiresAt || '');
    setIsResetPasswordPage(true);
    setIsForgotPasswordPage(false);
  };

  const navigateHome = () => {
    window.history.replaceState(null, '', '/');
    setIsForgotPasswordPage(false);
    setIsResetPasswordPage(false);
  };

  const handleHomeNavigation = () => {
    navigateHome();
    setSelectedProductId(null);
    setIsDashboardOpen(false);
    setIsBuyerHistoryOpen(false);
    setIsMenuOpen(false);
  };

  const openBuyerDashboard = () => {
    setSelectedProductId(null);
    setIsBuyerHistoryOpen(true);
    setIsDashboardOpen(false);
    setIsMenuOpen(false);
    setIsProfileOpen(false);
    setIsProfileModalOpen(false);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const openSellerDashboard = () => {
    setSelectedProductId(null);
    setIsDashboardOpen(true);
    setIsBuyerHistoryOpen(false);
    setIsMenuOpen(false);
    setIsProfileOpen(false);
    setIsProfileModalOpen(false);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    setSelectedProductId(null);
    setIsSearchOpen(false);
    const section = document.getElementById('products');
    if (section) {
      const top = Math.max(0, section.getBoundingClientRect().top + window.scrollY - 12);
      window.scrollTo({ top, behavior: 'auto' });
    }
  };

  const fetchProducts = async () => {
    try {
      const response = await apiFetch('/products/', { method: 'GET' });
      if (!response.ok) {
        throw new Error('Failed to fetch products');
      }
      const data = await response.json();
      const products = Array.isArray(data?.results)
        ? data.results
        : (Array.isArray(data) ? data : []);
      setAllProducts(products);
      setLoading(false);
    } catch (err) {
      setAllProducts([]);
      setLoading(false);
      showFlash('Unable to reach product API.', 'error', 6000);
    }
  };

  const handleLogin = (user) => {
    const safeUser = {
      role: user.role || 'buyer',
      ...user,
    };
    if (user.tokens) {
      storeAuthTokens(user.tokens.access, user.tokens.refresh);
    }
    setCurrentUser(safeUser);
    showFlash(`Login successful. Welcome back, ${user.name || user.username || 'to Kukuta'}!`, 'success', 4000);
  };

  const handleSignup = (user) => {
    const safeUser = {
      role: user.role || 'buyer',
      ...user,
    };
    if (user.tokens) {
      storeAuthTokens(user.tokens.access, user.tokens.refresh);
    }
    setCurrentUser(safeUser);
  };

  const handleRoleToggle = async (newRole) => {
    if (!currentUser) return;
    const dashboardIsOpen = isDashboardOpen || isBuyerHistoryOpen;
    try {
      const response = await apiFetch('/role-toggle/', {
        method: 'POST',
        body: { role: newRole },
      });
      const data = await response.json();
      if (response.ok) {
        const updatedRole = data.role || newRole;
        setCurrentUser((current) =>
          current ? { ...current, role: updatedRole } : current
        );
        if (dashboardIsOpen) {
          setIsDashboardOpen(updatedRole === 'seller');
          setIsBuyerHistoryOpen(updatedRole === 'buyer');
          setSelectedProductId(null);
          window.scrollTo({ top: 0, behavior: 'auto' });
        }
        setIsMenuOpen(false);
        setIsRoleDropdownOpen(false);
        setIsProfileOpen(false);
        setIsProfileModalOpen(false);
        showFlash(`Role switched to ${updatedRole}.`, 'success');
      } else {
        showFlash(data.error || 'Could not switch role.', 'error');
      }
    } catch (err) {
      showFlash('Could not switch role.', 'error');
    }
  };

  const confirmBookingInChat = async (agreedPrice, orderId) => {
    if (!contactProduct || !currentUser || !chatRecipient) return null;
    try {
      const response = await apiFetch('/orders/price-agreement/', {
        method: 'POST',
        body: {
          product_id: contactProduct.id,
          participant: chatRecipient,
          agreed_price: agreedPrice,
          order_id: orderId,
        },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        showFlash(data.error || 'Could not accept this price.', 'error');
        return null;
      }

      if (data.status === 'confirmed') {
        const agreedOrder = mapAgreedOrder(data);
        setOrders((previous) => [agreedOrder, ...previous.filter((order) => order.id !== agreedOrder.id)]);
        showFlash(`Both sides accepted ${agreedOrder.price}. The order is now on both dashboards.`, 'success');
      } else {
        showFlash('Price accepted. The order will appear after the other side accepts the same amount.', 'info');
      }
      return data;
    } catch (error) {
      showFlash('Could not save the price acceptance. Check your connection and try again.', 'error');
      return null;
    }
  };

  const handlePlaceOrder = (product) => {
    const newOrder = {
      id: Date.now(),
      productId: product.id,
      productName: product.name,
      price: product.price,
      seller: product.seller || 'Farm',
      buyer: currentUser?.username || 'Guest',
      date: new Date().toLocaleDateString(),
      status: 'Confirmed',
      invoice: createInvoiceForOrder({
        id: Date.now(),
        productName: product.name,
        buyer: currentUser?.username || 'Guest',
        seller: product.seller || 'Farm',
        price: product.price,
        status: 'Confirmed',
      }, product),
    };
    setOrders((prev) => [newOrder, ...prev]);
    if (newOrder.invoice) {
      setActiveInvoice(newOrder.invoice);
    }
    showFlash(`Order placed for ${product.name}!${newOrder.invoice ? ' Invoice generated.' : ''}`, 'success');
  };

  const handleOrderNow = async (product) => {
    if (!currentUser) {
      showFlash('Please sign in to continue.', 'info');
      setIsLoginOpen(true);
      return;
    }

    const isOwnProduct = currentUser.role === 'seller'
      && String(product?.seller || '').trim().toLowerCase() === String(currentUser.username || '').trim().toLowerCase();
    if (isOwnProduct) {
      showFlash('This is your product. You cannot order or start a chat for your own listing.', 'info');
      return;
    }

    if (currentUser.role === 'seller') {
      await handleContactSeller(product);
      return;
    }

    if (currentUser.role !== 'buyer') {
      showFlash('Please sign in as a buyer or seller to continue.', 'info');
      return;
    }

    if (isLivestockProduct(product)) {
      showFlash('Livestock bookings are handled through chat confirmation only.', 'info');
    }

    await handleContactSeller(product);
  };

  const handleContactSeller = async (product) => {
    if (!currentUser) {
      showFlash('Please sign in to contact the seller.', 'info');
      setIsLoginOpen(true);
      return;
    }
    if (currentUser.role !== 'buyer' && currentUser.role !== 'seller') {
      showFlash('Only buyers and sellers can contact a seller from the storefront.', 'info');
      return;
    }

    const isOwnProduct = currentUser.role === 'seller'
      && String(product?.seller || '').trim().toLowerCase() === String(currentUser.username || '').trim().toLowerCase();
    if (isOwnProduct) {
      showFlash('This is your product. You cannot start a chat for your own listing.', 'info');
      return;
    }

    setContactProduct(product);
    setChatRecipient(product.seller);
    setMessageDraft('');
    setMessagePanelOpen(true);

    try {
      const response = await apiFetch('/messages/', {
        method: 'GET',
      });
      if (!response.ok) return;
      const data = await response.json();
      const messages = Array.isArray(data) ? data : data.results || [];
      const relevant = messages.filter((item) => item.product === product.id || item.product_name === product.name);
      setMessageHistory(relevant);
    } catch (error) {
      setMessageHistory([]);
    }
  };

  const handleContactBuyer = (order) => {
    const otherParticipant = order.buyer === currentUser?.username ? order.seller : order.buyer;
    const product = allProducts.find((item) => item.id === order.productId) || {
      id: order.productId,
      name: order.productName,
      seller: currentUser?.username,
    };
    setContactProduct(product);
    setChatRecipient(otherParticipant);
    setMessagePanelOpen(true);
  };

  const handleOpenMessageNotification = async () => {
    let message = unreadMessages[0];
    if (!message && !contactProduct) {
      try {
        const response = await apiFetch('/messages/', { method: 'GET' });
        const data = response.ok ? await response.json() : [];
        message = Array.isArray(data) ? data[data.length - 1] : null;
      } catch (error) {
        message = null;
      }
    }
    if (!message) {
      if (contactProduct && chatRecipient) {
        setMessagePanelOpen(true);
      } else if (allProducts[0]) {
        setContactProduct(allProducts[0]);
        setChatRecipient(currentUser?.role === 'buyer' ? allProducts[0].seller : '');
        setMessagePanelOpen(true);
      }
      return;
    }
    const messageProductId = message.product || message.product_id;
    const product = allProducts.find((item) => String(item.id) === String(messageProductId)) || (messageProductId ? {
      id: messageProductId,
      name: message.product_name || 'Product conversation',
      seller: currentUser?.username,
    } : null);
    setContactProduct(product);
    setChatRecipient(message.sender_name || message.sender);
    setMessagePanelOpen(true);
    setUnreadMessages([]);
    await Promise.all(unreadMessages.map((item) => (
      apiFetch(`/messages/${item.id}/mark_read/`, { method: 'POST' })
    )));
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!contactProduct || !messageDraft.trim()) return;

    try {
      const response = await apiFetch('/messages/', {
        method: 'POST',
        body: {
          recipient: contactProduct.seller,
          content: messageDraft.trim(),
          product_id: contactProduct.id,
        },
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || 'Unable to send message');
      }
      setMessageHistory((prev) => [...prev, data]);
      setMessageDraft('');
      showFlash('Message sent to the seller.', 'success');
    } catch (error) {
      showFlash(error.message || 'Unable to send message.', 'error');
    }
  };

  const handleAddProduct = async (formData) => {
    try {
      const response = await apiFetch('/products/', {
        method: 'POST',
        body: formData, // FormData will set Content-Type automatically
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const serverErrors = data && typeof data === 'object' ? data : {};
        const serverMessage = serverErrors.error || serverErrors.message || 'Failed to add product.';
        throw Object.assign(new Error(serverMessage), { fieldErrors: serverErrors });
      }

      const addedProduct = {
        ...data,
        seller: data.seller || currentUser?.username,
        image: data.image || data.images?.[0]?.image_url || data.images?.[0]?.image || '🥚',
      };
      setAllProducts((prev) => [addedProduct, ...prev]);
      setSelectedProductId(addedProduct.id);
      showFlash(`Product "${formData.get('name')}" added successfully!`, 'success');
      return true;
    } catch (err) {
      showFlash(`Error adding product: ${err.message}`, 'error');
      return { success: false, errors: err.fieldErrors || { detail: err.message } };
    }
  };

  const handleDeleteProduct = async (productId) => {
    setConfirmDialog({
      message: 'Are you sure you want to delete this product?',
      async onConfirm() {
        try {
          const response = await apiFetch(`/products/${productId}/`, {
            method: 'DELETE',
          });

          const data = await response.json().catch(() => null);
          if (!response.ok) {
            throw new Error(data?.detail || data?.error || 'Failed to delete product');
          }

          setAllProducts((products) => products.filter((product) => product.id !== productId));
          showFlash('Product deleted successfully!', 'success');
        } catch (err) {
          showFlash(`Error deleting product: ${err.message}`, 'error');
        } finally {
          setConfirmDialog(null);
        }
      }
    });
  };

  const handleUpdateProduct = async (productId, values) => {
    try {
      const response = await apiFetch(`/products/${productId}/`, {
        method: 'PATCH',
        body: values,
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.detail || data?.seller || data?.error || 'Failed to update product.');
      }
      setAllProducts((products) => products.map((product) => product.id === productId ? { ...product, ...data, image: data.image || product.image || '🥚' } : product));
      showFlash('Product details updated successfully!', 'success');
      return true;
    } catch (err) {
      showFlash(`Error updating product: ${err.message}`, 'error');
      return false;
    }
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('kukutaCurrentUser');
      sessionStorage.removeItem('accessToken');
      sessionStorage.removeItem('refreshToken');
      delete window.__KUKUTA_AUTH__;
    } catch (e) {}
    setCurrentUser(null);
  };

  const handleSelectProduct = useCallback((id) => {
    setSelectedProductId(id);
    const section = productsSectionRef.current;
    if (section) {
      const top = Math.max(0, section.getBoundingClientRect().top + window.scrollY - 12);
      window.scrollTo({ top, behavior: 'auto' });
    }
  }, []);

  const handleOpenInvoice = (invoice) => {
    setActiveInvoice(invoice);
  };

  const handleBackToProducts = () => {
    setSelectedProductId(null);
    const section = productsSectionRef.current;
    if (section) {
      const top = Math.max(0, section.getBoundingClientRect().top + window.scrollY - 12);
      window.scrollTo({ top, behavior: 'auto' });
    }
  };

  const selectedProduct = useMemo(
    () => allProducts.find((product) => product.id === selectedProductId),
    [allProducts, selectedProductId]
  );
  const relatedProducts = useMemo(
    () => selectedProduct
      ? allProducts.filter(
          (product) => product.category === selectedProduct.category && product.id !== selectedProduct.id
        ).slice(0, 4)
      : [],
    [allProducts, selectedProduct]
  );

  const debouncedSearch = useDebounce(search, 200);

  const filteredProducts = useMemo(() => {
    const normalizedSearch = debouncedSearch.toLowerCase();
    return allProducts.filter((p) => {
      const matchesSearch = !normalizedSearch || p.name.toLowerCase().includes(normalizedSearch) ||
                  p.description.toLowerCase().includes(normalizedSearch) ||
                  (p.seller || '').toLowerCase().includes(normalizedSearch);
      const matchesCategory = selectedCategory === null || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [allProducts, debouncedSearch, selectedCategory]);

  const sortedProducts = useMemo(() => {
    const next = [...filteredProducts];
    next.sort((a, b) => {
      if (sortOption === 'Price: low to high') {
        return parsePrice(a.price) - parsePrice(b.price);
      }
      if (sortOption === 'Price: high to low') {
        return parsePrice(b.price) - parsePrice(a.price);
      }
      return b.id - a.id;
    });
    return next;
  }, [filteredProducts, sortOption]);

  const cartCount = useMemo(
    () => cartItems.reduce((count, item) => count + item.quantity, 0),
    [cartItems]
  );
  const wishlistItems = useMemo(
    () => allProducts.filter((product) => wishlist.includes(product.id)),
    [allProducts, wishlist]
  );

  const buyerOrders = useMemo(
    () => orders.filter((order) => order.buyer === currentUser?.username || order.seller === currentUser?.username),
    [orders, currentUser?.username]
  );
  const sellerOrders = useMemo(
    () => orders.filter((order) => order.seller === currentUser?.username || order.buyer === currentUser?.username),
    [orders, currentUser?.username]
  );
  const sellerProducts = useMemo(
    () => allProducts.filter((product) => product.seller === currentUser?.username),
    [allProducts, currentUser?.username]
  );
  const sellerDashboardMode = isDashboardOpen && currentUser?.role === 'seller';
  const buyerDashboardMode = isBuyerHistoryOpen && currentUser?.role === 'buyer' && !sellerDashboardMode;

  if (showRoosterAnimation) {
    return (
      <>
        <RoosterSplash onAnimationComplete={() => setShowRoosterAnimation(false)} />
      </>
    );
  }

  return (
    <>
      <AddProductModal 
        isOpen={isAddProductOpen} 
        onClose={() => setIsAddProductOpen(false)}
        onAddProduct={handleAddProduct}
        userName={currentUser?.username}
      />
      <LoginModal 
        isOpen={isLoginOpen} 
        onClose={() => setIsLoginOpen(false)}
        onSwitchToSignin={() => setIsSigninOpen(true)}
        onLogin={handleLogin}
        onForgotPassword={navigateToForgotPassword}
      />
      <SigninModal 
        isOpen={isSigninOpen} 
        onClose={() => setIsSigninOpen(false)}
        onSwitchToLogin={() => setIsLoginOpen(true)}
        onSignup={handleSignup}
      />
      {isForgotPasswordPage && (
        <Suspense fallback={<div className="loading">Loading recovery page...</div>}>
          <ForgotPasswordPage 
            onClose={navigateHome}
            onSwitchToLogin={() => { navigateHome(); setIsLoginOpen(true); }}
            onNavigateToResetConfirm={navigateToResetConfirm}
          />
        </Suspense>
      )}
      {isResetPasswordPage && (
        <Suspense fallback={<div className="loading">Loading reset page...</div>}>
          <PasswordResetConfirmPage 
            uid={resetUid}
            token={resetToken}
            expiresAt={resetExpiresAt}
            onClose={navigateHome}
            onOpenLogin={() => { navigateHome(); setIsLoginOpen(true); }}
            onRequestNewOtp={handleRequestNewOtp}
          />
        </Suspense>
      )}

      {!isForgotPasswordPage && !isResetPasswordPage && (
        <>
          <header className="farm-header" id="home">
            <div className="header-shell">
              <button className="brand-wrap brand-link" type="button" onClick={handleHomeNavigation} aria-label="Go to Kukuta home page">
                <span className="brand-mark">K</span>
                <span className="brand">Kukuta</span>
              </button>

              <button
                className="search-toggle"
                type="button"
                aria-label="Search"
                aria-expanded={isSearchOpen}
                title="Search"
                onClick={() => setIsSearchOpen((open) => !open)}
              >
                🔍
              </button>

              <form className={`search-form${isSearchOpen ? ' search-open' : ''}`} onSubmit={handleSearchSubmit} role="search">
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search products..."
                  aria-label="Search products, descriptions, and sellers"
                />
              </form>

              <button
                className={`hamburger-menu${isMenuOpen ? ' is-open' : ''}`}
                type="button"
                onClick={() => setIsMenuOpen((open) => !open)}
                aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={isMenuOpen}
                aria-controls="kukuta-menu"
                title={isMenuOpen ? 'Close menu' : 'Open menu'}
              >
                <span></span>
                <span></span>
                <span></span>
              </button>

              <div className={`utility-buttons ${isMenuOpen ? 'expanded' : ''}`}>
                {currentUser && (
                  <>
                    <button
                      className={`icon-btn notification-toggle ${unreadMessages.length ? 'active' : ''}`}
                      onClick={() => { handleOpenMessageNotification(); setIsMenuOpen(false); }}
                      aria-label={`${unreadMessages.length} unread messages`}
                      title="Open chat messages"
                    >
                      💬
                      {unreadMessages.length > 0 && <span>{unreadMessages.length}</span>}
                    </button>
                    <button className="icon-btn" onClick={() => { setIsCartOpen(true); setIsMenuOpen(false); }} aria-label={`Shopping cart, ${cartCount} items`} title="Shopping cart">
                      🛒
                      <span>{cartCount}</span>
                    </button>
                    <button
                      className={`icon-btn wishlist-toggle ${wishlist.length ? 'active' : ''}`}
                      onClick={() => { toggleWishlistPanel(); setIsMenuOpen(false); }}
                      aria-label="Open wishlist"
                      title="Wishlist"
                    >
                      {wishlist.length ? '♥' : '♡'}
                      <span>{wishlist.length}</span>
                    </button>
                  </>
                )}
                {currentUser && (
                  <button className="icon-btn theme-toggle" onClick={handleThemeToggle} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
                    {theme === 'light' ? '☀️' : '🌙'}
                  </button>
                )}
              </div>

              {isMenuOpen && (
                <div className="navbar-dropdown" id="kukuta-menu" aria-label="Account menu">
                  {currentUser ? (
                    <>
                      <div className="dropdown-section">
                        <div className="dropdown-header">Your Account</div>
                        <button className="dropdown-item" onClick={() => { setIsProfileOpen(!isProfileOpen); setIsMenuOpen(false); }}>
                          👤 {currentUser.name}
                        </button>
                        <button className="dropdown-item" onClick={() => { 
                          handleRoleToggle(currentUser.role === 'seller' ? 'buyer' : 'seller');
                          setIsMenuOpen(false);
                        }}>
                          Switch to {currentUser.role === 'seller' ? 'Buyer' : 'Seller'}
                        </button>
                        {currentUser.role === 'seller' && (
                          <>
                            <button className="dropdown-item" onClick={openSellerDashboard}>
                              Dashboard
                            </button>
                            <button className="dropdown-item" onClick={() => { setIsAddProductOpen(true); setIsMenuOpen(false); }}>
                              + Add Product
                            </button>
                          </>
                        )}
                        {currentUser.role === 'buyer' && (
                          <button className="dropdown-item" onClick={openBuyerDashboard}>
                            Buyer Dashboard
                          </button>
                        )}
                      </div>
                      <button className="dropdown-item logout" onClick={() => { handleLogout(); setIsMenuOpen(false); }}>
                        Logout
                      </button>
                    </>
                  ) : (
                    <div className="dropdown-section">
                      <button className="dropdown-item" onClick={() => { setIsLoginOpen(true); setIsMenuOpen(false); }}>
                        Login
                      </button>
                      <button className="dropdown-item" onClick={() => { setIsSigninOpen(true); setIsMenuOpen(false); }}>
                        Sign Up
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="auth-buttons">
                {currentUser ? (
                  <div className="user-controls">
                    <div className="role-dropdown-container">
                      <button 
                        className="role-switch-dropdown-btn" 
                        onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
                        aria-expanded={isRoleDropdownOpen}
                        aria-haspopup="true"
                        title={`Current role: ${currentUser.role || 'buyer'}`}
                      >
                        {currentUser.role === 'seller' ? '🏪 Seller' : '🛒 Buyer'} ▼
                      </button>
                      {isRoleDropdownOpen && (
                        <div className="role-dropdown-menu">
                          <div className="role-dropdown-header">
                            Switch Role
                          </div>
                          <button 
                            className={`role-option ${currentUser.role === 'buyer' ? 'active' : ''}`}
                            onClick={() => {
                              if (currentUser.role !== 'buyer') {
                                handleRoleToggle('buyer');
                              }
                              setIsRoleDropdownOpen(false);
                            }}
                          >
                            🛒 Buyer
                            {currentUser.role === 'buyer' && <span className="current-indicator">✓</span>}
                          </button>
                          <button 
                            className={`role-option ${currentUser.role === 'seller' ? 'active' : ''}`}
                            onClick={() => {
                              if (currentUser.role !== 'seller') {
                                handleRoleToggle('seller');
                              }
                              setIsRoleDropdownOpen(false);
                            }}
                          >
                            🏪 Seller
                            {currentUser.role === 'seller' && <span className="current-indicator">✓</span>}
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="profile-container">
                      <button className="profile-icon" onClick={() => setIsProfileOpen(!isProfileOpen)} aria-expanded={isProfileOpen} aria-haspopup="true">
                        👤 {currentUser.name}
                      </button>
                      {isProfileOpen && (
                        <div className="profile-dropdown">
                          <div className="profile-dropdown-identity">
                            <div className="profile-dropdown-avatar" aria-hidden="true">{(currentUser.name || 'U').charAt(0).toUpperCase()}</div>
                            <div>
                              <strong>{currentUser.name}</strong>
                              <span>{currentUser.role || 'buyer'}</span>
                            </div>
                          </div>
                          <div className="profile-dropdown-actions">
                            <button
                              className="profile-menu-btn"
                              onClick={() => {
                                setIsProfileModalOpen(true);
                                setIsProfileOpen(false);
                              }}
                            >
                              <span aria-hidden="true">👤</span> View profile
                            </button>
                            <button
                              className="profile-menu-btn"
                              onClick={() => {
                                handleRoleToggle(currentUser.role === 'seller' ? 'buyer' : 'seller');
                                setIsProfileOpen(false);
                              }}
                            >
                              <span aria-hidden="true">⇄</span> Switch to {currentUser.role === 'seller' ? 'Buyer' : 'Seller'}
                            </button>
                          {currentUser.role === 'seller' && (
                            <>
                              <button className="profile-menu-btn" onClick={openSellerDashboard}>
                                <span aria-hidden="true">▦</span> Dashboard
                              </button>
                              <button className="profile-menu-btn" onClick={() => setIsAddProductOpen(true)}>
                                <span aria-hidden="true">＋</span> Add product
                              </button>
                            </>
                          )}
                          {currentUser.role === 'buyer' && (
                            <button className="profile-menu-btn" onClick={openBuyerDashboard}>
                              <span aria-hidden="true">◷</span> Buyer Dashboard
                            </button>
                          )}
                          </div>
                          <button className="profile-logout-btn" onClick={handleLogout}>
                            <span aria-hidden="true">↪</span> Log out
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    <button className="login-btn" onClick={() => setIsLoginOpen(true)}>Login</button>
                    <button className="signin-btn" onClick={() => setIsSigninOpen(true)}>Sign Up</button>
                  </>
                )}
              </div>
            </div>
          </header>

      {flash && !sellerDashboardMode && !buyerDashboardMode && (
        <div className={`flash-message ${flash.type || 'info'}`} role="status">
          <div className="flash-content">
            <span>{flash.message}</span>
            <button className="flash-close" onClick={() => setFlash(null)}>×</button>
          </div>
        </div>
      )}

      {confirmDialog && !sellerDashboardMode && !buyerDashboardMode && (
        <ConfirmModal dialog={confirmDialog} onClose={() => setConfirmDialog(null)} />
      )}

      <InvoiceModal invoice={activeInvoice} onClose={() => setActiveInvoice(null)} />

      {!sellerDashboardMode && !buyerDashboardMode && <Messenger
        isOpen={messagePanelOpen}
        onClose={() => setMessagePanelOpen(false)}
        product={contactProduct}
        products={allProducts}
        currentUser={currentUser}
        recipient={chatRecipient}
        title={contactProduct ? 'Product chat' : 'Messages'}
        onConfirmBooking={confirmBookingInChat}
        autoOpenConversation={Boolean(contactProduct && chatRecipient)}
      />}

      {!sellerDashboardMode && !buyerDashboardMode && <ProfileModal
        isOpen={isProfileModalOpen} 
        onClose={() => setIsProfileModalOpen(false)} 
        currentUser={currentUser} 
        onRoleToggle={handleRoleToggle}
        onOpenDashboard={openSellerDashboard}
        onOpenOrderHistory={openBuyerDashboard}
        onLogout={handleLogout}
      />}

      {!sellerDashboardMode && !buyerDashboardMode && <CartPanel
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartItems={cartItems}
        onRemove={handleRemoveFromCart}
        onQuantityChange={handleUpdateCartQuantity}
        onCheckout={handleCheckout}
        total={cartTotal}
      />}
      {!sellerDashboardMode && !buyerDashboardMode && <WishlistPanel
        isOpen={isWishlistOpen}
        onClose={() => setIsWishlistOpen(false)}
        items={wishlistItems}
        onRemove={handleToggleWishlist}
        onAddToCart={handleAddToCart}
        onOrder={handlePlaceOrder}
      />}

      {!selectedProduct && !sellerDashboardMode && !buyerDashboardMode && (
        <HeroSlider
          products={allProducts}
          onSelectProduct={handleSelectProduct}
          selectedCategory={selectedCategory}
          search={search}
          wishlist={wishlist}
          orders={orders}
        />
      )}

      {isDashboardOpen && currentUser?.role === 'seller' && (
        <Suspense fallback={<div className="loading">Loading dashboard...</div>}>
          <SellerDashboardPage
            sellerUsername={currentUser.username}
            products={sellerProducts}
            orders={sellerOrders}
            onDeleteProduct={handleDeleteProduct}
            onUpdateProduct={handleUpdateProduct}
            onContactBuyer={handleContactBuyer}
            onOpenInvoice={handleOpenInvoice}
            onAddProduct={() => setIsAddProductOpen(true)}
            onClose={() => setIsDashboardOpen(false)}
          />
        </Suspense>
      )}

      {buyerDashboardMode && (
        <Suspense fallback={<div className="loading">Loading order history...</div>}>
          <BuyerOrderHistoryPage
            orders={buyerOrders}
            currentUsername={currentUser.username}
            onClose={() => setIsBuyerHistoryOpen(false)}
            onOpenInvoice={handleOpenInvoice}
          />
        </Suspense>
      )}

      {!selectedProduct && !sellerDashboardMode && !buyerDashboardMode && (
        <section className="category-shortcuts scroll-reveal">
          <div className="shortcuts-container">
            <button
              className={`category-btn ${selectedCategory === null ? 'active' : ''}`}
              onClick={() => setSelectedCategory(null)}
            >
              All Products
            </button>
            <div className="category-groups">
              {categoryGroups.map((group) => (
                <details className="category-group" key={group.title} open>
                  <summary>
                    <span>
                      <strong>{group.title}</strong>
                      <small>{group.subtitle}</small>
                    </span>
                    <span className="category-group-chevron">⌄</span>
                  </summary>
                  <div className="category-group-options">
                    {group.categories.map((cat) => (
                      <button
                        key={cat}
                        className={`category-btn ${selectedCategory === cat ? 'active' : ''}`}
                        onClick={() => setSelectedCategory(cat)}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </div>
          <div className="category-actions">
            <label className="sort-label">
              Sort by
              <select value={sortOption} onChange={(e) => setSortOption(e.target.value)}>
                <option value="Newest">Newest</option>
                <option value="Price: low to high">Price: low to high</option>
                <option value="Price: high to low">Price: high to low</option>
              </select>
            </label>
          </div>
        </section>
      )}

      {!sellerDashboardMode && !buyerDashboardMode && <section
        id="products"
        ref={productsSectionRef}
        className={`products-section scroll-reveal${selectedProduct ? ' product-detail-active' : ''}`}
      >
        {!selectedProduct && <h2 className="section-title">Our Products</h2>}
        {loading ? (
          <div className="loading">Loading products...</div>
        ) : error ? (
          <div className="error">Error loading products: {error}</div>
        ) : selectedProduct ? (
          <ProductDetail
            product={selectedProduct}
            relatedProducts={relatedProducts}
            onBack={handleBackToProducts}
            onOrder={handleOrderNow}
            onViewRelated={handleSelectProduct}
            currentUser={currentUser}
            onToggleWishlist={handleToggleWishlist}
            isWishlisted={wishlist.includes(selectedProduct.id)}
            onAddToCart={handleAddToCart}
            onContactSeller={handleContactSeller}
          />
        ) : (
          <LazyBoundary fallback={<div className="loading">Loading product catalog...</div>}>
            <ProductPage
              products={sortedProducts}
              onAddToCart={(p) => handleAddToCart(p)}
              onContactSeller={(p) => handleContactSeller(p)}
              onViewProduct={(id) => handleSelectProduct(id)}
              onToggleWishlist={handleToggleWishlist}
              wishlist={wishlist}
              currentUser={currentUser}
            />
          </LazyBoundary>
        )}
      </section>}

      {!sellerDashboardMode && !buyerDashboardMode && <section className="about-section scroll-reveal">
        <h2>About Kukuta Hen Farm</h2>
        <p>
          We are a family-owned hen farm dedicated to providing the highest quality, organically-raised eggs and farm products. Our hens are raised with care in a stress-free environment, ensuring the best taste and nutrition.
        </p>
      </section>}

      {!sellerDashboardMode && !buyerDashboardMode && <footer className="farm-footer">
        {currentUser?.role === 'buyer' && (
          <p className="buyer-safety-disclaimer" role="note">
            Buyer safety: keep payments and conversations on Kukuta, verify seller feedback, and never share passwords or one-time codes.
          </p>
        )}
        <p>&copy; 2024 Kukuta Hen Farm. All rights reserved.</p>
        <p>Sustainability | Quality | Care</p>
      </footer>}
    </>
      )}
    </>
  );
}
