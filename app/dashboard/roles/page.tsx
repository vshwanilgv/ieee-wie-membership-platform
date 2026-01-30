'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Shield, UserPlus, Edit2, Trash2, Loader2, X, Calendar, Building2 } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { format } from 'date-fns'

interface Profile {
  id: string
  full_name: string
  email: string
  ieee_id: string | null
  photo_url: string | null
}

interface Committee {
  id: string
  name: string
  description: string | null
}

interface MemberRole {
  id: string
  member_id: string
  role_type: string
  title: string
  committee_id: string | null
  start_date: string
  end_date: string | null
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  profiles: Profile
  committees: Committee | null
}

const ROLE_TYPES = [
  { value: 'chairwoman', label: 'Chairwoman', color: 'purple' },
  { value: 'executive_committee', label: 'Executive Committee', color: 'blue' },
  { value: 'board_of_directors', label: 'Board of Directors', color: 'indigo' },
  { value: 'committee_lead', label: 'Committee Lead', color: 'green' },
  { value: 'committee_member', label: 'Committee Member', color: 'gray' },
]

export default function RoleManagementPage() {
  const [members, setMembers] = useState<Profile[]>([])
  const [roles, setRoles] = useState<MemberRole[]>([])
  const [committees, setCommittees] = useState<Committee[]>([])
  const [loading, setLoading] = useState(true)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [editingRole, setEditingRole] = useState<MemberRole | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [canManageRoles, setCanManageRoles] = useState(false)
  
  const [formData, setFormData] = useState({
    member_id: '',
    role_type: '',
    title: '',
    committee_id: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
  })

  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      // Check current user's permissions
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: userRoles } = await supabase
          .from('member_roles')
          .select('role_type')
          .eq('member_id', user.id)
          .eq('status', 'approved')
          .or('end_date.is.null,end_date.gte.' + new Date().toISOString().split('T')[0])
        
        const hasPermission = userRoles?.some(r => 
          r.role_type === 'chairwoman' || r.role_type === 'executive_committee'
        )
        setCanManageRoles(hasPermission || false)
      }

      // Load all members
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name')

      if (profilesError) throw profilesError
      setMembers(profilesData || [])

      // Load all roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('member_roles')
        .select(`
          *,
          profiles!member_id (*),
          committees (*)
        `)
        .order('created_at', { ascending: false })

      if (rolesError) throw rolesError
      setRoles(rolesData || [])

      // Load committees
      const { data: committeesData, error: committeesError } = await supabase
        .from('committees')
        .select('*')
        .order('name')

      if (committeesError) throw committeesError
      setCommittees(committeesData || [])
    } catch (error: any) {
      console.error('Error loading data:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      toast.error(`Failed to load data: ${error.message || 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleAssignRole = (memberId?: string) => {
    if (memberId) {
      setFormData({ ...formData, member_id: memberId })
    }
    setEditingRole(null)
    setShowAssignModal(true)
  }

  const handleEditRole = (role: MemberRole) => {
    setEditingRole(role)
    setFormData({
      member_id: role.member_id,
      role_type: role.role_type,
      title: role.title,
      committee_id: role.committee_id || '',
      start_date: role.start_date,
      end_date: role.end_date || '',
    })
    setShowAssignModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.member_id || !formData.role_type || !formData.title || !formData.start_date) {
      toast.error('Please fill in all required fields')
      return
    }

    setSubmitting(true)

    try {
      const roleData = {
        member_id: formData.member_id,
        role_type: formData.role_type,
        title: formData.title,
        committee_id: formData.committee_id || null,
        start_date: formData.start_date,
        end_date: formData.end_date || null,
        status: 'approved' as const, // Auto-approve for now
      }

      if (editingRole) {
        // Update existing role
        const { error } = await supabase
          .from('member_roles')
          .update(roleData)
          .eq('id', editingRole.id)

        if (error) throw error
        
        toast.success('Role updated successfully!')
      } else {
        // Create new role
        const { error } = await supabase
          .from('member_roles')
          .insert(roleData)

        if (error) throw error
        
        toast.success('Role assigned successfully!')
      }

      // Close modal and reset form first
      setShowAssignModal(false)
      setFormData({
        member_id: '',
        role_type: '',
        title: '',
        committee_id: '',
        start_date: new Date().toISOString().split('T')[0],
        end_date: '',
      })
      setEditingRole(null)
      
      // Then reload data
      await loadData()
    } catch (error: any) {
      console.error('Error saving role:', error)
      toast.error(error.message || 'Failed to save role')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteRole = async (roleId: string) => {
    if (!confirm('Are you sure you want to remove this role?')) {
      return
    }

    try {
      const { data, error } = await supabase
        .from('member_roles')
        .delete()
        .eq('id', roleId)

      if (error) {
        console.error('Delete error:', error)
        toast.error(`Failed to remove role: ${error.message}`)
        return
      }
      
      // Optimistically update the UI
      setRoles(prevRoles => prevRoles.filter(r => r.id !== roleId))
      toast.success('Role removed successfully!')
    } catch (error: any) {
      console.error('Error deleting role:', error)
      toast.error(`Failed to remove role: ${error.message || 'Unknown error'}`)
      // Reload data to ensure consistency if delete failed
      await loadData()
    }
  }

  const getRoleColor = (roleType: string) => {
    const role = ROLE_TYPES.find(r => r.value === roleType)
    return role?.color || 'gray'
  }

  const getRoleLabel = (roleType: string) => {
    const role = ROLE_TYPES.find(r => r.value === roleType)
    return role?.label || roleType
  }

  const getRoleBadgeClasses = (roleType: string) => {
    const colorMap: Record<string, string> = {
      purple: 'bg-purple-100 text-purple-800',
      blue: 'bg-blue-100 text-blue-800',
      indigo: 'bg-indigo-100 text-indigo-800',
      green: 'bg-green-100 text-green-800',
      gray: 'bg-gray-100 text-gray-800',
    }
    const color = getRoleColor(roleType)
    return colorMap[color] || 'bg-gray-100 text-gray-800'
  }

  const getMemberRoles = (memberId: string) => {
    return roles.filter(r => r.member_id === memberId && r.status === 'approved')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    )
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl shadow-lg mb-6 p-6 sm:p-8 text-white">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Role Management</h1>
            <p className="text-purple-100 mt-1">Assign and manage member roles</p>
          </div>
          {canManageRoles && (
            <button
              onClick={() => handleAssignRole()}
              className="flex items-center gap-2 px-5 py-2.5 bg-white text-purple-600 font-medium rounded-lg hover:bg-purple-50 transition-all shadow-md hover:shadow-lg"
            >
              <UserPlus size={18} />
              Assign Role
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-md p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Shield className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Members</p>
              <p className="text-2xl font-bold text-gray-900">{members.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-md p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <UserPlus className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Active Roles</p>
              <p className="text-2xl font-bold text-gray-900">
                {roles.filter(r => r.status === 'approved').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-md p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <Building2 className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Committees</p>
              <p className="text-2xl font-bold text-gray-900">{committees.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Members List */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">All Members</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Member
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Current Roles
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {members.map(member => {
                const memberRoles = getMemberRoles(member.id)
                return (
                  <tr key={member.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center text-white font-semibold">
                          {member.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{member.full_name}</div>
                          <div className="text-sm text-gray-500">{member.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {memberRoles.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {memberRoles.map(role => (
                            <div key={role.id} className="group relative inline-flex items-center gap-1">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeClasses(role.role_type)}`}>
                                {getRoleLabel(role.role_type)}
                              </span>
                              {canManageRoles && (
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => handleEditRole(role)}
                                    className="p-1 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors"
                                    title="Edit role"
                                  >
                                    <Edit2 size={12} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteRole(role.id)}
                                    className="p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                                    title="Delete role"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">No roles assigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {canManageRoles && (
                        <button
                          onClick={() => handleAssignRole(member.id)}
                          className="text-purple-600 hover:text-purple-900 font-medium"
                        >
                          Assign Role
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assign/Edit Role Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-blue-600 text-white p-6 flex items-center justify-between">
              <h2 className="text-xl font-bold">
                {editingRole ? 'Edit Role' : 'Assign New Role'}
              </h2>
              <button
                onClick={() => {
                  setShowAssignModal(false)
                  setEditingRole(null)
                  setFormData({
                    member_id: '',
                    role_type: '',
                    title: '',
                    committee_id: '',
                    start_date: new Date().toISOString().split('T')[0],
                    end_date: '',
                  })
                }}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Member Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Member <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.member_id}
                  onChange={(e) => setFormData({ ...formData, member_id: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all text-gray-900"
                  required
                  disabled={!!editingRole}
                >
                  <option value="">Select a member</option>
                  {members.map(member => (
                    <option key={member.id} value={member.id}>
                      {member.full_name} ({member.email})
                    </option>
                  ))}
                </select>
              </div>

              {/* Role Type */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Role Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.role_type}
                  onChange={(e) => setFormData({ ...formData, role_type: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all text-gray-900"
                  required
                >
                  <option value="">Select role type</option>
                  {ROLE_TYPES.map(role => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all text-gray-900"
                  placeholder="e.g., Membership Development Director"
                  required
                />
              </div>

              {/* Committee */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Committee (Optional)
                </label>
                <select
                  value={formData.committee_id}
                  onChange={(e) => setFormData({ ...formData, committee_id: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all text-gray-900"
                >
                  <option value="">No committee</option>
                  {committees.map(committee => (
                    <option key={committee.id} value={committee.id}>
                      {committee.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Start Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all text-gray-900"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    End Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    min={formData.start_date}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all text-gray-900"
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAssignModal(false)
                    setEditingRole(null)
                  }}
                  className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-all"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-medium rounded-xl hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Saving...
                    </>
                  ) : (
                    editingRole ? 'Update Role' : 'Assign Role'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
