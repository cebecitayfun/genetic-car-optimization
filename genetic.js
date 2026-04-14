// genetic.js v2 - Poligon Genomlarını Yöneten Evrim Algoritması

class GeneticAlgorithm {
    constructor(populationSize, mutationRate) {
        this.populationSize = populationSize;
        this.mutationRate = mutationRate;
        this.generation = 1;
        this.population = [];
        this.bestCar = null;
        this.allTimeBestDist = 0;
        
        // V2 Chart and Analytics Properties
        this.historicalBestDistances = []; 
        this.topScores = []; // Array of { dist: number, gen: number }
    }

    initPopulation(startX, startY) {
        this.population = [];
        for (let i = 0; i < this.populationSize; i++) {
            this.population.push(new Car(startX, startY));
        }
    }

    isEveryoneDead() {
        return this.population.every(car => !car.alive);
    }

    evolve(startX, startY) {
        this.calculateFitness();

        // Grafik için veriyi kaydet
        if (this.bestCar) {
            this.historicalBestDistances.push(this.bestCar.distance);
            this.updateTopScores(this.bestCar.distance, this.generation);
        }

        const newGeneration = [];

        // ELITISM: En iyi araba
        const eliteGenome = JSON.parse(JSON.stringify(this.bestCar.genome)); 
        newGeneration.push(new Car(startX, startY, eliteGenome));

        for (let i = 1; i < this.populationSize; i++) {
            const parentA = this.selectParent();
            const parentB = this.selectParent();

            let childGenome = this.crossover(parentA.genome, parentB.genome);
            childGenome = this.mutate(childGenome);
            
            newGeneration.push(new Car(startX, startY, childGenome));
        }

        this.population = newGeneration;
        this.generation++;
    }

    updateTopScores(dist, gen) {
        if (dist <= 0) return;
        // Aynı gen'in skorunu güncelle veya ekle
        const existing = this.topScores.find(s => s.gen === gen);
        if (existing) {
            if (dist > existing.dist) existing.dist = dist;
        } else {
            this.topScores.push({ dist: dist, gen: gen });
        }
        // Azalana göre sırala ve ilk 10'u tut
        this.topScores.sort((a, b) => b.dist - a.dist);
        if (this.topScores.length > 10) {
            this.topScores = this.topScores.slice(0, 10);
        }
    }

    calculateFitness() {
        let maxDist = 0;
        this.bestCar = this.population[0];

        for (let car of this.population) {
            if (car.distance < 0) car.distance = 0;
            if (car.distance > maxDist) {
                maxDist = car.distance;
                this.bestCar = car;
            }
        }
        
        if (maxDist > this.allTimeBestDist) {
            this.allTimeBestDist = maxDist;
        }

        let sumFitness = 0;
        for (let car of this.population) {
            car.fitness = Math.pow(car.distance, 2); 
            sumFitness += car.fitness;
        }

        for (let car of this.population) {
            car.prob = car.fitness / sumFitness;
        }
    }

    selectParent() {
        let index = 0;
        let r = Math.random();
        while (r > 0 && index < this.population.length) {
            r -= this.population[index].prob;
            index++;
        }
        index--;
        if(index < 0) index = 0;
        return this.population[index];
    }

    // Çaprazlama (Çeşitli Gövde Tipleri)
    crossover(genomeA, genomeB) {
        const numV = Math.random() > 0.5 ? genomeA.numVertices : genomeB.numVertices;
        let newRadii = [];
        
        for (let i = 0; i < numV; i++) {
            const rA = genomeA.radii[i] || 50;
            const rB = genomeB.radii[i] || 50;
            newRadii.push(Math.random() > 0.5 ? rA : rB);
        }

        let wheel1 = Math.random() > 0.5 ? genomeA.wheelNode1 : genomeB.wheelNode1;
        let wheel2 = Math.random() > 0.5 ? genomeA.wheelNode2 : genomeB.wheelNode2;
        
        // Tekerlek bağlantı noktalarını yeni köşe sayısına göre ayarla
        wheel1 = wheel1 % numV;
        wheel2 = wheel2 % numV;
        
        while (Math.abs(wheel1 - wheel2) < Math.max(1, Math.floor(numV/4))) {
            wheel2 = Math.floor(Math.random() * numV);
        }

        return {
            radii: newRadii,
            numVertices: numV,
            wheelNode1: wheel1,
            wheelNode2: wheel2,
            wheelR1: Math.random() > 0.5 ? genomeA.wheelR1 : genomeB.wheelR1,
            wheelR2: Math.random() > 0.5 ? genomeA.wheelR2 : genomeB.wheelR2,
            wheelDensity1: Math.random() > 0.5 ? genomeA.wheelDensity1 : genomeB.wheelDensity1,
            wheelDensity2: Math.random() > 0.5 ? genomeA.wheelDensity2 : genomeB.wheelDensity2,
            motorSpeed: Math.random() > 0.5 ? genomeA.motorSpeed : genomeB.motorSpeed,
            density: Math.random() > 0.5 ? genomeA.density : genomeB.density
        };
    }

    // Mutasyon (Çeşitli Gövde Tipleri)
    mutate(genome) {
        const numV = genome.numVertices || 8;
        
        // SADECE yarıçapları mutasyona uğrat
        for (let i = 0; i < numV; i++) {
            if (Math.random() < this.mutationRate) {
                // Şekiller her yöne esneyebilsin diye kısıtları gevşet
                genome.radii[i] += (Math.random() - 0.5) * 40;
                genome.radii[i] = Math.max(15, Math.min(120, genome.radii[i]));
            }
        }


        if (Math.random() < this.mutationRate) { 
            genome.wheelNode1 = Math.floor(Math.random() * genome.numVertices); 
        }
        if (Math.random() < this.mutationRate) { 
            genome.wheelNode2 = Math.floor(Math.random() * genome.numVertices); 
        }
        
        // Tekerlek bağlantı noktalarını güncelle
        while (Math.abs(genome.wheelNode1 - genome.wheelNode2) < Math.max(1, Math.floor(genome.numVertices/4))) {
            genome.wheelNode2 = Math.floor(Math.random() * genome.numVertices);
        }

        if (Math.random() < this.mutationRate) { 
            genome.wheelR1 += (Math.random() - 0.5) * 10; 
            genome.wheelR1 = Math.max(15, Math.min(50, genome.wheelR1));  // Daha büyük tekerlek aralığı
        }
        if (Math.random() < this.mutationRate) { 
            genome.wheelR2 += (Math.random() - 0.5) * 10; 
            genome.wheelR2 = Math.max(15, Math.min(50, genome.wheelR2));
        }
        if (Math.random() < this.mutationRate) { 
            genome.wheelDensity1 += (Math.random() - 0.5) * 0.004; 
            genome.wheelDensity1 = Math.max(0.001, Math.min(0.015, genome.wheelDensity1));
        }
        if (Math.random() < this.mutationRate) { 
            genome.wheelDensity2 += (Math.random() - 0.5) * 0.004; 
            genome.wheelDensity2 = Math.max(0.001, Math.min(0.015, genome.wheelDensity2));
        }
        if (Math.random() < this.mutationRate) { 
            genome.motorSpeed += (Math.random() - 0.5) * 0.02; 
            genome.motorSpeed = Math.max(0.01, Math.min(0.08, genome.motorSpeed));  // Max 0.08 - uçmayı önle
        }
        if (Math.random() < this.mutationRate) { 
            genome.density += (Math.random() - 0.5) * 0.002; 
            genome.density = Math.max(0.004, Math.min(0.012, genome.density));  // Ağır kal
        }
        
        return genome;
    }
}
