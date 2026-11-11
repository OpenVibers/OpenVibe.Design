-- phase: expand
-- OpenVibe Elements stage 2 (2026-11-11): Design /create gets the kind Element. A design of this kind stores a
-- validated ui.element@1 document in each variant instead of an HTML take, and remembers where the picked element
-- was added: Live's element library and the Exchange gallery. The kind check is widened, never narrowed, and the
-- two links are JSONB so a failed hand-off leaves its plain reason beside the element.

ALTER TABLE designs DROP CONSTRAINT IF EXISTS designs_kind;
ALTER TABLE designs ADD CONSTRAINT designs_kind
    CHECK (kind IN ('page', 'screen', 'component', 'slide', 'email', 'social-card', 'mark', 'element'));

ALTER TABLE designs ADD COLUMN IF NOT EXISTS element_channel jsonb;
ALTER TABLE designs ADD COLUMN IF NOT EXISTS element_listing jsonb;
