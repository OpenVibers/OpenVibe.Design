-- phase: expand
-- OpenVibe Elements stage 2 (2026-11-11, owner correction: the gallery lives on OpenVibe.Design, Exchange stays
-- the AI model catalogue): the free "Elements and packs" gallery beside /create. A listing is a validated
-- ui.element@1 document or a ui.element-pack@1 pack, with the maker, the original it remixes, and its counts.
-- Installs add the element to the person's Live channel and are one row each; ratings come only from people who
-- installed it; reports are rows for staff. Nothing here carries a price.

ALTER TABLE designs ADD COLUMN IF NOT EXISTS element_remix_of text;

CREATE TABLE IF NOT EXISTS design_element_listings (
    id              text COLLATE "C" PRIMARY KEY,        -- del_ + 26 Crockford base32 characters (ULID)
    slug            text COLLATE "C" NOT NULL UNIQUE,
    kind            text COLLATE "C" NOT NULL,           -- element | pack
    name            text NOT NULL,
    summary         text,
    document        jsonb NOT NULL,
    look            jsonb,
    author_subject  text,
    author_name     text NOT NULL,
    author_username text,
    source          text COLLATE "C" NOT NULL DEFAULT 'design',
    source_id       text,
    remix_of        text COLLATE "C" REFERENCES design_element_listings(id) ON DELETE SET NULL,
    official        boolean NOT NULL DEFAULT false,
    status          text COLLATE "C" NOT NULL DEFAULT 'published',
    installs        integer NOT NULL DEFAULT 0,
    rating_sum      integer NOT NULL DEFAULT 0,
    rating_count    integer NOT NULL DEFAULT 0,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT design_element_listings_kind CHECK (kind IN ('element', 'pack')),
    CONSTRAINT design_element_listings_source CHECK (source IN ('design', 'gallery', 'remix', 'official')),
    CONSTRAINT design_element_listings_status CHECK (status IN ('published', 'hidden')),
    CONSTRAINT design_element_listings_name CHECK (length(name) BETWEEN 2 AND 120),
    CONSTRAINT design_element_listings_summary CHECK (summary IS NULL OR length(summary) <= 600),
    CONSTRAINT design_element_listings_official CHECK (official = false OR author_subject IS NULL)
);

CREATE INDEX IF NOT EXISTS design_element_listings_published
    ON design_element_listings (status, created_at DESC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS design_element_listings_author
    ON design_element_listings (author_subject, created_at DESC);

CREATE TABLE IF NOT EXISTS design_element_installs (
    id          text COLLATE "C" PRIMARY KEY,
    listing_id  text COLLATE "C" NOT NULL REFERENCES design_element_listings(id) ON DELETE CASCADE,
    subject     text NOT NULL,
    channel     text,
    library     jsonb,                               -- what Live answered, or its plain error
    created_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT design_element_installs_once UNIQUE (listing_id, subject)
);
CREATE INDEX IF NOT EXISTS design_element_installs_subject ON design_element_installs (subject, created_at DESC);

CREATE TABLE IF NOT EXISTS design_element_ratings (
    id          text COLLATE "C" PRIMARY KEY,
    listing_id  text COLLATE "C" NOT NULL REFERENCES design_element_listings(id) ON DELETE CASCADE,
    subject     text NOT NULL,
    stars       integer NOT NULL,
    note        text,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT design_element_ratings_once UNIQUE (listing_id, subject),
    CONSTRAINT design_element_ratings_stars CHECK (stars BETWEEN 1 AND 5),
    CONSTRAINT design_element_ratings_note CHECK (note IS NULL OR length(note) <= 400)
);

CREATE TABLE IF NOT EXISTS design_element_reports (
    id          text COLLATE "C" PRIMARY KEY,
    listing_id  text COLLATE "C" NOT NULL REFERENCES design_element_listings(id) ON DELETE CASCADE,
    subject     text,
    reason      text COLLATE "C" NOT NULL,
    detail      text,
    status      text COLLATE "C" NOT NULL DEFAULT 'pending',
    reviewer_note text,
    reviewed_by text,
    reviewed_at timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT design_element_reports_reason CHECK (reason IN ('unsafe', 'broken', 'spam', 'other')),
    CONSTRAINT design_element_reports_status CHECK (status IN ('pending', 'accepted', 'rejected')),
    CONSTRAINT design_element_reports_detail CHECK (detail IS NULL OR length(detail) <= 1000)
);
CREATE INDEX IF NOT EXISTS design_element_reports_pending ON design_element_reports (status, created_at DESC);
