const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    render();
}
window.addEventListener("resize", resize);
resize();

let gridSize = 30;
let mode = "elektronik";
let components = [];
let wires = [];

let draggingComp = null;
let draggingOffset = { x: 0, y: 0 };

let draggingWire = null; // { from: {compId,pinIndex}, tempPos:{x,y} }

let pan = { x: 0, y: 0 };
let zoom = 1;

let lastTouchDist = null;
let lastPanCenter = null;

// IDs
let nextId = 1;
function createId() {
    return nextId++;
}

// --- Komponenten-Definitionen ---

function createComponent(type, x, y, mode) {
    const id = createId();
    const base = {
        id,
        type,
        x,
        y,
        w: 80,
        h: 40,
        mode,
        pins: []
    };

    if (type === "LED") {
        base.w = 50;
        base.h = 30;
        base.pins = [
            { name: "IN", side: "left", offset: 0.5, kind: "in" }
        ];
        base.state = false;
    } else if (type === "SWITCH") {
        base.w = 50;
        base.h = 30;
        base.pins = [
            { name: "OUT", side: "right", offset: 0.5, kind: "out" }
        ];
        base.state = false;
    } else if (type === "AND" || type === "OR") {
        base.pins = [
            { name: "A", side: "left", offset: 0.3, kind: "in" },
            { name: "B", side: "left", offset: 0.7, kind: "in" },
            { name: "OUT", side: "right", offset: 0.5, kind: "out" }
        ];
        base.state = false;
    } else if (type === "NOT") {
        base.pins = [
            { name: "IN", side: "left", offset: 0.5, kind: "in" },
            { name: "OUT", side: "right", offset: 0.5, kind: "out" }
        ];
        base.state = false;
    }

    return base;
}

// --- Koordinaten-Helfer ---

function worldToScreen(x, y) {
    return {
        x: (x - pan.x) * zoom,
        y: (y - pan.y) * zoom
    };
}

function screenToWorld(x, y) {
    return {
        x: x / zoom + pan.x,
        y: y / zoom + pan.y
    };
}

function getPinPosition(comp, pin) {
    let px = comp.x;
    let py = comp.y;
    if (pin.side === "left") {
        px = comp.x;
        py = comp.y + comp.h * pin.offset;
    } else if (pin.side === "right") {
        px = comp.x + comp.w;
        py = comp.y + comp.h * pin.offset;
    } else if (pin.side === "top") {
        px = comp.x + comp.w * pin.offset;
        py = comp.y;
    } else if (pin.side === "bottom") {
        px = comp.x + comp.w * pin.offset;
        py = comp.y + comp.h;
    }
    return { x: px, y: py };
}

// --- Zeichnen ---

function drawGrid() {
    ctx.save();
    ctx.translate(-pan.x * zoom, -pan.y * zoom);
    ctx.scale(zoom, zoom);

    ctx.strokeStyle = "#333";
    ctx.lineWidth = 1 / zoom;

    const width = canvas.width / zoom;
    const height = canvas.height / zoom;

    for (let x = Math.floor(pan.x / gridSize) * gridSize; x < pan.x + width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, pan.y);
        ctx.lineTo(x, pan.y + height);
        ctx.stroke();
    }

    for (let y = Math.floor(pan.y / gridSize) * gridSize; y < pan.y + height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(pan.x, y);
        ctx.lineTo(pan.x + width, y);
        ctx.stroke();
    }

    ctx.restore();
}

function drawComponents() {
    ctx.save();
    ctx.translate(-pan.x * zoom, -pan.y * zoom);
    ctx.scale(zoom, zoom);

    components.forEach(c => {
        if (c.mode !== mode) return;

        // Körper
        ctx.fillStyle = "#444";
        ctx.strokeStyle = "#aaa";
        ctx.lineWidth = 1 / zoom;
        ctx.fillRect(c.x, c.y, c.w, c.h);
        ctx.strokeRect(c.x, c.y, c.w, c.h);

        // Typ-Text
        ctx.fillStyle = "white";
        ctx.font = `${10 / zoom}px sans-serif`;
        ctx.fillText(c.type, c.x + 4, c.y + 12);

        // Zustand (für LED / SWITCH)
        if (c.type === "LED") {
            ctx.fillStyle = c.state ? "red" : "#550000";
            ctx.beginPath();
            ctx.arc(c.x + c.w / 2, c.y + c.h / 2, 6, 0, Math.PI * 2);
            ctx.fill();
        } else if (c.type === "SWITCH") {
            ctx.fillStyle = c.state ? "#0f0" : "#070";
            ctx.fillRect(c.x + 5, c.y + c.h / 2 - 4, c.w - 10, 8);
        }

        // Pins
        c.pins.forEach((p, idx) => {
            const pos = getPinPosition(c, p);
            ctx.fillStyle = "#ccc";
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = "#aaa";
            ctx.font = `${8 / zoom}px sans-serif`;
            let tx = pos.x + (p.side === "left" ? -18 : 8);
            let ty = pos.y + 3;
            ctx.fillText(p.name, tx, ty);
        });
    });

    ctx.restore();
}

