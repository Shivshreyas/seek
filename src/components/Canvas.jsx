import React, { useEffect, useRef } from 'react';
import './Canvas.css';

const TMDB_BASE = 'https://image.tmdb.org/t/p/original/';
const TMDB_IMAGES = [
    '-oZDram5xlRnoahMnIGvR1WfxvGqsCZICF-rp7zmIMc.jpg', '-ov2L-E21WpsUnJvb6aKzz9Gy1QEXmUwxKdky6kiU80.jpg',
    '0lw1HLUl6UmSG-WEpXA_vwqluusYcsby72AiInETWkM.jpg', '1ABCxvHc6asgPPD9agprtojh5sM.jpg',
    '1ASJhufUXBEN26YKIsNEak4SPXF.jpg', '1AT4Nc6oHkmL3p6i27P14SBnIpb.jpg',
    '1CDdClx0DGembBYjRWFH7HB2uff.jpg', '1CMvEINPk4xk79GTZavXS3BOOfL.jpg',
    '1CUqw1lVoKofkkQOFk8pOQD8OHX.jpg', '1DBDwevWS8OhiT3wqqlW7KGPd6m.jpg',
    '1DIrnonqYm9wsCJBQps1aaEdY5k.jpg', '1DXD1dMkd0H764jFdfJbL7ItJLD.jpg',
    '1DzZhqgfb6WrJ5DHCGOE9Uu9Fkz.jpg', '1EAxNqdkVnp48a7NUuNBHGflowM.jpg',
    '1EGJSlQsUxh6M1FfUEDby10mZ5q.jpg', '1Ec2AdlvpLKkfgnjlTcG9lV52IT.jpg',
    '1Edzb2YczuQatxe5clvuVXhxvND.jpg', '1GGfWFp9hp4RUHRHxd505z9rVFa.jpg',
    '1GgPN8ohMnyWbPKCtRO02ZhAQof.jpg', '1Gh3zrDzfbBx4VdJz0XDkqz0B6l.jpg',
    '1GrURa0tEBIBjJ2EbeRsMP65YPK.jpg', '1HV2v30FbqrNrOoBPBUxwZY7Jlp.jpg',
    '1I1cFIKnXEdaOfN4597Y91oNXyo.jpg', '1ItGGdOYifWNRJ3fNhiS9SSmdZM.jpg',
    '1K3Kwzh50eAymDxDiGnisfDFpFS.jpg', '1K7jIv3vy6dIXwo0CQNwokLeJc5.jpg',
    '1KHmSzyi1UoZMuTlD19pJcPbmDd.jpg', '1KJtjg3MQFnrfd7NXfs11z4HLwD.jpg',
    '1KYDPOC6ENDWCkW3TGCdca104hi.jpg', '1Kc2o8wTcsFDAzk6lOnbpm2ZByK.jpg',
];

const GRID_SIZE = 380;
const MAX_PER_CELL = 12; // Max items per grid cell
const LONG_PRESS_MS = 280;
const FRICTION = 0.90;
const LERP = 0.14;
const GRID_CLUSTER_RADIUS = 800;
const GRID_CLUSTER_MAX = 24;
const GRID_GAP = 16;
const PAN_CANCEL_PX = 6;
const EXPAND_RADIUS = 900;
const EXPAND_GAP = 18;

