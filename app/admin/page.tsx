'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { User, Stream } from '@prisma/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, ShieldAlert, Search, RefreshCw, Wrench, PlayCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'react-toastify';
import { UsersTable } from '../components/admin/UsersTable';
import { StreamsList } from '../components/admin/StreamsList';
import { BanModal } from '../components/BanModal';

interface MaintenanceData {
  isActive: boolean;
  startedAt?: string | Date;
  endsAt?: string | Date;
  message?: string;
}

type StreamWithUser = Stream & {
  user: {
    username: string | null;
    displayName: string | null;
  };
};

export default function AdminDashboard() {
  const { data: _, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [streams, setStreams] = useState<StreamWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Ban/Timeout Modal State
  const [isBanModalOpen, setIsBanModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Maintenance Mode State
  const [maintenanceActive, setMaintenanceActive] = useState(false);
  const [maintenanceData, setMaintenanceData] = useState<MaintenanceData | null>(null);
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('');
  const [maintenanceDuration, setMaintenanceDuration] = useState<number | null>(60);

  // Fetch maintenance status on mount
  useEffect(() => {
    fetch('/api/admin/maintenance')
      .then((r) => r.json())
      .then((data) => {
        setMaintenanceActive(data.isActive);
        setMaintenanceData(data);
      });
  }, []);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    } else if (status === 'authenticated') {
      // Further client-side check if needed, but API is guarded
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersRes, streamsRes] = await Promise.all([
        fetch(`/api/admin/users?search=${encodeURIComponent(search)}`),
        fetch('/api/admin/streams'),
      ]);

      if (usersRes.status === 403 || streamsRes.status === 403) {
        toast.error('Unauthorized access.');
        router.push('/dashboard');
        return;
      }

      const userData = await usersRes.json();
      const streamData = await streamsRes.json();

      setUsers(userData.users || []);
      setStreams(streamData.streams || []);
    } catch (error) {
      toast.error('Failed to fetch admin data.');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleUpdate = async (targetUserId: string, action: 'assign' | 'revoke') => {
    try {
      const res = await fetch('/api/admin/assign-creator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId, action }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        fetchData();
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error('Error updating role.');
    }
  };

  const handleBanAction = async (type: 'ban' | 'timeout', duration: string, reason: string) => {
    if (!selectedUser) return;
    try {
      const res = await fetch('/api/admin/ban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId: selectedUser.id,
          type,
          duration,
          reason,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        setIsBanModalOpen(false);
        fetchData();
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error('Error applying restriction.');
    }
  };

  const handleDeleteUser = async (user: User) => {
    try {
      const res = await fetch('/api/admin/delete-user', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: user.id }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        fetchData();
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error('Error deleting user.');
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white selection:bg-blue-500/30">
      <main className="max-w-7xl mx-auto px-6 pt-24 pb-12 space-y-12">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <ShieldAlert className="w-6 h-6 text-blue-500" />
              </div>
              <span className="text-xs font-black uppercase tracking-[0.2em] text-blue-500">
                Admin Control
              </span>
            </div>
            <h1 className="text-5xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-gray-500">
              Owner Dashboard
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-blue-500 transition-colors" />
              <input
                type="text"
                placeholder="Search users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchData()}
                className="bg-white/5 border border-white/10 rounded-2xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 w-64 transition-all"
              />
            </div>
            <Button
              onClick={fetchData}
              variant="outline"
              className="rounded-2xl border-white/10 hover:bg-white/5"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </header>

        {/* Maintenance Mode Card */}
        <div
          className={`p-6 rounded-2xl border ${
            maintenanceActive
              ? 'bg-yellow-500/10 border-yellow-500/30'
              : 'bg-gray-900 border-gray-800'
          } space-y-4`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Wrench
                className={`w-5 h-5 ${maintenanceActive ? 'text-yellow-400' : 'text-gray-400'}`}
              />
              <div>
                <h3 className="font-bold text-white">Maintenance Mode</h3>
                <p className="text-xs text-gray-400">
                  {maintenanceActive && maintenanceData?.startedAt
                    ? `Active since ${new Date(maintenanceData.startedAt as string | Date).toLocaleString()}`
                    : 'Platform is live and accessible to all users'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Status badge */}
              <span
                className={`text-xs font-bold px-3 py-1 rounded-full ${
                  maintenanceActive
                    ? 'bg-yellow-500/20 text-yellow-400'
                    : 'bg-green-500/20 text-green-400'
                }`}
              >
                {maintenanceActive ? '● ACTIVE' : '● LIVE'}
              </span>

              {maintenanceActive ? (
                <button
                  onClick={async () => {
                    await fetch('/api/admin/maintenance', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'disable' }),
                    });
                    setMaintenanceActive(false);
                    setMaintenanceData(null);
                    toast.success('Maintenance mode disabled. Platform is live.');
                  }}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl text-sm transition-all"
                >
                  End Maintenance
                </button>
              ) : (
                <button
                  onClick={() => setShowMaintenanceModal(true)}
                  className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white font-bold rounded-xl text-sm transition-all"
                >
                  Enable Maintenance
                </button>
              )}
            </div>
          </div>

          {/* Show countdown if active and has endsAt */}
          {maintenanceActive && maintenanceData?.endsAt && (
            <div className="text-sm text-yellow-300/70">
              Scheduled to end: {new Date(maintenanceData.endsAt as string | Date).toLocaleString()}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* User Management */}
          <Card className="lg:col-span-2 bg-[#111] border-white/5 shadow-2xl rounded-3xl overflow-hidden">
            <CardHeader className="p-8 border-b border-white/5 flex flex-row items-center justify-between bg-white/[0.02]">
              <CardTitle className="text-xl flex items-center gap-3">
                <Users className="w-5 h-5 text-blue-400" /> User Management
              </CardTitle>
              <span className="text-xs text-gray-500 font-mono">{users.length} users found</span>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <UsersTable
                users={users}
                onRoleUpdate={handleRoleUpdate}
                onBanClick={(user: User) => {
                  setSelectedUser(user);
                  setIsBanModalOpen(true);
                }}
                onUnbanClick={async (targetUserId) => {
                  try {
                    const res = await fetch('/api/admin/ban', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ targetUserId, type: 'unban' }),
                    });
                    const data = await res.json();
                    if (res.ok) {
                      toast.success(data.message);
                      fetchData();
                    } else {
                      toast.error(data.message);
                    }
                  } catch (error) {
                    toast.error('Error lifting restriction.');
                  }
                }}
                onDeleteClick={handleDeleteUser}
              />
            </CardContent>
          </Card>

          {/* Stream Management */}
          <Card className="bg-[#111] border-white/5 shadow-2xl rounded-3xl overflow-hidden flex flex-col">
            <CardHeader className="p-8 border-b border-white/5 bg-white/[0.02]">
              <CardTitle className="text-xl flex items-center gap-3">
                <PlayCircle className="w-5 h-5 text-accent-400" /> Active Streams
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-x-auto overflow-y-auto max-h-[600px]">
              <StreamsList
                streams={streams}
                onForceClose={(id) => {
                  // Implementation for force close can be added here
                  toast.info('Force close requested for ' + id);
                }}
              />
            </CardContent>
          </Card>
        </div>
      </main>

      <BanModal
        isOpen={isBanModalOpen}
        targetUsername={selectedUser?.username || ''}
        scope="platform"
        onClose={() => setIsBanModalOpen(false)}
        onConfirm={handleBanAction}
      />

      {showMaintenanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-800 rounded-3xl w-full max-w-md p-6 space-y-6">
            <h2 className="text-xl font-bold text-white">Enable Maintenance Mode</h2>

            {/* Message input */}
            <div className="space-y-2">
              <label className="text-sm text-gray-400">Message shown to users</label>
              <textarea
                value={maintenanceMessage}
                onChange={(e) => setMaintenanceMessage(e.target.value)}
                placeholder="EchoDeck is undergoing maintenance. We'll be back shortly."
                className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-white text-sm resize-none h-24 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Duration radio buttons */}
            <div className="space-y-2">
              <label className="text-sm text-gray-400">Duration</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: '30 Minutes', value: 30 },
                  { label: '1 Hour', value: 60 },
                  { label: '3 Hours', value: 180 },
                  { label: '6 Hours', value: 360 },
                  { label: '12 Hours', value: 720 },
                  { label: '24 Hours', value: 1440 },
                  { label: 'Indefinite', value: null },
                ].map((option) => (
                  <label
                    key={option.label}
                    className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${
                      maintenanceDuration === option.value
                        ? 'border-blue-500 bg-blue-500/10 text-white'
                        : 'border-gray-700 text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="duration"
                      className="hidden"
                      checked={maintenanceDuration === option.value}
                      onChange={() => setMaintenanceDuration(option.value)}
                    />
                    <span className="text-sm font-medium">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Preview of endsAt */}
            {maintenanceDuration !== null && (
              <p className="text-xs text-gray-500">
                Maintenance will end at:{' '}
                <span className="text-gray-300">
                  {new Date(Date.now() + maintenanceDuration * 60 * 1000).toLocaleString()}
                </span>
              </p>
            )}

            {/* Warning */}
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3">
              <p className="text-yellow-400 text-xs font-medium">
                ⚠ All users except you will be immediately redirected to the maintenance page. All
                active API calls will return 503.
              </p>
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowMaintenanceModal(false)}
                className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await fetch('/api/admin/maintenance', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      action: 'enable',
                      message: maintenanceMessage,
                      durationMinutes: maintenanceDuration,
                    }),
                  });
                  setMaintenanceActive(true);
                  setShowMaintenanceModal(false);
                  toast.warning('Maintenance mode is now active.');
                  const res = await fetch('/api/admin/maintenance');
                  setMaintenanceData(await res.json());
                }}
                className="flex-1 py-3 bg-yellow-600 hover:bg-yellow-700 text-white font-bold rounded-xl transition-all"
              >
                Enable Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
