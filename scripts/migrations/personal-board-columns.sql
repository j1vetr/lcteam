BEGIN;
CREATE TABLE IF NOT EXISTS personal_columns (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  status text NOT NULL,
  position integer NOT NULL
);
CREATE INDEX IF NOT EXISTS personal_columns_user_idx ON personal_columns(user_id);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS personal_column_id integer
  REFERENCES personal_columns(id) ON DELETE RESTRICT;
COMMIT;
