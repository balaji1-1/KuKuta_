import { useState, useEffect } from 'react';
import React from 'react'
import { jsPDF } from 'jspdf';
import ForgotPasswordPage from './ForgotPassword';
import RoosterSplash from './RoosterSplash';
import ProductCard from './ProductCard';
import ProductPage from './ProductPage';
import Messenger from './Messenger';
import apiFetch from './api';

const categories = [
  'Egg*Chicks',
  'Bird',
  'Feed & Nutrition',
  'Housing & Shelter',
  'Equipment & Tools',
  'Health & Care',
  'Cattel',
];

const categoryGroups = [
  { title: 'Livestock', subtitle: 'Birds and farm animals', categories: ['Egg*Chicks', 'Bird', 'Cattel'] },
  { title: 'Care & Nutrition', subtitle: 'Feed, health and medication', categories: ['Feed & Nutrition', 'Health & Care'] },
  { title: 'Housing & Tools', subtitle: 'Shelter and farm equipment', categories: ['Housing & Shelter', 'Equipment & Tools'] },
];

const birdTypeOptions = [
  'Breeding Hen',
  'Breeding Rooster',
  'Fighting Roosters',
  'Cockerels',
  'Pullet',
];

const LIVESTOCK_CATEGORIES = new Set(['Egg*Chicks', 'Bird', 'Cattel']);
const CURRENCY_SYMBOL = '₹';

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

const demoProducts = [
  {
    id: 101,
    name: 'Organic Free-Range Eggs',
    category: 'Egg*Chicks',
    price: '₹9.99',
    description: 'A dozen farm-fresh free-range eggs packed with flavor and nutrition.',
    image: '🥚',
    seller: 'Kukuta Farm',
  },
  {
    id: 102,
    name: 'Premium Layer Feed',
    category: 'Feed & Nutrition',
    price: '₹18.50',
    description: 'Balanced feed mix to keep your hens healthy, happy, and productive.',
    image: '🌾',
    seller: 'Kukuta Farm',
  },
  {
    id: 103,
    name: 'Cozy Hen House Kit',
    category: 'Housing & Shelter',
    price: '₹129.00',
    description: 'Durable shelter kit for safe, comfortable housing year-round.',
    image: '🏠',
    seller: 'Kukuta Farm',
  },
  {
    id: 104,
    name: 'Premium Egg Branding Box',
    category: 'Equipment & Tools',
    price: '₹24.75',
    description: 'Wooden egg crate set with branding to grow your farm business.',
    image: '🧺',
    seller: 'Kukuta Farm',
  },
  {
    id: 105,
    name: 'Healthy Coop Cleanser',
    category: 'Health & Care',
    price: '₹14.99',
    description: 'Eco-friendly coop cleaner for a fresh and safe environment.',
    image: '🧼',
    seller: 'Kukuta Farm',
  },
  {
    id: 106,
    name: 'Poultry Growth Booster',
    category: 'Feed & Nutrition',
    price: '₹26.00',
    description: 'Vitamin-rich feed supplement to improve growth, immunity, and overall flock strength.',
    image: '🌱',
    seller: 'Kukuta Farm',
  },
  {
    id: 107,
    name: 'Automatic Poultry Waterer',
    category: 'Equipment & Tools',
    price: '₹58.75',
    description: 'Clean and steady drinking system designed for busy farms and healthier birds.',
    image: '💧',
    seller: 'Kukuta Farm',
  },
  {
    id: 108,
    name: 'Hen Nesting Box',
    category: 'Housing & Shelter',
    price: '₹89.50',
    description: 'Comfortable nesting unit for safe and hygienic egg laying with easy cleaning access.',
    image: '🪺',
    seller: 'Kukuta Farm',
  },
  {
    id: 109,
    name: 'Farm Health Starter Kit',
    category: 'Health & Care',
    price: '₹33.20',
    description: 'Essential care bundle for sanitizing, disinfecting, and supporting poultry wellness.',
    image: '🩺',
    seller: 'Kukuta Farm',
  },
  {
    id: 110,
    name: 'Dual Purpose Egg Crate',
    category: 'Equipment & Tools',
    price: '₹42.90',
    description: 'Reliable egg crate for safe transport and neat storage during sale and distribution.',
    image: '📦',
    seller: 'Kukuta Farm',
  },
];

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
          try {
            localStorage.setItem('accessToken', data.tokens.access);
            localStorage.setItem('refreshToken', data.tokens.refresh);
          } catch (e) {}
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

