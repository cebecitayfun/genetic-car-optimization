// car.js v5 - Referans Tasarım: Triangle-Fan Polygon + Giant Wheels
// Bug Fix: fromVertices kullanmıyor! Hull = invisible rectangle, 
// görsel olarak afterRender'da Canvas 2D ile çiziliyor.

class Car {
    constructor(x, y, genome = null) {
        this.alive = true;
        this.distance = 0;
        this.timer = 0;
        this.prevX = x;
        this.stuckCounter = 0;

        if (genome) {
            this.genome = genome;
        } else {
            // CONCAVE 8GEN GÖVDE SİSTEMİ - İç bükey gövdeler
            const numVertices = 8;  // SABİT 8 köşe
            const radii = [];
            
            // Dış köşeler için rastgele yarıçaplar
            for (let i = 0; i < numVertices; i++) {
                radii.push(40 + Math.random() * 60);
            }
            
            // Tekerlek bağlantı noktaları
            const wheel1 = Math.floor(Math.random() * numVertices);
            let wheel2 = Math.floor(Math.random() * numVertices);
            
            while (Math.abs(wheel1 - wheel2) < Math.floor(numVertices / 3)) {
                wheel2 = Math.floor(Math.random() * numVertices);
            }

            this.genome = {
                radii: radii,
                numVertices: numVertices,
                wheelNode1: wheel1,
                wheelNode2: wheel2,
                wheelR1: 15 + Math.random() * 20,     // 15-35 arası tekerlek
                wheelR2: 15 + Math.random() * 20,
                wheelDensity1: 0.003 + Math.random() * 0.003,  // Ağır tekerlekler
                wheelDensity2: 0.003 + Math.random() * 0.003,
                motorSpeed: 0.01 + Math.random() * 0.03,  // 0.01-0.04 (mutasyonla büyüyebilir)
                density: 0.006 + Math.random() * 0.003,   // AĞIR gövde (eskiden 0.003)
            };
        }

        const numV = this.genome.numVertices || 8;
        const angleStep = (Math.PI * 2) / numV;

        // Renk paleti
        const colorPalette = [
            { fill: 'rgba(110, 180, 230, 0.82)', edge: '#3a7ca5' },
            { fill: 'rgba(160, 200, 120, 0.82)', edge: '#5a8040' },
            { fill: 'rgba(230, 160, 90, 0.82)',  edge: '#a06020' },
            { fill: 'rgba(200, 110, 210, 0.82)', edge: '#803090' },
            { fill: 'rgba(100, 210, 170, 0.82)', edge: '#208060' },
        ];
        this.color = colorPalette[Math.floor(Math.random() * colorPalette.length)];

        const avgR = this.genome.radii.reduce((a, b) => a + b, 0) / numV;

        // ============================================================
        // HULL FİZİK MODELİ - GERÇEK İÇBÜKEY (PIZZA DİLİMLERİ YÖNTEMİ)
        // Rednuht'taki gibi yıldız/içbükey şekillerin çalışması için
        // gövdeyi 8 adet üçgenden oluşan compound (birleşik) yapıya dönüştürüyoruz.
        // Yoksa poly-decomp olmadığı için Matter.js düz bir convex hull (kutu) çizer!
        // ============================================================
        const vertexSets = [];
        let cx = 0, cy = 0, totalArea = 0;

        for (let i = 0; i < numV; i++) {
            const a1 = i * angleStep;
            const a2 = ((i + 1) % numV) * angleStep;
            const r1 = this.genome.radii[i];
            const r2 = this.genome.radii[(i + 1) % numV];
            
            // Merkezden dışa doğru bir üçgen dilimi
            const verts = [
                { x: 0, y: 0 },
                { x: r1 * Math.cos(a1), y: r1 * Math.sin(a1) },
                { x: r2 * Math.cos(a2), y: r2 * Math.sin(a2) }
            ];
            vertexSets.push(verts);

            // Ağırlık merkezini hesaplamak için
            const area = Math.abs(Matter.Vertices.area(verts));
            const centre = Matter.Vertices.centre(verts);
            cx += centre.x * area;
            cy += centre.y * area;
            totalArea += area;
        }

        // Tüm araçlar aynı negatif grubu paylaşır
        const CAR_GROUP = -1;

        // true parametresi: Çokgenleri birleştirmek için flag
        this.hull = Matter.Bodies.fromVertices(x, y, vertexSets, {
            collisionFilter: {
                group: CAR_GROUP,
                category: 0x0001,
                mask: 0x0002
            },
            frictionAir: 0.001,
            friction: 1.5,       // Güvenilir sürtünme - gövde mape değdiğinde fra.uygular
            density: this.genome.density,
            restitution: 0.0,
            render: { visible: false }
        });

        // fromVertices centroid of hull is shifted from (x,y).
        // ÖNCE offset'i kaydet (setPosition'dan ÖNCE), SONRA taşı.
        this.localRadialX = x - this.hull.position.x;
        this.localRadialY = y - this.hull.position.y;
        Matter.Body.setPosition(this.hull, { x: x, y: y });

        // === KRİTİK DÜZELTME 1: Collision filter + friction + restitution tüm alt parçalara ===
        // Compound body collision'da parçaların kendi friction/restitution'sı kullanılır!
        // Parent body'ye atadığımız 1.5 friction alt parçalara OTAPATİK GEÇMEZ.
        // Her parçaya ayrıca atamazk zorundayiz.
        const carFilter = { group: CAR_GROUP, category: 0x0001, mask: 0x0002 };
        for (let i = 0; i < this.hull.parts.length; i++) {
            this.hull.parts[i].collisionFilter = carFilter;
            this.hull.parts[i].friction = 1.5;      // Güvde mape sürtününce güçlü fren
            this.hull.parts[i].restitution = 0.0;   // Sıfır sekme
        }

        // === KRİTİK DÜZELTME 2: Inertia'yı manuel küçült ===
        // fromVertices compound body'nin atalet momenti çok yüksek çıkar
        // (dagılık üçgenler = devasa inertia). Düşük inertia = kolay dönüş.
        // avgR çaplı disk'in yarısı kadar inertia veri: araç havada rahatça döner.
        const targetInertia = this.hull.mass * avgR * avgR * 0.4;
        Matter.Body.setInertia(this.hull, targetInertia);

        // Tekerlek bağlantı noktaları
        const wheelA1 = this.genome.wheelNode1 * angleStep;
        const wheelR1 = this.genome.radii[this.genome.wheelNode1];
        const wheelA2 = this.genome.wheelNode2 * angleStep;
        const wheelR2 = this.genome.radii[this.genome.wheelNode2];

        // Hull'ın şu anki pozisyonu centroid. Radyal merkezi bulmak için:
        const hullCX = this.hull ? this.hull.position.x : x;
        const hullCY = this.hull ? this.hull.position.y : y;
        const radialX = hullCX + this.localRadialX;
        const radialY = hullCY + this.localRadialY;

        const wp1 = {
            x: radialX + wheelR1 * 0.65 * Math.cos(wheelA1),
            y: radialY + wheelR1 * 0.65 * Math.sin(wheelA1)
        };
        const wp2 = {
            x: radialX + wheelR2 * 0.65 * Math.cos(wheelA2),
            y: radialY + wheelR2 * 0.65 * Math.sin(wheelA2)
        };

        this.wheel1 = Matter.Bodies.circle(wp1.x, wp1.y, this.genome.wheelR1, {
            collisionFilter: {
                group: CAR_GROUP,
                category: 0x0001,
                mask: 0x0002
            },
            friction: 0.9,
            frictionStatic: 1.0,
            frictionAir: 0.02,     // Doğal hız sınırlaması: terminal hıza ulaşınca torque dengelenir
            restitution: 0.0,      // Sıfır sekme: tekerlek toprak'a basılı kalır
            density: this.genome.wheelDensity1 || 0.003,
            render: { fillStyle: '#1a1a1a', strokeStyle: '#444', lineWidth: 2 }
        });

        this.wheel2 = Matter.Bodies.circle(wp2.x, wp2.y, this.genome.wheelR2, {
            collisionFilter: {
                group: CAR_GROUP,
                category: 0x0001,
                mask: 0x0002
            },
            friction: 0.9,
            frictionStatic: 1.0,
            frictionAir: 0.02,
            restitution: 0.0,
            density: this.genome.wheelDensity2 || 0.003,
            render: { fillStyle: '#1a1a1a', strokeStyle: '#444', lineWidth: 2 }
        });

        // Akslar: hull centroid'ine göre pointA hesapla
        const pa1 = { x: wp1.x - hullCX, y: wp1.y - hullCY };
        const pa2 = { x: wp2.x - hullCX, y: wp2.y - hullCY };

        this.axle1 = Matter.Constraint.create({
            bodyA: this.hull,
            pointA: pa1,
            bodyB: this.wheel1,
            length: 0, stiffness: 0.7, damping: 0.05,
            render: { visible: false }
        });
        this.axle2 = Matter.Constraint.create({
            bodyA: this.hull,
            pointA: pa2,
            bodyB: this.wheel2,
            length: 0, stiffness: 0.7, damping: 0.05,
            render: { visible: false }
        });

        this.composite = Matter.Composite.create();
        Matter.Composite.add(this.composite, [
            this.hull, this.wheel1, this.wheel2, this.axle1, this.axle2
        ]);
    } // end constructor

