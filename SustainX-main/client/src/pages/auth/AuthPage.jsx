import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import Modal from '../../components/ui/Modal';
import Icon from '../../components/ui/Icon';
import { forgotPasswordApi } from '../../services/api';

// Backend roles preserved verbatim: student / collector / admin
// UI order: Citizen / Collector / Admin (collector in the middle)
const ROLE_TABS = [
  {
    key: 'student',
    label: 'Citizen',
    icon: 'user',
    info: 'Report waste, track pickup requests, earn reward points',
  },
  {
    key: 'collector',
    label: 'Collector',
    icon: 'truck',
    info: 'Manage collection routes, update tasks & bin status',
  },
  {
    key: 'admin',
    label: 'Admin',
    icon: 'shield',
    info: 'Oversee city operations, manage bins, vehicles & complaints',
  },
];

function LeafMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
    </svg>
  );
}

export default function AuthPage() {
  const { login, register } = useAuth();
  const { showToast } = useToast();

  const [selectedRole, setSelectedRole] = useState('student');
  const [activeTab, setActiveTab] = useState('login');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const [suName, setSuName] = useState('');
  const [suEmail, setSuEmail] = useState('');
  const [suPass, setSuPass] = useState('');
  const [suConfirm, setSuConfirm] = useState('');
  const [showSuPass, setShowSuPass] = useState(false);

  const [isForgotOpen, setIsForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [forgotError, setForgotError] = useState('');

  const roleTab = ROLE_TABS.find((r) => r.key === selectedRole);

  const handleRoleSelect = (role) => {
    setSelectedRole(role);
    setError('');
    if (role !== 'student') setActiveTab('login');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    if (!loginEmail.trim() || !loginPass) {
      setError('Please provide your email and password.');
      return;
    }
    setLoading(true);
    try {
      await login(loginEmail.trim().toLowerCase(), loginPass, selectedRole);
      try {
        localStorage.setItem('wms_remember', rememberMe ? '30d' : 'session');
      } catch { /* storage unavailable */ }
    } catch (err) {
      setError(err?.message || 'Sign in failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    if (!suName.trim() || !suEmail.trim() || !suPass || !suConfirm) {
      setError('Please fill in all required fields.');
      return;
    }
    if (!/^[^@]+@[^@]+\.[^@]+$/.test(suEmail.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    if (suPass.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (suPass !== suConfirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await register({ name: suName.trim(), email: suEmail.trim().toLowerCase(), password: suPass });
      showToast('Welcome! 100 points sign-up bonus credited.', 'success', 5000);
    } catch (err) {
      setError(err?.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');
    if (!forgotEmail.trim()) {
      setForgotError('Please provide your email.');
      return;
    }
    setForgotLoading(true);
    try {
      const res = await forgotPasswordApi({ email: forgotEmail.trim() });
      setForgotSuccess(res.data.message);
    } catch (err) {
      setForgotError(err?.message || 'Request failed. Please verify your details.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="sb-auth" id="auth-root">
      {/* ── Left brand panel ─────────────────────────────── */}
      <aside className="sb-left" aria-hidden="false">
        <span className="sb-orb sb-orb-a" aria-hidden="true" />
        <span className="sb-orb sb-orb-b" aria-hidden="true" />
        <span className="sb-orb sb-orb-c" aria-hidden="true" />

        <div className="sb-brand">
          <span className="sb-brand-icon">
            <LeafMark />
          </span>
          <span className="sb-brand-text">
            <strong>MUNICIPAL CORPORATION</strong>
            <small>WASTE MANAGEMENT DIVISION</small>
          </span>
        </div>

        <div className="sb-hero">
          <h1>
            Swachh Bharat
            <br />
            Digital Portal
          </h1>
          <p>
            An integrated platform for citizens to report waste, collectors to
            manage routes, and administrators to oversee operations.
          </p>
        </div>

        <div className="sb-foot">
          <p>Government of India · Ministry of Housing &amp; Urban Affairs</p>
          <p>© 2026 All rights reserved</p>
        </div>
      </aside>

      {/* ── Right form panel ─────────────────────────────── */}
      <main className="sb-right">
        <div className="sb-form">
          {activeTab === 'login' ? (
            <>
              <h2 className="sb-title">Sign In</h2>
              <p className="sb-sub">Select your role to continue</p>

              <div className="sb-roles" role="group" aria-label="Select your role">
                {ROLE_TABS.map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    className={`sb-role ${selectedRole === r.key ? 'active' : ''}`}
                    onClick={() => handleRoleSelect(r.key)}
                    aria-pressed={selectedRole === r.key}
                  >
                    <Icon name={r.icon} size={16} />
                    {r.label}
                  </button>
                ))}
              </div>

              {roleTab && (
                <div className="sb-info">
                  <span className="sb-info-icon">
                    <Icon name={roleTab.icon} size={16} />
                  </span>
                  <span>{roleTab.info}</span>
                </div>
              )}

              {error && <div className="sb-error" role="alert">{error}</div>}

              <form onSubmit={handleLogin} noValidate className="sb-fields">
                <div className="sb-group">
                  <label className="sb-label" htmlFor="loginEmail">Email Address</label>
                  <input
                    id="loginEmail"
                    className="sb-input"
                    type="email"
                    placeholder="yourname@example.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    autoComplete="email"
                  />
                </div>

                <div className="sb-group">
                  <div className="sb-label-row">
                    <label className="sb-label" htmlFor="loginPass">Password</label>
                    <button
                      type="button"
                      className="sb-link-btn"
                      onClick={() => { setIsForgotOpen(true); setForgotError(''); setForgotSuccess(''); }}
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="sb-pass-wrap">
                    <input
                      id="loginPass"
                      className="sb-input"
                      type={showPass ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={loginPass}
                      onChange={(e) => setLoginPass(e.target.value)}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className="sb-eye"
                      onClick={() => setShowPass((v) => !v)}
                      aria-label={showPass ? 'Hide password' : 'Show password'}
                    >
                      <Icon name="eye" size={18} />
                    </button>
                  </div>
                </div>

                <label className="sb-remember">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <span>Keep me signed in for 30 days</span>
                </label>

                <button type="submit" className="sb-submit" disabled={loading}>
                  {loading ? 'Signing in…' : `Sign in as ${roleTab?.label || 'Citizen'}`}
                </button>
              </form>

              {selectedRole === 'student' ? (
                <p className="sb-switch">
                  New to the portal?{' '}
                  <button type="button" onClick={() => { setActiveTab('signup'); setError(''); }}>
                    Register as a citizen
                  </button>
                </p>
              ) : (
                <p className="sb-note">
                  {selectedRole === 'collector'
                    ? 'Field collector accounts are provisioned by municipal administration.'
                    : 'Administrator accounts are provisioned by super admins.'}
                </p>
              )}
            </>
          ) : (
            <>
              <h2 className="sb-title">Create Account</h2>
              <p className="sb-sub">Register as a citizen to get started</p>

              <div className="sb-roles" role="group" aria-label="Select your role">
                {ROLE_TABS.map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    className={`sb-role ${selectedRole === r.key ? 'active' : ''}`}
                    onClick={() => handleRoleSelect(r.key)}
                    aria-pressed={selectedRole === r.key}
                    disabled={r.key !== 'student'}
                    title={r.key !== 'student' ? 'Only citizen self-registration is allowed' : undefined}
                    style={r.key !== 'student' ? { opacity: 0.55, cursor: 'not-allowed' } : undefined}
                  >
                    <Icon name={r.icon} size={16} />
                    {r.label}
                  </button>
                ))}
              </div>

              <div className="sb-info">
                <span className="sb-info-icon">
                  <Icon name="user" size={16} />
                </span>
                <span>Free citizen account · 100 reward points sign-up bonus</span>
              </div>

              {error && <div className="sb-error" role="alert">{error}</div>}

              <form onSubmit={handleSignup} noValidate className="sb-fields">
                <div className="sb-group">
                  <label className="sb-label" htmlFor="suName">Full Name</label>
                  <input
                    id="suName"
                    className="sb-input"
                    type="text"
                    placeholder="Your full name"
                    value={suName}
                    onChange={(e) => setSuName(e.target.value)}
                    autoComplete="name"
                  />
                </div>
                <div className="sb-group">
                  <label className="sb-label" htmlFor="suEmail">Email Address</label>
                  <input
                    id="suEmail"
                    className="sb-input"
                    type="email"
                    placeholder="yourname@example.com"
                    value={suEmail}
                    onChange={(e) => setSuEmail(e.target.value)}
                    autoComplete="email"
                  />
                </div>
                <div className="sb-group">
                  <label className="sb-label" htmlFor="suPass">Password</label>
                  <div className="sb-pass-wrap">
                    <input
                      id="suPass"
                      className="sb-input"
                      type={showSuPass ? 'text' : 'password'}
                      placeholder="Min. 6 characters"
                      value={suPass}
                      onChange={(e) => setSuPass(e.target.value)}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="sb-eye"
                      onClick={() => setShowSuPass((v) => !v)}
                      aria-label={showSuPass ? 'Hide password' : 'Show password'}
                    >
                      <Icon name="eye" size={18} />
                    </button>
                  </div>
                </div>
                <div className="sb-group">
                  <label className="sb-label" htmlFor="suConfirm">Confirm Password</label>
                  <input
                    id="suConfirm"
                    className="sb-input"
                    type="password"
                    placeholder="Repeat password"
                    value={suConfirm}
                    onChange={(e) => setSuConfirm(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>

                <button type="submit" className="sb-submit" disabled={loading}>
                  {loading ? 'Creating account…' : 'Register as Citizen'}
                </button>
              </form>

              <p className="sb-switch">
                Already registered?{' '}
                <button type="button" onClick={() => { setActiveTab('login'); setError(''); }}>
                  Sign in
                </button>
              </p>
            </>
          )}

          <div className="sb-trust">
            <span className="sb-trust-dot" aria-hidden="true" />
            <span>Secure &amp; Encrypted</span>
            <span className="sb-trust-sep">·</span>
            <span>Official Government Portal</span>
            <span className="sb-trust-sep">·</span>
            <span>Help</span>
          </div>
        </div>
      </main>

      <Modal id="forgot-modal" isOpen={isForgotOpen} onClose={() => setIsForgotOpen(false)} title="Reset Password">
        <div style={{ padding: '1.5rem' }}>
          {forgotSuccess ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📧</div>
              <h3 style={{ color: 'var(--clr-green)', marginBottom: '.5rem' }}>Request Sent</h3>
              <p className="text-muted" style={{ fontSize: '.9rem', lineHeight: '1.5' }}>{forgotSuccess}</p>
              <button className="btn btn-primary btn-full" style={{ marginTop: '1.5rem' }} onClick={() => setIsForgotOpen(false)}>Close</button>
            </div>
          ) : (
            <form onSubmit={handleForgotSubmit}>
              <p className="text-muted" style={{ fontSize: '.85rem', marginBottom: '1.2rem' }}>
                Enter your registered email address. Reset instructions will be sent.
              </p>
              {forgotError && <div className="auth-error" style={{ marginBottom: '1rem' }}>{forgotError}</div>}
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label" htmlFor="forgotEmail">Email address</label>
                <input id="forgotEmail" className="form-input" type="email" placeholder="you@example.com" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} />
              </div>
              <button type="submit" className="btn btn-primary btn-full" disabled={forgotLoading}>
                {forgotLoading ? 'Requesting…' : 'Send Reset Instructions'}
              </button>
            </form>
          )}
        </div>
      </Modal>
    </div>
  );
}
