-- Enable Supabase Realtime for messaging (works on Vercel without Socket.io).

alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversations;
