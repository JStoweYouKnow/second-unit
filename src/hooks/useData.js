import { useState, useEffect, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { artists as mockArtists } from '../data/mockData'

/**
 * Fetches all artists with their skills and brands.
 * Falls back to mock data when Supabase isn't configured.
 */
export function useArtists({ search = '', roleFilter = 'all' } = {}) {
  const [artists, setArtists] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchArtists = useCallback(async () => {
    setLoading(true)
    setError(null)

    if (!isSupabaseConfigured) {
      // Mock mode
      let filtered = [...mockArtists]
      if (roleFilter !== 'all') {
        filtered = filtered.filter(a => a.role === roleFilter)
      }
      if (search) {
        const q = search.toLowerCase()
        filtered = filtered.filter(a =>
          a.name.toLowerCase().includes(q) ||
          a.role.toLowerCase().includes(q) ||
          a.skills.some(s => s.toLowerCase().includes(q))
        )
      }
      setArtists(filtered)
      setLoading(false)
      return
    }

    try {
      let query = supabase
        .from('artists')
        .select(`
          *,
          profile:profiles!artists_profile_id_fkey(email, avatar_url),
          skills:artist_skills(skill:skills(name)),
          brands:artist_brands(brand:brands(name))
        `)
        .order('rating', { ascending: false })

      if (roleFilter !== 'all') {
        query = query.eq('role_title', roleFilter)
      }

      if (search) {
        query = query.or(`display_name.ilike.%${search}%,role_title.ilike.%${search}%,bio.ilike.%${search}%`)
      }

      const { data, error: fetchError } = await query
      if (fetchError) throw fetchError

      // Flatten nested joins
      const formatted = data.map(a => ({
        id: a.id,
        profileId: a.profile_id,
        name: a.display_name,
        role: a.role_title,
        avatar: a.display_name.split(' ').map(n => n[0]).join(''),
        bio: a.bio,
        hourlyRate: a.hourly_rate,
        location: a.location,
        available: a.available,
        rating: parseFloat(a.rating),
        projects: a.total_projects,
        skills: a.skills?.map(s => s.skill.name) || [],
        brands: a.brands?.map(b => b.brand.name) || [],
        videoLinks: a.video_links || [],
        socials: {
          twitter: a.twitter || '#',
          instagram: a.instagram || '#',
          linkedin: a.linkedin || '#',
          website: a.website || '#',
        },
        joined: a.created_at,
      }))

      setArtists(formatted)
    } catch (err) {
      setError(err.message)
      // Fallback to mock on error
      setArtists(mockArtists)
    } finally {
      setLoading(false)
    }
  }, [search, roleFilter])

  useEffect(() => { fetchArtists() }, [fetchArtists])

  return { artists, loading, error, refetch: fetchArtists }
}

/**
 * Fetches a single artist by ID.
 */
export function useArtist(id) {
  const [artist, setArtist] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return

    if (!isSupabaseConfigured) {
      const found = mockArtists.find(a => a.id === parseInt(id) || a.id === id)
      setArtist(found || null)
      setLoading(false)
      return
    }

    async function fetch() {
      const { data } = await supabase
        .from('artists')
        .select(`
          *,
          skills:artist_skills(skill:skills(name)),
          brands:artist_brands(brand:brands(name)),
          portfolio:portfolio_items(*),
          availability:availability_slots(*)
        `)
        .eq('id', id)
        .single()

      if (data) {
        setArtist({
          id: data.id,
          profileId: data.profile_id,
          name: data.display_name,
          role: data.role_title,
          avatar: data.display_name.split(' ').map(n => n[0]).join(''),
          bio: data.bio,
          hourlyRate: data.hourly_rate,
          location: data.location,
          available: data.available,
          rating: parseFloat(data.rating),
          projects: data.total_projects,
          skills: data.skills?.map(s => s.skill.name) || [],
          brands: data.brands?.map(b => b.brand.name) || [],
          videoLinks: data.video_links || [],
          socials: {
            twitter: data.twitter || '#',
            instagram: data.instagram || '#',
            linkedin: data.linkedin || '#',
            website: data.website || '#',
          },
          joined: data.created_at,
          portfolio: data.portfolio || [],
          availability: data.availability || [],
        })
      }
      setLoading(false)
    }

    fetch()
  }, [id])

  return { artist, loading }
}

/**
 * Manages favorites for the current user.
 */
export function useFavorites(userId) {
  const [favorites, setFavorites] = useState([1, 6]) // Default mock favorites
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isSupabaseConfigured || !userId) return

    async function fetch() {
      setLoading(true)
      const { data } = await supabase
        .from('favorites')
        .select('artist_id')
        .eq('employer_id', userId)
      setFavorites(data?.map(f => f.artist_id) || [])
      setLoading(false)
    }

    fetch()
  }, [userId])

  const toggleFavorite = async (artistId) => {
    const isFav = favorites.includes(artistId)

    // Optimistic update
    setFavorites(prev =>
      isFav ? prev.filter(id => id !== artistId) : [...prev, artistId]
    )

    if (!isSupabaseConfigured) return

    if (isFav) {
      await supabase
        .from('favorites')
        .delete()
        .eq('employer_id', userId)
        .eq('artist_id', artistId)
    } else {
      await supabase
        .from('favorites')
        .insert({ employer_id: userId, artist_id: artistId })
    }
  }

  return { favorites, toggleFavorite, loading }
}
