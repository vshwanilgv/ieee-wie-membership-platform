'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Calendar, Award, Clock, CheckCircle, XCircle, Image as ImageIcon, Loader2, X } from 'lucide-react'
import { toast } from 'react-hot-toast'
import Image from 'next/image'
import { format } from 'date-fns'

interface ContributionType {
  id: string
  name: string
  description: string | null
  min_score: number
  max_score: number
  requires_evidence: boolean
}

interface Contribution {
  id: string
  title: string
  description: string
  activity_date: string
  status: 'pending' | 'approved' | 'rejected'
  assigned_score: number | null
  approval_comment: string | null
  rejection_reason: string | null
  created_at: string
  contribution_type_id: string
  contribution_types: ContributionType
  contribution_evidence: { id: string; file_path: string }[]
}

export default function ContributionsPage() {
  const [contributions, setContributions] = useState<Contribution[]>([])
  const [contributionTypes, setContributionTypes] = useState<ContributionType[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [submitting, setSubmitting] = useState(false)
  const [uploadingFiles, setUploadingFiles] = useState(false)
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    contribution_type_id: '',
    activity_date: '',
  })
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [previewUrls, setPreviewUrls] = useState<string[]>([])

  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    // Cleanup preview URLs
    return () => {
      previewUrls.forEach(url => URL.revokeObjectURL(url))
    }
  }, [previewUrls])

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Load contribution types
      const { data: types, error: typesError } = await supabase
        .from('contribution_types')
        .select('*')
        .order('name')

      console.log('Contribution types response:', { types, typesError })

      if (typesError) {
        console.error('Error loading contribution types:', typesError)
        toast.error(`Failed to load activity types: ${typesError.message}`)
        throw typesError
      }
      
      if (!types || types.length === 0) {
        console.warn('No contribution types found in database')
        toast.error('No activity types found. Please contact admin.')
      }
      
      setContributionTypes(types || [])

      // Load contributions
      await loadContributions()
    } catch (error: any) {
      console.error('Error loading data:', error)
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const loadContributions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('contributions')
        .select(`
          *,
          contribution_types (*),
          contribution_evidence (id, file_path)
        `)
        .eq('member_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setContributions(data || [])
    } catch (error: any) {
      console.error('Error loading contributions:', error)
      toast.error('Failed to load contributions')
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    
    // Validate files
    const validFiles = files.filter(file => {
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} is not an image`)
        return false
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} is larger than 5MB`)
        return false
      }
      return true
    })

    if (validFiles.length + selectedFiles.length > 5) {
      toast.error('Maximum 5 photos allowed')
      return
    }

    // Create preview URLs
    const newPreviewUrls = validFiles.map(file => URL.createObjectURL(file))
    
    setSelectedFiles(prev => [...prev, ...validFiles])
    setPreviewUrls(prev => [...prev, ...newPreviewUrls])
  }

  const removeFile = (index: number) => {
    URL.revokeObjectURL(previewUrls[index])
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
    setPreviewUrls(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.title.trim() || !formData.description.trim() || !formData.contribution_type_id || !formData.activity_date) {
      toast.error('Please fill in all required fields')
      return
    }

    const selectedType = contributionTypes.find(t => t.id === formData.contribution_type_id)
    if (selectedType?.requires_evidence && selectedFiles.length === 0) {
      toast.error('This activity type requires photo evidence')
      return
    }

    setSubmitting(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Insert contribution
      const { data: contribution, error: contributionError } = await supabase
        .from('contributions')
        .insert({
          member_id: user.id,
          title: formData.title.trim(),
          description: formData.description.trim(),
          contribution_type_id: formData.contribution_type_id,
          activity_date: formData.activity_date,
          status: 'pending',
        })
        .select()
        .single()

      if (contributionError) throw contributionError

      // Upload evidence photos
      if (selectedFiles.length > 0) {
        setUploadingFiles(true)
        
        for (let i = 0; i < selectedFiles.length; i++) {
          const file = selectedFiles[i]
          const fileExt = file.name.split('.').pop()
          const fileName = `${contribution.id}/${Date.now()}-${i}.${fileExt}`

          const { error: uploadError } = await supabase.storage
            .from('activity-evidence')
            .upload(fileName, file)

          if (uploadError) {
            console.error('Upload error:', uploadError)
            continue
          }

          // Save evidence record
          await supabase
            .from('contribution_evidence')
            .insert({
              contribution_id: contribution.id,
              file_path: fileName,
              file_size: file.size,
              mime_type: file.type,
            })
        }
      }

      toast.success('Contribution submitted successfully!')
      
      // Reset form
      setFormData({
        title: '',
        description: '',
        contribution_type_id: '',
        activity_date: '',
      })
      setSelectedFiles([])
      setPreviewUrls([])
      setShowAddForm(false)
      
      await loadContributions()
    } catch (error: any) {
      console.error('Error submitting contribution:', error)
      toast.error(error.message || 'Failed to submit contribution')
    } finally {
      setSubmitting(false)
      setUploadingFiles(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle size={14} />
            Approved
          </span>
        )
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircle size={14} />
            Rejected
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Clock size={14} />
            Pending
          </span>
        )
    }
  }

  const filteredContributions = contributions.filter(c => 
    filter === 'all' ? true : c.status === filter
  )

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
            <h1 className="text-2xl sm:text-3xl font-bold">My Contributions</h1>
            <p className="text-purple-100 mt-1">Track and manage your activities</p>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-white text-purple-600 font-medium rounded-lg hover:bg-purple-50 transition-all shadow-md hover:shadow-lg"
          >
            <Plus size={18} />
            Add Contribution
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white rounded-xl shadow-md p-4 mb-6">
        <div className="flex flex-wrap gap-2">
          {[
            { value: 'all', label: 'All' },
            { value: 'pending', label: 'Pending' },
            { value: 'approved', label: 'Approved' },
            { value: 'rejected', label: 'Rejected' },
          ].map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setFilter(value as any)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                filter === value
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Add Contribution Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-blue-600 text-white p-6 flex items-center justify-between">
              <h2 className="text-xl font-bold">Add New Contribution</h2>
              <button
                onClick={() => setShowAddForm(false)}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
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
                  placeholder="e.g., Organized Workshop on AI"
                  required
                />
              </div>

              {/* Contribution Type */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Activity Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.contribution_type_id}
                  onChange={(e) => setFormData({ ...formData, contribution_type_id: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all text-gray-900"
                  required
                >
                  <option value="">Select activity type</option>
                  {contributionTypes.map(type => (
                    <option key={type.id} value={type.id}>
                      {type.name} ({type.min_score}-{type.max_score} points)
                      {type.requires_evidence && ' - Evidence Required'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Activity Date */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Activity Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.activity_date}
                  onChange={(e) => setFormData({ ...formData, activity_date: e.target.value })}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all text-gray-900"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all text-gray-900 resize-none"
                  placeholder="Describe your contribution..."
                  required
                />
              </div>

              {/* Photo Upload */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Evidence Photos
                  {contributionTypes.find(t => t.id === formData.contribution_type_id)?.requires_evidence && (
                    <span className="text-red-500"> *</span>
                  )}
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-purple-500 transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">
                      Click to upload photos (Max 5 photos, 5MB each)
                    </p>
                  </label>
                </div>

                {/* Photo Previews */}
                {previewUrls.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4">
                    {previewUrls.map((url, index) => (
                      <div key={index} className="relative group">
                        <Image
                          src={url}
                          alt={`Preview ${index + 1}`}
                          width={200}
                          height={200}
                          className="w-full h-32 object-cover rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-all"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || uploadingFiles}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-medium rounded-xl hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting || uploadingFiles ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      {uploadingFiles ? 'Uploading...' : 'Submitting...'}
                    </>
                  ) : (
                    'Submit Contribution'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Contributions List */}
      <div className="space-y-4">
        {filteredContributions.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <Award className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No {filter !== 'all' && filter} contributions yet
            </h3>
            <p className="text-gray-600 mb-6">
              Start tracking your activities by adding your first contribution
            </p>
            <button
              onClick={() => setShowAddForm(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Plus size={18} />
              Add Contribution
            </button>
          </div>
        ) : (
          filteredContributions.map(contribution => (
            <div key={contribution.id} className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
                <div className="flex-1">
                  <div className="flex items-start gap-3 mb-2">
                    <h3 className="text-lg font-bold text-gray-900">{contribution.title}</h3>
                    {getStatusBadge(contribution.status)}
                  </div>
                  <p className="text-sm text-gray-600 mb-3">{contribution.description}</p>
                  
                  <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <Award className="w-4 h-4 text-purple-600" />
                      <span>{contribution.contribution_types.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-purple-600" />
                      <span>{format(new Date(contribution.activity_date), 'MMM dd, yyyy')}</span>
                    </div>
                    {contribution.assigned_score !== null && (
                      <div className="flex items-center gap-2 font-semibold text-purple-600">
                        <Award className="w-4 h-4" />
                        <span>{contribution.assigned_score} points</span>
                      </div>
                    )}
                  </div>

                  {contribution.approval_comment && (
                    <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-sm text-green-800">
                        <span className="font-semibold">Comment:</span> {contribution.approval_comment}
                      </p>
                    </div>
                  )}

                  {contribution.rejection_reason && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-800">
                        <span className="font-semibold">Reason:</span> {contribution.rejection_reason}
                      </p>
                    </div>
                  )}
                </div>

                {/* Evidence Photos */}
                {contribution.contribution_evidence.length > 0 && (
                  <div className="flex gap-2">
                    {contribution.contribution_evidence.slice(0, 3).map((evidence) => {
                      const { data: { publicUrl } } = supabase.storage
                        .from('activity-evidence')
                        .getPublicUrl(evidence.file_path)
                      
                      return (
                        <div key={evidence.id} className="w-20 h-20 rounded-lg overflow-hidden">
                          <Image
                            src={publicUrl}
                            alt="Evidence"
                            width={80}
                            height={80}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )
                    })}
                    {contribution.contribution_evidence.length > 3 && (
                      <div className="w-20 h-20 rounded-lg bg-gray-100 flex items-center justify-center">
                        <span className="text-sm font-semibold text-gray-600">
                          +{contribution.contribution_evidence.length - 3}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
