'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Trophy, Medal, Award, TrendingUp, Calendar } from 'lucide-react'
import toast from 'react-hot-toast'

type TimePeriod = 'monthly' | 'yearly' | 'all-time'

interface LeaderboardEntry {
  member_id: string
  full_name: string
  email: string
  avatar_url: string | null
  total_score: number
  contribution_count: number
  rank: number
}

export default function LeaderboardPage() {
  const supabase = createClient()
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('all-time')

  useEffect(() => {
    loadLeaderboard()
  }, [timePeriod])

  const loadLeaderboard = async () => {
    try {
      setLoading(true)

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error('Not authenticated')
        return
      }
      setCurrentUserId(user.id)

      // Build date filter based on time period
      let dateFilter = ''
      const now = new Date()
      if (timePeriod === 'monthly') {
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        dateFilter = `AND c.approved_at >= '${firstDayOfMonth.toISOString()}'`
      } else if (timePeriod === 'yearly') {
        const firstDayOfYear = new Date(now.getFullYear(), 0, 1)
        dateFilter = `AND c.approved_at >= '${firstDayOfYear.toISOString()}'`
      }

      // Query to get leaderboard data
      const { data, error } = await supabase.rpc('get_leaderboard', {
        period_filter: timePeriod
      })

      if (error) {
        console.error('Leaderboard query error:', error)
        throw error
      }

      setLeaderboard(data || [])
    } catch (error: any) {
      console.error('Error loading leaderboard:', error)
      toast.error('Failed to load leaderboard')
    } finally {
      setLoading(false)
    }
  }

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-6 h-6 text-yellow-500" />
      case 2:
        return <Medal className="w-6 h-6 text-gray-400" />
      case 3:
        return <Award className="w-6 h-6 text-amber-600" />
      default:
        return <span className="text-lg font-bold text-gray-500">#{rank}</span>
    }
  }

  const getRankBadgeColor = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-gradient-to-r from-yellow-400 to-yellow-600 shadow-lg shadow-yellow-500/50'
      case 2:
        return 'bg-gradient-to-r from-gray-300 to-gray-500 shadow-lg shadow-gray-400/50'
      case 3:
        return 'bg-gradient-to-r from-amber-400 to-amber-600 shadow-lg shadow-amber-500/50'
      default:
        return 'bg-white border border-gray-200'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const currentUserEntry = leaderboard.find(entry => entry.member_id === currentUserId)

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <TrendingUp className="w-8 h-8 text-blue-600" />
                Leaderboard
              </h1>
              <p className="text-gray-600 mt-2">
                Top contributors ranked by contribution points
              </p>
            </div>

            {/* Time Period Filter */}
            <div className="flex items-center gap-2 bg-white rounded-lg shadow-sm p-1">
              <button
                onClick={() => setTimePeriod('monthly')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  timePeriod === 'monthly'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Calendar className="w-4 h-4 inline mr-1" />
                This Month
              </button>
              <button
                onClick={() => setTimePeriod('yearly')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  timePeriod === 'yearly'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Calendar className="w-4 h-4 inline mr-1" />
                This Year
              </button>
              <button
                onClick={() => setTimePeriod('all-time')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  timePeriod === 'all-time'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                All Time
              </button>
            </div>
          </div>
        </div>

        {/* Current User Stats Card */}
        {currentUserEntry && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium mb-1">Your Rank</p>
                <p className="text-3xl font-bold text-blue-900">#{currentUserEntry.rank}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-blue-600 font-medium mb-1">Total Points</p>
                <p className="text-3xl font-bold text-blue-900">{currentUserEntry.total_score}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-blue-600 font-medium mb-1">Contributions</p>
                <p className="text-3xl font-bold text-blue-900">{currentUserEntry.contribution_count}</p>
              </div>
            </div>
          </div>
        )}

        {/* Top 3 Podium */}
        {leaderboard.length >= 3 && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            {/* 2nd Place */}
            <div className="flex flex-col items-center mt-8">
              <div className={`${getRankBadgeColor(2)} rounded-2xl p-6 w-full text-center transform hover:scale-105 transition-transform`}>
                <div className="flex justify-center mb-3">
                  {getRankIcon(2)}
                </div>
                <div className="w-20 h-20 rounded-full bg-white mx-auto mb-3 flex items-center justify-center text-2xl font-bold text-gray-700">
                  {leaderboard[1].full_name.charAt(0).toUpperCase()}
                </div>
                <h3 className="font-bold text-gray-900 mb-1 truncate">
                  {leaderboard[1].full_name}
                </h3>
                <p className="text-2xl font-bold text-gray-900">{leaderboard[1].total_score}</p>
                <p className="text-sm text-gray-600">{leaderboard[1].contribution_count} contributions</p>
              </div>
            </div>

            {/* 1st Place */}
            <div className="flex flex-col items-center">
              <div className={`${getRankBadgeColor(1)} rounded-2xl p-6 w-full text-center transform hover:scale-105 transition-transform`}>
                <div className="flex justify-center mb-3">
                  {getRankIcon(1)}
                </div>
                <div className="w-24 h-24 rounded-full bg-white mx-auto mb-3 flex items-center justify-center text-3xl font-bold text-gray-700">
                  {leaderboard[0].full_name.charAt(0).toUpperCase()}
                </div>
                <h3 className="font-bold text-gray-900 mb-1 truncate text-lg">
                  {leaderboard[0].full_name}
                </h3>
                <p className="text-3xl font-bold text-gray-900">{leaderboard[0].total_score}</p>
                <p className="text-sm text-gray-600">{leaderboard[0].contribution_count} contributions</p>
              </div>
            </div>

            {/* 3rd Place */}
            <div className="flex flex-col items-center mt-8">
              <div className={`${getRankBadgeColor(3)} rounded-2xl p-6 w-full text-center transform hover:scale-105 transition-transform`}>
                <div className="flex justify-center mb-3">
                  {getRankIcon(3)}
                </div>
                <div className="w-20 h-20 rounded-full bg-white mx-auto mb-3 flex items-center justify-center text-2xl font-bold text-gray-700">
                  {leaderboard[2].full_name.charAt(0).toUpperCase()}
                </div>
                <h3 className="font-bold text-gray-900 mb-1 truncate">
                  {leaderboard[2].full_name}
                </h3>
                <p className="text-2xl font-bold text-gray-900">{leaderboard[2].total_score}</p>
                <p className="text-sm text-gray-600">{leaderboard[2].contribution_count} contributions</p>
              </div>
            </div>
          </div>
        )}

        {/* Full Leaderboard List */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rank
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Member
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Points
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contributions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {leaderboard.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                    No contributions found for this period
                  </td>
                </tr>
              ) : (
                leaderboard.map((entry) => (
                  <tr
                    key={entry.member_id}
                    className={`hover:bg-gray-50 transition-colors ${
                      entry.member_id === currentUserId ? 'bg-blue-50' : ''
                    }`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getRankIcon(entry.rank)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold">
                          {entry.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {entry.full_name}
                            {entry.member_id === currentUserId && (
                              <span className="ml-2 text-xs bg-blue-600 text-white px-2 py-1 rounded">
                                You
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500">{entry.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-lg font-bold text-gray-900">{entry.total_score}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{entry.contribution_count}</div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
