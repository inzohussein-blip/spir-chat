-- ============================================================
-- A/B campaigns: an optional second message variant. When body_b is set,
-- the audience is split ~50/50 and each recipient's variant is logged so
-- the campaign report can compare the two.
-- ============================================================
alter table campaigns
  add column if not exists body_b text;

alter table campaign_recipients
  add column if not exists variant text not null default 'a' check (variant in ('a', 'b'));
