// Mock data for Second Unit
export const artists = [
  {
    id: 1, name: 'Maya Chen', role: 'AI Visual Artist', avatar: 'MC',
    skills: ['Midjourney', 'Stable Diffusion', 'ComfyUI', 'After Effects'],
    brands: ['Nike', 'Apple', 'Gucci'],
    rating: 4.9, projects: 127, hourlyRate: 250, dailyRate: 2000, projectFlatRate: 10000, available: true,
    bio: 'Award-winning AI visual artist specializing in fashion and luxury brand campaigns. Pioneering the fusion of generative AI with high-end commercial aesthetics.',
    portfolio: ['https://example.com/p1', 'https://example.com/p2'],
    videoLinks: ['https://vimeo.com/example1', 'https://youtube.com/example1'],
    socials: { twitter: '#', instagram: '#', website: 'https://mayachen.art', linkedin: '#' },
    location: 'Los Angeles, CA', joined: '2024-03-15',
    availability: [{ date: '2026-04-25', slots: ['10:00', '14:00', '16:00'] }, { date: '2026-04-28', slots: ['09:00', '11:00'] }],
  },
  {
    id: 2, name: 'Kai Reeves', role: 'AI Motion Designer', avatar: 'KR',
    skills: ['Runway', 'Pika Labs', 'Sora', 'Blender'],
    brands: ['Tesla', 'Adidas', 'Spotify'],
    rating: 4.8, projects: 98, hourlyRate: 220, dailyRate: 1760, projectFlatRate: 8800, available: true,
    bio: 'Motion design specialist leveraging cutting-edge AI video generation tools to create stunning brand narratives and advertisements.',
    portfolio: [], videoLinks: ['https://vimeo.com/example2'],
    socials: { twitter: '#', instagram: '#', website: 'https://kaireeves.io', linkedin: '#' },
    location: 'New York, NY', joined: '2024-01-10',
    availability: [{ date: '2026-04-24', slots: ['13:00', '15:00'] }],
  },
  {
    id: 3, name: 'Aria Nakamura', role: 'AI Music Producer', avatar: 'AN',
    skills: ['Suno', 'Udio', 'Ableton', 'AIVA'],
    brands: ['Sony Music', 'Beats', 'TikTok'],
    rating: 4.9, projects: 156, hourlyRate: 300, dailyRate: 2400, projectFlatRate: 12000, available: false,
    bio: 'Grammy-nominated producer pushing boundaries of AI-assisted music composition and sound design for major label releases and brand soundscapes.',
    portfolio: [], videoLinks: [],
    socials: { twitter: '#', instagram: '#', website: 'https://aria.music', linkedin: '#' },
    location: 'Tokyo, Japan', joined: '2023-11-20',
    availability: [],
  },
  {
    id: 4, name: 'Dex Okafor', role: 'AI 3D Artist', avatar: 'DO',
    skills: ['NeRF', 'Gaussian Splatting', 'Unreal Engine', 'Blender'],
    brands: ['Meta', 'Epic Games', 'BMW'],
    rating: 4.7, projects: 84, hourlyRate: 280, dailyRate: 2240, projectFlatRate: 11200, available: true,
    bio: 'Specializing in photorealistic 3D environments and virtual production using neural radiance fields and AI-enhanced workflows.',
    portfolio: [], videoLinks: ['https://youtube.com/example3'],
    socials: { twitter: '#', instagram: '#', website: '#', linkedin: '#' },
    location: 'London, UK', joined: '2024-02-05',
    availability: [{ date: '2026-04-23', slots: ['10:00', '12:00', '14:00', '16:00'] }],
  },
  {
    id: 5, name: 'Luna Vasquez', role: 'AI Fashion Designer', avatar: 'LV',
    skills: ['CLO3D', 'Midjourney', 'DALL-E', 'Photoshop'],
    brands: ['Balenciaga', 'H&M', 'Vogue'],
    rating: 4.8, projects: 112, hourlyRate: 260, dailyRate: 2080, projectFlatRate: 10400, available: true,
    bio: 'Digital fashion pioneer creating AI-generated collections and virtual garments for major fashion houses and digital platforms.',
    portfolio: [], videoLinks: [],
    socials: { twitter: '#', instagram: '#', website: '#', linkedin: '#' },
    location: 'Milan, Italy', joined: '2024-04-01',
    availability: [{ date: '2026-04-26', slots: ['09:00', '11:00', '15:00'] }],
  },
  {
    id: 6, name: 'Theo Park', role: 'AI Concept Artist', avatar: 'TP',
    skills: ['Stable Diffusion', 'ControlNet', 'Photoshop', 'Procreate'],
    brands: ['Marvel', 'Netflix', 'Riot Games'],
    rating: 4.9, projects: 203, hourlyRate: 240, dailyRate: 1920, projectFlatRate: 9600, available: true,
    bio: 'Veteran concept artist integrating AI tools into production pipelines for major entertainment studios. Known for cinematic world-building.',
    portfolio: [], videoLinks: ['https://youtube.com/example4'],
    socials: { twitter: '#', instagram: '#', website: '#', linkedin: '#' },
    location: 'Seoul, South Korea', joined: '2023-09-15',
    availability: [{ date: '2026-04-24', slots: ['10:00', '14:00'] }, { date: '2026-04-25', slots: ['09:00'] }],
  },
  {
    id: 7, name: 'Sage Williams', role: 'AI Animator', avatar: 'SW',
    skills: ['AnimateDiff', 'Runway', 'After Effects', 'Cinema 4D'],
    brands: ['Disney', 'Pixar', 'Coca-Cola'],
    rating: 4.6, projects: 67, hourlyRate: 200, dailyRate: 1600, projectFlatRate: 8000, available: true,
    bio: 'Animation specialist blending traditional techniques with AI-powered animation tools for feature films and commercials.',
    portfolio: [], videoLinks: [],
    socials: { twitter: '#', instagram: '#', website: '#', linkedin: '#' },
    location: 'Vancouver, Canada', joined: '2024-06-20',
    availability: [{ date: '2026-04-27', slots: ['11:00', '13:00', '15:00'] }],
  },
  {
    id: 8, name: 'Zara Kim', role: 'AI UX Designer', avatar: 'ZK',
    skills: ['Figma AI', 'Galileo', 'Framer', 'Webflow'],
    brands: ['Stripe', 'Notion', 'Figma'],
    rating: 4.8, projects: 91, hourlyRate: 230, dailyRate: 1840, projectFlatRate: 9200, available: false,
    bio: 'Designing the future of human-computer interaction through AI-augmented design systems and intelligent interfaces.',
    portfolio: [], videoLinks: [],
    socials: { twitter: '#', instagram: '#', website: '#', linkedin: '#' },
    location: 'San Francisco, CA', joined: '2024-05-10',
    availability: [],
  },
];

