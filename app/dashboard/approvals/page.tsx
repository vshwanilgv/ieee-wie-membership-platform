'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle, XCircle, Clock, Eye, Loader2, Calendar, User, Award, Image as ImageIcon } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { format } from 'date-fns'

interface Profile {
  id: string
  full_name: string
  email: string
  photo_url: string | null
}

interface ContributionType {
  id: string
  name: string
  points: number
  category: string
}

interface ContributionEvidence {
  id: string
  file_url: string
  file_name: string
}

interface Contribution {
  id: string
  member_id: string
  contribution_type_id: string
  title: string
  description: string
  activity_date: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  profiles: Profile
  contribution_types: ContributionType
  contribution_evidence: ContributionEvidence[]
}

interface UserRole {
  role_type: string
  title: string
}

export default function ApprovalsPage() {
  const [contributions, setContributions] = useState<Contribution[]>([])
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState<UserRole | null>(null)
  const [selectedContribution, setSelectedContribution] = useState<Contribution | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error('Please log in to view approvals')
        return
      }

      // Get user's highest role
      const { data: userRoles, error: rolesError } = await supabase
        .from('member_roles')
        .select('role_type, title')
        .eq('member_id', user.id)
        .eq('status', 'approved')
        .or('end_date.is.null,end_date.gte.' + new Date().toISOString().split('T')[0])
        .order('role_type')

      if (rolesError) throw rolesError

      // Determine highest role priority
      const roleHierarchy = ['chairwoman', 'executive_committee', 'board_of_directors', 'committee_lead', 'committee_member']
      const highestRole = userRoles?.find(r => roleHierarchy.includes(r.role_type))
      
      if (!highestRole) {
        toast.error('You do not have permission to approve contributions')
        setLoading(false)
        return
      }

      setUserRole(highestRole)

      // Load contributions based on user's role
      // Chairwoman can approve executive_committee contributions
      // Executive committee can approve board_of_directors contributions
      // Board of directors can approve committee_lead and committee_member contributions
      
      let contributorRoleTypes: string[] = []
      
      switch (highestRole.role_type) {
        case 'chairwoman':
          contributorRoleTypes = ['executive_committee']
          break
        case 'executive_committee':
          contributorRoleTypes = ['board_of_directors']
          break
        case 'board_of_directors':
          contributorRoleTypes = ['committee_lead', 'committee_member']
          break
        default:
          toast.error('You do not have permission to approve contributions')
          setLoading(false)
          return
      }

      console.log('Current user role:', highestRole.role_type)
      console.log('Looking for contributors with roles:', contributorRoleTypes)

      // Get contributors with the specified roles
      const { data: contributorRoles, error: contributorRolesError } = await supabase
        .from('member_roles')
        .select('member_id')
        .in('role_type', contributorRoleTypes)
        .eq('status', 'approved')
        .or('end_date.is.null,end_date.gte.' + new Date().toISOString().split('T')[0])

      if (contributorRolesError) throw contributorRolesError

      console.log('Found contributor roles:', contributorRoles)

      const contributorIds = [...new Set(contributorRoles?.map(r => r.member_id) || [])]
      
      console.log('Contributor IDs to check:', contributorIds)

      if (contributorIds.length === 0) {
        console.log('No contributors found with specified roles')
        setContributions([])
        setLoading(false)
        return
      }

      // Debug: Check ALL contributions for these users regardless of status
      const { data: allContributions } = await supabase
        .from('contributions')
        .select('id, member_id, status, title')
        .in('member_id', contributorIds)
      
      console.log('ALL contributions for these users (any status):', allContributions)
      
      // Debug: Check ALL contributions in database
      const { data: allDbContributions } = await supabase
        .from('contributions')
        .select('id, member_id, status, title')
      
      console.log('ALL contributions in database:', allDbContributions)
      console.log('Executive committee member ID:', contributorIds[0])
      console.log('Contributions by member:', allDbContributions?.map(c => ({ 
        title: c.title, 
        member_id: c.member_id, 
        status: c.status,
        isExecCommittee: c.member_id === contributorIds[0]
      })))

      // Load pending contributions from these contributors
      const { data: contributionsData, error: contributionsError } = await supabase
        .from('contributions')
        .select(`
          *,
          contribution_types (*),
          contribution_evidence (*)
        `)
        .in('member_id', contributorIds)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      console.log('Contributions query result:', contributionsData)
      console.log('Contributions query error:', contributionsError)

      if (contributionsError) throw contributionsError
      
      // Fetch profiles separately to avoid relationship ambiguity
      if (contributionsData && contributionsData.length > 0) {
        const contributorIdsToFetch = [...new Set(contributionsData.map(c => c.member_id))]
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('*')
          .in('id', contributorIdsToFetch)
        
        if (profilesError) throw profilesError
        
        // Map profiles to contributions
        const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || [])
        const contributionsWithProfiles = contributionsData.map(c => ({
          ...c,
          profiles: profilesMap.get(c.member_id)
        }))
        
        setContributions(contributionsWithProfiles as Contribution[])
      } else {
        setContributions([])
      }
    } catch (error: any) {
      console.error('Error loading data:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      console.error('Error type:', typeof error)
      console.error('Error keys:', Object.keys(error))
      toast.error(`Failed to load data: ${error.message || error.msg || 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (contributionId: string) => {
    setActionLoading(contributionId)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase.rpc('approve_contribution', {
        contribution_id: contributionId,
        approver_user_id: user.id
      })

      if (error) throw error

      toast.success('Contribution approved successfully!')
      setContributions(prev => prev.filter(c => c.id !== contributionId))
      setShowDetailModal(false)
    } catch (error: any) {
      console.error('Error approving contribution:', error)
      toast.error(`Failed to approve: ${error.message || 'Unknown error'}`)
    } finally {
      setActionLoading(null)
    }
  }

  const handleReject = async (contributionId: string) => {
    const reason = prompt('Please provide a reason for rejection:')
    if (!reason) return

    setActionLoading(contributionId)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase.rpc('reject_contribution', {
        contribution_id: contributionId,
        approver_user_id: user.id,
        reason: reason
      })

      if (error) throw error

      toast.success('Contribution rejected')
      setContributions(prev => prev.filter(c => c.id !== contributionId))
      setShowDetailModal(false)
    } catch (error: any) {
      console.error('Error rejecting contribution:', error)
      toast.error(`Failed to reject: ${error.message || 'Unknown error'}`)
    } finally {
      setActionLoading(null)
    }
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800'
    }
    return styles[status as keyof typeof styles] || styles.pending
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    )
  }

  if (!userRole) {
    return (
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
          <Clock className="w-12 h-12 text-yellow-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Approval Permission</h3>
          <p className="text-gray-600">You do not have a role that allows you to approve contributions.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl shadow-lg mb-6 p-6 sm:p-8 text-white">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Approvals Dashboard</h1>
            <p className="text-purple-100 mt-1">Review and approve pending contributions</p>
            <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full text-sm">
              <Award size={16} />
              <span>Your Role: {userRole.title}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-md p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Pending Review</p>
              <p className="text-2xl font-bold text-gray-900">{contributions.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-md p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Award className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Your Approval Level</p>
              <p className="text-lg font-bold text-gray-900">{userRole.title}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Contributions List */}
      {contributions.length === 0 ? (
        <div className="bg-white rounded-xl shadow-md p-12 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">All Caught Up!</h3>
          <p className="text-gray-600">There are no pending contributions to review at this time.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-900">Pending Contributions</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {contributions.map(contribution => (
              <div key={contribution.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Contributor Info */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center text-white font-semibold">
                        {contribution.profiles.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {contribution.profiles.full_name}
                        </div>
                        <div className="text-xs text-gray-500">{contribution.profiles.email}</div>
                      </div>
                    </div>

                    {/* Contribution Details */}
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{contribution.title}</h3>
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">{contribution.description}</p>

                    <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                      <span className="inline-flex items-center gap-1">
                        <Award size={14} />
                        {contribution.contribution_types.name}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Calendar size={14} />
                        {format(new Date(contribution.activity_date), 'MMM dd, yyyy')}
                      </span>
                      {contribution.contribution_evidence.length > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <ImageIcon size={14} />
                          {contribution.contribution_evidence.length} file(s)
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        +{contribution.contribution_types.points} points
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => {
                        setSelectedContribution(contribution)
                        setShowDetailModal(true)
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors whitespace-nowrap"
                    >
                      <Eye size={16} />
                      View Details
                    </button>
                    <button
                      onClick={() => handleApprove(contribution.id)}
                      disabled={actionLoading === contribution.id}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 whitespace-nowrap"
                    >
                      {actionLoading === contribution.id ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <CheckCircle size={16} />
                      )}
                      Approve
                    </button>
                    <button
                      onClick={() => handleReject(contribution.id)}
                      disabled={actionLoading === contribution.id}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 whitespace-nowrap"
                    >
                      <XCircle size={16} />
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedContribution && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-blue-600 text-white p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Contribution Details</h2>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <XCircle size={24} />
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Contributor */}
              <div className="flex items-center gap-3 mb-6 pb-6 border-b">
                <div className="flex-shrink-0 h-12 w-12 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center text-white font-semibold text-lg">
                  {selectedContribution.profiles.full_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-lg font-semibold text-gray-900">
                    {selectedContribution.profiles.full_name}
                  </div>
                  <div className="text-sm text-gray-500">{selectedContribution.profiles.email}</div>
                </div>
              </div>

              {/* Details */}
              <div className="space-y-4 mb-6">
                <div>
                  <label className="text-sm font-medium text-gray-500">Title</label>
                  <p className="text-lg font-semibold text-gray-900">{selectedContribution.title}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">Description</label>
                  <p className="text-gray-700 whitespace-pre-wrap">{selectedContribution.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Type</label>
                    <p className="text-gray-900">{selectedContribution.contribution_types.name}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Date</label>
                    <p className="text-gray-900">
                      {format(new Date(selectedContribution.activity_date), 'MMMM dd, yyyy')}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Category</label>
                    <p className="text-gray-900">{selectedContribution.contribution_types.category}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Points</label>
                    <p className="text-green-600 font-semibold">
                      +{selectedContribution.contribution_types.points} points
                    </p>
                  </div>
                </div>

                {/* Evidence */}
                {selectedContribution.contribution_evidence.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-gray-500 mb-2 block">Evidence Files</label>
                    <div className="grid grid-cols-2 gap-4">
                      {selectedContribution.contribution_evidence.map(evidence => (
                        <a
                          key={evidence.id}
                          href={evidence.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          <ImageIcon size={20} className="text-purple-600" />
                          <span className="text-sm text-gray-700 truncate">{evidence.file_name}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-6 border-t">
                <button
                  onClick={() => handleApprove(selectedContribution.id)}
                  disabled={actionLoading === selectedContribution.id}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {actionLoading === selectedContribution.id ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <CheckCircle size={20} />
                  )}
                  Approve Contribution
                </button>
                <button
                  onClick={() => handleReject(selectedContribution.id)}
                  disabled={actionLoading === selectedContribution.id}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  <XCircle size={20} />
                  Reject Contribution
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
