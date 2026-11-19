const simCanvas = document.getElementById('simCanvas');
const simCtx = simCanvas.getContext('2d');
const scopeCanvas = document.getElementById('scopeCanvas');
const scopeCtx = scopeCanvas.getContext('2d');

const heightSlider = document.getElementById('heightSlider');
const turnsSlider = document.getElementById('turnsSlider');
const hVal = document.getElementById('hVal');
const nVal = document.getElementById('nVal');
const uMaxDisplay = document.getElementById('uMaxDisplay');

const g = 9.81;
const pxPerMeter = 1000; 
const coilY = 400;
const coilHeight = 60;
const magnetHeight = 36;
const slowMotion = 0.2;

let h_cm = 15;
let turns = 400;
let magnetY = coilY - coilHeight/2 - h_cm * 10 - magnetHeight/2;
let velocity = 0;
let isFalling = false;
let maxVoltage = 0;
let scopeMaxRange = 5;
let voltageHistory = [];
let elapsedSimTime = 0;
let totalCycleTime = 1;
let measurementCount = 0;

let mousePos = { x: 0, y: 0, active: false };
scopeCanvas.style.cursor = "crosshair";

scopeCanvas.addEventListener('mousemove', (e) => {
    const rect = scopeCanvas.getBoundingClientRect();
    mousePos.x = e.clientX - rect.left;
    mousePos.y = e.clientY - rect.top;
    mousePos.active = true;
});

scopeCanvas.addEventListener('mouseleave', () => {
    mousePos.active = false;
});

heightSlider.oninput = function() {
    h_cm = parseInt(this.value);
    hVal.innerText = h_cm + " cm";
    if (!isFalling) resetMagnet();
};

turnsSlider.oninput = function() {
    turns = parseInt(this.value);
    nVal.innerText = turns;
    if (!isFalling) updateAutoScaleY();
};

function calculateVoltage(y_px, v_ms) {
    const dy_meters = (y_px - coilY) / pxPerMeter;
    const sigma = 0.035;
    const B_factor = 0.008;
    const dPhi_dy = - (dy_meters / (sigma * sigma)) * Math.exp(-(dy_meters * dy_meters) / (2 * sigma * sigma));
    const voltage_V = -turns * B_factor * dPhi_dy * v_ms;
    return voltage_V;
}

function updateAutoScaleY() {
    const startY = (coilY - coilHeight/2) - (h_cm * 10) - magnetHeight/2;
    const exitPeakY = coilY + 35;
    const distMeters = (exitPeakY - startY) / pxPerMeter;
    const vEst = Math.sqrt(2 * g * distMeters);
    const estPeakU = Math.abs(calculateVoltage(exitPeakY, vEst));

    const rawMax = estPeakU * 1.15;
    const step = rawMax > 10 ? 5 : (rawMax > 4 ? 2 : (rawMax > 1 ? 1 : 0.5));
    scopeMaxRange = Math.max(0.5, Math.ceil(rawMax / step) * step);
}

function resetMagnet() {
    isFalling = false;
    velocity = 0;
    elapsedSimTime = 0;
    magnetY = (coilY - coilHeight/2) - (h_cm * 10) - magnetHeight/2;
    
    const endY = simCanvas.height + 40;
    const totalDistanceMeters = (endY - magnetY) / pxPerMeter;
    totalCycleTime = Math.sqrt((2 * totalDistanceMeters) / g);
    
    updateAutoScaleY();
    drawSim();
}

function dropMagnet() {
    resetMagnet();
    isFalling = true;
    maxVoltage = 0;
    voltageHistory = [{ t: 0, u: 0 }];
    //uMaxDisplay.innerText = "0.000";
}

function updatePhysics(dt) {
    if (!isFalling) return;
    
    const simDt = dt * slowMotion;
    elapsedSimTime += simDt;
    velocity += g * simDt;
    magnetY += velocity * pxPerMeter * simDt;

    const currentU = calculateVoltage(magnetY, velocity);
    voltageHistory.push({ t: elapsedSimTime, u: currentU });

    if (Math.abs(currentU) > maxVoltage) {
        maxVoltage = Math.abs(currentU);
        //uMaxDisplay.innerText = maxVoltage.toFixed(3);
    }

    if (elapsedSimTime >= totalCycleTime) {
        isFalling = false;
    }
}

