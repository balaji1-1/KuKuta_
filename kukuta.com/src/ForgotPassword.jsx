import React, { useState } from 'react';
import apiFetch from './api';

function ForgotPasswordPage({ onClose, onSwitchToLogin, onNavigateToResetConfirm }) {
  const [identifier, setIdentifier] = useState('');
  const [showResetFields, setShowResetFields] = useState(false);
  const [uid, setUid] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [otpError, setOtpError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [message, setMessage] = useState('');

  const handleIdentifierSubmit = async (e) => {
    e.preventDefault();
    setEmailError('');
    setMessage('');
    if (!identifier.trim()) {
      setEmailError('Email or phone number is required.');
      return;
    }
    try {
      const response = await apiFetch('/password-reset/', {
        method: 'POST',
        auth: false,
        body: { identifier },
      });
      const data = await response.json();
      setMessage(data.message || 'If that account exists, password reset instructions have been sent.');
      if (response.ok && data.uid && data.token) {
        setUid(data.uid);
        setToken(data.token);
        if (onNavigateToResetConfirm) {
          onNavigateToResetConfirm(data.uid, data.token, data.expires_at);
          return;
        }
        setShowResetFields(true);
      }
    } catch (error) {
      setMessage('Failed to send reset email. Please try again.');
    }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setConfirmPasswordError('');
    setOtpError('');
    setMessage('');
    let hasError = false;
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
        body: { identifier, otp: otp.trim(), new_password: newPassword },
      });
      const data = await response.json();
      if (response.ok) {
        setMessage('Password reset successful. Please login with your new password.');
        setShowResetFields(false);
        setIdentifier('');
        setOtp('');
        setNewPassword('');
        setConfirmPassword('');
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
          <h2>Forgot Password</h2>
          <p>Enter your email and reset your password directly on this page.</p>
        </div>
        <form onSubmit={showResetFields ? handleResetSubmit : handleIdentifierSubmit} className="auth-form">
          {!showResetFields && (
            <>
              <div className="form-group">
                <label htmlFor="forgot-identifier">Email or Phone Number</label>
                <input
                  id="forgot-identifier"
                  type="text"
                  className={emailError ? 'input-error' : ''}
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    if (emailError) setEmailError('');
                  }}
                  placeholder="your@email.com or 08012345678"
                  required
                />
                {emailError && <div className="field-error">{emailError}</div>}
              </div>
              <button type="submit" className="auth-btn">Verify Account</button>
            </>
          )}
          {showResetFields && (
            <>
              <p className="info-text">Your identifier was verified. Enter a new password below.</p>
              <div className="form-group">
                <label htmlFor="forgot-identifier-confirm">Email or Phone Number</label>
                <input
                  id="forgot-identifier-confirm"
                  type="text"
                  className={emailError ? 'input-error' : ''}
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    if (emailError) setEmailError('');
                  }}
                  placeholder="your@email.com or 08012345678"
                  required
                />
                {emailError && <div className="field-error">{emailError}</div>}
              </div>
              <div className="form-group">
                <label htmlFor="forgot-otp">OTP</label>
                <input
                  id="forgot-otp"
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
                <label htmlFor="new-password">New Password</label>
                <input
                  id="new-password"
                  type={showPasswords ? 'text' : 'password'}
                  className={passwordError ? 'input-error' : ''}
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    if (passwordError) setPasswordError('');
                  }}
                  placeholder="New password"
                  required
                />
                {passwordError && <div className="field-error">{passwordError}</div>}
              </div>
              <div className="form-group">
                <label htmlFor="confirm-new-password">Confirm New Password</label>
                <input
                  id="confirm-new-password"
                  type={showPasswords ? 'text' : 'password'}
                  className={confirmPasswordError ? 'input-error' : ''}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (confirmPasswordError) setConfirmPasswordError('');
                  }}
                  placeholder="Confirm password"
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
              <button type="submit" className="auth-btn">Reset Password</button>
            </>
          )}
          {message && <div className="form-message">{message}</div>}
          <p className="auth-switch">
            Remembered it? <button type="button" onClick={onSwitchToLogin}>Login</button>
          </p>
          <p className="auth-switch">
            <button type="button" onClick={onClose}>Back to home</button>
          </p>
        </form>
      </div>
    </main>
  );
}

export default ForgotPasswordPage;