    // Canvas 2D ile REDNUHT GİBİ radial gövde çiz
    drawCustom(ctx, tx, ty, scaleScale) {
        if (!this.hull || !this.genome.radii) return;

        const alpha = this.alive ? 1.0 : 0.15;
        ctx.save();
        ctx.globalAlpha = alpha;

        // --- GÖVDE: Radial Polygon + Spoke Çizgileri ---
        
        // Cisim dönerken asıl radyal merkezin nerede olduğunu trigonometri ile buluyoruz.
        const rot = this.hull.angle;
        const cos = Math.cos(rot);
        const sin = Math.sin(rot);
        const centerX = this.hull.position.x + (this.localRadialX * cos - this.localRadialY * sin);
        const centerY = this.hull.position.y + (this.localRadialX * sin + this.localRadialY * cos);

        // Fiziki üçgenlerin dış köşelerini sırasıyla bul
        const pts = [];
        for (let i = 0; i < 8; i++) {
            const a = i * (Math.PI * 2 / 8) + rot;
            const r = this.genome.radii[i];
            pts.push({
                x: centerX + r * Math.cos(a),
                y: centerY + r * Math.sin(a)
            });
        }

        // 1. Ana Gövde Dış Poligonu (Fizik köşeleriyle milimetrik örtüşür)
        ctx.beginPath();
        ctx.moveTo(tx(pts[0].x), ty(pts[0].y));
        for (let i = 1; i < 8; i++) {
            ctx.lineTo(tx(pts[i].x), ty(pts[i].y));
        }
        ctx.closePath();
        
        ctx.fillStyle = this.color.fill;
        ctx.fill();
        ctx.strokeStyle = this.color.edge;
        ctx.lineWidth = 2.0;
        ctx.stroke();

        // 2. REDNUHT GİBİ SPOKE ÇİZGİLERİ - Köşelerden merkeze
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
            ctx.moveTo(tx(pts[i].x), ty(pts[i].y));
            ctx.lineTo(tx(centerX), ty(centerY));
        }
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.lineWidth = 1.0;
        ctx.stroke();

