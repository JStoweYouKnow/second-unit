-- =============================================
-- Seed data for development/demo
-- Run after schema.sql in Supabase SQL Editor
-- =============================================

-- Skills
insert into skills (name) values
  ('Midjourney'), ('Stable Diffusion'), ('ComfyUI'), ('After Effects'),
  ('Runway'), ('Pika Labs'), ('Sora'), ('Blender'),
  ('Suno'), ('Udio'), ('Ableton'), ('AIVA'),
  ('NeRF'), ('Gaussian Splatting'), ('Unreal Engine'),
  ('CLO3D'), ('DALL-E'), ('Photoshop'),
  ('ControlNet'), ('Procreate'),
  ('AnimateDiff'), ('Cinema 4D'),
  ('Figma AI'), ('Galileo'), ('Framer'), ('Webflow');

-- Brands
insert into brands (name) values
  ('Nike'), ('Apple'), ('Gucci'), ('Tesla'), ('Adidas'), ('Spotify'),
  ('Sony Music'), ('Beats'), ('TikTok'), ('Meta'), ('Epic Games'), ('BMW'),
  ('Balenciaga'), ('H&M'), ('Vogue'), ('Marvel'), ('Netflix'), ('Riot Games'),
  ('Disney'), ('Pixar'), ('Coca-Cola'), ('Stripe'), ('Notion'), ('Figma');
