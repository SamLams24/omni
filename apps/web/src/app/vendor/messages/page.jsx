"use client";

import { useState, useEffect } from "react";
import { Loader2, MessageCircle, Inbox } from "lucide-react";
import useUser from "@/utils/useUser";
import ChatModal from "@/components/ChatModal";

export default function VendorMessagesPage() {
  const { data: user, loading: userLoading } = useUser();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedConv, setSelectedConv] = useState(null);

  useEffect(() => {
    if (user && !userLoading) {
      loadConversations();
    }
  }, [user, userLoading]);

  const loadConversations = async () => {
    try {
      const response = await fetch("/api/vendors/conversations");
      if (!response.ok) throw new Error("Failed to load conversations");

      const data = await response.json();
      setConversations(data.conversations || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (userLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-emerald-400" size={32} />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-space-grotesk text-2xl md:text-3xl font-bold text-white">Messages</h1>
        <p className="font-dm-sans text-sm text-zinc-400 mt-1">
          {conversations.length} conversation
          {conversations.length > 1 ? "s" : ""}
        </p>
      </div>

      <div className="max-w-4xl">
        {conversations.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-12 text-center">
            <Inbox size={40} className="mx-auto mb-4 text-zinc-600" />
            <p className="font-dm-sans text-sm text-zinc-500">Aucun message pour le moment</p>
          </div>
        ) : (
          <div className="space-y-3">
            {conversations.map((conv) => (
              <div
                key={conv.request_id || `vendor-${conv.vendor_id}`}
                onClick={() => setSelectedConv(conv)}
                className="rounded-2xl border border-white/10 bg-zinc-900/60 p-6 transition-all hover:bg-zinc-900/80 cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <MessageCircle size={16} className="text-emerald-400 shrink-0" />
                      <h3 className="font-dm-sans font-bold text-zinc-200 truncate">
                        {conv.product_name || "Conversation générale"}
                      </h3>
                    </div>
                    <p className="font-dm-sans text-sm text-zinc-400 truncate ml-[28px]">
                      {conv.last_message_preview}
                    </p>
                    {conv.last_message_time && (
                      <p className="font-dm-sans text-xs text-zinc-500 mt-1 ml-[28px]">
                        {new Date(conv.last_message_time).toLocaleString("fr-FR")}
                      </p>
                    )}
                  </div>
                  {conv.unread_count > 0 && (
                    <span className="shrink-0 bg-emerald-500 text-black text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full">
                      {conv.unread_count}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedConv && (
        <ChatModal
          requestId={selectedConv.request_id}
          vendorId={selectedConv.vendor_id}
          peerId={selectedConv.peer_id}
          vendorName={selectedConv.peer_name || "Client"}
          onClose={() => {
            setSelectedConv(null);
            loadConversations();
          }}
        />
      )}
    </div>
  );
}