function drawWires() {
    ctx.save();
    ctx.translate(-pan.x * zoom, -pan.y * zoom);
    ctx.scale(zoom, zoom);

    ctx.strokeStyle = "#0f8";
    ctx.lineWidth = 2 / zoom;

    wires.forEach(w => {
        const fromComp = components.find(c => c.id === w.from.compId);
        const toComp = components.find(c => c.id === w.to.compId);
        if (!fromComp || !toComp) return;
        const fromPin = fromComp.pins[w.from.pinIndex];
        const toPin = toComp.pins[w.to.pinIndex];
        if (!fromPin || !toPin) return;

        const p1 = getPinPosition(fromComp, fromPin);
        const p2 = getPinPosition(toComp, toPin);

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
    });

    // temporäre Leitung
    if (draggingWire) {
        const fromComp = components.find(c => c.id === draggingWire.from.compId);
        if (fromComp) {
            const fromPin = fromComp.pins[draggingWire.from.pinIndex];
            const p1 = getPinPosition(fromComp, fromPin);
            const p2 = draggingWire.tempPos;

            ctx.strokeStyle = "#0f8";
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }

    ctx.restore();
}

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid();
    drawWires();
    drawComponents();
}

// --- Logik-Simulation ---

function simulate() {
    // einfache, iterative Simulation
    // 1. alle Outputs auf false
    components.forEach(c => {
        if (c.type !== "SWITCH") c.state = false;
    });

    // 2. Schalter behalten ihren Zustand
    // 3. mehrmals durchlaufen, um Signale zu propagieren
    for (let iter = 0; iter < 5; iter++) {
        components.forEach(c => {
            // Nur in Logik-Modus simulieren (außer LED und SWITCH)
            if (c.mode !== "logik") {
                if (c.type !== "LED" && c.type !== "SWITCH") return;
            }

            if (c.type === "SWITCH") {
                // state bleibt wie er ist
            } else if (c.type === "AND") {
                const a = getInputValue(c, "A");
                const b = getInputValue(c, "B");
                c.state = a && b;
            } else if (c.type === "OR") {
                const a = getInputValue(c, "A");
                const b = getInputValue(c, "B");
                c.state = a || b;
            } else if (c.type === "NOT") {
                const a = getInputValue(c, "IN");
                c.state = !a;
            } else if (c.type === "LED") {
                const a = getInputValue(c, "IN");
                c.state = a;
            }
        });
    }

    render();
}

function getInputValue(comp, pinName) {
    // finde Pin
    const pinIndex = comp.pins.findIndex(p => p.name === pinName && p.kind === "in");
    if (pinIndex === -1) return false;

    // finde Leitung, die auf diesen Pin geht
    const w = wires.find(w =>
        w.to.compId === comp.id && w.to.pinIndex === pinIndex
    );
    if (!w) return false;

    const fromComp = components.find(c => c.id === w.from.compId);
    if (!fromComp) return false;

    return !!fromComp.state;
}

// --- Hit-Tests ---

function hitComponent(worldX, worldY) {
    for (let i = components.length - 1; i >= 0; i--) {
        const c = components[i];
        if (c.mode !== mode) continue;
        if (
            worldX >= c.x &&
            worldX <= c.x + c.w &&
            worldY >= c.y &&
            worldY <= c.y + c.h
        ) {
            return c;
        }
    }
    return null;
}

function hitPin(worldX, worldY) {
    for (let i = components.length - 1; i >= 0; i--) {
        const c = components[i];
        if (c.mode !== mode) continue;
        for (let j = 0; j < c.pins.length; j++) {
            const p = c.pins[j];
            const pos = getPinPosition(c, p);
            const dx = worldX - pos.x;
            const dy = worldY - pos.y;
            if (dx * dx + dy * dy <= 8 * 8) {
                return { comp: c, pinIndex: j, pin: p };
            }
        }
    }
    return null;
}

// --- Interaktion (Touch) ---

let activeTouches = [];

canvas.addEventListener("touchstart", e => {
    e.preventDefault();
    activeTouches = Array.from(e.touches);

    if (activeTouches.length === 1) {
        const t = activeTouches[0];
        const { x, y } = screenToWorld(t.clientX, t.clientY);

        const pinHit = hitPin(x, y);
        if (pinHit) {
            // Leitung starten (nur von Output-Pins)
            if (pinHit.pin.kind === "out") {
                draggingWire = {
                    from: { compId: pinHit.comp.id, pinIndex: pinHit.pinIndex },
                    tempPos: { x, y }
                };
            }
            return;
        }

        const comp = hitComponent(x, y);
        if (comp) {
            draggingComp = comp;
            draggingOffset.x = x - comp.x;
            draggingOffset.y = y - comp.y;

            // Schalter toggeln, wenn kurz angetippt
            if (comp.type === "SWITCH") {
                comp.state = !comp.state;
                simulate();
            }
        } else {
            draggingComp = null;
        }
    } else if (activeTouches.length === 2) {
        lastTouchDist = distance(activeTouches[0], activeTouches[1]);
        lastPanCenter = {
            x: (activeTouches[0].clientX + activeTouches[1].clientX) / 2,
            y: (activeTouches[0].clientY + activeTouches[1].clientY) / 2
        };
    }
});

