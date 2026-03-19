alert("JS läuft!");

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let gridSize = 30;

// Aktiver Modus
let mode = "elektronik";

// Beispiel-Komponenten
let components = [
    {
        type: "LED",
        x: 100,
        y: 100,
        w: 50,
        h: 20,
        color: "red",
        mode: "elektronik"
    },
    {
        type: "AND",
        x: 200,
        y: 200,
        w: 60,
        h: 30,
        color: "blue",
        mode: "logik"
    }
];

let dragging = null;

// Raster zeichnen
function drawGrid() {
    ctx.strokeStyle = "#444";
    ctx.lineWidth = 1;

    for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }

    for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }
}

// Bauteile zeichnen
function drawComponents() {
    components.forEach(c => {
        if (c.mode !== mode) return;

        ctx.fillStyle = c.color;
        ctx.fillRect(c.x, c.y, c.w, c.h);

        ctx.fillStyle = "white";
        ctx.font = "12px sans-serif";
        ctx.fillText(c.type, c.x + 5, c.y + 15);
    });
}

// Render-Funktion
function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid();
    drawComponents();
}

render();

// Touch-Start
canvas.addEventListener("touchstart", e => {
    const t = e.touches[0];
    const x = t.clientX;
    const y = t.clientY;

    components.forEach(c => {
        if (c.mode !== mode) return;

        if (x > c.x && x < c.x + c.w && y > c.y && y < c.y + c.h) {
            dragging = c;
        }
    });
});

// Touch-Move
canvas.addEventListener("touchmove", e => {
    if (!dragging) return;

    const t = e.touches[0];
    dragging.x = t.clientX - dragging.w / 2;
    dragging.y = t.clientY - dragging.h / 2;

    render();
});

// Touch-End
canvas.addEventListener("touchend", () => {
    if (dragging) {
        dragging.x = Math.round(dragging.x / gridSize) * gridSize;
        dragging.y = Math.round(dragging.y / gridSize) * gridSize;
    }
    dragging = null;
    render();
});

// Modus wechseln
function setMode(m) {
    mode = m;
    render();
}
