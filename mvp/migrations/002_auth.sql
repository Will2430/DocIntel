ALTER TABLE users
  ADD COLUMN IF NOT EXISTS google_sub TEXT;

ALTER TABLE users
  ALTER COLUMN password_hash DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_google_sub_idx ON users(google_sub);
