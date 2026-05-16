-- supabase/migrations/006_subscriptions.sql
-- Phase 5 table — created now for schema completeness.
-- Tracks YooKassa subscription state per user.
CREATE TYPE subscription_status AS ENUM ('active', 'cancelled', 'expired');

CREATE TABLE subscriptions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES profiles ON DELETE CASCADE,
  plan                 plan_type NOT NULL DEFAULT 'free',
  status               subscription_status NOT NULL DEFAULT 'active',
  yookassa_payment_id  text,
  current_period_end   timestamptz
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE INDEX ON subscriptions (user_id);
