// engine.js v2 - Sınırsız Harita, Grafik Motoru ve Simülasyon



let engine, render, runner, world;
let geneticEngine;
let terrain = [];
let fitnessChart = null;

// Settings
const POPULATION_SIZE = 25;
const START_X = 200;
const START_Y = 370;  // Araçlar ince terrain (Y=430) üstünde başlar
window.START_X = START_X;
let fastForwardActive = false;

// DOM Elements
const genCountEl = document.getElementById('gen-count');
const aliveCountEl = document.getElementById('alive-count');
const totalPopEl = document.getElementById('total-pop');
const currBestDistEl = document.getElementById('curr-best-dist');
const mutRateSlider = document.getElementById('mutation-rate');
const mutValEl = document.getElementById('mutation-val');
const topScoresListEl = document.getElementById('top-scores-list');
const canvasRoot = document.getElementById('simulation-box');

function initSimulation() {
    engine = Matter.Engine.create();
    world = engine.world;
    
    // ZIPLAMAYI KÖKTEN ÇÖZMEK İÇİN FİZİK AYARLARI
    engine.gravity.y = 1.5;  // Artırıldı: Araçlar daha ağır hissettiriyor
    engine.timing.timeScale = 1;
    
    // ÇARPIŞMА TEŞPİTİNİ DAHA HASSAS YAP
    engine.positionIterations = 20;
    engine.velocityIterations = 16;
    engine.constraintIterations = 4;

    // COLLISION SLOP SIFIRLA - Cisimler yüzeyin içine girmesin
    // Varsayılan değer ~4px → cisim yüzeyin 4px içine giriyor.
    // 0.001 yaparak temas ANINDA (ilk pixel'de) çarpışma kuvveti uygulanır.
    Matter.Resolver._restingThresh = 0.001;
    Matter.Resolver._restingThreshTangent = 0.001;

    render = Matter.Render.create({
        element: canvasRoot,
        engine: engine,
        options: {
            width: canvasRoot.clientWidth,
            height: canvasRoot.clientHeight,
            wireframes: false, 
            background: '#ffffff',
            hasBounds: true,
            showVelocity: false,
            showAngleIndicator: false
        }
    });

    Matter.Render.run(render);
    runner = Matter.Runner.create();
    Matter.Runner.run(runner, engine);

    // ==============================================
    // CUSTOM RENDER: Polygon gövdeleri Canvas 2D ile çiz
    // Matter.js'nin default render'dan SONRA çalışır
    // ==============================================
    Matter.Events.on(render, 'afterRender', () => {
        if (!geneticEngine || !geneticEngine.population) return;

        const ctx = render.canvas.getContext('2d');
        const bounds = render.bounds;
        const cw = render.canvas.width;
        const ch = render.canvas.height;
        const boundsW = bounds.max.x - bounds.min.x;
        const boundsH = bounds.max.y - bounds.min.y;
        const scaleX = cw / boundsW;
        const scaleY = ch / boundsH;

        // Dünya koordinatları → Canvas koordinatları
        const tx = (wx) => (wx - bounds.min.x) * scaleX;
        const ty = (wy) => (wy - bounds.min.y) * scaleY;

        for (const car of geneticEngine.population) {
            car.drawCustom(ctx, tx, ty, scaleX);
        }
    });

    createTerrain();
    initChart();

    totalPopEl.innerText = POPULATION_SIZE;
    geneticEngine = new GeneticAlgorithm(POPULATION_SIZE, mutRateSlider.value / 100);
    geneticEngine.initPopulation(START_X, START_Y);
    addCarsToWorld();

    Matter.Events.on(engine, 'beforeUpdate', mainLoop);
    
    window.addEventListener('resize', () => {
        render.canvas.width = canvasRoot.clientWidth;
        render.canvas.height = canvasRoot.clientHeight;
    });
}

function initChart() {
    const ctx = document.getElementById('fitnessChart').getContext('2d');
    fitnessChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [], 
            datasets: [{
                label: 'Best Distance (Meters)',
                data: [],
                borderColor: '#38bdf8',
                backgroundColor: 'rgba(56, 189, 248, 0.2)',
                borderWidth: 2,
                tension: 0.3, // Curve
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' }, beginAtZero: true }
            }
        }
    });
}

