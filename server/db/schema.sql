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