function PasswordResetConfirmPage({ uid, token, onClose, onOpenLogin }) {
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
          {!resetSuccess && <button type="submit" className="auth-btn">Reset Password</button>}
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
          try {
            localStorage.setItem('accessToken', data.tokens.access);
            localStorage.setItem('refreshToken', data.tokens.refresh);
          } catch (e) {}
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
              View Order History
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

  const downloadPdf = () => {
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

function SellerDashboard({ sellerUsername, products, orders, onDeleteProduct, onUpdateProduct, onContactBuyer, onOpenInvoice, onClose }) {
  const totalRevenue = orders.reduce((sum, order) => sum + parsePrice(order.price), 0);
  const [editingProductId, setEditingProductId] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [editImage, setEditImage] = useState(null);

  const startEditing = (product) => {
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
  };

  const updateEditValue = (field, value) => {
    setEditValues((current) => ({ ...current, [field]: value }));
  };

  const saveProduct = async (event) => {
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
  };

  return (
    <section className="dashboard-section seller-dashboard">
      <div className="dashboard-header">
        <div className="dashboard-title-block">
          <span className="dashboard-eyebrow">Store operations</span>
          <h2>Seller Dashboard</h2>
          <p>Manage your catalog and keep track of sales activity.</p>
        </div>
        <button className="close-dashboard-btn" onClick={onClose}>× Close dashboard</button>
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
            <span>Orders received</span>
            <strong>{orders.length}</strong>
          </div>
          <div className="dashboard-metric">
            <span>Total revenue</span>
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
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(event) => setEditImage(event.target.files?.[0] || null)}
                        />
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
          <p>No products listed yet.</p>
        )}
      </div>
      <div className="dashboard-panel">
        <div className="dashboard-panel-heading">
          <div>
            <span className="dashboard-eyebrow">Activity</span>
            <h3>Recent Sales</h3>
          </div>
          <span className="dashboard-panel-count">{orders.length} order{orders.length === 1 ? '' : 's'}</span>
        </div>
        {orders.length > 0 ? (
          <table className="orders-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Product</th>
                <th>Buyer</th>
                <th>Price</th>
                <th>Date</th>
                <th>Invoice</th>
                <th>Chat</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>{order.id}</td>
                  <td>{order.productName}</td>
                  <td>{order.buyer}</td>
                  <td>{order.price}</td>
                  <td>{order.date}</td>
                  <td>
                    {order.invoice ? (
                      <button className="auth-btn secondary chat-order-btn" onClick={() => onOpenInvoice(order.invoice)}>
                        View invoice
                      </button>
                    ) : (
                      <span className="invoice-disabled">Livestock</span>
                    )}
                  </td>
                  <td>
                    <button className="auth-btn secondary chat-order-btn" onClick={() => onContactBuyer(order)}>
                      Chat
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No sales yet.</p>
        )}
      </div>
    </section>
  );
}

