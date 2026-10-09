import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { changePassword, updateUser } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { roleMeta } from '../../config/roles';
import { wardLabel } from '../../lib/geography';
import PageHeader from '../../components/ui/PageHeader';
import SectionCard from '../../components/ui/SectionCard';
import Avatar from '../../components/ui/Avatar';
import Badge from '../../components/ui/Badge';
import Icon from '../../components/ui/Icon';

export default function CollectorProfile() {
  const { user, refreshUser, logout } = useAuth();
  const { showToast } = useToast();
  const [profile, setProfile] = useState({ name: user?.name || '' });
  const [pw, setPw] = useState({ oldPassword: '', newPassword: '', confirm: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  const saveProfile = async (e) => {
    e.preventDefault();
    if (!profile.name.trim()) { showToast('Name cannot be empty.', 'warning'); return; }
    setSavingProfile(true);
    try { await updateUser(user._id, { name: profile.name.trim() }); await refreshUser(); showToast('Profile updated.', 'success'); }
    catch (err) { showToast(err?.message || 'Could not update profile.', 'error'); }
    finally { setSavingProfile(false); }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    if (!pw.oldPassword || !pw.newPassword) { showToast('Please fill all password fields.', 'warning'); return; }
    if (pw.newPassword.length < 6) { showToast('New password must be at least 6 characters.', 'warning'); return; }
    if (pw.newPassword !== pw.confirm) { showToast('Passwords do not match.', 'warning'); return; }
    setSavingPw(true);
    try { await changePassword(user._id, { oldPassword: pw.oldPassword, newPassword: pw.newPassword }); showToast('Password changed.', 'success'); setPw({ oldPassword: '', newPassword: '', confirm: '' }); }
    catch (err) { showToast(err?.message || 'Could not change password.', 'error'); }
    finally { setSavingPw(false); }
  };

  const meta = roleMeta(user?.role);
  return (
    <>
      <PageHeader title="Profile" subtitle="Your account and preferences." icon="user" />
      <div className="u-grid u-grid-2">
        <SectionCard title="Account">
          <div className="profile-head">
            <Avatar name={user?.name} size={72} />
            <div>
              <h3 className="profile-name">{user?.name}</h3>
              <p className="profile-email">{user?.email}</p>
              <Badge tone="warning">{meta.label}</Badge>
            </div>
          </div>
          <dl className="profile-dl">
            <div className="detail-row"><span className="detail-label">Ward</span><span className="detail-value">{wardLabel(user?.block)}</span></div>
            <div className="detail-row"><span className="detail-label">Department</span><span className="detail-value">{user?.dept || '—'}</span></div>
            <div className="detail-row"><span className="detail-label">Reward points</span><span className="detail-value">{user?.rewardPoints ?? 0} pts</span></div>
          </dl>
        </SectionCard>
        <div className="u-grid">
          <SectionCard title="Edit profile">
            <form onSubmit={saveProfile}>
              <div className="form-group"><label className="form-label">Full name</label><input className="form-input" type="text" value={profile.name} onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))} placeholder="Your full name" /></div>
              <button type="submit" className="btn btn-primary" disabled={savingProfile}>{savingProfile ? 'Saving…' : 'Save changes'}</button>
            </form>
          </SectionCard>
          <SectionCard title="Change password">
            <form onSubmit={savePassword}>
              <div className="form-group"><label className="form-label">Current password</label><input className="form-input" type="password" value={pw.oldPassword} onChange={(e) => setPw((p) => ({ ...p, oldPassword: e.target.value }))} placeholder="Current password" /></div>
              <div className="form-group"><label className="form-label">New password</label><input className="form-input" type="password" value={pw.newPassword} onChange={(e) => setPw((p) => ({ ...p, newPassword: e.target.value }))} placeholder="Min 6 characters" /></div>
              <div className="form-group"><label className="form-label">Confirm new password</label><input className="form-input" type="password" value={pw.confirm} onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))} placeholder="Repeat new password" /></div>
              <button type="submit" className="btn btn-primary" disabled={savingPw}>{savingPw ? 'Updating…' : 'Update password'}</button>
            </form>
          </SectionCard>
        </div>
      </div>
      <div className="u-mt-1">
        <button type="button" className="btn btn-ghost btn-sm" onClick={logout}><Icon name="logout" size={16} /> Sign out</button>
      </div>
    </>
  );
}