function drawSim() {
    simCtx.clearRect(0, 0, simCanvas.width, simCanvas.height);
    const topCoilY = coilY - coilHeight/2;

    simCtx.strokeStyle = "#999";
    simCtx.beginPath();
    simCtx.moveTo(20, topCoilY);
    simCtx.lineTo(280, topCoilY);
    simCtx.stroke();

    simCtx.fillStyle = "#b87333";
    simCtx.fillRect(105, topCoilY, 90, coilHeight);

    const mTop = magnetY - magnetHeight/2;
    simCtx.fillStyle = "#d32f2f";
    simCtx.fillRect(130, mTop, 40, magnetHeight/2);
    simCtx.fillStyle = "#1976d2";
    simCtx.fillRect(130, mTop + magnetHeight/2, 40, magnetHeight/2);
    
    simCtx.fillStyle = "white";
    simCtx.font = "bold 12px Arial";
    simCtx.fillText("N", 145, mTop + 13);
    simCtx.fillText("S", 145, mTop + 31);

    simCtx.strokeStyle = "#8d4925";
    simCtx.lineWidth = 2;
    const visualTurns = Math.min(20, turns / 50);
    for (let i = 0; i <= visualTurns; i++) {
        let y = topCoilY + (i * (coilHeight / visualTurns));
        simCtx.beginPath();
        simCtx.moveTo(100, y);
        simCtx.lineTo(200, y);
        simCtx.stroke();
    }
    simCtx.lineWidth = 1;
}

