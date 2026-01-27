'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User, Mail, Phone, IdCard, Edit2, Save, X, Camera, Loader2 } from 'lucide-react'
import { toast } from 'react-hot-toast'
import Image from 'next/image'

interface Profile {
  id: string
  full_name: string
  email: string
  ieee_id: string | null
  phone: string | null
  photo_url: string | null
  bio: string | null
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [formData, setFormData] = useState({
    full_name: '',
    ieee_id: '',
    phone: '',
    bio: '',
  })
  const supabase = createClient()

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        toast.error('Not authenticated')
        return
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error) throw error

      setProfile(data)
      setFormData({
        full_name: data.full_name,
        ieee_id: data.ieee_id || '',
        phone: data.phone || '',
        bio: data.bio || '',
      })
    } catch (error: any) {
      toast.error('Failed to load profile')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file')
      return
    }

    // Validate file size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be less than 2MB')
      return
    }

    setUploading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}/avatar.${fileExt}`

      // Delete old photo if exists
      if (profile?.photo_url) {
        const oldPath = profile.photo_url.split('/').pop()
        if (oldPath) {
          await supabase.storage
            .from('profile-photos')
            .remove([`${user.id}/${oldPath}`])
        }
      }

      // Upload new photo
      const { error: uploadError } = await supabase.storage
        .from('profile-photos')
        .upload(fileName, file, { upsert: true })

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('profile-photos')
        .getPublicUrl(fileName)

      // Update profile with new photo URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ photo_url: publicUrl })
        .eq('id', user.id)

      if (updateError) throw updateError

      setProfile(prev => prev ? { ...prev, photo_url: publicUrl } : null)
      toast.success('Photo updated successfully!')
    } catch (error: any) {
      toast.error('Failed to upload photo')
      console.error(error)
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    if (!formData.full_name.trim()) {
      toast.error('Name is required')
      return
    }

    setSaving(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const updateData = {
        full_name: formData.full_name.trim(),
        ieee_id: formData.ieee_id.trim() || null,
        phone: formData.phone.trim() || null,
        bio: formData.bio.trim() || null,
      }

      const { data, error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.id)
        .select()

      if (error) {
        console.error('Update error:', error)
        throw new Error(error.message)
      }

      if (data && data.length > 0) {
        setProfile(data[0])
        setEditing(false)
        toast.success('Profile updated successfully!')
      } else {
        await loadProfile()
        setEditing(false)
        toast.success('Profile updated!')
      }
    } catch (error: any) {
      console.error('Save error:', error)
      toast.error(error.message || 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    if (profile) {
      setFormData({
        full_name: profile.full_name,
        ieee_id: profile.ieee_id || '',
        phone: profile.phone || '',
        bio: profile.bio || '',
      })
    }
    setEditing(false)
  }

  if (loading) {
    return (
      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl shadow-lg mb-6 p-6 sm:p-8 animate-pulse">
          <div className="h-8 bg-white/20 rounded w-1/3"></div>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-6 sm:p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="w-40 h-40 rounded-full bg-gray-200 animate-pulse"></div>
            <div className="mt-4 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-32 animate-pulse"></div>
              <div className="h-3 bg-gray-200 rounded w-40 animate-pulse"></div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className={i === 1 || i === 2 || i === 5 ? 'md:col-span-2' : ''}>
                <div className="h-4 bg-gray-200 rounded w-24 mb-2 animate-pulse"></div>
                <div className="h-12 bg-gray-100 rounded-xl animate-pulse"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Profile not found</p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Header Card */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl shadow-lg mb-6 p-6 sm:p-8 text-white">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">My Profile</h1>
            <p className="text-purple-100 mt-1">Manage your personal information</p>
          </div>
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-white text-purple-600 font-medium rounded-lg hover:bg-purple-50 transition-all shadow-md hover:shadow-lg"
            >
              <Edit2 size={18} />
              Edit Profile
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleCancel}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2.5 bg-white/20 backdrop-blur text-white font-medium rounded-lg hover:bg-white/30 transition-all disabled:opacity-50"
              >
                <X size={18} />
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-white text-purple-600 font-medium rounded-lg hover:bg-purple-50 transition-all shadow-md hover:shadow-lg disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Save size={18} />
                )}
                Save
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        {/* Profile Content */}
        <div className="p-6 sm:p-8">
          {/* Photo Section */}
          <div className="flex flex-col items-center mb-8">
            <div className="relative group">
              <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full overflow-hidden bg-gradient-to-br from-purple-100 to-blue-100 border-4 border-white shadow-xl ring-4 ring-purple-100 transition-all duration-300 group-hover:ring-purple-200">
                {profile.photo_url ? (
                  <Image
                    src={profile.photo_url}
                    alt={profile.full_name}
                    width={160}
                    height={160}
                    className="w-full h-full object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User className="w-20 h-20 text-purple-400" />
                  </div>
                )}
              </div>
              <label
                htmlFor="photo-upload"
                className="absolute bottom-2 right-2 w-12 h-12 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center cursor-pointer hover:scale-110 transition-transform shadow-lg group-hover:shadow-xl"
              >
                {uploading ? (
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                ) : (
                  <Camera className="w-6 h-6 text-white" />
                )}
              </label>
              <input
                id="photo-upload"
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                disabled={uploading}
                className="hidden"
              />
            </div>
            <div className="mt-4 text-center">
              <p className="text-sm font-medium text-gray-700">
                {profile.full_name}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Click camera icon to change photo
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                Max 2MB • JPG, PNG, WEBP
              </p>
            </div>
          </div>

          {/* Profile Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Full Name */}
            <div className="md:col-span-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <User size={16} className="text-purple-600" />
                </div>
                Full Name <span className="text-red-500">*</span>
              </label>
              {editing ? (
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all text-gray-900 font-medium"
                  placeholder="Enter your full name"
                />
              ) : (
                <div className="px-4 py-3 bg-gray-50 rounded-xl">
                  <p className="text-gray-900 font-medium text-lg">{profile.full_name}</p>
                </div>
              )}
            </div>

            {/* Email (read-only) */}
            <div className="md:col-span-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Mail size={16} className="text-blue-600" />
                </div>
                Email Address
              </label>
              <div className="px-4 py-3 bg-gray-50 rounded-xl border-2 border-gray-100">
                <p className="text-gray-700 font-medium">{profile.email}</p>
              </div>
              <p className="mt-1.5 text-xs text-gray-500 ml-10">
                Email cannot be changed
              </p>
            </div>

            {/* IEEE ID */}
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <IdCard size={16} className="text-green-600" />
                </div>
                IEEE Member ID
                <span className="text-gray-400 text-xs font-normal">(Optional)</span>
              </label>
              {editing ? (
                <input
                  type="text"
                  value={formData.ieee_id}
                  onChange={(e) => setFormData({ ...formData, ieee_id: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all text-gray-900"
                  placeholder="e.g., 12345678"
                />
              ) : (
                <div className="px-4 py-3 bg-gray-50 rounded-xl min-h-[52px] flex items-center">
                  <p className="text-gray-900">
                    {profile.ieee_id || <span className="text-gray-400 italic">Not provided</span>}
                  </p>
                </div>
              )}
            </div>

            {/* Phone */}
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Phone size={16} className="text-orange-600" />
                </div>
                Phone Number
                <span className="text-gray-400 text-xs font-normal">(Optional)</span>
              </label>
              {editing ? (
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all text-gray-900"
                  placeholder="e.g., +94 77 123 4567"
                />
              ) : (
                <div className="px-4 py-3 bg-gray-50 rounded-xl min-h-[52px] flex items-center">
                  <p className="text-gray-900">
                    {profile.phone || <span className="text-gray-400 italic">Not provided</span>}
                  </p>
                </div>
              )}
            </div>

            {/* Bio */}
            <div className="md:col-span-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <div className="w-8 h-8 bg-pink-100 rounded-lg flex items-center justify-center">
                  <Edit2 size={16} className="text-pink-600" />
                </div>
                Bio
                <span className="text-gray-400 text-xs font-normal">(Optional)</span>
              </label>
              {editing ? (
                <textarea
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all text-gray-900 resize-none"
                  placeholder="Tell us about yourself..."
                />
              ) : (
                <div className="px-4 py-3 bg-gray-50 rounded-xl min-h-[120px]">
                  <p className="text-gray-900 whitespace-pre-wrap">
                    {profile.bio || <span className="text-gray-400 italic">No bio added</span>}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