        // 3. Merkez noktası
        ctx.beginPath();
        ctx.arc(tx(centerX), ty(centerY), 3 * scaleScale, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fill();

        // --- Tekerlekler üzerine spoke (çanak çizgisi) ---
        [this.wheel1, this.wheel2].forEach(wheel => {
            if (!wheel || !wheel.circleRadius) return;

            const wx = wheel.position.x;
            const wy = wheel.position.y;
            const wr = wheel.circleRadius;
            const wrot = wheel.angle;
            const numSpokes = 6;

            // Spoke çizgileri
            ctx.strokeStyle = '#555';
            ctx.lineWidth = 1.2;
            for (let i = 0; i < numSpokes; i++) {
                const sa = wrot + (i / numSpokes) * Math.PI * 2;
                ctx.beginPath();
                ctx.moveTo(tx(wx), ty(wy));
                ctx.lineTo(
                    tx(wx + wr * Math.cos(sa)),
                    ty(wy + wr * Math.sin(sa))
                );
                ctx.stroke();
            }

            // İç göbek (hub) dairesi
            const hubR = wr * 0.22;
            ctx.beginPath();
            ctx.arc(tx(wx), ty(wy), hubR * scaleScale, 0, Math.PI * 2);
            ctx.fillStyle = '#333';
            ctx.fill();
            ctx.strokeStyle = '#666';
            ctx.lineWidth = 1;
            ctx.stroke();
        });

        ctx.restore();
    }

