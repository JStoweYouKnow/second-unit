-- SMS text alerts (Twilio) — optional mobile number on profile.
-- Run after notifications.sql / push-subscriptions.sql

alter table profiles
  add column if not exists phone text;

comment on column profiles.phone is 'E.164 mobile number for SMS alerts (optional)';