function Canvas() {
    const stageRef = useRef(null);
    const canvasRef = useRef(null);
    const trayRef = useRef(null);
    const trayItemsRef = useRef(null);

    // State refs (avoiding React state for performance)
    const state = useRef({
        worldWidth: 0,
        worldHeight: 0,
        targetX: 0, targetY: 0,
        viewX: 0, viewY: 0,
        inertiaVX: 0, inertiaVY: 0,
        isPanning: false,
        dragStartX: 0, dragStartY: 0,
        startTargetX: 0, startTargetY: 0,
        hasMoved: false,
        imageDrag: null,
        longPressTimer: 0,
        arrangedCluster: null,
        tapCandidate: null,
        occupancy: new Map(),
        used: new Set(),
        expandedSet: new Set(),
        neighborRestores: new Map()
    });

    useEffect(() => {
        const canvas = canvasRef.current;
        const stage = stageRef.current;
        const tray = trayRef.current;
        const trayItems = trayItemsRef.current;

        if (!canvas || !stage) return;

        state.current.worldWidth = canvas.clientWidth;
        state.current.worldHeight = canvas.clientHeight;

        // Utility functions
        const rand = (min, max) => Math.random() * (max - min) + min;
        const keyFor = (wx, wy) => `${Math.floor(wx / GRID_SIZE)},${Math.floor(wy / GRID_SIZE)}`;
        const occGet = (wx, wy) => state.current.occupancy.get(keyFor(wx, wy)) || 0;
        const occInc = (wx, wy) => {
            const k = keyFor(wx, wy);
            state.current.occupancy.set(k, (state.current.occupancy.get(k) || 0) + 1);
        };

        const applyPan = () => {
            // We can keep this one as is, as it moves the whole canvas container
            canvas.style.transform = `translate(calc(-50% + ${state.current.viewX}px), calc(-50% + ${state.current.viewY}px))`;
        };

        const recenter = () => {
            state.current.targetX = 0;
            state.current.targetY = 0;
            state.current.inertiaVX = 0;
            state.current.inertiaVY = 0;
        };

        // Intersection Observer for lazy loading
        const io = new IntersectionObserver((entries) => {
            for (const entry of entries) {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    if (img.dataset && img.dataset.src && !img.src) {
                        img.src = img.dataset.src;
                    }
                    io.unobserve(img);
                }
            }
        }, { root: null, rootMargin: '800px', threshold: 0.01 });

        //Create lens icon
        const createLens = () => {
            const el = document.createElement('button');
            el.type = 'button';
            el.className = 'lens';
            el.setAttribute('aria-label', 'Reverse image search');
            el.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>`;
            el.addEventListener('pointerdown', (ev) => ev.stopPropagation());
            el.addEventListener('pointerup', (ev) => ev.stopPropagation());
            return el;
        };

        // Create art element
        const createArt = (url) => {
            // Extract real URL (remove hash if present)
            const realUrl = url.split('#')[0];

            const container = document.createElement('div');
            container.className = 'art';

            const img = document.createElement('img');
            img.className = 'art-img';
            img.loading = 'lazy';
            img.alt = 'inspiration';
            img.decoding = 'async';
            img.dataset.src = realUrl; // Use real URL for loading
            img.addEventListener('load', () => img.classList.add('ready'));
            img.addEventListener('error', () => {
                // Hide broken images
                container.style.display = 'none';
            });
            img.style.width = `${rand(16, 26).toFixed(2)}vw`;

            // Observe for lazy loading
            io.observe(img);

            const dl = document.createElement('a');
            dl.className = 'dl';
            dl.textContent = 'download';
            dl.href = realUrl;
            dl.setAttribute('download', '');
            dl.addEventListener('pointerdown', (ev) => ev.stopPropagation());
            dl.addEventListener('click', (ev) => {
                ev.stopPropagation();
                ev.preventDefault();
                const link = document.createElement('a');
                link.href = realUrl;
                link.download = 'poster.jpg';
                link.click();
            });

            const lens = createLens();
            lens.addEventListener('click', (ev) => {
                ev.stopPropagation();
                const encoded = encodeURIComponent(realUrl);
                window.open(`https://lens.google.com/uploadbyurl?url=${encoded}&hl=en`, '_blank');
            });

            container.appendChild(img);
            container.appendChild(dl);
            container.appendChild(lens);
            return container;
        };

        // Place image
        const placeImage = (url) => {
            if (state.current.used.has(url)) return;

            let attempts = 50; // Increased attempts
            let wx = 0, wy = 0;

            while (attempts--) {
                const bias = 0.55;
                const cx = -state.current.targetX, cy = -state.current.targetY;
                // Widen the random spread to fill more space
                wx = rand(-0.5 * state.current.worldWidth, 0.5 * state.current.worldWidth) * bias + cx * (1 - bias) + rand(-1000, 1000);
                wy = rand(-0.5 * state.current.worldHeight, 0.5 * state.current.worldHeight) * bias + cy * (1 - bias) + rand(-1000, 1000);
                if (occGet(wx, wy) < MAX_PER_CELL) break;
            }

            if (occGet(wx, wy) >= MAX_PER_CELL) {
                // console.log('Failed to place image due to density');
                return;
            }

            state.current.used.add(url);
            occInc(wx, wy);

            const art = createArt(url);
            art.dataset.wx = String(wx);
            art.dataset.wy = String(wy);
            art.dataset.src = url;
            art.style.transform = `translate3d(${wx}px, ${wy}px, 0)`;
            canvas.appendChild(art);
        };

        // Load images batch
        const loadBatch = () => {
            // Load a batch of images
            let index = Math.floor(Math.random() * 10000); // Random start index
            TMDB_IMAGES.forEach(img => {
                const url = `${TMDB_BASE}${img}`;
                const uniqueUrl = `${url}#${index++}`;
                placeImage(uniqueUrl);
            });
        };

        // Initial load
        loadBatch();
        loadBatch();
        loadBatch();

        // Periodic background loading
        const intervalId = setInterval(() => {
            if (canvas.children.length < 300) { // Limit total items
                loadBatch();
            }
        }, 2000);

        // Pan handlers
        const startPan = (e) => {
            state.current.isPanning = true;
            state.current.hasMoved = false;
            document.body.classList.add('panning');
            state.current.dragStartX = e.clientX;
            state.current.dragStartY = e.clientY;
            state.current.startTargetX = state.current.targetX;
            state.current.startTargetY = state.current.targetY;
            state.current.inertiaVX = 0;
            state.current.inertiaVY = 0;
            stage.setPointerCapture(e.pointerId);
        };

        const movePan = (e) => {
            if (!state.current.isPanning || state.current.imageDrag) return;

            const dx = e.clientX - state.current.dragStartX;
            const dy = e.clientY - state.current.dragStartY;

            if (Math.abs(dx) > PAN_CANCEL_PX || Math.abs(dy) > PAN_CANCEL_PX) {
                state.current.hasMoved = true;
                state.current.tapCandidate = null;
            }

            state.current.targetX = state.current.startTargetX + dx;
            state.current.targetY = state.current.startTargetY + dy;
            state.current.inertiaVX = dx * 0.08;
            state.current.inertiaVY = dy * 0.08;
        };

        const endPan = (e) => {
            state.current.isPanning = false;
            document.body.classList.remove('panning');
            stage.releasePointerCapture(e.pointerId);
        };

        // Pointer handlers
        const onPointerDown = (e) => {
            const target = e.target;
            if (target.closest && (target.closest('.lens') || target.closest('.dl'))) return;

            if (target && target.closest) {
                const art = target.closest('.art');
                state.current.tapCandidate = art || null;
                clearTimeout(state.current.longPressTimer);
                if (art) {
                    state.current.longPressTimer = setTimeout(() => {
                        beginImageHold(art, e);
                        state.current.tapCandidate = null;
                    }, LONG_PRESS_MS);
                }
            }
            startPan(e);
        };

        const onPointerMove = (e) => {
            if (Math.abs(e.clientX - state.current.dragStartX) > PAN_CANCEL_PX ||
                Math.abs(e.clientY - state.current.dragStartY) > PAN_CANCEL_PX) {
                clearTimeout(state.current.longPressTimer);
            }
            if (state.current.imageDrag) {
                updateImageDrag(e);
                return;
            }
            movePan(e);
        };

        const onPointerUp = (e) => {
            clearTimeout(state.current.longPressTimer);
            if (state.current.imageDrag) {
                endImageDrag(e);
                return;
            }
            if (!state.current.hasMoved) {
                if (state.current.tapCandidate) {
                    toggleExpand(state.current.tapCandidate);
                } else {
                    collapseExpanded();
                }
            }
            state.current.tapCandidate = null;
            endPan(e);
        };

        // Image drag functions  
        const beginImageHold = (art, e) => {
            state.current.imageDrag = {
                el: art,
                startWX: parseFloat(art.dataset.wx || '0'),
                startWY: parseFloat(art.dataset.wy || '0')
            };
            art.classList.add('topmost');
            arrangeClusterAround(art, true);
        };

        const updateImageDrag = (e) => {
            const art = state.current.imageDrag.el;
            const dx = e.clientX - state.current.dragStartX;
            const dy = e.clientY - state.current.dragStartY;
            const wx = state.current.imageDrag.startWX + dx;
            const wy = state.current.imageDrag.startWY + dy;

            art.dataset.wx = String(wx);
            art.dataset.wy = String(wy);
            art.style.transform = `translate3d(${wx}px, ${wy}px, 0)`;

            if (state.current.arrangedCluster) {
                positionClusterGrid(state.current.arrangedCluster, { wx, wy });
                pushOthersAway({ wx, wy });
            }
        };

        const endImageDrag = (e) => {
            const art = state.current.imageDrag.el;
            state.current.imageDrag = null;

            if (state.current.arrangedCluster) {
                for (const it of state.current.arrangedCluster.items) {
                    // Read from dataset as truth, style transform is complex to parse
                    const left = parseFloat(it.el.dataset.wx || '0');
                    const top = parseFloat(it.el.dataset.wy || '0');
                    it.el.dataset.wx = String(left);
                    it.el.dataset.wy = String(top);
                    // Ensure final transform is set (should already be)
                    it.el.style.transform = `translate3d(${left}px, ${top}px, 0)`;
                }
                state.current.arrangedCluster = null;
            }
        };

        const getAllArts = () => Array.from(canvas.querySelectorAll('.art'));
        const distance = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

        const arrangeClusterAround = (centerEl, push) => {
            const cx = parseFloat(centerEl.dataset.wx || '0');
            const cy = parseFloat(centerEl.dataset.wy || '0');
            const arts = getAllArts();
            const neighbors = [];

            for (const el of arts) {
                if (el === centerEl) continue;
                const wx = parseFloat(el.dataset.wx || '0');
                const wy = parseFloat(el.dataset.wy || '0');
                if (distance(cx, cy, wx, wy) <= GRID_CLUSTER_RADIUS) {
                    neighbors.push({ el, wx, wy });
                    if (neighbors.length >= GRID_CLUSTER_MAX) break;
                }
            }

            const cluster = { center: centerEl, items: neighbors };
            const count = neighbors.length;

            if (count === 0) {
                state.current.arrangedCluster = cluster;
                return;
            }

            const cols = Math.ceil(Math.sqrt(count));
            const rows = Math.ceil(count / cols);
            const size = 220;
            cluster.grid = { cols, rows, size };
            positionClusterGrid(cluster, { wx: cx, wy: cy });
            state.current.arrangedCluster = cluster;
            if (push) pushOthersAway({ wx: cx, wy: cy });
        };

        const positionClusterGrid = (cluster, center) => {
            const { cols, rows, size } = cluster.grid;
            const gap = GRID_GAP;
            const halfW = (cols - 1) * (size + gap) * 0.5;
            const halfH = (rows - 1) * (size + gap) * 0.5;

            for (let i = 0; i < cluster.items.length; i++) {
                const it = cluster.items[i];
                const col = i % cols;
                const row = Math.floor(i / cols);
                const wx = center.wx + col * (size + gap) - halfW;
                const wy = center.wy + row * (size + gap) - halfH;
                it.el.dataset.wx = String(wx);
                it.el.dataset.wy = String(wy);
                it.el.style.transform = `translate3d(${wx}px, ${wy}px, 0)`;
            }
        };

        const pushOthersAway = (center) => {
            const arts = getAllArts();
            for (const el of arts) {
                if (state.current.arrangedCluster &&
                    (el === state.current.arrangedCluster.center ||
                        state.current.arrangedCluster.items.some(it => it.el === el))) continue;

                const wx = parseFloat(el.dataset.wx || '0');
                const wy = parseFloat(el.dataset.wy || '0');
                const d = distance(center.wx, center.wy, wx, wy);

                if (d < GRID_CLUSTER_RADIUS * 1.2) {
                    const angle = Math.atan2(wy - center.wy, wx - center.wx);
                    const dist = GRID_CLUSTER_RADIUS * 1.35 - d;
                    const nx = wx + Math.cos(angle) * dist;
                    const ny = wy + Math.sin(angle) * dist;
                    el.dataset.wx = String(nx);
                    el.dataset.wy = String(ny);
                    el.style.transform = `translate3d(${nx}px, ${ny}px, 0)`;
                }
            }
        };

        const toggleExpand = (art) => {
            if (state.current.expandedSet.has(art)) {
                collapseExpanded();
                return;
            }
            collapseExpanded(); // Single expand mode
            expandLayoutAround(art);
            art.classList.add('expanded');
            state.current.expandedSet.add(art);
            art.classList.add('topmost');
            updateTray();
        };

        const expandLayoutAround = (art) => {
            const ax = parseFloat(art.dataset.wx || '0');
            const ay = parseFloat(art.dataset.wy || '0');
            const arts = getAllArts();
            let ringIndex = 0;

            for (const el of arts) {
                if (el === art) continue;
                const ex = parseFloat(el.dataset.wx || '0');
                const ey = parseFloat(el.dataset.wy || '0');
                const d = distance(ax, ay, ex, ey);

                if (d < EXPAND_RADIUS) {
                    const angle = Math.atan2(ey - ay, ex - ax);
                    const radius = EXPAND_RADIUS + (ringIndex % 2) * (EXPAND_GAP * 6);
                    const nx = ax + Math.cos(angle) * radius;
                    const ny = ay + Math.sin(angle) * radius;

                    // Save original position before moving
                    if (!state.current.neighborRestores.has(el)) {
                        state.current.neighborRestores.set(el, { wx: ex, wy: ey });
                    }

                    el.dataset.wx = String(nx);
                    el.dataset.wy = String(ny);
                    el.style.transform = `translate3d(${nx}px, ${ny}px, 0)`;
                    ringIndex++;
                }
            }
        };

        const updateTray = () => {
            trayItems.innerHTML = '';
            if (state.current.expandedSet.size === 0) {
                tray.hidden = true;
                return;
            }
            tray.hidden = false;

            for (const art of state.current.expandedSet) {
                const item = document.createElement('div');
                item.className = 'tray-item';
                const img = art.querySelector('img.art-img');
                const thumb = document.createElement('img');
                thumb.src = img.src || img.dataset.src || '';
                item.appendChild(thumb);
                item.addEventListener('click', () => {
                    const wx = parseFloat(art.dataset.wx || '0');
                    const wy = parseFloat(art.dataset.wy || '0');
                    state.current.targetX = -wx;
                    state.current.targetY = -wy;
                    state.current.inertiaVX = 0;
                    state.current.inertiaVY = 0;
                    art.classList.add('topmost');
                });
                trayItems.appendChild(item);
            }
        };

        const collapseExpanded = () => {
            if (state.current.expandedSet.size === 0) return;
            for (const art of state.current.expandedSet) {
                art.classList.remove('expanded');
            }
            // Restore neighbors
            for (const [el, pos] of state.current.neighborRestores) {
                el.dataset.wx = String(pos.wx);
                el.dataset.wy = String(pos.wy);
                el.style.transform = `translate3d(${pos.wx}px, ${pos.wy}px, 0)`;
            }
            state.current.neighborRestores.clear();

            state.current.expandedSet.clear();
            updateTray();
        };

        // Animation loop
        const animate = () => {
            if (!state.current.isPanning && !state.current.imageDrag) {
                state.current.targetX += state.current.inertiaVX;
                state.current.targetY += state.current.inertiaVY;
                state.current.inertiaVX *= FRICTION;
                state.current.inertiaVY *= FRICTION;
                if (Math.abs(state.current.inertiaVX) < 0.01) state.current.inertiaVX = 0;
                if (Math.abs(state.current.inertiaVY) < 0.01) state.current.inertiaVY = 0;
            }

            state.current.viewX += (state.current.targetX - state.current.viewX) * LERP;
            state.current.viewY += (state.current.targetY - state.current.viewY) * LERP;
            applyPan();
            requestAnimationFrame(animate);
        };

        // Event listeners
        stage.addEventListener('pointerdown', onPointerDown);
        stage.addEventListener('pointermove', onPointerMove);
        stage.addEventListener('pointerup', onPointerUp);
        stage.addEventListener('pointercancel', onPointerUp);

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') collapseExpanded();
        });

        document.getElementById('recenter').addEventListener('click', recenter);

        // Initialize
        canvas.style.width = `${state.current.worldWidth}px`;
        canvas.style.height = `${state.current.worldHeight}px`;
        applyPan();
        requestAnimationFrame(animate);


        return () => {
            clearInterval(intervalId);
            stage.removeEventListener('pointerdown', onPointerDown);
            stage.removeEventListener('pointermove', onPointerMove);
            stage.removeEventListener('pointerup', onPointerUp);
            stage.removeEventListener('pointercancel', onPointerUp);
        };
    }, []);

    return (
        <>
            <div className="site-header">
                <div className="brand">canvas</div>
            </div>

            <div ref={stageRef} id="stage">
                <div ref={canvasRef} id="canvas" />
            </div>

            <button id="recenter" className="floating-btn" title="Recenter">⊙</button>

            <div ref={trayRef} id="tray" className="tray" hidden>
                <div className="tray-head">Expanded Images</div>
                <div ref={trayItemsRef} id="tray-items" className="tray-items" />
            </div>


        </>
    );
}

export default Canvas;
