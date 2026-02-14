import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Trophy, Calendar, Award, TrendingUp } from 'lucide-react'
import { format } from 'date-fns'

interface ProfilePageProps {
  params: {
    userId: string
  }
}

export default async function PublicProfilePage({ params }: ProfilePageProps) {
  const supabase = await createClient()
  const { userId } = params

  // Fetch user profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (profileError || !profile) {
    notFound()
  }

  // Fetch approved contributions
  const { data: contributions } = await supabase
    .from('contributions')
    .select(`
      *,
      contribution_types (
        name,
        description
      )
    `)
    .eq('member_id', userId)
    .eq('status', 'approved')
    .order('approved_at', { ascending: false })

  // Calculate stats
  const totalScore = contributions?.reduce((sum, c) => sum + (c.assigned_score || 0), 0) || 0
  const totalContributions = contributions?.length || 0

  // Get user roles
  const { data: roles } = await supabase
    .from('member_roles')
    .select('role_type, start_date, end_date, status')
    .eq('member_id', userId)
    .eq('status', 'approved')
    .order('start_date', { ascending: false })

  const activeRoles = roles?.filter(r => !r.end_date || new Date(r.end_date) >= new Date()) || []

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-4xl font-bold">
              {profile.full_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-4xl font-bold mb-2">{profile.full_name}</h1>
              <p className="text-blue-100 text-lg">{profile.email}</p>
              {activeRoles.length > 0 && (
                <div className="flex gap-2 mt-3">
                  {activeRoles.map((role, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-sm font-medium"
                    >
                      {role.role_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="max-w-6xl mx-auto px-6 -mt-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium mb-1">Total Points</p>
                <p className="text-3xl font-bold text-blue-600">{totalScore}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Trophy className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium mb-1">Contributions</p>
                <p className="text-3xl font-bold text-purple-600">{totalContributions}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Award className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium mb-1">Member Since</p>
                <p className="text-xl font-bold text-green-600">
                  {format(new Date(profile.created_at), 'MMM yyyy')}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Calendar className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Contributions List */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-blue-600" />
            Approved Contributions
          </h2>

          {contributions && contributions.length > 0 ? (
            <div className="space-y-4">
              {contributions.map((contribution) => (
                <div
                  key={contribution.id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-1">
                        {contribution.contribution_types?.name || 'Unknown Type'}
                      </h3>
                      {contribution.description && (
                        <p className="text-gray-600 text-sm mb-2">{contribution.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {format(new Date(contribution.activity_date), 'MMM dd, yyyy')}
                        </span>
                        {contribution.approved_at && (
                          <span className="text-green-600">
                            Approved on {format(new Date(contribution.approved_at), 'MMM dd, yyyy')}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="ml-4">
                      <div className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-semibold">
                        {contribution.assigned_score || 0} pts
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <Award className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg">No approved contributions yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
