/* The chat component's live demo (/components/chat): Shared's messages.js and ov-composer.js, exactly as every site's
   chat uses them (Live's stream chat, OpenVibe.Chat's rooms, Vibe). A message's actions are one cluster at its corner
   (rule 138); Edit puts the words in the box under an "Editing your message" bar; Reply names who. Nothing leaves this
   page: the demo keeps its messages here. */
(function () {
    'use strict';
    function start() {
        const list = document.getElementById('cr-chat-list');
        const box = document.getElementById('cr-chat-box');
        if (!list || !box || !window.OVMessages || !window.OpenVibeComposer) return;
        const me = 'you';
        const ago = (min) => new Date(Date.now() - min * 60000).toISOString();
        const messages = [
            { id: 1, sender_id: 'maticus', display_name: 'Maticus', message: 'Live now: building the robot arm', created_at: ago(9) },
            { id: 2, sender_id: 'you', display_name: 'You', message: 'Yo', created_at: ago(8) },
            { id: 3, sender_id: 'lucia', display_name: 'lucía', message: '¿A qué hora termina el stream?', created_at: ago(6), lang: 'Spanish', english: 'What time does the stream end?' },
            { id: 4, sender_id: 'maticus', display_name: 'Maticus', message: 'about an hour 🙂', created_at: ago(5) },
            { id: 5, sender_id: 'you', display_name: 'You', message: 'The edit button sits at the corner now', created_at: ago(4), edited_at: ago(3) },
        ];
        let view = 'room';
        let composer = null;
        const offer = (m, { mine }) => (mine ? ['reply', 'edit', 'copy'] : m.english ? ['reply', 'translate', 'copy'] : ['reply', 'copy']);
        const draw = () => OVMessages.render(list, { messages, view, me, actions: offer, onAction });
        function onAction(id, m) {
            if (id === 'reply') composer.reply({ name: m.display_name, text: m.message, data: { id: m.id, name: m.display_name, text: m.message } });
            else if (id === 'edit') composer.edit({ text: m.message, onSave: (text) => { m.message = text; m.edited_at = new Date().toISOString(); draw(); } });
            else if (id === 'translate' && m.english) { m.message = `${m.english} (from ${m.lang})`; delete m.english; draw(); }
            else if (id === 'copy' && navigator.clipboard) navigator.clipboard.writeText(m.message).catch(() => {});
        }
        composer = OpenVibeComposer.mount(box, {
            preset: 'chat', id: 'cr-chat-composer', placeholder: 'Write a message', noDraft: true,
            onSubmit: (v) => {
                messages.push({ id: Date.now(), sender_id: me, display_name: 'You', message: v.text, created_at: new Date().toISOString(), reply_to: v.reply ? { message: `${v.reply.name}: ${v.reply.text}` } : null });
                draw();
                list.scrollTop = list.scrollHeight;
            },
        });
        document.querySelectorAll('[data-cr-chat-view]').forEach((b) => b.addEventListener('click', () => {
            view = b.dataset.crChatView;
            document.querySelectorAll('[data-cr-chat-view]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
            draw();
        }));
        draw();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
