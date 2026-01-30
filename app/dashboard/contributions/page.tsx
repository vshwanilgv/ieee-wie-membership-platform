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
  approved_at: string | null
  created_at: string
  contribution_type_id: string
  contribution_types: ContributionType
  contribution_evidence: { id: string; file_path: string }[]
}

// Component to handle async image loading
function CardImage({ filePath }: { filePath: string }) {
  const [imageUrl, setImageUrl] = useState<string>('')
  const supabase = createClient()

  useEffect(() => {
    const loadImage = async () => {
      const { data } = await supabase.storage
        .from('activity-evidence')
        .createSignedUrl(filePath, 3600)
      
      if (data?.signedUrl) {
        setImageUrl(data.signedUrl)
      }
    }
    loadImage()
  }, [filePath])

  if (!imageUrl) {
    return <div className="w-full h-full bg-gray-200 animate-pulse" />
  }

  return (
    <Image
      src={imageUrl}
      alt="Evidence"
      width={128}
      height={128}
      className="w-full h-full object-cover"
    />
  )
}

// Component for modal image display
function ModalImage({ evidence }: { evidence: { id: string; file_path: string } }) {
  const [imageUrl, setImageUrl] = useState<string>('')
  const supabase = createClient()

  useEffect(() => {
    const loadImage = async () => {
      const { data } = await supabase.storage
        .from('activity-evidence')
        .createSignedUrl(evidence.file_path, 3600)
      
      if (data?.signedUrl) {
        setImageUrl(data.signedUrl)
      }
    }
    loadImage()
  }, [evidence.file_path])

  if (!imageUrl) {
    return <div className="aspect-square rounded-lg bg-gray-200 animate-pulse" />
  }

  return (
    <div className="aspect-square rounded-lg overflow-hidden group relative">
      <Image
        src={imageUrl}
        alt="Evidence"
        width={200}
        height={200}
        className="w-full h-full object-cover transition-transform group-hover:scale-110"
      />
      <a
        href={imageUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-white opacity-0 group-hover:opacity-100 text-sm font-medium">
          View Full
        </span>
      </a>
    </div>
  )
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
  const [existingEvidence, setExistingEvidence] = useState<{id: string, file_path: string}[]>([])
  const [selectedContribution, setSelectedContribution] = useState<Contribution | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [editingContribution, setEditingContribution] = useState<Contribution | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

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

  const removeExistingEvidence = (index: number) => {
    setExistingEvidence(prev => prev.filter((_, i) => i !== index))
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

      let contribution: any

      if (editingContribution) {
        // Update existing contribution
        const { data, error: updateError } = await supabase
          .from('contributions')
          .update({
            title: formData.title.trim(),
            description: formData.description.trim(),
            contribution_type_id: formData.contribution_type_id,
            activity_date: formData.activity_date,
          })
          .eq('id', editingContribution.id)
          .select()
          .single()

        if (updateError) throw updateError
        contribution = data
        
        // Delete removed existing evidence
        const removedEvidence = editingContribution.contribution_evidence.filter(
          ev => !existingEvidence.find(e => e.id === ev.id)
        )
        
        if (removedEvidence.length > 0) {
          // Delete from storage
          const filePaths = removedEvidence.map(e => e.file_path)
          await supabase.storage.from('activity-evidence').remove(filePaths)
          
          // Delete from database
          await supabase
            .from('contribution_evidence')
            .delete()
            .in('id', removedEvidence.map(e => e.id))
        }
      } else {
        // Insert new contribution
        const { data, error: contributionError } = await supabase
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
        contribution = data
      }

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

      toast.success(editingContribution ? 'Contribution updated successfully!' : 'Contribution submitted successfully!')
      
      // Reset form
      setFormData({
        title: '',
        description: '',
        contribution_type_id: '',
        activity_date: '',
      })
      setSelectedFiles([])
      setPreviewUrls([])
      setExistingEvidence([])
      setShowAddForm(false)
      setEditingContribution(null)
      
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

  const openContributionDetail = (contribution: Contribution, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    if (showDetailModal) return // Prevent opening multiple modals
    setSelectedContribution(contribution)
    setShowDetailModal(true)
  }

  const closeDetailModal = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    setShowDetailModal(false)
    setTimeout(() => setSelectedContribution(null), 100)
  }

  const handleEdit = async (contribution: Contribution, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingContribution(contribution)
    setFormData({
      title: contribution.title,
      description: contribution.description,
      contribution_type_id: contribution.contribution_type_id,
      activity_date: contribution.activity_date,
    })
    
    // Store existing evidence
    setExistingEvidence(contribution.contribution_evidence)
    
    // Load existing images as signed URLs for preview
    if (contribution.contribution_evidence.length > 0) {
      const urls = await Promise.all(
        contribution.contribution_evidence.map(async (evidence) => {
          const { data, error } = await supabase.storage
            .from('activity-evidence')
            .createSignedUrl(evidence.file_path, 3600) // 1 hour expiry
          return data?.signedUrl || ''
        })
      )
      setPreviewUrls(urls.filter(url => url))
    }
    
    setShowAddForm(true)
  }

  const handleDelete = async (contributionId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    
    if (!confirm('Are you sure you want to delete this contribution? This action cannot be undone.')) {
      return
    }

    setDeleting(contributionId)

    try {
      // First delete all evidence photos from storage
      const contribution = contributions.find(c => c.id === contributionId)
      if (contribution?.contribution_evidence.length > 0) {
        const filePaths = contribution.contribution_evidence.map(e => e.file_path)
        await supabase.storage
          .from('activity-evidence')
          .remove(filePaths)
      }

      // Then delete the contribution record
      const { error } = await supabase
        .from('contributions')
        .delete()
        .eq('id', contributionId)

      if (error) throw error

      // Update local state immediately
      setContributions(prev => prev.filter(c => c.id !== contributionId))
      
      toast.success('Contribution deleted successfully')
    } catch (error: any) {
      console.error('Error deleting contribution:', error)
      toast.error('Failed to delete contribution')
      // Reload to ensure consistency
      await loadContributions()
    } finally {
      setDeleting(null)
    }
  }

  const handleCancelEdit = () => {
    setEditingContribution(null)
    setExistingEvidence([])
    setFormData({
      title: '',
      description: '',
      contribution_type_id: '',
      activity_date: '',
    })
    setSelectedFiles([])
    setPreviewUrls([])
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
            <h1 className="text-2xl sm:text-3xl font-bold">My Contributions</h1>
            <p className="text-purple-100 mt-1">Track and manage your activities</p>
          </div>
          {(filter === 'all' || filter === 'pending') && (
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-white text-purple-600 font-medium rounded-lg hover:bg-purple-50 transition-all shadow-md hover:shadow-lg"
            >
              <Plus size={18} />
              Add Contribution
            </button>
          )}
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
              <h2 className="text-xl font-bold">{editingContribution ? 'Edit Contribution' : 'Add New Contribution'}</h2>
              <button
                onClick={() => {
                  setShowAddForm(false)
                  handleCancelEdit()
                }}
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
                  {editingContribution && editingContribution.contribution_evidence.length > 0 && (
                    <span className="ml-2 text-xs text-gray-500">
                      ({editingContribution.contribution_evidence.length} existing photo{editingContribution.contribution_evidence.length > 1 ? 's' : ''})
                    </span>
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
                {(previewUrls.length > 0 || selectedFiles.length > 0) && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4">
                    {/* Existing evidence when editing */}
                    {editingContribution && previewUrls.map((url, index) => (
                      <div key={`existing-${index}`} className="relative group">
                        <Image
                          src={url}
                          alt={`Existing ${index + 1}`}
                          width={200}
                          height={200}
                          className="w-full h-32 object-cover rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => removeExistingEvidence(index)}
                          className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={16} />
                        </button>
                        <span className="absolute bottom-2 left-2 px-2 py-0.5 bg-blue-500 text-white text-xs rounded">Existing</span>
                      </div>
                    ))}
                    
                    {/* New files being added */}
                    {!editingContribution && previewUrls.map((url, index) => (
                      <div key={`new-${index}`} className="relative group">
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
                  onClick={() => {
                    setShowAddForm(false)
                    handleCancelEdit()
                  }}
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
                      {uploadingFiles ? 'Uploading...' : (editingContribution ? 'Updating...' : 'Submitting...')}
                    </>
                  ) : (
                    editingContribution ? 'Update Contribution' : 'Submit Contribution'
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
              {filter === 'all' || filter === 'pending'
                ? 'Start tracking your activities by adding your first contribution'
                : `You don't have any ${filter} contributions`}
            </p>
            {(filter === 'all' || filter === 'pending') && (
              <button
                onClick={() => setShowAddForm(true)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors"
              >
                <Plus size={18} />
                Add Contribution
              </button>
            )}
          </div>
        ) : (
          filteredContributions.map(contribution => (
            <div 
              key={contribution.id} 
              onClick={(e) => {
                if (!showDetailModal) {
                  openContributionDetail(contribution, e)
                }
              }}
              className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-all cursor-pointer hover:scale-[1.01]"
            >
              <div className="flex flex-col gap-4">
                {/* Header with title, status, and action buttons */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1">
                    <h3 className="text-lg font-bold text-gray-900">{contribution.title}</h3>
                    {getStatusBadge(contribution.status)}
                  </div>
                  {contribution.status === 'pending' && (
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => handleEdit(contribution, e)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                        </svg>
                      </button>
                      <button
                        onClick={(e) => handleDelete(contribution.id, e)}
                        disabled={deleting === contribution.id}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Delete"
                      >
                        {deleting === contribution.id ? (
                          <Loader2 size={18} className="animate-spin" />
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          </svg>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* Main content area with description and image */}
                <div className="flex gap-4">
                  <div className="flex-1">
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">{contribution.description}</p>
                    
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

                  {/* Evidence Photos Thumbnails */}
                  {contribution.contribution_evidence.length > 0 && (
                    <div className="flex-shrink-0">
                      <div className="w-32 h-32 rounded-lg overflow-hidden relative">
                        <CardImage 
                          filePath={contribution.contribution_evidence[0].file_path}
                        />
                        {contribution.contribution_evidence.length > 1 && (
                          <div className="absolute bottom-0 right-0 bg-black/70 text-white px-2 py-1 text-xs font-semibold rounded-tl-lg">
                            +{contribution.contribution_evidence.length - 1}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Contribution Detail Modal */}
      {showDetailModal && selectedContribution && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4"
          onClick={(e) => closeDetailModal(e)}
          style={{ isolation: 'isolate' }}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto relative z-[10000]"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
          >
            <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-blue-600 text-white p-6 flex items-center justify-between">
              <div className="flex-1">
                <h2 className="text-xl font-bold mb-1">{selectedContribution.title}</h2>
                <div className="flex items-center gap-2">
                  {getStatusBadge(selectedContribution.status)}
                  {selectedContribution.assigned_score !== null && (
                    <span className="px-3 py-1 bg-white/20 rounded-full text-sm font-semibold">
                      {selectedContribution.assigned_score} points
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => closeDetailModal(e)}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Activity Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-purple-50 rounded-lg">
                  <div className="flex items-center gap-2 text-purple-600 mb-1">
                    <Award size={18} />
                    <span className="text-sm font-semibold">Activity Type</span>
                  </div>
                  <p className="text-gray-900 font-medium">
                    {selectedContribution.contribution_types.name}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    {selectedContribution.contribution_types.min_score}-{selectedContribution.contribution_types.max_score} points
                  </p>
                </div>

                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-2 text-blue-600 mb-1">
                    <Calendar size={18} />
                    <span className="text-sm font-semibold">Activity Date</span>
                  </div>
                  <p className="text-gray-900 font-medium">
                    {format(new Date(selectedContribution.activity_date), 'MMMM dd, yyyy')}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    Submitted {format(new Date(selectedContribution.created_at), 'MMM dd, yyyy')}
                  </p>
                </div>
              </div>

              {/* Description */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Description</h3>
                <p className="text-gray-900 leading-relaxed bg-gray-50 p-4 rounded-lg">
                  {selectedContribution.description}
                </p>
              </div>

              {/* Evidence Photos */}
              {selectedContribution.contribution_evidence.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">
                    Evidence Photos ({selectedContribution.contribution_evidence.length})
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {selectedContribution.contribution_evidence.map((evidence) => (
                      <ModalImage key={evidence.id} evidence={evidence} />
                    ))}
                  </div>
                </div>
              )}

              {/* Approval Comment */}
              {selectedContribution.approval_comment && (
                <div className="p-4 bg-green-50 border-2 border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 text-green-700 mb-2">
                    <CheckCircle size={18} />
                    <span className="font-semibold">Approval Comment</span>
                  </div>
                  <p className="text-green-800">{selectedContribution.approval_comment}</p>
                </div>
              )}

              {/* Rejection Reason */}
              {selectedContribution.rejection_reason && (
                <div className="p-4 bg-red-50 border-2 border-red-200 rounded-lg">
                  <div className="flex items-center gap-2 text-red-700 mb-2">
                    <XCircle size={18} />
                    <span className="font-semibold">Rejection Reason</span>
                  </div>
                  <p className="text-red-800">{selectedContribution.rejection_reason}</p>
                </div>
              )}

              {/* Status Timeline */}
              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Timeline</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    <span>Submitted on {format(new Date(selectedContribution.created_at), 'MMM dd, yyyy \'at\' h:mm a')}</span>
                  </div>
                  {selectedContribution.status === 'approved' && (
                    <div className="flex items-center gap-2 text-green-600">
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      <span>Approved {selectedContribution.approved_at && `on ${format(new Date(selectedContribution.approved_at), 'MMM dd, yyyy \'at\' h:mm a')}`}</span>
                    </div>
                  )}
                  {selectedContribution.status === 'rejected' && (
                    <div className="flex items-center gap-2 text-red-600">
                      <div className="w-2 h-2 rounded-full bg-red-500"></div>
                      <span>Rejected {selectedContribution.approved_at && `on ${format(new Date(selectedContribution.approved_at), 'MMM dd, yyyy \'at\' h:mm a')}`}</span>
                    </div>
                  )}
                  {selectedContribution.status === 'pending' && (
                    <div className="flex items-center gap-2 text-yellow-600">
                      <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></div>
                      <span>Awaiting approval</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t p-6 bg-gray-50 flex justify-end">
              <button
                type="button"
                onClick={(e) => closeDetailModal(e)}
                className="px-6 py-2.5 bg-gray-600 text-white font-medium rounded-lg hover:bg-gray-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
