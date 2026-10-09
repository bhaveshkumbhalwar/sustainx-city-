import { useState } from 'react';
import { useFetch } from '../../hooks/useFetch';
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import PageHeader from '../../components/ui/PageHeader';
import SectionCard from '../../components/ui/SectionCard';
import Icon from '../../components/ui/Icon';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import { timeAgo } from '../../lib/format';

export default function NotificationsPage() {
  const { showToast } = useToast();
  const [items, setItems] = useState(null);
  const { data, loading, error } = useFetch(async () => {
    const res = await getNotifications();
    const list = res.data || [];
    setItems(list);
    return list;
  });

  const notifications = items ?? data ?? [];
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const markRead = async (n) => {
    if (n.isRead) return;
    try {
      await markNotificationRead(n._id);
      setItems((prev) => (prev || []).map((x) => (x._id === n._id ? { ...x, isRead: true } : x)));
    } catch {
      showToast('Could not mark notification.', 'error');
    }
  };

  const markAll = async () => {
    if (unreadCount === 0) return;
    try {
      await markAllNotificationsRead();
      setItems((prev) => (prev || []).map((n) => ({ ...n, isRead: true })));
      showToast('All notifications marked as read.', 'success');
    } catch {
      showToast('Could not update notifications.', 'error');
    }
  };

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle="Stay updated with alerts, report status and system messages."
        icon="bell"
        actions={
          <button type="button" className="btn btn-ghost btn-sm" onClick={markAll} disabled={unreadCount === 0}>
            Mark all read
          </button>
        }
      />

      <SectionCard>
        {loading ? (
          <div className="notif-list">
            {[1, 2, 3].map((i) => <div key={i} className="skeleton skeleton-rect" style={{ height: 60 }} />)}
          </div>
        ) : error ? (
          <p>Could not load notifications: {error?.message}</p>
        ) : notifications.length === 0 ? (
          <EmptyState icon="bell" title="No notifications" description="You're all caught up." />
        ) : (
          <div className="notif-list">
            {notifications.map((n) => (
              <button
                key={n._id}
                type="button"
                className={`notif-item ${n.isRead ? '' : 'unread'}`}
                onClick={() => markRead(n)}
              >
                <div className="notif-item-icon">
                  <Icon name={n.type === 'iot' ? 'alert-triangle' : 'bell'} size={18} />
                </div>
                <div className="notif-item-body">
                  <div className="notif-item-message">{n.message}</div>
                  <div className="notif-item-meta">
                    <Badge tone={n.type === 'iot' ? 'warning' : 'info'}>{n.type || 'system'}</Badge>
                    <span>{timeAgo(n.createdAt)}</span>
                  </div>
                </div>
                {!n.isRead && <span className="notif-unread-dot" />}
              </button>
            ))}
          </div>
        )}
      </SectionCard>
    </>
  );
}