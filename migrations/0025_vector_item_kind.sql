-- phase: expand
-- Item icons (2026-11-16; the owner: item icons drawn as emoji look cheap, "item icon generation" on openvibe.design):
-- the vector maker gets the kind item, an icon in the house item style (server/vectors/item-style.js). The kind check
-- is widened, never narrowed.

ALTER TABLE ai_vectors DROP CONSTRAINT IF EXISTS ai_vectors_kind;
ALTER TABLE ai_vectors ADD CONSTRAINT ai_vectors_kind CHECK (kind IN ('icon', 'illustration', 'pattern', 'item'));
