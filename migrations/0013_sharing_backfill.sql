-- phase: migrate
-- Every design with a signed-in owner is registered once, Only me. A guest design is reached with its
-- own secret edit key and is not a share.v1 resource: it has no owner subject to give it to.
INSERT INTO shares (service, kind, resource_id, owner_subject, audience)
SELECT 'design', 'design', d.id, jsonb_build_object('type', 'user', 'id', d.owner), 'private'
FROM designs d
WHERE d.owner ~ '^usr_[0-9A-HJKMNP-TV-Z]{26}$'
ON CONFLICT (service, kind, resource_id) DO NOTHING;