function drawWave(ctx, midY, width) {
    if (voltageHistory.length < 2) return;
    ctx.strokeStyle = "#d32f2f";
    ctx.lineWidth = 2.5;
    ctx.beginPath();

    for (let i = 0; i < voltageHistory.length; i++) {
        const progressX = voltageHistory[i].t / totalCycleTime;
        const x = progressX * width;
        const normalizedY = voltageHistory[i].u / scopeMaxRange;
        const y = midY - (normalizedY * midY);
        
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.lineWidth = 1;
}

function drawScope() {
    const w = scopeCanvas.width;
    const h = scopeCanvas.height;
    const midY = h / 2;

    scopeCtx.clearRect(0, 0, w, h);

    scopeCtx.strokeStyle = "#eee";
    for (let x = 0; x <= w; x += w / 10) {
        scopeCtx.beginPath();
        scopeCtx.moveTo(x, 0);
        scopeCtx.lineTo(x, h);
        scopeCtx.stroke();
    }
    for (let i = 1; i <= 3; i++) {
        let offset = (midY / 4) * i;
        scopeCtx.beginPath();
        scopeCtx.moveTo(0, midY - offset);
        scopeCtx.lineTo(w, midY - offset);
        scopeCtx.moveTo(0, midY + offset);
        scopeCtx.lineTo(w, midY + offset);
        scopeCtx.stroke();
    }

    scopeCtx.strokeStyle = "#888";
    scopeCtx.beginPath();
    scopeCtx.moveTo(0, midY);
    scopeCtx.lineTo(w, midY);
    scopeCtx.stroke();

    scopeCtx.fillStyle = "#555";
    scopeCtx.font = "11px Arial";
    scopeCtx.fillText("0.00 s", 5, midY + 14);
    scopeCtx.fillText(`${totalCycleTime.toFixed(2)} s`, w - 42, midY + 14);
    
    scopeCtx.fillText(`+${scopeMaxRange.toFixed(1)} V`, 6, 14);
    scopeCtx.fillText(`+${(scopeMaxRange / 2).toFixed(2)} V`, 6, midY / 2 + 4);
    scopeCtx.fillText(`-${(scopeMaxRange / 2).toFixed(2)} V`, 6, midY + midY / 2 + 4);
    scopeCtx.fillText(`-${scopeMaxRange.toFixed(1)} V`, 6, h - 6);

    drawWave(scopeCtx, midY, w);

    if (mousePos.active) {
        drawMagnifier(w, h, midY);
    }
}

function drawMagnifier(w, h, midY) {
    const zoom = 5;
    const radius = 85;
    const mx = mousePos.x;
    const my = mousePos.y;

    const cursorVoltage_V = ((midY - my) / midY) * scopeMaxRange;
    const cursorTime_s = (mx / w) * totalCycleTime;

    scopeCtx.save();
    scopeCtx.beginPath();
    scopeCtx.arc(mx, my, radius, 0, Math.PI * 2);
    scopeCtx.fillStyle = "#ffffff";
    scopeCtx.fill();
    scopeCtx.clip();

    scopeCtx.translate(mx, my);
    scopeCtx.scale(zoom, zoom);
    scopeCtx.translate(-mx, -my);

    scopeCtx.strokeStyle = "#e3f2fd";
    scopeCtx.lineWidth = 1 / zoom;
    const gridStepV = scopeMaxRange > 10 ? 0.5 : 0.2;
    for (let v = -scopeMaxRange; v <= scopeMaxRange; v += gridStepV) {
        const yPos = midY - (v / scopeMaxRange) * midY;
        scopeCtx.beginPath();
        scopeCtx.moveTo(0, yPos);
        scopeCtx.lineTo(w, yPos);
        scopeCtx.stroke();
    }

    scopeCtx.strokeStyle = "#888";
    scopeCtx.beginPath();
    scopeCtx.moveTo(0, midY);
    scopeCtx.lineTo(w, midY);
    scopeCtx.stroke();

    drawWave(scopeCtx, midY, w);
    scopeCtx.restore();

    scopeCtx.strokeStyle = "#1565c0";
    scopeCtx.lineWidth = 1;
    scopeCtx.beginPath();
    scopeCtx.moveTo(mx - 12, my);
    scopeCtx.lineTo(mx + 12, my);
    scopeCtx.moveTo(mx, my - 12);
    scopeCtx.lineTo(mx, my + 12);
    scopeCtx.stroke();

    scopeCtx.strokeStyle = "#1a237e";
    scopeCtx.lineWidth = 3;
    scopeCtx.beginPath();
    scopeCtx.arc(mx, my, radius, 0, Math.PI * 2);
    scopeCtx.stroke();
    scopeCtx.lineWidth = 1;

    const sign = cursorVoltage_V >= 0 ? "+" : "";
    const labelText = `U = ${sign}${cursorVoltage_V.toFixed(3)} V | t = ${cursorTime_s.toFixed(3)} s`;
    scopeCtx.font = "bold 12px Segoe UI, sans-serif";
    const textWidth = scopeCtx.measureText(labelText).width;
    
    let boxX = mx - textWidth / 2 - 8;
    if (boxX < 5) boxX = 5;
    if (boxX + textWidth + 16 > w) boxX = w - textWidth - 21;
    
    let boxY = my - radius - 28;
    if (boxY < 5) boxY = my + radius + 8;

    scopeCtx.fillStyle = "rgba(26, 35, 126, 0.92)";
    scopeCtx.fillRect(boxX, boxY, textWidth + 16, 22);
    scopeCtx.fillStyle = "#ffffff";
    scopeCtx.fillText(labelText, boxX + 8, boxY + 15);
}

function recordMeasurement() {
    if (maxVoltage === 0) {
        alert("Najpierw upuść magnes, aby zmierzyć napięcie!");
        return;
    }
    measurementCount++;
    const h_m = (h_cm / 100).toFixed(2);
    const v_ms = Math.sqrt(2 * g * (h_cm / 100)).toFixed(2);
    
    const tbody = document.getElementById('resultsBody');
    const row = tbody.insertRow();
    row.innerHTML = `
        <td>${measurementCount}</td>
        <td>${h_m}</td>
        <td>${v_ms}</td>
        <td>${turns}</td>
        <td><b>${maxVoltage.toFixed(3)}</b></td>
    `;
}

function clearTable() {
    document.getElementById('resultsBody').innerHTML = "";
    measurementCount = 0;
}

let lastTime = performance.now();
function loop(now) {
    const dt = (now - lastTime) / 1000;
    lastTime = now;

    updatePhysics(Math.min(dt, 0.03));
    drawSim();
    drawScope();
    requestAnimationFrame(loop);
}

resetMagnet();
requestAnimationFrame(loop);
