/*! <ov-icon> · the OpenVibe glyphs on any page · MIT · https://openvibe.design/icons */
/**
 * <script src="https://openvibe.design/ov-icon.js" defer></script>
 * <ov-icon name="heart"></ov-icon>                       follows the text: 1em, currentColor
 * <ov-icon name="mic" size="16" label="Microphone"></ov-icon>   a size in pixels; a label makes it an image to screen readers
 * <ov-icon name="fa-gear"></ov-icon>                     a Font Awesome name works too, and Lucide's or Material's:
 * <ov-icon name="lucide:settings"></ov-icon>  <ov-icon name="material:delete"></ov-icon>   (openvibe.design/icons/migrate)
 * <ov-icon name="bell" variant="solid"></ov-icon>        line | solid | auto (the default)
 *
 * Every size by itself: on auto, an icon 18 px or smaller shows its solid drawing when it has one (a container query,
 * so it follows the real size, not the attribute), and a glyph made only of lines draws them a little heavier there.
 * A person's own choice on OpenVibe (html[data-ov-icons="line"|"solid"]) wins over auto.
 *
 * The drawings come from the server the script came from, the names a page asks for in one request, kept for the
 * page's life. CSS: --ov-icon-size (1em), --ov-icon-stroke (2). Works in React 19, Vue, Svelte, Solid and plain HTML.
 */
