'use strict';

// Iconify is the temporary reference source until Exchange exposes /v1/search/icons.
// The model receives names and concepts only; SVG paths are never sent to it.
const API = 'https://api.iconify.design';

async function searchReferences(query, { fetchImpl = globalThis.fetch, limit = 5 } = {}) {
    const q = String(query || '').trim().slice(0, 120);
    if (!q) return [];
    const url = new URL('/search', API);
    url.searchParams.set('query', q);
    url.searchParams.set('limit', String(Math.min(Math.max(Number(limit) || 5, 1), 8)));
    const response = await fetchImpl(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`Icon references returned ${response.status}`);
    const body = await response.json();
    return (Array.isArray(body.icons) ? body.icons : []).slice(0, 8).flatMap((fullName) => {
        const [prefix, name] = String(fullName).split(':');
        const collection = body.collections && body.collections[prefix];
        const license = collection && collection.license;
        if (!/^[a-z0-9-]+$/.test(prefix || '') || !/^[a-z0-9-]+$/.test(name || '') || !license || !license.spdx) return [];
        return [{ name, set: prefix, setName: String(collection.name || prefix).slice(0, 100),
            author: String((collection.author && collection.author.name) || '').slice(0, 100),
            license: String(license.spdx).slice(0, 80), licenseUrl: String(license.url || '').slice(0, 300),
            preview: `${API}/${prefix}/${name}.svg` }];
    });
}

module.exports = { searchReferences };
