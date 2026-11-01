/*! <ov-icon> · the OpenVibe glyphs on any page · MIT · https://openvibe.design/icons */
/**
 * <script src="https://openvibe.design/ov-icon.js" defer></script>
 * <ov-icon name="heart"></ov-icon>                       follows the text: 1em, currentColor
 * <ov-icon name="mic" size="16" label="Microphone"></ov-icon>   a size in pixels; a label makes it an image to screen readers
 * <ov-icon name="fa-gear"></ov-icon>                     a Font Awesome name works too, and Lucide's or Material's:
 * <ov-icon name="lucide:settings"></ov-icon>  <ov-icon name="material:delete"></ov-icon>   (openvibe.design/icons/migrate)
 * <ov-icon name="bell" variant="solid"></ov-icon>        line | solid | auto (the default)
 * <ov-icon name="bell" motion="ring"></ov-icon>          draw | pop | nudge | ring | beat | shake: one move when it, or the
 *                                                        button or link it sits in, is pointed at or pressed (draw: on show;
 *                                                        shake: when it gets the attribute no). Nothing loops or spins.
 * <ov-icon name="heart" on></ov-icon>                    on: the solid drawing, as a control that is turned on
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
        + '.v-auto:not(.has-s) .l,.v-line .l{stroke-width:var(--ov-icon-stroke-small,2.4)}}'
        // On: the solid drawing, as for a control that is turned on (a liked heart), with one beat when it turns on.
        + ':host([on]) .has-s .l{display:none}:host([on]) .has-s .s{display:inline;animation:ovm-beat .5s ease-out}'
        // Motion (plan L50 step 7; openvibe.design/icons/pack/ov-icon-motion.css is the same for any SVG).
        + 'svg{transform-origin:50% 50%}'
        + ':host([motion=draw]) .l>*{stroke-dasharray:160;stroke-dashoffset:160;animation:ovm-draw .9s cubic-bezier(.65,0,.35,1) forwards}'
        + ':host([motion=draw]) .l>*:nth-child(2){animation-delay:.12s}:host([motion=draw]) .l>*:nth-child(n+3){animation-delay:.24s}'
        + ':host([motion=pop]) svg{transition:transform .32s cubic-bezier(.34,1.56,.64,1)}:host([motion=pop][data-press]) svg{transform:scale(.82);transition-duration:.08s}'
        + ':host([motion=nudge]) svg{transition:transform .28s cubic-bezier(.34,1.56,.64,1)}:host([motion=nudge][data-play]) svg{transform:translate(var(--ovm-x,2px),var(--ovm-y,0))}'
        + ':host([motion=ring]) svg{transform-origin:50% 12%}:host([motion=ring][data-play]) svg{animation:ovm-ring .9s cubic-bezier(.36,.07,.19,.97)}'
        + ':host([motion=beat]) svg{transform-origin:50% 55%}:host([motion=beat][data-play]) svg{animation:ovm-beat .7s ease-out}'
        + ':host([motion=shake][no]) svg{animation:ovm-shake .5s cubic-bezier(.36,.07,.19,.97)}'
        + '@keyframes ovm-draw{to{stroke-dashoffset:0}}'
        + '@keyframes ovm-ring{0%,100%{transform:rotate(0)}15%{transform:rotate(14deg)}32%{transform:rotate(-12deg)}50%{transform:rotate(8deg)}68%{transform:rotate(-5deg)}84%{transform:rotate(2deg)}}'
        + '@keyframes ovm-beat{0%,100%{transform:scale(1)}18%{transform:scale(1.2)}36%{transform:scale(.96)}54%{transform:scale(1.1)}72%{transform:scale(1)}}'
        + '@keyframes ovm-shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-3px)}40%{transform:translateX(3px)}60%{transform:translateX(-2px)}80%{transform:translateX(1px)}}'
        // Calm: the system's reduced motion or OpenVibe's (html[data-ov-motion="reduced"]) stops every move.
        + ':host([data-calm]) svg,:host([data-calm]) svg *{animation:none!important;transition:none!important}'
        + ':host([data-calm]) .l>*{stroke-dashoffset:0!important}:host([data-calm]) svg{transform:none!important}';
    var sheet = null;
    try { sheet = new CSSStyleSheet(); sheet.replaceSync(CSS); } catch (e) { sheet = null; }

    var live = new Set();
    var reduceMq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    function calm() { return !!(reduceMq && reduceMq.matches) || document.documentElement.getAttribute('data-ov-motion') === 'reduced'; }
    if (reduceMq && reduceMq.addEventListener) reduceMq.addEventListener('change', function () { live.forEach(function (el) { el._calm(); }); });
    function pref() {
        var p = document.documentElement.getAttribute('data-ov-icons');
        return p === 'line' || p === 'solid' ? p : 'auto';
    }
    new MutationObserver(function () { live.forEach(function (el) { el._look(); el._calm(); }); })
        .observe(document.documentElement, { attributes: true, attributeFilter: ['data-ov-icons', 'data-ov-motion'] });

    function OvIcon() { return Reflect.construct(HTMLElement, [], OvIcon); }
    OvIcon.prototype = Object.create(HTMLElement.prototype);
    OvIcon.prototype.constructor = OvIcon;
    Object.setPrototypeOf(OvIcon, HTMLElement);
    Object.defineProperty(OvIcon, 'observedAttributes', { get: function () { return ['name', 'size', 'variant', 'label', 'motion']; } });

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
        this._calm();
        this._wire();
        this._draw();
    };
    OvIcon.prototype.disconnectedCallback = function () { live.delete(this); this._unwire(); };
    OvIcon.prototype._calm = function () { this.toggleAttribute('data-calm', calm()); };
    // A move plays when the icon, or the button, link or label it sits in, is pointed at, focused or pressed.
    OvIcon.prototype._wire = function () {
        this._unwire();
        if (!this.hasAttribute('motion')) return;
        var self = this;
        var target = this.closest('a, button, label, summary, [role="button"], [role="menuitem"], [role="tab"]') || this;
        var on = function () { self.removeAttribute('data-play'); void self.offsetWidth; self.setAttribute('data-play', ''); };
        var off = function () { self.removeAttribute('data-play'); };
        var down = function () { self.setAttribute('data-press', ''); };
        var up = function () { self.removeAttribute('data-press'); };
        var ends = function (e) { if (self.getAttribute('motion') !== 'nudge' && e.target === self._svg) off(); };
        var pairs = [[target, 'pointerenter', on], [target, 'focusin', on], [target, 'pointerleave', off], [target, 'focusout', off],
            [target, 'pointerdown', down], [target, 'pointerup', up], [target, 'pointercancel', up], [target, 'pointerleave', up]];
        pairs.forEach(function (p) { p[0].addEventListener(p[1], p[2]); });
        if (this.shadowRoot) this.shadowRoot.addEventListener('animationend', ends);
        this._wired = function () { pairs.forEach(function (p) { p[0].removeEventListener(p[1], p[2]); }); if (self.shadowRoot) self.shadowRoot.removeEventListener('animationend', ends); };
    };
    OvIcon.prototype._unwire = function () { if (this._wired) { this._wired(); this._wired = null; } };
    OvIcon.prototype.attributeChangedCallback = function (attr, was, now) {
        if (!this._svg || was === now) return;
        if (attr === 'name') this._draw();
        else if (attr === 'size') this._size();
        else if (attr === 'label') this._label();
        else if (attr === 'motion') this._wire();
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