canvas.addEventListener("touchmove", e => {
    e.preventDefault();
    activeTouches = Array.from(e.touches);

    if (activeTouches.length === 1) {
        const t = activeTouches[0];
        const { x, y } = screenToWorld(t.clientX, t.clientY);

        if (draggingWire) {
            draggingWire.tempPos = { x, y };
            render();
            return;
        }

        if (draggingComp) {
            draggingComp.x = x - draggingOffset.x;
            draggingComp.y = y - draggingOffset.y;
            render();
        }
    } else if (activeTouches.length === 2) {
        const t1 = activeTouches[0];
        const t2 = activeTouches[1];
        const newDist = distance(t1, t2);
        const center = {
            x: (t1.clientX + t2.clientX) / 2,
            y: (t1.clientY + t2.clientY) / 2
        };

        if (lastTouchDist) {
            const factor = newDist / lastTouchDist;
            const before = screenToWorld(center.x, center.y);
            zoom *= factor;
            zoom = Math.max(0.3, Math.min(zoom, 3));
            const after = screenToWorld(center.x, center.y);
            pan.x += before.x - after.x;
            pan.y += before.y - after.y;
        }

        lastTouchDist = newDist;
        lastPanCenter = center;
        render();
    }
});

canvas.addEventListener("touchend", e => {
    e.preventDefault();
    activeTouches = Array.from(e.touches);

    if (draggingComp) {
        // Snap to grid
        draggingComp.x = Math.round(draggingComp.x / gridSize) * gridSize;
        draggingComp.y = Math.round(draggingComp.y / gridSize) * gridSize;
        draggingComp = null;
        simulate();
    }

    if (draggingWire) {
        const { x, y } = draggingWire.tempPos;
        const pinHit = hitPin(x, y);
        if (pinHit && pinHit.pin.kind === "in") {
            // Verbindung erstellen
            wires.push({
                from: draggingWire.from,
                to: { compId: pinHit.comp.id, pinIndex: pinHit.pinIndex }
            });
            simulate();
        }
        draggingWire = null;
        render();
    }

    if (activeTouches.length < 2) {
        lastTouchDist = null;
        lastPanCenter = null;
    }
});

function distance(t1, t2) {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

// --- Toolbar-Interaktion ---

const tools = Array.from(document.querySelectorAll(".tool"));
const modeLabel = document.getElementById("mode-label");
const saveBtn = document.getElementById("save-btn");
const loadBtn = document.getElementById("load-btn");

// Toolbar-Button für Elektronik-Modus als aktiv markieren
tools.forEach(tool => {
    if (tool.getAttribute("data-mode") === "elektronik") {
        tool.classList.add("active");
    }
});

tools.forEach(tool => {
    const modeAttr = tool.getAttribute("data-mode");
    const addAttr = tool.getAttribute("data-add");

    if (modeAttr) {
        tool.addEventListener("click", () => {
            mode = modeAttr;
            tools.forEach(t => t.classList.remove("active"));
            tool.classList.add("active");
            modeLabel.textContent = "Modus: " + (mode === "elektronik" ? "Elektronik" : "Logik");
            render();
        });
    }

    if (addAttr) {
        tool.addEventListener("click", () => {
            const worldCenter = screenToWorld(canvas.width / 2, canvas.height / 2);
            const comp = createComponent(addAttr, worldCenter.x - 40, worldCenter.y - 20, mode);
            components.push(comp);
            simulate();
        });
    }
});

saveBtn.addEventListener("click", () => {
    const data = {
        components,
        wires,
        nextId,
        pan,
        zoom
    };
    localStorage.setItem("baukasten-save", JSON.stringify(data));
    alert("Gespeichert");
});

loadBtn.addEventListener("click", () => {
    const raw = localStorage.getItem("baukasten-save");
    if (!raw) {
        alert("Kein Speicherstand gefunden");
        return;
    }
    try {
        const data = JSON.parse(raw);
        components = data.components || [];
        wires = data.wires || [];
        nextId = data.nextId || 1;
        pan = data.pan || { x: 0, y: 0 };
        zoom = data.zoom || 1;
        simulate();
    } catch (e) {
        alert("Fehler beim Laden");
    }
});

// Initial
simulate();