function updateAnalyticsUI() {
    // Top Scores Tablosunu Güncelle - Her neslin max menzilini göster
    topScoresListEl.innerHTML = '';
    if (geneticEngine.topScores.length === 0) {
        topScoresListEl.innerHTML = '<li class="score-item empty-state">Henüz rekor kırılmadı.</li>';
    } else {
        geneticEngine.topScores.forEach((score, index) => {
            const li = document.createElement('li');
            li.className = 'score-item';
            const m = (score.dist / 10).toFixed(1); // Daha gerçekçi
            const medal = index === 0 ? '🥇' : (index === 1 ? '🥈' : (index === 2 ? '🥉' : `${index+1}.`));
            li.innerHTML = `<span class="score-rank">${medal}</span> Gen ${score.gen} <span class="score-dist">${m} m</span>`;
            topScoresListEl.appendChild(li);
        });
    }

    // Çizgi Grafiği (Chart.js) Güncelle
    const labels = [];
    const data = [];
    for (let i = 0; i < geneticEngine.historicalBestDistances.length; i++) {
        labels.push('G' + (i + 1));
        data.push(parseFloat((geneticEngine.historicalBestDistances[i] / 10).toFixed(1)));
    }
    fitnessChart.data.labels = labels;
    fitnessChart.data.datasets[0].data = data;
    fitnessChart.update();
}

function createTerrain() {
    if (terrain.length > 0) {
        Matter.World.remove(world, terrain);
        terrain = [];
    }

    // ================================================================
    // REFERANS TASARIM: İnce planka segmentler (H=18px)
    // Her segmentin sol-üst köşesi = önceki segmentin sağ-üst köşesi
    // Matematik kanıtlandı: gap SIFIR
    //
    // Merkez formülü (sol-üst köşeden):
    //   cx = lastX + (W/2)*cos(θ) - (H/2)*sin(θ)
    //   cy = lastY + (W/2)*sin(θ) + (H/2)*cos(θ)
    // Sonraki bağlantı noktası:
    //   nextX = lastX + W*cos(θ)
    //   nextY = lastY + W*sin(θ)
    // ================================================================
    const H = 22;       // Anti-tunneling: 60fps'de max araba hızı ~20px/step → H>20 tun.imkansız
    const halfH = H / 2;

    const groundSettings = {
        isStatic: true,
        friction: 0.8,
        frictionStatic: 1.0,
        restitution: 0.0,
        collisionFilter: {
            group: 0,
            category: 0x0002,
            mask: 0x0001
        },
        render: { fillStyle: '#555555', strokeStyle: '#333333', lineWidth: 1 }
    };

    // Başlangıç düz platform: sol-üst köşesi (0, 430)'da, genişliği 1200
    // Merkez: (600, 430 + halfH)
    terrain.push(Matter.Bodies.rectangle(600, 430 + halfH, 1200, H, groundSettings));

    // Bağlantı noktası = başlangıç platformunun sağ-üst köşesi
    let lastX = 1200;   // İlk platformun sağ ucu (cx + W/2 = 600 + 600)
    let lastY = 430;    // Yüzey yüksekliği

    for (let i = 0; i < 1500; i++) { // Daha uzun bir map (1500 segment)
        const roll = Math.random();
        // Segment aralarına boşluk girmemesi için genişliği artır
        const w = Math.random() * 160 + 100;  // 100-260px genişlik (daha az boşluk için)
        let angle;

        // Harita çok yukarı çıkarsa (Y çok küçülürse) mecburi aşağı kavis
        if (lastY < 100) {
            angle = Math.random() * 0.3 + 0.1; // Daha az dik iniş
        // Harita çok aşağı inip uçuruma giderse mecburi tırmanış
        } else if (lastY > 1200) {
            angle = -(Math.random() * 0.3 + 0.1); // Daha az dik tırmanış
        } else {
            // Zorluk Seviyeleri (Tepe ve Çukurlar) - daha az açılarla
            if (roll < 0.20) {
                angle = Math.random() * 0.25 + 0.05;  // Az dik iniş
            } else if (roll < 0.40) {
                angle = -(Math.random() * 0.25 + 0.05); // Az dik tırmanış
            } else if (roll < 0.55) {
                angle = Math.random() * 0.5 + 0.15;  // Daha az dik iniş / Çukur
            } else if (roll < 0.70) {
                angle = -(Math.random() * 0.5 + 0.15); // Daha az dik rampa
            } else {
                angle = (Math.random() - 0.5) * 0.08;  // Daha düz
            }
        }

        const halfW = w / 2;

        // Sol-üst köşesi (lastX, lastY) olacak şekilde merkezi hesapla
        const cx = lastX + halfW * Math.cos(angle) - halfH * Math.sin(angle);
        const cy = lastY + halfW * Math.sin(angle) + halfH * Math.cos(angle);

        terrain.push(Matter.Bodies.rectangle(cx, cy, w, H, {
            ...groundSettings, angle
        }));

        // Sonraki bağlantı noktası = bu segmentin sağ-üst köşesi
        lastX = lastX + w * Math.cos(angle);
        lastY = lastY + w * Math.sin(angle);
    }

    Matter.World.add(world, terrain);
}


