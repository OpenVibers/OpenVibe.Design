'use strict';
/**
 * The element preview's robot: OpenVibe.Bot's own arena (public/js/sim-world.js, copied) with the element's robot
 * actions played on a local rover. It is a picture, not a device: no command is sent anywhere, and the rover only
 * moves when the element's recipe says a robot action would run.
 */
(function () {
    var canvas = document.getElementById('el-sim');
    var world = window.OVSimWorld;
    if (!canvas || !world) return;
    var ctx = canvas.getContext('2d');
    var data = {};
    try { data = JSON.parse(document.getElementById('el-sim-data').textContent || '{}'); } catch (e) { return; }
    var actions = (data.actions || []).filter(function (a) { return a && a.kind === 'robot'; });
    var pose = { x: world.START.x, y: world.START.y, heading: world.START.heading };
    var headlights = false;
    var label = document.getElementById('el-sim-state');
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function scale() {
        var pad = 10;
        var w = world.COLS * world.CELL;
        var h = world.ROWS * world.CELL;
        var s = Math.min((canvas.width - pad * 2) / w, (canvas.height - pad * 2) / h);
        return { s: s, x: (canvas.width - w * s) / 2, y: (canvas.height - h * s) / 2 };
    }
    function draw() {
        var z = scale();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (var cy = 0; cy < world.ROWS; cy += 1) {
            for (var cx = 0; cx < world.COLS; cx += 1) {
                var cell = world.MAP[cy][cx];
                var floor = world.floorAt(cx * world.CELL + world.CELL / 2, cy * world.CELL + world.CELL / 2);
                ctx.fillStyle = cell === '#' ? '#2a3446' : cell === 'r' ? '#b06a62' : cell === 'b' ? '#5c7fbf' : cell === 'g' ? '#5f9c78' : cell === 'y' ? '#b3a35c'
                    : floor === 'line' ? '#d9c94e' : floor === 'tile2' ? '#151d2a' : '#101722';
                ctx.fillRect(z.x + cx * world.CELL * z.s, z.y + cy * world.CELL * z.s, world.CELL * z.s + 1, world.CELL * z.s + 1);
            }
        }
        var px = z.x + pose.x * z.s;
        var py = z.y + pose.y * z.s;
        if (headlights) {
            ctx.beginPath();
            ctx.fillStyle = 'rgba(255, 226, 130, .28)';
            ctx.arc(px, py, 24, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate((pose.heading * Math.PI) / 180);
        ctx.beginPath();
        ctx.fillStyle = '#e7edf7';
        ctx.moveTo(0, -8);
        ctx.lineTo(6, 7);
        ctx.lineTo(-6, 7);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    function say(text) { if (label) label.textContent = text; }

    function stepFor(action, seconds) {
        var drive = { throttle: 0, steer: 0 };
        var direction = action.direction || 'forward';
        if (direction === 'forward') drive.throttle = 1;
        if (direction === 'back') drive.throttle = -1;
        if (direction === 'left') drive.steer = -1;
        if (direction === 'right') drive.steer = 1;
        if (direction === 'spin_left') drive.steer = -1;
        if (direction === 'spin_right') drive.steer = 1;
        return world.step(pose, drive, seconds);
    }

    function play(action, done) {
        var seconds = Math.min(2.4, Math.max(0.4, (Number(action.robot && action.robot.ms) || 1000) / 1000));
        var left = reduced ? 0 : seconds;
        var last = Date.now();
        say(action.text);
        (function frame() {
            var now = Date.now();
            var dt = Math.min(0.05, (now - last) / 1000);
            last = now;
            if (left > 0) {
                var r = stepFor(action.robot || action, dt);
                pose = r.pose;
                left -= dt;
            }
            draw();
            if (left > 0) requestAnimationFrame(frame);
            else setTimeout(done, reduced ? 0 : 500);
        })();
    }

    var i = 0;
    function next() {
        if (i >= actions.length) { say('Simulated rover, ready.'); return; }
        var action = actions[i++];
        if (action.robot && (action.robot.on === true || action.robot.on === false)) {
            headlights = action.robot.on;
            say(action.text);
            draw();
            setTimeout(next, reduced ? 0 : 700);
            return;
        }
        if (action.robot && action.robot.kind === 'robot.drive_pulse') { play(action, next); return; }
        say(action.text);
        draw();
        setTimeout(next, reduced ? 0 : 700);
    }

    draw();
    setTimeout(next, reduced ? 0 : 400);
})();
