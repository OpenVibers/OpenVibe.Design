-- phase: expand
-- The component registry: one design.component@1 document per Shared kit component, its default example's HTML,
-- and where in openvibe-shared it came from (server/components/import.js). A new table; a release before this
-- one ignores it and keeps serving the hand-written definitions it shipped.
CREATE TABLE IF NOT EXISTS design_components (
    name text COLLATE "C" PRIMARY KEY,
    source text COLLATE "C" NOT NULL,
    definition jsonb NOT NULL,
    example_markup text NOT NULL DEFAULT '',
    imported_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS design_components_source_idx ON design_components (source);