function addCarsToWorld() {
    for (let car of geneticEngine.population) {
        Matter.World.add(world, car.composite);
    }
}

function removeCarsFromWorld() {
    for (let car of geneticEngine.population) {
        Matter.World.remove(world, car.composite);
    }
}

// Hangi arabaya odaklanacağımızı tutan index (-1 = en öne bak)
let focusedCarIndex = -1;

const carListEl = document.getElementById('car-list');

// Her max 10 frame'de bir araba listesini güncelle (performans için)
let listUpdateCounter = 0;

function mainLoop() {
    let aliveCount = 0;
    let currentMaxDist = 0;
    // Varsayılan: başlangıç noktasına bak (boş alan değil)
    let leadCarX = START_X;
    let leadCarY = START_Y;

    for (let car of geneticEngine.population) {
        car.update();
        if (car.alive && car.hull) {
            aliveCount++;
            // Her frame gerçek hull pozisyonuyla takip et (distance değil)
            if (car.hull.position.x > leadCarX) {
                leadCarX = car.hull.position.x;
                leadCarY = car.hull.position.y;
            }
            if (car.distance > currentMaxDist) {
                currentMaxDist = car.distance;
            }
        }
    }

    aliveCountEl.innerText = aliveCount;
    currBestDistEl.innerText = (currentMaxDist / 10).toFixed(1) + " m";

    // Kamera: Odaklı araba varsa onu takip et, yoksa en öndekini takip et
    const ZOOM_W = 850;
    const ZOOM_H = 480;
    let camX = leadCarX;
    let camY = leadCarY;

    if (focusedCarIndex >= 0 && focusedCarIndex < geneticEngine.population.length) {
        const fc = geneticEngine.population[focusedCarIndex];
        if (fc && fc.hull) {
            camX = fc.hull.position.x;
            camY = fc.hull.position.y;
        }
    }

    Matter.Render.lookAt(render, {
        min: { x: camX - ZOOM_W * 0.4, y: camY - ZOOM_H * 0.65 },
        max: { x: camX + ZOOM_W * 0.6, y: camY + ZOOM_H * 0.35 }
    });

    // Araba listesini her 12 frame'de bir güncelle
    listUpdateCounter++;
    if (listUpdateCounter % 12 === 0) {
        updateCarListUI();
    }

    if (aliveCount === 0) {
        nextGeneration();
    }
}

function updateCarListUI() {
    // Arabaları mesafeye göre sırala (en önde olan en üste)
    const sorted = geneticEngine.population
        .map((car, i) => ({ car, i }))
        .sort((a, b) => b.car.distance - a.car.distance);

    carListEl.innerHTML = '';
    sorted.forEach(({ car, i }, rank) => {
        const li = document.createElement('li');
        const dist = (car.distance / 10).toFixed(1);
        const isAlive = car.alive;
        const isFocused = (focusedCarIndex === i);

        li.className = 'car-item' + (isAlive ? ' alive' : ' dead') + (isFocused ? ' focused' : '');
        li.innerHTML = `
            <span class="car-rank">${rank + 1}</span>
            <span class="car-name">Araba #${i + 1}</span>
            <span class="car-dist">${dist}m</span>
            <span class="car-status">${isAlive ? '🟢' : '🔴'}</span>
        `;
        li.addEventListener('click', () => {
            // Aynı arabaya tekrar tıklanırsa odaklamayı kaldır
            if (focusedCarIndex === i) {
                focusedCarIndex = -1;
            } else {
                focusedCarIndex = i;
            }
            updateCarListUI(); // Stil güncellemesi için
        });
        carListEl.appendChild(li);
    });
}