(function () {
    'use strict';
    if (typeof window === 'undefined' || !window.customElements || window.customElements.get('ov-icon')) return;
    var script = document.currentScript;
    var BASE = 'https://openvibe.design';
    try { if (script && script.src) BASE = new URL(script.src).origin; } catch (e) { /* the default */ }
    var NAME = /^(?:(?:lucide|material|mui|fa):)?[a-z][a-z0-9_-]{0,47}$/;

    // ── The drawings: asked for together, kept for the page's life ──
    var known = Object.create(null);   // name → Promise<{ line, solid } | null>
    var waiting = Object.create(null); // name → resolve
    var timer = 0;
    function flush() {
        timer = 0;
        var names = Object.keys(waiting);
        var batch = waiting;
        waiting = Object.create(null);
        for (var i = 0; i < names.length; i += 60) {
            (function (part) {
                fetch(BASE + '/api/v1/glyphs?draw=1&names=' + encodeURIComponent(part.join(',')), { credentials: 'omit' })
                    .then(function (r) { return r.ok ? r.json() : { glyphs: [] }; })
                    .catch(function () { return { glyphs: [] }; })
                    .then(function (j) {
                        var got = Object.create(null);
                        (j.glyphs || []).forEach(function (g) { got[g.asked || g.name] = g; });
                        part.forEach(function (n) {
                            var g = got[n];
                            batch[n](g && g.svg ? { line: String(g.svg), solid: String(g.solid || '') } : null);
                        });
                    });
            })(names.slice(i, i + 60));
        }
    }
    function load(name) {
        if (!known[name]) {
            known[name] = new Promise(function (resolve) { waiting[name] = resolve; });
            if (!timer) timer = setTimeout(flush, 0);
        }
        return known[name];
    }

    // ── How it looks: the line drawing, or the solid one when small or asked ──
    var CSS = ':host{display:inline-block;inline-size:var(--ov-icon-size,1em);block-size:var(--ov-icon-size,1em);flex:none;vertical-align:-.125em;line-height:0;contain:layout style;container-type:size}'
        + 'svg{display:block;inline-size:100%;block-size:100%;overflow:visible}'
        + '.l{fill:none;stroke:currentColor;stroke-width:var(--ov-icon-stroke,2);stroke-linecap:round;stroke-linejoin:round}'
        + '.s{display:none;fill:currentColor;stroke:none}'
        + '.s .ln{fill:none;stroke:currentColor;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round}'
        + '.v-solid.has-s .l{display:none}.v-solid.has-s .s{display:inline}'
        + '@container (max-width: 18px){'
        + '.v-auto.has-s .l{display:none}.v-auto.has-s .s{display:inline}'
        + '.v-auto:not(.has-s) .l,.v-line .l{stroke-width:var(--ov-icon-stroke-small,2.4)}}';
    var sheet = null;
    try { sheet = new CSSStyleSheet(); sheet.replaceSync(CSS); } catch (e) { sheet = null; }

    var live = new Set();
    function pref() {
        var p = document.documentElement.getAttribute('data-ov-icons');
        return p === 'line' || p === 'solid' ? p : 'auto';
    }
    new MutationObserver(function () { live.forEach(function (el) { el._look(); }); })
        .observe(document.documentElement, { attributes: true, attributeFilter: ['data-ov-icons'] });

    function OvIcon() { return Reflect.construct(HTMLElement, [], OvIcon); }
    OvIcon.prototype = Object.create(HTMLElement.prototype);
    OvIcon.prototype.constructor = OvIcon;
    Object.setPrototypeOf(OvIcon, HTMLElement);
    Object.defineProperty(OvIcon, 'observedAttributes', { get: function () { return ['name', 'size', 'variant', 'label']; } });

    OvIcon.prototype.connectedCallback = function () {
        if (!this.shadowRoot) {
            var root = this.attachShadow({ mode: 'open' });
            if (sheet && 'adoptedStyleSheets' in root) root.adoptedStyleSheets = [sheet];
            else { var st = document.createElement('style'); st.textContent = CSS; root.appendChild(st); }
            this._svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            this._svg.setAttribute('viewBox', '0 0 24 24');
            this._svg.setAttribute('aria-hidden', 'true');
            this._svg.setAttribute('focusable', 'false');
            root.appendChild(this._svg);
        }
        live.add(this);
        this._size();
        this._label();
        this._draw();
    };
    OvIcon.prototype.disconnectedCallback = function () { live.delete(this); };
    OvIcon.prototype.attributeChangedCallback = function (attr, was, now) {
        if (!this._svg || was === now) return;
        if (attr === 'name') this._draw();
        else if (attr === 'size') this._size();
        else if (attr === 'label') this._label();
        else this._look();
    };
    OvIcon.prototype._size = function () {
        var s = Number(this.getAttribute('size'));
        if (s > 0 && s <= 1024) this.style.setProperty('--ov-icon-size', s + 'px');
        else this.style.removeProperty('--ov-icon-size');
    };
    OvIcon.prototype._label = function () {
        var label = (this.getAttribute('label') || '').trim();
        if (label) { this.setAttribute('role', 'img'); this.setAttribute('aria-label', label); this.removeAttribute('aria-hidden'); }
        else { this.removeAttribute('role'); this.removeAttribute('aria-label'); this.setAttribute('aria-hidden', 'true'); }
    };
    OvIcon.prototype._look = function () {
        var v = this.getAttribute('variant');
        if (v !== 'line' && v !== 'solid' && v !== 'auto') v = pref();
        this._svg.setAttribute('class', 'v-' + v + (this._hasSolid ? ' has-s' : ''));
    };
    OvIcon.prototype._draw = function () {
        var self = this;
        var name = String(this.getAttribute('name') || '').trim().toLowerCase();
        this._want = name;
        if (!NAME.test(name)) { this._svg.innerHTML = ''; return; }
        load(name).then(function (g) {
            if (self._want !== name) return;
            self._hasSolid = !!(g && g.solid);
            // The drawings are the OpenVibe glyph registry's own shapes (paths, circles, rects), from this script's server.
            self._svg.innerHTML = g ? '<g class="l">' + g.line + '</g>' + (g.solid ? '<g class="s">' + g.solid + '</g>' : '') : '';
            self._look();
            self.toggleAttribute('data-missing', !g);
        });
    };
    window.customElements.define('ov-icon', OvIcon);
})();
