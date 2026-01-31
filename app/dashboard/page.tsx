import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Award, TrendingUp, Users, CheckCircle } from 'lucide-react'

async function getStats(userId: string) {
  const supabase = await createClient()
  
  // Get total score
  const { data: scoreData } = await supabase
    .from('member_total_scores')
    .select('*')
    .eq('member_id', userId)
    .single()
  
  // Get pending contributions
  const { count: pendingCount } = await supabase
    .from('contributions')
    .select('*', { count: 'exact', head: true })
    .eq('member_id', userId)
    .eq('status', 'pending')
  
  // Get recent contributions
  const { data: recentContributions } = await supabase
    .from('contributions')
    .select(`
      id,
      title,
      activity_date,
      status,
      assigned_score,
      contribution_types (name)
    `)
    .eq('member_id', userId)
    .order('created_at', { ascending: false })
    .limit(5)
  
  return {
    totalScore: scoreData?.total_score || 0,
    totalContributions: scoreData?.total_contributions || 0,
    pendingCount: pendingCount || 0,
    recentContributions: recentContributions || [],
  }
}

export default async function DashboardPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/auth/login')
  }
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()
  
  const stats = await getStats(user.id)
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back, {profile?.full_name || 'Member'}!
        </h1>
        <p className="text-gray-600 mt-1">
          Here's an overview of your membership activities
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <TrendingUp className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Total Score
                  </dt>
                  <dd className="text-2xl font-semibold text-gray-900">
                    {stats.totalScore}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Award className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Contributions
                  </dt>
                  <dd className="text-2xl font-semibold text-gray-900">
                    {stats.totalContributions}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CheckCircle className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Pending Approval
                  </dt>
                  <dd className="text-2xl font-semibold text-gray-900">
                    {stats.pendingCount}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Users className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Active Roles
                  </dt>
                  <dd className="text-2xl font-semibold text-gray-900">
                    -
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Contributions */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Recent Contributions
          </h3>
        </div>
        <div className="px-4 py-5 sm:p-6">
          {stats.recentContributions.length > 0 ? (
            <div className="space-y-4">
              {stats.recentContributions.map((contribution: any) => (
                <div
                  key={contribution.id}
                  className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0"
                >
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-gray-900">
                      {contribution.title}
                    </h4>
                    <p className="text-sm text-gray-500">
                      {contribution.contribution_types?.name} • {new Date(contribution.activity_date).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="ml-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        contribution.status === 'approved'
                          ? 'bg-green-100 text-green-800'
                          : contribution.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {contribution.status}
                    </span>
                    {contribution.assigned_score && (
                      <span className="ml-2 text-sm font-semibold text-purple-600">
                        +{contribution.assigned_score}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">
              No contributions yet. Start by adding your first contribution!
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