function BuyerOrderHistory({ orders, onClose, onOpenInvoice }) {
  const totalSpent = orders.reduce((sum, order) => sum + parsePrice(order.price), 0);
  const totalOrders = orders.length;

  return (
    <section className="dashboard-section buyer-history">
      <div className="dashboard-header">
        <h2>Buyer Dashboard - Order History</h2>
        <button className="close-dashboard-btn" onClick={onClose}>× Close</button>
      </div>
      <div className="dashboard-panel">
        <div className="dashboard-summary">
          <div>
            <strong>Total Orders:</strong> {totalOrders}
          </div>
          <div>
            <strong>Total Spent:</strong> {formatPrice(totalSpent)}
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
                <th>Seller</th>
                <th>Price</th>
                <th>Date</th>
                <th>Status</th>
                <th>Invoice</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>{order.id}</td>
                  <td>{order.productName}</td>
                  <td>{order.seller}</td>
                  <td>{order.price}</td>
                  <td>{order.date}</td>
                  <td>{order.status}</td>
                  <td>
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
          <p>You have no order history yet.</p>
        )}
      </div>
    </section>
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
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Feed & Nutrition');
  const [birdType, setBirdType] = useState('Breeding Hen');
  const [betterHenModel, setBetterHenModel] = useState(null);
  const [roosterModel, setRoosterModel] = useState(null);
  const [images, setImages] = useState([]);
  const [videos, setVideos] = useState([]);
  const [imageUrls, setImageUrls] = useState([]);
  const [videoUrls, setVideoUrls] = useState([]);
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
    setVideos(prev => [...prev, ...files]);
  };

  const removeImage = (index) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const removeVideo = (index) => {
    setVideos(prev => prev.filter((_, i) => i !== index));
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

  const handleBetterHenModelUpload = (e) => {
    setBetterHenModel(e.target.files[0] || null);
  };

  const handleRoosterModelUpload = (e) => {
    setRoosterModel(e.target.files[0] || null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFieldErrors({});
    setFormSuccess('');

    const isBirdCategory = category === 'Bird';

    if (category === 'Egg*Chicks' && (!betterHenModel || !roosterModel)) {
      setFieldErrors({
        better_hen_model: !betterHenModel ? 'A hen model is required.' : '',
        rooster_model: !roosterModel ? 'A rooster model is required.' : '',
      });
      return;
    }

    if (isBirdCategory && !birdType) {
      setFieldErrors({ bird_type: 'Please select a bird type.' });
      return;
    }

    setIsSubmitting(true);
    const formData = new FormData();
    formData.append('name', name);
    formData.append('price', `${CURRENCY_SYMBOL}${price}`);
    formData.append('quantity', quantity);
    formData.append('description', description);
    formData.append('category', category);
    if (isBirdCategory) {
      formData.append('bird_type', birdType);
    }
    formData.append('seller', userName);
    if (betterHenModel) {
      formData.append('better_hen_model', betterHenModel);
    }
    if (roosterModel) {
      formData.append('rooster_model', roosterModel);
    }

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

    // Add video URLs
    videoUrls.filter(url => url.trim()).forEach((url, index) => {
      formData.append(`video_urls[${index}]`, url);
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
    setPrice('');
    setQuantity(1);
    setBetterHenModel(null);
    setRoosterModel(null);
    setDescription('');
    setImages([]);
    setVideos([]);
    setImageUrls([]);
    setVideoUrls([]);
    setBirdType('Breeding Hen');
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
        <form onSubmit={handleSubmit} className="auth-form" encType="multipart/form-data">
          <div className="form-group">
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

          <div className="form-group">
            <label htmlFor="product-price">Price (₹)</label>
            <input
              id="product-price"
              type="number"
              value={price}
              className={getFieldError('price') ? 'input-error' : ''}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="29"
              step="0.01"
              required
            />
            {getFieldError('price') && <div className="field-error">{getFieldError('price')}</div>}
          </div>

          <div className="form-group">
            <label htmlFor="product-quantity">Quantity</label>
            <input
              id="product-quantity"
              type="number"
              min="1"
              value={quantity}
              className={getFieldError('quantity') ? 'input-error' : ''}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
              placeholder="1"
              required
            />
            {getFieldError('quantity') && <div className="field-error">{getFieldError('quantity')}</div>}
          </div>

          <div className="form-group">
            <label htmlFor="product-category">Category</label>
            <select
              id="product-category"
              value={category}
              className={getFieldError('category') ? 'input-error' : ''}
              onChange={(e) => setCategory(e.target.value)}
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            {getFieldError('category') && <div className="field-error">{getFieldError('category')}</div>}
            {category === 'Egg*Chicks' && (
              <div className="field-note">For Egg*Chicks listings, both a hen model and a rooster model are required.</div>
            )}
            {category === 'Bird' && (
              <div className="field-note">Select the bird type for this listing.</div>
            )}
          </div>

          {category === 'Bird' && (
            <div className="form-group">
              <label htmlFor="product-bird-type">Bird Type</label>
              <select
                id="product-bird-type"
                value={birdType}
                className={getFieldError('bird_type') ? 'input-error' : ''}
                onChange={(e) => setBirdType(e.target.value)}
              >
                {birdTypeOptions.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              {getFieldError('bird_type') && <div className="field-error">{getFieldError('bird_type')}</div>}
            </div>
          )}

          {category === 'Egg*Chicks' && (
            <>
              <div className="form-group">
                <label htmlFor="better-hen-model">Better Hen Model</label>
                <input
                  id="better-hen-model"
                  type="file"
                  accept=".glb,.gltf,.obj,.fbx,.usdz"
                  onChange={handleBetterHenModelUpload}
                />
                {getFieldError('better_hen_model') && <div className="field-error">{getFieldError('better_hen_model')}</div>}
                {betterHenModel && <div className="field-note">Selected file: {betterHenModel.name}</div>}
                <div className="field-note">Upload the hen model file used to represent this listing.</div>
              </div>
              <div className="form-group">
                <label htmlFor="rooster-model">Rooster Model</label>
                <input
                  id="rooster-model"
                  type="file"
                  accept=".glb,.gltf,.obj,.fbx,.usdz"
                  onChange={handleRoosterModelUpload}
                />
                {getFieldError('rooster_model') && <div className="field-error">{getFieldError('rooster_model')}</div>}
                {roosterModel && <div className="field-note">Selected file: {roosterModel.name}</div>}
                <div className="field-note">Upload the matching rooster model for Egg*Chicks listings.</div>
              </div>
            </>
          )}
          {(formError || formSuccess) && (
            <div className="form-message-row">
              {formError && <div className="form-error" role="alert">{formError}</div>}
              {formSuccess && <div className="form-success" role="status">{formSuccess}</div>}
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
                accept="video/*"
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

          <button type="submit" className="auth-btn" disabled={isSubmitting} aria-busy={isSubmitting}>
            {isSubmitting ? 'Adding product…' : 'Add Product'}
          </button>
        </form>
      </div>
    </div>
  );
}

function HeroSlider({ products = [], onSelectProduct, selectedCategory = null, search = '', wishlist = [] }) {
  const [currentSlide, setCurrentSlide] = useState(0);

  const fallbackSlides = [
    {
      title: 'Farm fresh, chef approved.',
      subtitle: 'Curated poultry and nutrition essentials for healthy living.',
      gradient: 'linear-gradient(135deg, #132b14 0%, #2a5d34 42%, #6ca35c 100%)',
      emoji: '🐔',
    },
    {
      title: 'Premium nutrition for every flock.',
      subtitle: 'High-quality feed, eggs, and care products selected by experts.',
      gradient: 'linear-gradient(135deg, #8c5d18 0%, #d7b15a 42%, #f5e2a6 100%)',
      emoji: '🥚',
    },
    {
      title: 'Sustainability built into every order.',
      subtitle: 'Thoughtful sourcing, trusted quality, and dependable delivery.',
      gradient: 'linear-gradient(135deg, #0e3d38 0%, #2e7d6b 42%, #b0d7c4 100%)',
      emoji: '🌿',
    },
  ];

  const normalizedSearch = search.trim().toLowerCase();
  const productSlides = [...products]
    .map((product, index) => {
      const searchableText = `${product.name || ''} ${product.description || ''} ${product.seller || ''}`.toLowerCase();
      let score = 0;
      if (selectedCategory && product.category === selectedCategory) score += 5;
      if (normalizedSearch && searchableText.includes(normalizedSearch)) score += 4;
      if (wishlist.includes(product.id)) score += 3;
      return { product, index, score };
    })
    .sort((left, right) => right.score - left.score || right.product.id - left.product.id)
    .slice(0, 3)
    .map(({ product }, index) => ({
    title: product.name,
    subtitle: `${product.category || 'Farm product'} from ${product.seller || 'Kukuta Farm'}`,
    seller: product.seller || 'Kukuta Farm',
    productId: product.id,
    product,
    gradient: fallbackSlides[index % fallbackSlides.length].gradient,
    emoji: fallbackSlides[index % fallbackSlides.length].emoji,
  }));
  const slides = productSlides.length > 0 ? productSlides : fallbackSlides;

  React.useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const goToSlide = (index) => setCurrentSlide(index);
  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % slides.length);
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);

  return (
    <section className="hero-slider scroll-reveal">
      {slides.map((slide, index) => (
        <div
          key={index}
          className={`hero-slide ${index === currentSlide ? 'active' : ''}`}
          style={{ background: slide.gradient }}
        >
          <div className="hero-slide-content">
            {slide.product ? (
              <button
                type="button"
                className="hero-product-image"
                onClick={() => onSelectProduct?.(slide.productId)}
                aria-label={`View ${slide.title}`}
              >
                {getProductImage(slide.product)}
              </button>
            ) : (
              <div className="hero-emoji">{slide.emoji}</div>
            )}
            <h2>{slide.title}</h2>
            <p>{slide.subtitle}</p>
            <div className="hero-actions">
              <button className="slide-primary" onClick={() => slide.productId && onSelectProduct?.(slide.productId)}>
                {slide.productId ? 'View product' : 'Explore products'}
              </button>
              <span className="slide-secondary">{slide.seller ? `Sold by ${slide.seller}` : 'Meet our farmers'}</span>
            </div>
          </div>
        </div>
      ))}

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
}

function ProductDetail({ product, relatedProducts, onBack, onOrder, onViewRelated, currentUser, onToggleWishlist, isWishlisted, onAddToCart, onContactSeller }) {
  const [reviews, setReviews] = useState([]);
  const [sellerReviews, setSellerReviews] = useState([]);
  const [relatedRatings, setRelatedRatings] = useState({});
  const [reviewRating, setReviewRating] = useState('5');
  const [reviewComment, setReviewComment] = useState('');
  const [reviewImages, setReviewImages] = useState([]);
  const [editingReviewId, setEditingReviewId] = useState(null);
  const [editReviewRating, setEditReviewRating] = useState('5');
  const [editReviewComment, setEditReviewComment] = useState('');
  const [reviewError, setReviewError] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

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
          setReviews(Array.isArray(productData) ? productData : []);
          setSellerReviews(Array.isArray(sellerData) ? sellerData : []);
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

  const isSellerVerified = sellerAverage !== null && sellerAverage >= 4.5;

  const productAverage = reviews.length > 0
    ? reviews.reduce((total, review) => total + Number(review.rating || 0), 0) / reviews.length
    : null;

  useEffect(() => {
    if (!relatedProducts.length) {
      setRelatedRatings({});
      return undefined;
    }

    let active = true;
    Promise.allSettled(
      relatedProducts.map(async (related) => {
        try {
          const response = await apiFetch(`/reviews/?product=${related.id}`, { method: 'GET' });
          const data = response.ok ? await response.json() : [];
          const reviewList = Array.isArray(data) ? data : [];
          const average = reviewList.length > 0
            ? reviewList.reduce((total, review) => total + Number(review.rating || 0), 0) / reviewList.length
            : null;
          return [related.id, average];
        } catch {
          return [related.id, null];
        }
      })
    )
      .then((results) => {
        if (!active) return;
        const nextRatings = {};
        results.forEach((result) => {
          if (result.status === 'fulfilled') {
            const [id, rating] = result.value;
            nextRatings[id] = rating;
          }
        });
        setRelatedRatings(nextRatings);
      })
      .catch(() => {
        if (active) setRelatedRatings({});
      });

    return () => { active = false; };
  }, [relatedProducts]);

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
          <div className="product-detail-image">{getProductImage(product)}</div>
          <div className="product-detail-info">
            <h2>{product.name}</h2>
            {product.seller && (
              <div>
                <p className="seller-info">
                  Sold by {product.seller}
                  {isSellerVerified && (
                    <span className="seller-verified-badge">
                      <span className="seller-verified-icon">✓</span>
                      Verified
                    </span>
                  )}
                </p>
              </div>
            )}
            <p className="product-description">{product.description}</p>
            <div className="product-detail-price">{product.price}</div>
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
              <button className="add-cart-btn" onClick={() => onOrder(product)}>
                Order Now
              </button>
            </div>
          </div>
        </div>

      </div>
      <section className="product-reviews-panel">
        <div className="reviews-heading">
          <div>
            <span className="reviews-kicker">Customer feedback</span>
            <h3>Reviews for {product.name}</h3>
          </div>
          <span className="reviews-count review-summary-badge" aria-label={productAverage !== null ? `${productAverage.toFixed(1)} out of 5 stars` : 'No ratings yet'}>
            {productAverage !== null ? <>★ {productAverage.toFixed(1)}</> : '★ —'}
          </span>
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
                      <span className="review-stars" aria-label={`${Number(review.rating).toFixed(1)} out of 5 stars`}>★ {Number(review.rating).toFixed(1)}</span>
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
      <div className="related-products-panel">
        <h3>Related products</h3>
        {relatedProducts.length > 0 ? (
          <div className="related-products-grid">
            {relatedProducts.map((related) => {
              const average = typeof relatedRatings[related.id] === 'number' ? relatedRatings[related.id] : null;
              const filledStars = average !== null ? Math.max(0, Math.min(5, Math.round(average))) : 0;

              return (
                <div key={related.id} className="related-product-card" onClick={() => onViewRelated(related.id)}>
                  <div className="related-product-image">
                    {getProductImage(related)}
                    <div className="related-product-badge" aria-label={average !== null ? `${average.toFixed(1)} out of 5 stars` : 'No ratings yet'}>
                      <span className="related-product-stars">{'★'.repeat(filledStars)}{average !== null ? '☆'.repeat(5 - filledStars) : '☆☆☆☆☆'}</span>
                      <span className="related-product-rating">{average !== null ? average.toFixed(1) : 'New'}</span>
                    </div>
                  </div>
                  <div className="related-product-content">
                    <h4>{related.name}</h4>
                    <p>{related.price}</p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p>No related products available.</p>
        )}
      </div>
    </section>
  );
}

export default function App() {
  const [showRoosterAnimation, setShowRoosterAnimation] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [isMobileLayout, setIsMobileLayout] = useState(() => typeof window !== 'undefined' ? window.innerWidth <= 768 : false);
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
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [isBuyerHistoryOpen, setIsBuyerHistoryOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
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
  const [autoOpenConversation, setAutoOpenConversation] = useState(false);
  const [messageDraft, setMessageDraft] = useState('');
  const [messageHistory, setMessageHistory] = useState([]);
  const [unreadMessages, setUnreadMessages] = useState([]);
  const [bookingMap, setBookingMap] = useState({});
  const [activeInvoice, setActiveInvoice] = useState(null);

  const showFlash = (message, type = 'info', duration = 5000) => {
    setFlash({ message, type });
    setTimeout(() => setFlash(null), duration);
  };

  useEffect(() => {
    const handleResize = () => setIsMobileLayout(window.innerWidth <= 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (showRoosterAnimation) return undefined;
    const timer = setTimeout(() => {
      showFlash('Welcome to Kukuta. Explore trusted farm products and essentials.', 'success', 5000);
    }, 350);
    return () => clearTimeout(timer);
  }, [showRoosterAnimation]);

  const handleThemeToggle = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    showFlash(`Switched to ${nextTheme} mode`, 'success', 3000);
  };

  const handleAddToCart = (product) => {
    setCartItems((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    setIsCartOpen(true);
    showFlash(`${product.name} added to cart`, 'success');
  };

  const handleRemoveFromCart = (productId) => {
    setCartItems((prev) => prev.filter((item) => item.id !== productId));
    showFlash('Removed from cart', 'info');
  };

  const handleUpdateCartQuantity = (productId, value) => {
    const quantity = Math.max(1, Number(value) || 1);
    setCartItems((prev) => prev.map((item) => item.id === productId ? { ...item, quantity } : item));
  };

  const cartTotal = cartItems.reduce((sum, item) => sum + parsePrice(item.price) * item.quantity, 0);

  const handleToggleWishlist = (product) => {
    setWishlist((prev) => {
      if (prev.includes(product.id)) {
        showFlash(`${product.name} removed from wishlist`, 'info');
        return prev.filter((id) => id !== product.id);
      }
      setIsWishlistOpen(true);
      showFlash(`${product.name} added to wishlist`, 'success');
      return [...prev, product.id];
    });
  };

  const handleCheckout = () => {
    if (cartItems.length === 0) {
      showFlash('Your cart is empty', 'error');
      return;
    }

    const checkoutOrders = cartItems
      .map((item, index) => {
        const status = isLivestockProduct(item) ? 'Processing' : 'Confirmed';
        const order = {
          id: Date.now() + index,
          productId: item.id,
          productName: item.name,
          price: item.price,
          seller: item.seller || 'Farm',
          buyer: currentUser?.username || 'Guest',
          date: new Date().toLocaleDateString(),
          status,
          invoice: createInvoiceForOrder({
            id: Date.now() + index,
            productName: item.name,
            buyer: currentUser?.username || 'Guest',
            seller: item.seller || 'Farm',
            price: item.price,
            status,
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
        ? 'Checkout complete! Your order is now processing.'
        : 'Checkout complete!',
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
    const restoreCurrentUser = async () => {
      if (!localStorage.getItem('accessToken') && !localStorage.getItem('refreshToken')) {
        return;
      }

      try {
        const response = await apiFetch('/me/', { method: 'GET' });
        if (!response.ok) return;
        const user = await response.json();
        setCurrentUser(user);
      } catch (err) {
        // Anonymous startup is valid when saved credentials are unavailable.
      }
    };

    restoreCurrentUser();
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
        setIsResetPasswordPage(true);
      } else {
        setIsResetPasswordPage(false);
      }
    };

    updateRoute();
    window.addEventListener('popstate', updateRoute);
    return () => window.removeEventListener('popstate', updateRoute);
  }, []);

  // Handle clicking outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.profile-container')) setIsProfileOpen(false);
      if (!event.target.closest('.role-dropdown-container')) setIsRoleDropdownOpen(false);
      if (!event.target.closest('.header-shell .navbar-dropdown') && !event.target.closest('.hamburger-menu')) setIsMenuOpen(false);
      if (!event.target.closest('.search-form') && !event.target.closest('.search-toggle')) setIsSearchOpen(false);
      if (!event.target.closest('.messenger-panel')) setMessagePanelOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const elements = document.querySelectorAll('.scroll-reveal');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.18,
      }
    );

    elements.forEach((el) => observer.observe(el));
    return () => elements.forEach((el) => observer.unobserve(el));
  }, []);

  const navigateToForgotPassword = () => {
    window.history.pushState(null, '', '/forgot-password');
    setIsForgotPasswordPage(true);
    setIsResetPasswordPage(false);
  };

  const navigateToResetConfirm = (uid, token) => {
    const path = `/password-reset-confirm/${uid}/${token}/`;
    window.history.pushState(null, '', path);
    setResetUid(uid);
    setResetToken(token);
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

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    setSelectedProductId(null);
    setIsSearchOpen(false);
    document.getElementById('products')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const fetchProducts = async () => {
    try {
      const response = await apiFetch('/products/', { method: 'GET' });
      if (!response.ok) {
        throw new Error('Failed to fetch products');
      }
      const data = await response.json();
      const products = Array.isArray(data) && data.length > 0 ? data : demoProducts;
      setAllProducts(products);
      if (!data || data.length === 0) {
        showFlash('No backend products found. Showing demo items.', 'info', 6000);
      }
      setLoading(false);
    } catch (err) {
      setAllProducts(demoProducts);
      setLoading(false);
      showFlash('Unable to reach product API. Showing demo items.', 'error', 6000);
    }
  };

  const handleLogin = (user) => {
    setCurrentUser({
      role: user.role || 'buyer',
      ...user,
    });
    showFlash(`Login successful. Welcome back, ${user.name || user.username || 'to Kukuta'}!`, 'success', 4000);
  };

  const handleSignup = (user) => {
    setCurrentUser({
      role: user.role || 'buyer',
      ...user,
    });
  };

  const handleRoleToggle = async (newRole) => {
    if (!currentUser) return;
    try {
      const response = await apiFetch('/role-toggle/', {
        method: 'POST',
        body: { role: newRole },
      });
      const data = await response.json();
      if (response.ok) {
        setCurrentUser((current) =>
          current ? { ...current, role: data.role || newRole } : current
        );
        setIsRoleDropdownOpen(false); // Close the dropdown after switching
        setIsProfileModalOpen(false);
        showFlash(`Role switched to ${newRole}.`, 'success');
      } else {
        showFlash(data.error || 'Could not switch role.', 'error');
      }
    } catch (err) {
      showFlash('Could not switch role.', 'error');
    }
  };

  const getBookingKey = (product, recipientUser) => {
    if (!product) return null;
    const productId = Number(product.id ?? 0);
    const participants = [currentUser?.username || 'guest', recipientUser || 'seller']
      .filter(Boolean)
      .sort();
    return `${productId}-${participants.join('|')}`;
  };

  const createBookingState = (product, recipientUser, side = 'buyer') => {
    const key = getBookingKey(product, recipientUser);
    if (!key) return null;

    const buyerName = side === 'buyer' ? currentUser?.username || 'Guest' : recipientUser || 'Buyer';
    const sellerName = side === 'buyer' ? product.seller || 'Farm' : currentUser?.username || 'Seller';

    const state = {
      buyerConfirmed: side === 'buyer',
      sellerConfirmed: side === 'seller',
      buyer: buyerName,
      seller: sellerName,
      status: side === 'buyer' ? 'Waiting for seller confirmation' : 'Waiting for buyer confirmation',
    };

    setBookingMap((prev) => ({ ...prev, [key]: { ...(prev[key] || {}), ...state } }));
    return state;
  };

  const finalizeBookingOrder = (product, buyerName, sellerName) => {
    const newOrder = {
      id: Date.now(),
      productId: product.id,
      productName: product.name,
      price: product.price,
      seller: sellerName || product.seller || 'Farm',
      buyer: buyerName || currentUser?.username || 'Guest',
      date: new Date().toLocaleDateString(),
      status: 'Confirmed',
      invoice: createInvoiceForOrder({
        id: Date.now(),
        productName: product.name,
        buyer: buyerName || currentUser?.username || 'Guest',
        seller: sellerName || product.seller || 'Farm',
        price: product.price,
        status: 'Confirmed',
      }, product),
    };

    setOrders((prev) => {
      const alreadyExists = prev.some((order) => (
        order.productId === product.id &&
        order.buyer === newOrder.buyer &&
        order.seller === newOrder.seller
      ));
      return alreadyExists ? prev : [newOrder, ...prev];
    });

    if (newOrder.invoice) {
      setActiveInvoice(newOrder.invoice);
    }
  };

  const confirmBookingInChat = () => {
    if (!contactProduct || !currentUser || !chatRecipient) return;

    const key = getBookingKey(contactProduct, chatRecipient);
    if (!key) return;

    const currentState = bookingMap[key] || {
      buyerConfirmed: false,
      sellerConfirmed: false,
      buyer: currentUser?.role === 'buyer' ? currentUser.username : chatRecipient,
      seller: currentUser?.role === 'seller' ? currentUser.username : contactProduct.seller,
      status: 'Pending',
    };

    const nextState = { ...currentState };
    if (currentUser.role === 'buyer') {
      nextState.buyerConfirmed = true;
      nextState.buyer = currentUser.username;
      nextState.seller = contactProduct.seller || 'Farm';
    } else {
      nextState.sellerConfirmed = true;
      nextState.seller = currentUser.username;
      nextState.buyer = chatRecipient;
    }

    if (nextState.buyerConfirmed && nextState.sellerConfirmed) {
      nextState.status = 'Confirmed';
      finalizeBookingOrder(contactProduct, nextState.buyer, nextState.seller);
      showFlash('Both sides confirmed the booking. It is now visible in the seller dashboard.', 'success');
    } else {
      nextState.status = currentUser.role === 'buyer' ? 'Waiting for seller confirmation' : 'Waiting for buyer confirmation';
      showFlash(currentUser.role === 'buyer' ? 'Booking request is ready. Waiting for seller confirmation.' : 'You confirmed the booking. Waiting for buyer confirmation.', 'info');
    }

    setBookingMap((prev) => ({ ...prev, [key]: nextState }));
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
    if (!currentUser || currentUser.role !== 'buyer') {
      showFlash('Please sign in as a buyer to start a booking.', 'info');
      setIsLoginOpen(true);
      return;
    }

    if (isLivestockProduct(product)) {
      showFlash('Livestock bookings are handled through chat confirmation only.', 'info');
    }

    createBookingState(product, product.seller, 'buyer');
    await handleContactSeller(product, true);
  };

  const handleContactSeller = async (product, shouldOpenConversation = false) => {
    if (!currentUser) {
      showFlash('Please sign in to contact the seller.', 'info');
      setIsLoginOpen(true);
      return;
    }
    if (currentUser.role !== 'buyer') {
      showFlash('Only buyers can contact sellers from the storefront.', 'info');
      return;
    }

    const bookingKey = getBookingKey(product, product.seller);
    const existingBooking = bookingKey ? bookingMap[bookingKey] : null;

    setContactProduct(product);
    setChatRecipient(product.seller);
    setAutoOpenConversation(shouldOpenConversation);
    setMessageDraft('');
    setMessagePanelOpen(true);

    if (!existingBooking) {
      createBookingState(product, product.seller, 'buyer');
    }

    try {
      const response = await apiFetch('/messages/', {
        method: 'GET',
      });
      if (!response.ok) return;
      const data = await response.json();
      const relevant = Array.isArray(data)
        ? data.filter((item) => item.product === product.id || item.product_name === product.name)
        : [];
      setMessageHistory(relevant);
    } catch (error) {
      setMessageHistory([]);
    }
  };

  const handleContactBuyer = (order) => {
    const product = allProducts.find((item) => item.id === order.productId) || {
      id: order.productId,
      name: order.productName,
      seller: currentUser?.username,
    };
    const key = getBookingKey(product, order.buyer);
    if (key && !bookingMap[key]) {
      setBookingMap((prev) => ({
        ...prev,
        [key]: {
          buyerConfirmed: true,
          sellerConfirmed: false,
          buyer: order.buyer,
          seller: currentUser?.username || product.seller,
          status: 'Waiting for seller confirmation',
        },
      }));
    }
    setContactProduct(product);
    setChatRecipient(order.buyer);
    setAutoOpenConversation(false);
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
    const product = allProducts.find((item) => item.id === (message.product || message.product_id)) || {
      id: message.product || message.product_id,
      name: message.product_name || 'Product conversation',
      seller: currentUser?.username,
    };
    setContactProduct(product);
    setChatRecipient(message.sender_name || message.sender);
    setAutoOpenConversation(false);
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
    } catch (e) {}
    setCurrentUser(null);
  };

  const handleSelectProduct = (id) => {
    setSelectedProductId(id);
  };

  const handleOpenInvoice = (invoice) => {
    setActiveInvoice(invoice);
  };

  const handleBackToProducts = () => {
    setSelectedProductId(null);
  };

  const selectedProduct = allProducts.find((product) => product.id === selectedProductId);
  const relatedProducts = selectedProduct
    ? allProducts.filter(
        (product) => product.category === selectedProduct.category && product.id !== selectedProduct.id
      ).slice(0, 4)
    : [];

  const filteredProducts = allProducts.filter((p) => {
    const normalizedSearch = search.toLowerCase();
    const matchesSearch = !normalizedSearch || p.name.toLowerCase().includes(normalizedSearch) ||
                p.description.toLowerCase().includes(normalizedSearch) ||
                (p.seller || '').toLowerCase().includes(normalizedSearch);
    const matchesCategory = selectedCategory === null || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (sortOption === 'Price: low to high') {
      return parsePrice(a.price) - parsePrice(b.price);
    }
    if (sortOption === 'Price: high to low') {
      return parsePrice(b.price) - parsePrice(a.price);
    }
    return b.id - a.id;
  });

  const cartCount = cartItems.reduce((count, item) => count + item.quantity, 0);
  const wishlistItems = allProducts.filter((product) => wishlist.includes(product.id));

  const buyerOrders = orders.filter((order) => order.buyer === currentUser?.username);
  const sellerOrders = orders.filter((order) => order.seller === currentUser?.username);
  const sellerProducts = allProducts.filter((product) => product.seller === currentUser?.username);
  const sellerDashboardMode = isDashboardOpen && currentUser?.role === 'seller';

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
        <ForgotPasswordPage 
          onClose={navigateHome}
          onSwitchToLogin={() => { navigateHome(); setIsLoginOpen(true); }}
          onNavigateToResetConfirm={navigateToResetConfirm}
        />
      )}
      {isResetPasswordPage && (
        <PasswordResetConfirmPage 
          uid={resetUid}
          token={resetToken}
          onClose={navigateHome}
          onOpenLogin={() => { navigateHome(); setIsLoginOpen(true); }}
        />
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

              <button className={`hamburger-menu${isMenuOpen ? ' is-open' : ''}`} onClick={() => setIsMenuOpen(!isMenuOpen)} title="Menu" aria-label="Menu" aria-expanded={isMenuOpen}>
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
                    <button className="icon-btn" onClick={() => { setIsCartOpen(true); setIsMenuOpen(false); }}>
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
                  <button className="icon-btn theme-toggle" onClick={handleThemeToggle}>
                    {theme === 'light' ? '☀️' : '🌙'}
                  </button>
                )}
              </div>

              {isMenuOpen && (
                <div className="navbar-dropdown">
                  {currentUser ? (
                    <>
                      <div className="dropdown-section">
                        <div className="dropdown-header">Your Account</div>
                        <button className="dropdown-item dropdown-messages-item" onClick={() => { handleOpenMessageNotification(); setIsMenuOpen(false); }}>
                          <span aria-hidden="true">💬</span> Messages{unreadMessages.length > 0 ? ` (${unreadMessages.length})` : ''}
                        </button>
                        <button className="dropdown-item" onClick={() => { 
                          handleRoleToggle(currentUser.role === 'seller' ? 'buyer' : 'seller');
                          setIsMenuOpen(false);
                        }}>
                          Switch to {currentUser.role === 'seller' ? 'Buyer' : 'Seller'}
                        </button>
                        {currentUser.role === 'seller' && (
                          <>
                            <button className="dropdown-item" onClick={() => { setIsDashboardOpen(true); setIsMenuOpen(false); }}>
                              Dashboard
                            </button>
                            <button className="dropdown-item" onClick={() => { setIsAddProductOpen(true); setIsMenuOpen(false); }}>
                              + Add Product
                            </button>
                          </>
                        )}
                        {currentUser.role === 'buyer' && (
                          <button className="dropdown-item" onClick={() => { setIsBuyerHistoryOpen(true); setIsMenuOpen(false); }}>
                            Order History
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
                      <button className="profile-icon" onClick={() => setIsProfileOpen(!isProfileOpen)}>
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
                              <button className="profile-menu-btn" onClick={() => { setIsDashboardOpen(true); setIsProfileOpen(false); }}>
                                <span aria-hidden="true">▦</span> Dashboard
                              </button>
                              <button className="profile-menu-btn" onClick={() => setIsAddProductOpen(true)}>
                                <span aria-hidden="true">＋</span> Add product
                              </button>
                            </>
                          )}
                          {currentUser.role === 'buyer' && (
                            <button className="profile-menu-btn" onClick={() => { setIsBuyerHistoryOpen(true); setIsProfileOpen(false); }}>
                              <span aria-hidden="true">◷</span> Order history
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

      {flash && !sellerDashboardMode && (
        <div className={`flash-message ${flash.type || 'info'}`} role="status">
          <div className="flash-content">
            <span>{flash.message}</span>
            <button className="flash-close" onClick={() => setFlash(null)}>×</button>
          </div>
        </div>
      )}

      {confirmDialog && !sellerDashboardMode && (
        <ConfirmModal dialog={confirmDialog} onClose={() => setConfirmDialog(null)} />
      )}

      <InvoiceModal invoice={activeInvoice} onClose={() => setActiveInvoice(null)} />

      {!sellerDashboardMode && <Messenger
        isOpen={messagePanelOpen}
        onClose={() => setMessagePanelOpen(false)}
        product={contactProduct}
        currentUser={currentUser}
        recipient={chatRecipient}
        title={currentUser?.role === 'seller' ? 'Chat with Buyer' : 'Chat with Seller'}
        bookingStatus={contactProduct && chatRecipient ? bookingMap[getBookingKey(contactProduct, chatRecipient)] : null}
        onConfirmBooking={confirmBookingInChat}
        autoOpenConversation={autoOpenConversation}
      />}

      {!sellerDashboardMode && <ProfileModal 
        isOpen={isProfileModalOpen} 
        onClose={() => setIsProfileModalOpen(false)} 
        currentUser={currentUser} 
        onRoleToggle={handleRoleToggle}
        onOpenDashboard={() => setIsDashboardOpen(true)}
        onOpenOrderHistory={() => setIsBuyerHistoryOpen(true)}
        onLogout={handleLogout}
      />}

      {!sellerDashboardMode && <CartPanel
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartItems={cartItems}
        onRemove={handleRemoveFromCart}
        onQuantityChange={handleUpdateCartQuantity}
        onCheckout={handleCheckout}
        total={cartTotal}
      />}
      {!sellerDashboardMode && <WishlistPanel
        isOpen={isWishlistOpen}
        onClose={() => setIsWishlistOpen(false)}
        items={wishlistItems}
        onRemove={handleToggleWishlist}
        onAddToCart={handleAddToCart}
        onOrder={handlePlaceOrder}
      />}

      {!selectedProduct && !sellerDashboardMode && (
        <HeroSlider
          products={allProducts}
          onSelectProduct={handleSelectProduct}
          selectedCategory={selectedCategory}
          search={search}
          wishlist={wishlist}
        />
      )}

      {isDashboardOpen && currentUser?.role === 'seller' && (
        <SellerDashboard
          sellerUsername={currentUser.username}
          products={sellerProducts}
          orders={sellerOrders}
          onDeleteProduct={handleDeleteProduct}
          onUpdateProduct={handleUpdateProduct}
          onContactBuyer={handleContactBuyer}
          onOpenInvoice={handleOpenInvoice}
          onClose={() => setIsDashboardOpen(false)}
        />
      )}

      {isBuyerHistoryOpen && !sellerDashboardMode && currentUser?.role === 'buyer' && (
        <BuyerOrderHistory orders={buyerOrders} onClose={() => setIsBuyerHistoryOpen(false)} onOpenInvoice={handleOpenInvoice} />
      )}

      {!selectedProduct && !sellerDashboardMode && (
        <>
          <section className="fraud-disclaimer scroll-reveal">
            <div className="fraud-disclaimer-content">
              <span className="fraud-disclaimer-icon">🛡️</span>
              <div className="fraud-disclaimer-text">
                <strong>Shop safely:</strong> Review seller feedback before purchasing. Use secure payment methods and verify product details. Report suspicious sellers to keep our marketplace trusted.
              </div>
            </div>
          </section>
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
                <details className="category-group" key={group.title} open={!isMobileLayout}>
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
        </>
      )}

      {!sellerDashboardMode && <section id="products" className="products-section scroll-reveal">
        <h2 className="section-title">Our Products</h2>
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
          <ProductPage
            products={sortedProducts}
            onAddToCart={(p) => handleAddToCart(p)}
            onContactSeller={(p) => handleContactSeller(p)}
            onViewProduct={(id) => handleSelectProduct(id)}
            onToggleWishlist={handleToggleWishlist}
            wishlist={wishlist}
            currentUser={currentUser}
          />
        )}
      </section>}

      {!sellerDashboardMode && <section className="about-section scroll-reveal">
        <h2>About Kukuta Hen Farm</h2>
        <p>
          We are a family-owned hen farm dedicated to providing the highest quality, organically-raised eggs and farm products. Our hens are raised with care in a stress-free environment, ensuring the best taste and nutrition.
        </p>
      </section>}

      {!sellerDashboardMode && <footer className="farm-footer">
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
