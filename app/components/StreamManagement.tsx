'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  Ban,
  ShieldCheck,
  ShieldOff,
  RefreshCw,
  CheckCircle,
  XCircle,
  Unlock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'react-toastify';
import { BanModal } from './BanModal';

interface Viewer {
  id: string;
  username: string | null;
  displayName: string | null;
  image: string | null;
  isModerator: boolean;
  email?: string | null;
}

interface RestrictedUser {
  id: string;
  username: string | null;
  displayName: string | null;
  image: string | null;
  isBanned: boolean;
  bannedUntil: string | null;
  bannedAt: string | null;
  reason: string | null;
}

interface StreamManagementProps {
  creatorId: string;
  userRole?: string;
  currentUserId?: string;
}

export function StreamManagement({
  creatorId,
  userRole = 'MEMBER',
  currentUserId,
}: StreamManagementProps) {
  const [viewers, setViewers] = useState<Viewer[]>([]);
  const [restrictedUsers, setRestrictedUsers] = useState<RestrictedUser[]>([]);
  const [activeTab, setActiveTab] = useState<'viewers' | 'restricted'>('viewers');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<Viewer | null>(null);
  const [isBanModalOpen, setIsBanModalOpen] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<
    { id: string; viewer: { id: string; username: string | null; email?: string | null } }[]
  >([]);

  const fetchViewers = async () => {
    try {
      const res = await fetch(`/api/streams/viewers?creatorId=${creatorId}`);
      if (res.ok) {
        const data = await res.json();
        setViewers(data.viewers);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch viewers:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRestrictedUsers = async () => {
    try {
      const res = await fetch(`/api/streams/restricted?creatorId=${creatorId}`);
      if (res.ok) {
        const data = await res.json();
        setRestrictedUsers(data.restricted);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch restricted users:', err);
    }
  };

  useEffect(() => {
    fetchViewers();
    fetchRestrictedUsers();

    const fetchAccess = async () => {
      try {
        const res = await fetch(`/api/streams/access?creatorId=${creatorId}`);
        if (res.ok) {
          const data = await res.json();
          setPendingRequests(data.requests || []);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to fetch access requests:', err);
      }
    };
    fetchAccess();

    const interval = setInterval(() => {
      fetchViewers();
      fetchRestrictedUsers();
      fetchAccess();
    }, 2000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creatorId]);

  const handleToggleMod = async (viewer: Viewer) => {
    setTogglingId(viewer.id);
    const action = viewer.isModerator ? 'demote' : 'promote';
    try {
      const res = await fetch('/api/streams/moderator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: viewer.id, creatorId, action }),
      });
      if (res.ok) {
        toast.success(
          action === 'promote'
            ? `@${viewer.username} is now a moderator`
            : `@${viewer.username} is no longer a moderator`,
        );
        // Optimistic update
        setViewers((prev) =>
          prev.map((v) => (v.id === viewer.id ? { ...v, isModerator: !v.isModerator } : v)),
        );
      } else {
        const data = await res.json();
        toast.error(data.message || 'Action failed');
      }
    } catch {
      toast.error('Error communicating with server');
    } finally {
      setTogglingId(null);
    }
  };

  const handleBanConfirm = async (type: 'ban' | 'timeout', duration: string, reason: string) => {
    if (!selectedUser) return;
    try {
      const res = await fetch('/api/streams/ban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId: selectedUser.id,
          creatorId,
          type,
          duration,
          reason,
        }),
      });
      if (res.ok) {
        toast.success(`@${selectedUser.username} ${type === 'ban' ? 'banned' : 'timed out'}`);
        setIsBanModalOpen(false);
        fetchViewers();
        fetchRestrictedUsers();
      } else {
        toast.error('Action failed');
      }
    } catch {
      toast.error('Error communicating with server');
    }
  };

  const handleLiftRestriction = async (targetUserId: string, username: string) => {
    setTogglingId(targetUserId);
    try {
      const res = await fetch('/api/streams/ban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId,
          creatorId,
          type: 'unban',
        }),
      });
      if (res.ok) {
        toast.success(`Restriction lifted for @${username}`);
        fetchRestrictedUsers();
        fetchViewers();
      } else {
        toast.error('Failed to lift restriction');
      }
    } catch {
      toast.error('Error communicating with server');
    } finally {
      setTogglingId(null);
    }
  };

  const handleApprove = async (viewerId: string, approve: boolean) => {
    try {
      const res = await fetch('/api/streams/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          streamerId: creatorId,
          viewerId,
          action: approve ? 'approve' : 'reject',
        }),
      });
      if (res.ok) {
        toast.success(`Request ${approve ? 'approved' : 'rejected'}`);
        setPendingRequests((prev) => prev.filter((req) => req.viewer.id !== viewerId));
        fetchViewers();
      } else {
        toast.error('Failed to process request');
      }
    } catch (err) {
      toast.error('Error communicating with server');
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20">
            <Users className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="text-xl font-black tracking-tighter uppercase italic">
              Stream Management
            </h3>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
              Moderation and Access Control
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            fetchViewers();
            fetchRestrictedUsers();
          }}
          className="rounded-full hover:bg-white/5"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Hub Tabs */}
      <div className="flex gap-2 p-1 bg-white/[0.03] border border-white/5 rounded-2xl">
        <button
          onClick={() => setActiveTab('viewers')}
          className={`flex-1 py-2 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
            activeTab === 'viewers'
              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
              : 'text-gray-500 hover:text-white'
          }`}
        >
          Live Viewers ({viewers.length})
        </button>
        <button
          onClick={() => setActiveTab('restricted')}
          className={`flex-1 py-2 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
            activeTab === 'restricted'
              ? 'bg-red-500/10 text-red-500 border border-red-500/20'
              : 'text-gray-500 hover:text-white'
          }`}
        >
          Restricted ({restrictedUsers.length})
        </button>
      </div>

      {/* Viewer Search Bar */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Users className="h-4 w-4 text-gray-500" />
        </div>
        <input
          type="text"
          placeholder={`Search ${activeTab === 'viewers' ? 'viewers' : 'restricted users'}...`}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-white/[0.03] border border-white/5 rounded-xl py-2 pl-10 pr-4 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-bold"
        />
      </div>

      {/* Pending Requests Section */}
      {pendingRequests.length > 0 && activeTab === 'viewers' && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 animate-in fade-in">
          <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-3 flex items-center gap-2">
            Pending Requests ({pendingRequests.length})
          </h4>
          <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar pr-2">
            {pendingRequests.map((req) => (
              <div
                key={req.id}
                className="flex justify-between items-center gap-3 bg-white/5 px-3 py-2 rounded-xl"
              >
                <p className="text-xs font-bold text-white truncate max-w-[150px]">
                  @{req.viewer.username || req.viewer.email}
                </p>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleApprove(req.viewer.id, true)}
                    className="p-1.5 hover:bg-green-500/20 text-green-500 rounded-lg transition-colors"
                    title="Approve"
                  >
                    <CheckCircle className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleApprove(req.viewer.id, false)}
                    className="p-1.5 hover:bg-red-500/20 text-red-500 rounded-lg transition-colors"
                    title="Reject"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Content Table */}
      <div className="bg-white/[0.02] border border-white/5 rounded-[2rem] overflow-hidden flex-1">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-gray-500 bg-white/[0.03]">
                <th className="px-6 py-4 font-black">User</th>
                <th className="px-6 py-4 font-black text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {activeTab === 'viewers' ? (
                viewers.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-6 py-12 text-center text-gray-500 text-sm italic">
                      No active viewers found.
                    </td>
                  </tr>
                ) : (
                  viewers
                    .filter(
                      (v) =>
                        v.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        v.displayName?.toLowerCase().includes(searchTerm.toLowerCase()),
                    )
                    .map((viewer) => (
                      <tr key={viewer.id} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={
                                viewer.image ||
                                `https://api.dicebear.com/7.x/avataaars/svg?seed=${viewer.username}`
                              }
                              className="w-9 h-9 rounded-xl object-cover border border-white/10"
                              alt=""
                            />
                            <div className="flex flex-col min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white text-sm truncate">
                                  @{viewer.username || 'Anonymous'}
                                </span>
                                {viewer.isModerator && (
                                  <span className="flex-shrink-0 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest bg-primary/20 text-primary border border-primary/30">
                                    MOD
                                  </span>
                                )}
                              </div>
                              {viewer.displayName && (
                                <span className="text-[10px] text-gray-500 truncate">
                                  {viewer.displayName}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            {/* Mod Toggle - Only for Creator/Owner/Moderator depends on logic */}
                            {(userRole === 'CREATOR' || userRole === 'OWNER') && (
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={togglingId === viewer.id}
                                onClick={() => handleToggleMod(viewer)}
                                className={`h-8 px-3 gap-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                                  viewer.isModerator
                                    ? 'bg-primary/10 text-primary border-primary/20 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20'
                                    : 'bg-white/5 text-gray-400 border-white/10 hover:bg-primary/10 hover:text-primary hover:border-primary/30'
                                }`}
                                title={viewer.isModerator ? 'Remove Moderator' : 'Make Moderator'}
                              >
                                {viewer.isModerator ? (
                                  <ShieldOff className="w-3.5 h-3.5" />
                                ) : (
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                )}
                                {viewer.isModerator ? 'Unmod' : 'Mod'}
                              </Button>
                            )}

                            {/* Ban button */}
                            {viewer.id !== currentUserId && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedUser(viewer);
                                  setIsBanModalOpen(true);
                                }}
                                className="h-8 px-3 gap-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-white/5 text-gray-400 border border-white/10 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-all"
                                title="Ban / Timeout"
                              >
                                <Ban className="w-3.5 h-3.5" />
                                Restrict
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                )
              ) : restrictedUsers.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-6 py-12 text-center text-gray-500 text-sm italic">
                    No restricted users found.
                  </td>
                </tr>
              ) : (
                restrictedUsers
                  .filter(
                    (u) =>
                      u.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()),
                  )
                  .map((user) => (
                    <tr key={user.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={
                              user.image ||
                              `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`
                            }
                            className="w-9 h-9 rounded-xl object-cover border border-white/10"
                            alt=""
                          />
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white text-sm truncate">
                                @{user.username || 'Anonymous'}
                              </span>
                              <span
                                className={`flex-shrink-0 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest border ${
                                  !user.bannedUntil
                                    ? 'bg-red-500/20 text-red-500 border-red-500/30'
                                    : 'bg-amber-500/20 text-amber-500 border-amber-500/30'
                                }`}
                              >
                                {!user.bannedUntil
                                  ? 'BANNED'
                                  : (() => {
                                      const start = new Date(user.bannedAt || 0).getTime();
                                      const end = new Date(user.bannedUntil).getTime();
                                      const diff = end - start;
                                      const mins = Math.round(diff / 60000);
                                      if (mins < 60) return `${mins}M TIMEOUT`;
                                      const hours = Math.round(mins / 60);
                                      if (hours < 24) return `${hours}H TIMEOUT`;
                                      const days = Math.round(hours / 24);
                                      return `${days}D TIMEOUT`;
                                    })()}
                              </span>
                            </div>
                            {user.bannedUntil && (
                              <span className="text-[9px] text-gray-500 font-bold uppercase tracking-tighter">
                                Expires: {new Date(user.bannedUntil).toLocaleString()}
                              </span>
                            )}
                            {user.reason && (
                              <span className="text-[10px] text-gray-400 italic truncate max-w-[200px]">
                                &quot;{user.reason}&quot;
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={togglingId === user.id}
                            onClick={() => handleLiftRestriction(user.id, user.username || 'User')}
                            className="h-8 px-3 gap-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-white/5 text-gray-400 border border-white/10 hover:bg-green-500/10 hover:text-green-400 hover:border-green-500/20 transition-all"
                            title="Lift Restriction"
                          >
                            <Unlock className="w-3.5 h-3.5" />
                            Lift
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedUser && (
        <BanModal
          isOpen={isBanModalOpen}
          targetUsername={selectedUser.username || 'User'}
          scope="stream"
          onClose={() => setIsBanModalOpen(false)}
          onConfirm={handleBanConfirm}
        />
      )}
    </div>
  );
}
