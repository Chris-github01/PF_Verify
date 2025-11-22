import { useState, useEffect } from 'react';
import { Shield, UserPlus, Trash2, Search, Check, X as XIcon, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface User {
  id: string;
  email: string;
  created_at: string;
}

interface PlatformAdmin {
  id: string;
  user_id: string;
  is_active: boolean;
  created_at: string;
  user_email?: string;
}

export default function PlatformAdminUsers() {
  const [admins, setAdmins] = useState<PlatformAdmin[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: adminsData } = await supabase
        .from('platform_admins')
        .select('*')
        .order('created_at', { ascending: false });

      if (adminsData) {
        const adminsWithEmails = await Promise.all(
          adminsData.map(async (admin) => {
            const { data: profile } = await supabase
              .from('profiles')
              .select('email')
              .eq('id', admin.user_id)
              .maybeSingle();

            return {
              ...admin,
              user_email: profile?.email || 'Unknown',
            };
          })
        );

        setAdmins(adminsWithEmails);
      }

      const { data: { users } } = await supabase.auth.admin.listUsers();
      if (users) {
        setAllUsers(users);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAdmin = async () => {
    if (!selectedUserId) {
      setToast({ type: 'error', message: 'Please select a user' });
      return;
    }

    const existingAdmin = admins.find(a => a.user_id === selectedUserId);
    if (existingAdmin) {
      setToast({ type: 'error', message: 'User is already a platform admin' });
      return;
    }

    setAdding(true);
    try {
      const { data: currentUser } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('platform_admins')
        .insert({
          user_id: selectedUserId,
          is_active: true,
          created_by_user_id: currentUser?.data.user?.id,
        });

      if (error) throw error;

      setToast({ type: 'success', message: 'Platform admin added successfully' });
      setShowAddModal(false);
      setSelectedUserId('');
      await loadData();
    } catch (error: any) {
      setToast({ type: 'error', message: error.message || 'Failed to add platform admin' });
    } finally {
      setAdding(false);
    }
  };

  const handleToggleActive = async (adminId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('platform_admins')
        .update({ is_active: !currentStatus })
        .eq('id', adminId);

      if (error) throw error;

      setToast({
        type: 'success',
        message: `Admin ${!currentStatus ? 'activated' : 'deactivated'} successfully`
      });
      await loadData();
    } catch (error: any) {
      setToast({ type: 'error', message: error.message || 'Failed to update admin status' });
    }
  };

  const handleRemoveAdmin = async (adminId: string, email: string) => {
    if (!confirm(`Remove platform admin access for ${email}?`)) return;

    try {
      const { error } = await supabase
        .from('platform_admins')
        .delete()
        .eq('id', adminId);

      if (error) throw error;

      setToast({ type: 'success', message: 'Platform admin removed successfully' });
      await loadData();
    } catch (error: any) {
      setToast({ type: 'error', message: error.message || 'Failed to remove admin' });
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const filteredUsers = allUsers.filter(user =>
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) &&
    !admins.some(admin => admin.user_id === user.id)
  );

  if (loading) {
    return (
      <div className="px-6 py-6 max-w-7xl mx-auto">
        <div className="text-center py-12 text-slate-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="px-6 py-6 max-w-7xl mx-auto">
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 rounded-lg px-4 py-3 shadow-lg flex items-center gap-3 ${
            toast.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {toast.type === 'error' && <AlertCircle size={18} />}
          <span className="text-sm font-medium">{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2">
            <XIcon size={16} />
          </button>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Platform Administrators</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage users with platform admin access and permissions
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition"
        >
          <UserPlus size={18} />
          Add admin
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-[0_4px_14px_rgba(15,23,42,0.06)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Administrator
                </th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Status
                </th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Added
                </th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {admins.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-sm text-slate-500">
                    No platform administrators found
                  </td>
                </tr>
              ) : (
                admins.map((admin) => (
                  <tr key={admin.id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <Shield className="text-blue-600" size={18} />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-slate-900">
                            {admin.user_email}
                          </div>
                          <div className="text-xs text-slate-500">
                            User ID: {admin.user_id.slice(0, 8)}...
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                          admin.is_active
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-50 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {admin.is_active ? (
                          <>
                            <Check size={12} />
                            Active
                          </>
                        ) : (
                          'Inactive'
                        )}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {formatDate(admin.created_at)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleActive(admin.id, admin.is_active)}
                          className={`text-sm font-medium ${
                            admin.is_active
                              ? 'text-slate-600 hover:text-slate-800'
                              : 'text-emerald-600 hover:text-emerald-800'
                          } transition`}
                        >
                          {admin.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          onClick={() => handleRemoveAdmin(admin.id, admin.user_email || 'Unknown')}
                          className="text-sm font-medium text-rose-600 hover:text-rose-800 transition"
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Add Platform Administrator</h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setSelectedUserId('');
                  setSearchTerm('');
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <XIcon size={20} />
              </button>
            </div>

            <p className="text-sm text-slate-600 mb-4">
              Select a user to grant platform administrator access. They will be able to manage organisations and view all data.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Search users
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    placeholder="Search by email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Select user <span className="text-rose-600">*</span>
                </label>
                <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-lg">
                  {filteredUsers.length === 0 ? (
                    <div className="p-4 text-sm text-slate-500 text-center">
                      {searchTerm ? 'No matching users found' : 'All users are already admins'}
                    </div>
                  ) : (
                    filteredUsers.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => setSelectedUserId(user.id)}
                        className={`w-full px-4 py-3 text-left text-sm hover:bg-slate-50 transition border-b border-slate-100 last:border-0 ${
                          selectedUserId === user.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'
                        }`}
                      >
                        <div className="font-medium">{user.email}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Registered {formatDate(user.created_at)}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs text-amber-800">
                  <strong>Warning:</strong> Platform administrators have full access to all organisations, members, and data. Only grant this permission to trusted users.
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setSelectedUserId('');
                  setSearchTerm('');
                }}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900"
                disabled={adding}
              >
                Cancel
              </button>
              <button
                onClick={handleAddAdmin}
                disabled={adding || !selectedUserId}
                className="px-4 py-2 rounded-lg bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {adding ? 'Adding...' : 'Add administrator'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
