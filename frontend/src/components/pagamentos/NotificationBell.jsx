import React, { useState, useRef, useEffect } from 'react';
import { useNotifications } from '../../contexts/NotificationContext';
import './NotificationBell.css';

export default function NotificationBell({ collapsed = false }) {
  const { unreadCount, notifications, loading, fetchNotifications, markAsRead, markAllAsRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  const handleToggle = () => {
    if (!open) fetchNotifications();
    setOpen(!open);
  };

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const formatTime = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now - d;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'agora';
    if (diffMin < 60) return `${diffMin}min`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d`;
  };

  return (
    <div className="notification-bell-container" ref={dropdownRef}>
      <button
        className={`notification-bell-button ${collapsed ? 'nav-icon-only' : ''}`}
        onClick={handleToggle}
        title="Notificacoes"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
        </svg>
        {unreadCount > 0 && (
          <span className="notification-bell-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="notification-dropdown">
          <div className="notification-dropdown-header">
            <span className="notification-dropdown-title">Notificacoes</span>
            {unreadCount > 0 && (
              <button className="notification-mark-all" onClick={markAllAsRead}>
                Marcar todas como lidas
              </button>
            )}
          </div>
          <div className="notification-dropdown-body">
            {loading && <div className="notification-loading">Carregando...</div>}
            {!loading && notifications.length === 0 && (
              <div className="notification-empty">Nenhuma notificacao</div>
            )}
            {!loading && notifications.map(n => (
              <div
                key={n.id}
                className={`notification-item ${!n.read ? 'notification-unread' : ''}`}
                onClick={() => {
                  if (!n.read) markAsRead(n.id);
                  if (n.link_url) window.location.href = n.link_url;
                }}
              >
                <div className="notification-item-header">
                  <span className="notification-item-title">{n.title}</span>
                  <span className="notification-item-time">{formatTime(n.created_at)}</span>
                </div>
                {n.message && <div className="notification-item-message">{n.message}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