export const messages = [
  {
    id: 1, artistId: 1, artistName: 'Maya Chen', avatar: 'MC', unread: true,
    lastMessage: 'I\'d love to discuss the campaign details!', time: '2m ago',
    thread: [
      { id: 1, sender: 'user', text: 'Hi Maya! I saw your work on the Nike campaign and would love to discuss a similar project.', time: '10:30 AM' },
      { id: 2, sender: 'artist', text: 'Thank you! I\'d love to discuss the campaign details! What\'s the scope and timeline you\'re looking at?', time: '10:32 AM' },
    ],
  },
  {
    id: 2, artistId: 4, artistName: 'Dex Okafor', avatar: 'DO', unread: false,
    lastMessage: 'The 3D renders are ready for review.', time: '1h ago',
    thread: [
      { id: 1, sender: 'artist', text: 'Hey! I\'ve completed the initial 3D environment renders.', time: '9:00 AM' },
      { id: 2, sender: 'artist', text: 'The 3D renders are ready for review. Let me know your thoughts!', time: '9:15 AM' },
    ],
  },
  {
    id: 3, artistId: 6, artistName: 'Theo Park', avatar: 'TP', unread: true,
    lastMessage: 'I can start next Monday if the contract is signed.', time: '3h ago',
    thread: [
      { id: 1, sender: 'user', text: 'Theo, we\'d like to bring you on for our new game project.', time: 'Yesterday' },
      { id: 2, sender: 'artist', text: 'That sounds exciting! What kind of concept art are you looking for?', time: 'Yesterday' },
      { id: 3, sender: 'user', text: 'Sci-fi environments and character designs. 20 pieces total.', time: 'Today' },
      { id: 4, sender: 'artist', text: 'I can start next Monday if the contract is signed.', time: '3h ago' },
    ],
  },
];

export const bookings = [
  { id: 1, artistId: 1, artistName: 'Maya Chen', date: '2026-04-25', time: '10:00', duration: 2, status: 'confirmed', type: 'Consultation', rate: 250, pricingModel: 'hourly' },
  { id: 2, artistId: 4, artistName: 'Dex Okafor', date: '2026-04-23', time: '14:00', duration: 2, status: 'pending', type: 'Project Work', rate: 2240, pricingModel: 'daily' },
  { id: 3, artistId: 6, artistName: 'Theo Park', date: '2026-04-24', time: '10:00', duration: 1, status: 'confirmed', type: 'Full project', rate: 9600, pricingModel: 'flat' },
];

export const contracts = [
  { id: 1, artistId: 1, artistName: 'Maya Chen', title: 'Brand Campaign Q2 2026', status: 'active', value: 15000, startDate: '2026-04-01', endDate: '2026-06-30', type: 'standard' },
  { id: 2, artistId: 6, artistName: 'Theo Park', title: 'Game Concept Art Package', status: 'pending', value: 12000, startDate: '2026-04-28', endDate: '2026-07-28', type: 'custom' },
  { id: 3, artistId: 2, artistName: 'Kai Reeves', title: 'Product Launch Video', status: 'completed', value: 8500, startDate: '2026-01-15', endDate: '2026-03-15', type: 'standard' },
];

export const payments = [
  { id: 1, contractId: 1, artistName: 'Maya Chen', amount: 5000, date: '2026-04-01', status: 'paid', description: 'Milestone 1 - Initial Concepts' },
  { id: 2, contractId: 1, artistName: 'Maya Chen', amount: 5000, date: '2026-05-01', status: 'upcoming', description: 'Milestone 2 - Final Deliverables' },
  { id: 3, contractId: 3, artistName: 'Kai Reeves', amount: 8500, date: '2026-03-15', status: 'paid', description: 'Full Payment' },
  { id: 4, contractId: 2, artistName: 'Theo Park', amount: 4000, date: '2026-04-28', status: 'pending', description: 'Deposit - 33%' },
];
