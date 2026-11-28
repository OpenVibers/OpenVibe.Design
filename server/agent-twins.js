'use strict';
// openvibe-sdk/site (0.174.0) is the one implementation every site shares (the consolidation of 2026-11-16).
// The Markdown twins of this site's public pages (SEO-1): the pages in TWIN_PATH_RE, rendered signed out.
const express = require('express');
const agentLayer = require('openvibe-shared/agent-layer');

// changes, progress and uploader since 11-28: llms.txt listed their twins and agents got a 404 (tools/llms-check.js).
const TWIN_PATH_RE = /^\/(?:arena|brand|changes|components|developers|fonts(?:\/make)?|forms|kit|loading|look|make|motion|progress|rules|see|system|themes|tokens|uploader|use|vectors\/make|t\/[A-Za-z0-9_-]+)?$/;
const twins = require('openvibe-sdk/site').createTwins({ express, agentLayer, paths: TWIN_PATH_RE });

module.exports = { TWIN_PATH_RE, mountTwins: twins.mountTwins, renderWithRouter: twins.renderWithRouter };
