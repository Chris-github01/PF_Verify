import { useState, useEffect } from 'react';
import { ArrowLeft, AlertCircle, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Organisation {
  id: string;
  name: string;
  status: 'active' | 'trial' | 'suspended';
  seat_limit: number;
  created_at: string;
  created_by_user_id: string;
}

interface Member {
  id: string;
  email: string;
  full_name?: string;
  role: string;
  status: string;
  activated_at: string | null;
}

interface Project {
  id: string;
  name: string;
  status: string;
  updated_at: string;
  quote_count: number;
  owner_email?: string;
}

export default function OrganisationDetail({ organisationId }: { organisationId: string }) {
  const [organisation, setOrganisation] = useState<Organisation | null>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [planName, setPlanName] = useState('');
  const [seatLimit, setSeatLimit] = useState(10);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [ownerEmail, setOwnerEmail] = useState('');
  const [createdDate, setCreatedDate] = useState('');

  useEffect(() => {
    loadOrganisation();
  }, [organisationId]);

  const loadOrganisation = async () => {
    try {
      const { data: org, error } = await supabase
        .from('organisations')
        .select('*')
        .eq('id', organisationId)
        .single();

      if (error) throw error;
      setOrganisation(org);
      setSeatLimit(org.seat_limit);
      setCreatedDate(new Date(org.created_at).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }));

      const { data: sub } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('organisation_id', organisationId)
        .maybeSingle();

      setSubscription(sub);
      setPlanName(sub?.plan_name || 'Trial');

      const { data: memberData } = await supabase
        .from('organisation_members')
        .select('*')
        .eq('organisation_id', organisationId)
        .order('activated_at', { ascending: false, nullsFirst: false });

      const membersWithDetails = await Promise.all(
        (memberData || []).map(async (member) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('email, full_name')
            .eq('id', member.user_id)
            .maybeSingle();

          if (member.role === 'owner') {
            setOwnerEmail(profile?.email || 'Unknown');
          }

          return {
            ...member,
            email: profile?.email || 'Unknown',
            full_name: profile?.full_name,
          };
        })
      );

      setMembers(membersWithDetails as Member[]);

      const { data: projectData } = await supabase
        .from('projects')
        .select('*')
        .eq('organisation_id', organisationId)
        .order('updated_at', { ascending: false });

      const projectsWithDetails = await Promise.all(
        (projectData || []).map(async (project) => {
          const { count: quoteCount } = await supabase
            .from('quotes')
            .select('*', { count: 'exact', head: true })
            .eq('project_id', project.id);

          const { data: owner } = await supabase
            .from('profiles')
            .select('email')
            .eq('id', project.user_id)
            .maybeSingle();

          return {
            ...project,
            quote_count: quoteCount || 0,
            owner_email: owner?.email,
          };
        })
      );

      setProjects(projectsWithDetails as Project[]);
    } catch (error) {
      console.error('Error loading organisation:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveChanges = async () => {
    if (!organisation) return;

    setSaving(true);
    try {
      const { error: orgError } = await supabase
        .from('organisations')
        .update({ seat_limit: seatLimit })
        .eq('id', organisationId);

      if (orgError) throw orgError;

      if (subscription) {
        const { error: subError } = await supabase
          .from('subscriptions')
          .update({ plan_name: planName, seat_limit: seatLimit })
          .eq('organisation_id', organisationId);

        if (subError) throw subError;
      }

      setToast({ type: 'success', message: 'Changes saved successfully' });
      setEditMode(false);
      await loadOrganisation();
    } catch (error: any) {
      setToast({ type: 'error', message: error.message || 'Failed to save changes' });
    } finally {
      setSaving(false);
    }
  };

  const handleSuspend = async () => {
    if (!confirm('Suspend this organisation? Members will lose access immediately.')) return;

    try {
      const { error } = await supabase
        .from('organisations')
        .update({ status: 'suspended' })
        .eq('id', organisationId);

      if (error) throw error;

      setToast({ type: 'success', message: 'Organisation suspended' });
      await loadOrganisation();
    } catch (error: any) {
      setToast({ type: 'error', message: error.message || 'Failed to suspend organisation' });
    }
  };

  const handleActivate = async () => {
    try {
      const { error } = await supabase
        .from('organisations')
        .update({ status: 'active' })
        .eq('id', organisationId);

      if (error) throw error;

      setToast({ type: 'success', message: 'Organisation activated' });
      await loadOrganisation();
    } catch (error: any) {
      setToast({ type: 'error', message: error.message || 'Failed to activate organisation' });
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'trial':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'suspended':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
  };

  const seatsUsed = members.filter(
    m => m.status === 'active' && ['owner', 'admin', 'member'].includes(m.role)
  ).length;

  if (loading) {
    return (
      <div className="px-6 py-6 max-w-7xl mx-auto">
        <div className="text-center py-12 text-slate-500">Loading organisation...</div>
      </div>
    );
  }

  if (!organisation) {
    return (
      <div className="px-6 py-6 max-w-7xl mx-auto">
        <div className="text-center py-12 text-slate-500">Organisation not found</div>
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
            <X size={16} />
          </button>
        </div>
      )}

      <button
        onClick={() => (window.location.href = '/admin/organisations')}
        className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-4"
      >
        <ArrowLeft size={16} />
        Back to organisations
      </button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{organisation.name}</h1>
          <p className="mt-1 text-sm text-slate-500">
            Created {createdDate} · Owner: {ownerEmail}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${getStatusBadge(
              organisation.status
            )}`}
          >
            {organisation.status.charAt(0).toUpperCase() + organisation.status.slice(1)}
          </span>
          {organisation.status === 'suspended' ? (
            <button
              onClick={handleActivate}
              className="inline-flex items-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-700 transition"
            >
              Activate
            </button>
          ) : (
            <button
              onClick={handleSuspend}
              className="inline-flex items-center rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-rose-700 transition"
            >
              Suspend
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white shadow-[0_4px_14px_rgba(15,23,42,0.06)] p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-900">Plan & seats</h2>
              {!editMode ? (
                <button
                  onClick={() => setEditMode(true)}
                  className="text-xs font-medium text-[#0A66C2] hover:underline"
                >
                  Edit
                </button>
              ) : null}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Plan</label>
                <select
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                  disabled={!editMode}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2] focus:border-[#0A66C2] disabled:bg-slate-50 disabled:text-slate-500"
                >
                  <option value="Trial">Trial (14 days)</option>
                  <option value="Starter">Starter</option>
                  <option value="Pro">Pro</option>
                  <option value="Enterprise">Enterprise</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Seat limit</label>
                <input
                  type="number"
                  value={seatLimit}
                  onChange={(e) => setSeatLimit(parseInt(e.target.value) || 0)}
                  disabled={!editMode}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2] focus:border-[#0A66C2] disabled:bg-slate-50 disabled:text-slate-500"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Currently using {seatsUsed} seats. Owners, admins, and members use a seat. Viewers are free.
                </p>
                {seatLimit < seatsUsed && (
                  <p className="mt-1 text-xs text-rose-600">
                    Warning: This organisation uses {seatsUsed} seats. Reducing to {seatLimit} will place them over
                    their limit.
                  </p>
                )}
              </div>

              {editMode && (
                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={handleSaveChanges}
                    disabled={saving}
                    className="px-4 py-2 rounded-lg bg-[#0A66C2] text-sm font-semibold text-white hover:bg-[#0952A0] disabled:opacity-50 transition"
                  >
                    {saving ? 'Saving...' : 'Save changes'}
                  </button>
                  <button
                    onClick={() => {
                      setEditMode(false);
                      setSeatLimit(organisation.seat_limit);
                      setPlanName(subscription?.plan_name || 'Trial');
                    }}
                    className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white shadow-[0_4px_14px_rgba(15,23,42,0.06)] p-4">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Members</h2>
            <p className="text-xs text-slate-500 mb-4">
              Overview of all members in this organisation. Seat-consuming roles are highlighted.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full table-auto text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="px-2 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Member</th>
                    <th className="px-2 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Email</th>
                    <th className="px-2 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Role</th>
                    <th className="px-2 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                    <th className="px-2 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Last active
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <tr key={member.id} className="border-b border-slate-50">
                      <td className="px-2 py-2 text-sm text-slate-900">
                        {member.full_name || member.email.split('@')[0]}
                      </td>
                      <td className="px-2 py-2 text-sm text-slate-600">{member.email}</td>
                      <td className="px-2 py-2">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            ['owner', 'admin', 'member'].includes(member.role)
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-slate-50 text-slate-700'
                          }`}
                        >
                          {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                        </span>
                      </td>
                      <td className="px-2 py-2">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            member.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700'
                              : member.status === 'invited'
                              ? 'bg-slate-50 text-slate-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {member.status.charAt(0).toUpperCase() + member.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-sm text-slate-600">
                        {member.activated_at ? formatDate(member.activated_at) : 'Never'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white shadow-[0_4px_14px_rgba(15,23,42,0.06)] p-4">
            <h2 className="text-sm font-semibold text-slate-900 mb-4">Projects</h2>

            <div className="overflow-x-auto">
              <table className="w-full table-auto text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="px-2 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Project</th>
                    <th className="px-2 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                    <th className="px-2 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Last updated
                    </th>
                    <th className="px-2 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Quotes</th>
                    <th className="px-2 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Owner</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-2 py-4 text-center text-sm text-slate-500">
                        No projects yet
                      </td>
                    </tr>
                  ) : (
                    projects.map((project) => (
                      <tr key={project.id} className="border-b border-slate-50">
                        <td className="px-2 py-2 font-medium text-sm text-slate-900">{project.name}</td>
                        <td className="px-2 py-2">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              project.status === 'active'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-slate-50 text-slate-700'
                            }`}
                          >
                            {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-sm text-slate-600">{formatDate(project.updated_at)}</td>
                        <td className="px-2 py-2 text-sm text-slate-800">{project.quote_count}</td>
                        <td className="px-2 py-2 text-sm text-slate-600">{project.owner_email || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div>
          <div className="rounded-xl border border-slate-200 bg-white shadow-[0_4px_14px_rgba(15,23,42,0.06)] p-4">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Quick actions</h2>
            <div className="space-y-2">
              <button
                onClick={() => navigator.clipboard.writeText(organisationId)}
                className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg transition"
              >
                Copy organisation ID
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
