"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, MessageCircle, Package } from "lucide-react";
import { useIsMobile } from "@/hooks/useIsMobile";

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loadNotifications = async () => {
    try {
      const authRes = await fetch("/api/auth/session", { cache: "no-store" });
      const authData = await authRes.json();
      if (!authData?.user) return;

      const res = await fetch("/api/notifications");
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread_count || 0);
    } catch (err) {
      console.error("Load notifications error:", err);
    }
  };

  const markAsRead = async (id) => {
    await fetch(`/api/notifications?id=${id}`, {
      method: "PUT"
    });
    loadNotifications();
  };

  const getIcon = (type) => {
    switch (type) {
      case "message": return <MessageCircle size={16} />;
      case "request": return <Package size={16} />;
      default: return <Bell size={16} />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative p-2 text-white/40 hover:text-emerald-400 transition-colors"
      >
        <Bell size={24} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {showDropdown && (
        <div className={`absolute ${isMobile ? "right-0 left-0 mx-auto" : "right-0"} mt-2 w-[90vw] max-w-sm bg-[#0e0e18] rounded-xl shadow-lg border border-white/[0.06] z-50`}>
          <div className="p-4 border-b border-white/[0.06]">
            <h3 className="font-semibold text-white/80">Notifications</h3>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="p-4 text-center text-white/40">Aucune notification</p>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => {
                    if (!notif.is_read) markAsRead(notif.id);
                    if (notif.link) window.location.href = notif.link;
                  }}
                  className={`p-4 border-b border-white/[0.06] cursor-pointer hover:bg-white/[0.03] ${
                    !notif.is_read ? "bg-emerald-500/10" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="text-white/30 mt-1">
                      {getIcon(notif.type)}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{notif.title}</p>
                      {notif.message && (
                        <p className="text-sm text-white/40 mt-1">{notif.message}</p>
                      )}
                    </div>
                    {!notif.is_read && (
                      <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
