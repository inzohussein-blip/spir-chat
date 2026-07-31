-- Website live-chat widget: allow a "website" channel platform.
--
-- The original channels.platform check (00001) only covered the social networks
-- reachable through Zernio. A website channel is served entirely by SpirChat's
-- own Supabase-backed inbox (no Zernio), so widen the constraint. whatsapp is
-- included to match the Platform type already used in the app.
alter table channels drop constraint channels_platform_check;

alter table channels add constraint channels_platform_check
  check (platform in (
    'facebook', 'instagram', 'twitter', 'telegram',
    'bluesky', 'reddit', 'whatsapp', 'website'
  ));

-- Website conversations are polled by created_at within a conversation; the
-- existing idx_messages_conversation (conversation_id, created_at) already
-- covers that access pattern, so no new index is required.
