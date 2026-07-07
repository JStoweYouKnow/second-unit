import { useState, useEffect, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { groupSlotsByDate } from '../lib/availability'

const MOCK_ARTISTS = [
  {
    id: 'artist-001',
    profileId: 'mock-user-001',
    name: 'Emma Vance',
    role: 'AI Motion Designer',
    avatar: 'EV',
    bio: 'Emma is a visual designer specializing in generative AI workflows. She has worked with global fashion houses to design futuristic seasonal campaigns.',
    hourlyRate: 150,
    location: 'New York, NY',
    available: true,
    rating: 4.9,
    projects: 24,
    skills: ['Midjourney', 'Stable Diffusion', 'ComfyUI', 'After Effects'],
    brands: ['Gucci', 'Vogue', 'Apple'],
    videoLinks: [
      'https://vimeo.com/834816616',
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://vimeo.com/657896435'
    ],
    socials: {
      twitter: 'https://twitter.com',
      instagram: 'https://instagram.com',
      linkedin: 'https://linkedin.com',
      website: 'https://example.com',
    },
    joined: '2026-01-15',
    availabilitySlots: ['2026-06-15', '2026-06-16', '2026-06-18'],
    portfolio: [
      { id: 'p1', title: 'Neo-Tokyo Dreams', image: '', video: '', colorIdx: 0 },
      { id: 'p2', title: 'Cybernetic Couture', image: '', video: '', colorIdx: 1 },
      { id: 'p3', title: 'Digital Odyssey', image: '', video: '', colorIdx: 2 }
    ]
  },
  {
    id: 'artist-002',
    profileId: 'mock-user-002',
    name: 'Leo Thorne',
    role: 'AI Cinematic Director',
    avatar: 'LT',
    bio: 'Leo directs AI-native cinematic shorts and high-fidelity video trailers, blending generative video tools with professional sound design.',
    hourlyRate: 200,
    location: 'London, UK',
    available: true,
    rating: 5.0,
    projects: 18,
    skills: ['Runway', 'Sora', 'Pika Labs', 'Premiere Pro'],
    brands: ['Marvel', 'Netflix', 'Epic Games'],
    videoLinks: [
      'https://vimeo.com/347119253',
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://vimeo.com/17207620',
      'https://vimeo.com/83433604',
      'https://www.youtube.com/watch?v=9bZkp7q19f0'
    ],
    socials: {
      twitter: 'https://twitter.com',
      instagram: 'https://instagram.com',
      linkedin: 'https://linkedin.com',
      website: 'https://example.com',
    },
    joined: '2026-02-10',
    availabilitySlots: ['2026-06-15', '2026-06-17', '2026-06-19'],
    portfolio: [
      { id: 'p4', title: 'Chrono-Shift Trailer', image: '', video: '', colorIdx: 3 },
      { id: 'p5', title: 'Lost Worlds NeRF', image: '', video: '', colorIdx: 4 }
    ]
  }
]

/**
 * Fetches all artists with their skills and brands from Supabase.
 */
export function useArtists({ search = '', roleFilter = 'all' } = {}) {
  const [artists, setArtists] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchArtists = useCallback(async () => {
    setLoading(true)
    setError(null)

    if (!isSupabaseConfigured) {
      const q = search.toLowerCase()
      const filtered = MOCK_ARTISTS.filter(a => {
        if (roleFilter !== 'all' && a.role !== roleFilter) return false
        if (q && !a.name.toLowerCase().includes(q) && !a.role.toLowerCase().includes(q) && !a.skills.some(s => s.toLowerCase().includes(q))) return false
        return true
      })
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
          brands:artist_brands(brand:brands(name)),
          availability:availability_slots(*)
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

      const formatted = (data || []).map((a) => ({
        id: a.id,
        profileId: a.profile_id,
        name: a.display_name,
        role: a.role_title,
        avatar: a.display_name.split(' ').map((n) => n[0]).join(''),
        bio: a.bio,
        hourlyRate: a.hourly_rate,
        dailyRate: a.day_rate ?? undefined,
        projectFlatRate: a.project_flat_rate ?? undefined,
        location: a.location,
        available: a.available,
        rating: parseFloat(a.rating),
        projects: a.total_projects,
        skills: a.skills?.map((s) => s.skill.name) || [],
        brands: a.brands?.map((b) => b.brand.name) || [],
        videoLinks: a.video_links || [],
        availabilitySlots: a.availability?.filter(slot => !slot.is_booked).map(slot => slot.date) || [],
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
      setArtists([])
    } finally {
      setLoading(false)
    }
  }, [search, roleFilter])

  useEffect(() => {
    fetchArtists()
  }, [fetchArtists])

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
      const found = MOCK_ARTISTS.find(a => a.id === id)
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
          avatar: data.display_name.split(' ').map((n) => n[0]).join(''),
          bio: data.bio,
          hourlyRate: data.hourly_rate,
          dailyRate: data.day_rate ?? undefined,
          projectFlatRate: data.project_flat_rate ?? undefined,
          location: data.location,
          available: data.available,
          rating: parseFloat(data.rating),
          projects: data.total_projects,
          skills: data.skills?.map((s) => s.skill.name) || [],
          brands: data.brands?.map((b) => b.brand.name) || [],
          videoLinks: data.video_links || [],
          socials: {
            twitter: data.twitter || '#',
            instagram: data.instagram || '#',
            linkedin: data.linkedin || '#',
            website: data.website || '#',
          },
          joined: data.created_at,
          portfolio: [...(data.portfolio || [])].sort(
            (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
          ),
          availability: groupSlotsByDate(data.availability || []),
        })
      } else {
        setArtist(null)
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
  const [favorites, setFavorites] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isSupabaseConfigured || !userId) return

    async function fetch() {
      setLoading(true)
      const { data } = await supabase
        .from('favorites')
        .select('artist_id')
        .eq('employer_id', userId)
      setFavorites(data?.map((f) => f.artist_id) || [])
      setLoading(false)
    }

    fetch()
  }, [userId])

  const toggleFavorite = async (artistId) => {
    const isFav = favorites.includes(artistId)

    setFavorites((prev) =>
      isFav ? prev.filter((id) => id !== artistId) : [...prev, artistId]
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
