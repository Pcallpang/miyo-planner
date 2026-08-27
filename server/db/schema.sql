CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  google_sub text UNIQUE NOT NULL,
  email text,
  name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS google_tokens (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  enc_tokens text NOT NULL,
  calendar_id text NOT NULL DEFAULT 'primary',
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS app_state (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS procurement_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  purpose text,
  budget_item text,
  requester text,
  total_amount bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS procurement_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES procurement_requests(id) ON DELETE CASCADE,
  name text NOT NULL,
  spec text,
  unit text NOT NULL DEFAULT '개',
  qty integer NOT NULL DEFAULT 1,
  unit_price bigint NOT NULL DEFAULT 0,
  amount bigint NOT NULL DEFAULT 0,
  vendor text,
  source_url text,
  sort_order integer NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS feature_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS feature_request_votes (
  request_id uuid NOT NULL REFERENCES feature_requests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (request_id, user_id)
);