function nextGeneration() {
    focusedCarIndex = -1; // Kamera kilidini sıfırla
    resetSpeedMode();     // Hızı normale çevir
    removeCarsFromWorld();
    
    geneticEngine.evolve(START_X, START_Y);
    
    addCarsToWorld();
    
    genCountEl.innerText = geneticEngine.generation;
    updateAnalyticsUI();
}

// ------ UI KONTROLLERİ ------ 
// ========== BUTON KONTROLLERİ ==========

mutRateSlider.addEventListener('input', (e) => {
    mutValEl.innerText = e.target.value + "%";
    if (geneticEngine) geneticEngine.mutationRate = e.target.value / 100;
});

document.getElementById('btn-restart').addEventListener('click', () => {
    focusedCarIndex = -1;
    resetSpeedMode();
    removeCarsFromWorld();
    geneticEngine = new GeneticAlgorithm(POPULATION_SIZE, mutRateSlider.value / 100);
    geneticEngine.initPopulation(START_X, START_Y);
    addCarsToWorld();
    genCountEl.innerText = 1;
    updateAnalyticsUI();
});

// ---- BUTON 1: Fast Forward (toggle x1 / x5 / x15) ----
const btnSpeed = document.getElementById('btn-speed');
const FF_MODES = [
    { scale: 1,  label: '⚡ Fast Forward',        bg: '',                            border: '',                          color: '' },
    { scale: 5,  label: '⚡ Fast Forward (x5)',    bg: 'rgba(251,146,60,0.25)',        border: 'rgba(251,146,60,0.7)',       color: '#fb923c' },
    { scale: 15, label: '⚡ Fast Forward (x15) 🔥', bg: 'rgba(239,68,68,0.25)',        border: 'rgba(239,68,68,0.7)',        color: '#ef4444' },
];
let ffModeIndex = 0;

btnSpeed.addEventListener('click', () => {
    // Yalnızca skip sırasında değilse çalıştır
    if (isSkipping) return;
    ffModeIndex = (ffModeIndex + 1) % FF_MODES.length;
    applyFFMode(ffModeIndex);
});

function applyFFMode(idx) {
    const mode = FF_MODES[idx];
    engine.timing.timeScale = mode.scale;
    btnSpeed.innerText = mode.label;
    btnSpeed.style.background   = mode.bg;
    btnSpeed.style.borderColor  = mode.border;
    btnSpeed.style.color        = mode.color;
    ffModeIndex = idx;
}

function resetSpeedMode() {
    applyFFMode(0);
}

// ---- BUTON 2: Sonraki Nesle Geç ----
// Arabalar simüle edilmeye devam eder (timeScale=40) ta ki HERKES doğal olarak ölene kadar.
// Sonra normal hıza döner ve evrim başlar.
const btnSkipGen = document.getElementById('btn-skip-gen');
let isSkipping = false;

btnSkipGen.addEventListener('click', () => {
    if (isSkipping) return;
    isSkipping = true;
    btnSkipGen.innerText = '⏳ Simüle ediliyor...';
    btnSkipGen.disabled = true;

    // MEVCUT MAX MESAFEYİ KAYDET (önemli!)
    let currentMaxDist = 0;
    for (let car of geneticEngine.population) {
        if (car.distance > currentMaxDist) {
            currentMaxDist = car.distance;
        }
    }

    // timeScale=40 ile mevcut nesli hızlandır
    engine.timing.timeScale = 40;

    // Nesil numarasını kaydet — değişince bu gen tamamdır
    const startGen = geneticEngine.generation;

    const checkInterval = setInterval(() => {
        // NESİL DEĞİŞTİYSE VEYA HERKES ÖLDÜYSE = tamamlandı
        if (geneticEngine.generation > startGen || geneticEngine.isEveryoneDead()) {
            clearInterval(checkInterval);
            
            // Eğer herkes öldüyse ama nesil değişmediyse manuel çağır
            if (geneticEngine.generation === startGen && geneticEngine.isEveryoneDead()) {
                nextGeneration();
            }
            
            isSkipping = false;
            btnSkipGen.innerText = '⏭ Sonraki Nesle Geç';
            btnSkipGen.disabled = false;
            // timeScale zaten nextGeneration() → resetSpeedMode() ile 1'e döndü
        }
    }, 100);
});

// Eski btn-kill-all (Kıyamet) - artık hızla öldürmek için
document.getElementById('btn-kill-all').addEventListener('click', () => {
    for (let car of geneticEngine.population) { car.die(); }
});

// Başlat
window.onload = initSimulation;