    update() {
        if (!this.alive) return;

        // ==============================================================
        // MOTOR: body.torque ile döndür, setAngularVelocity değil!
        //
        // Neden? setAngularVelocity her frame tekerlekle hızını aniden
        // sıfırdan hedef değere "zıplatır". Bu ani hız değişikliği eksen
        // kısıtlarından geçerek hull'a yukarı doğru impuls kuvveti gönderir
        // → araba sekiyor.
        //
        // body.torque: Motor'un açısal kuvvetidir. Matter.js bunu bir sonraki
        // fizik adımında kademeli ivme olarak uygular. Her adımda otomatik
        // sıfırlanır, yani her frame set edilmesi gerekir.
        // Tekerlek frictionAir=0.02 sayesinde doğal terminal hıza ulaşır:
        // omega_terminal = torque / (inertia * frictionAir)
        // ==============================================================
        const torque = this.genome.motorSpeed * 40; // Eskiden 600'dü, tek tekerde şaha kalkmayı engellemek için torku düşürdük
        this.wheel1.torque = torque;
        this.wheel2.torque = torque;

        if (this.hull.position.x > this.distance) {
            this.distance = this.hull.position.x;
        }

        this.timer++;

        // Maksimum yaşam süresi (8000 frame = ~2dk, sonsuz simülasyonu engeller)
        if (this.timer > 8000) {
            this.die();
            return;
        }

        // Sıkışma tespiti: her 80 frame'de bir kontrol et
        if (this.timer % 80 === 0) {
            const movement = this.hull.position.x - this.prevX;
            if (movement < 5) {
                this.stuckCounter++;
            } else {
                this.stuckCounter = 0;
            }
            this.prevX = this.hull.position.x;

            if (this.stuckCounter >= 3) {
                this.die();
                return;
            }
        }

        if (this.hull.position.y > 2000) { this.die(); return; }
        if (this.hull.position.x < (window.START_X || 150) - 200) { this.die(); return; }
    }

    // Tekerleğin yerde olup olmadığını kontrol et
    isWheelOnGround(wheel) {
        if (!wheel) return false;
        
        // DAHA ESNEK yer kontrolü - tekerlekler durmasın
        const yVelocity = Math.abs(wheel.velocity.y);
        const angularVelocity = Math.abs(wheel.angularVelocity);
        
        // ÇOK daha geniş aralıkta yerde kabul et
        // Y pozisyonu 600'e kadar, yVelocity 2'ye kadar, angularVelocity 10'a kadar
        return yVelocity < 2 && angularVelocity < 10 && wheel.position.y < 600;
    }

    die() {
        if (!this.alive) return;
        this.alive = false;
        const fade = b => { if (b && b.render) b.render.opacity = 0.1; };
        [this.wheel1, this.wheel2].forEach(fade);
        if (this.wheel1) Matter.Body.setAngularVelocity(this.wheel1, 0);
        if (this.wheel2) Matter.Body.setAngularVelocity(this.wheel2, 0);
    }
}
