-- Run this in your Supabase SQL Editor
-- Go to: https://supabase.com → Your Project → SQL Editor → New Query

create table if not exists shield_referrals (
  id               uuid primary key default gen_random_uuid(),
  -- Referrer (person sending the referral)
  referrer_name    text not null,
  referrer_phone   text not null,
  referrer_email   text,
  -- Referred person
  referred_name    text not null,
  referred_phone   text,
  referred_email   text,
  -- Plan
  plan_type        text not null check (plan_type in ('guardian', 'sentinel')),
  -- Status: pending → confirmed → applied
  status           text not null default 'pending' check (status in ('pending', 'confirmed', 'applied')),
  reward_applied   boolean default false,
  notes            text,
  -- Timestamps
  created_at       timestamptz default now(),
  confirmed_at     timestamptz
);

-- Disable RLS (same as GenFlow setup)
alter table shield_referrals disable row level security;
