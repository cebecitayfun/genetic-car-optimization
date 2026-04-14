# Artificial Intelligence in Action - Applied Programming Project
**Project Title:** Optimization Simulation: Evolving 2D Cars with a Genetic Algorithm
**Student Name:** Tayfun Cebeci

---

## 1. Introduction and Selected Problem
For this applied programming project, I selected **Topic 3: Optimization Simulation**, choosing to build a robust **Genetic Algorithm (GA)** tool that simulates natural selection. The core problem this application addresses is physical design and navigation optimization: evolving a 2D vehicle capable of traversing an unpredictable, infinitely generated, highly uneven terrain without flipping or getting stuck.

Instead of writing a hardcoded heuristic for navigating the terrain, this simulation utilizes a physics engine to enforce real-world constraints (gravity, friction, inertia, and torque) and uses the Genetic Algorithm to continuously find the optimal local and global maximum configurations (vehicle body shapes, wheel dimensions, wheel placement, and motor torque).

## 2. Mathematical & Theoretical Background of the Algorithm

The Genetic Algorithm implemented here is inspired by Darwinian natural selection and follows these primary theoretical stages:

### A. Initialization (Genome Encoding)
A "Genome" represents a single car. Each genome contains a set of continuous numerical parameters:
*   `radii[8]`: The distances from the center vertex to construct the 8-sided concave polygon body (pizza-slice method).
*   `wheelNode1`, `wheelNode2`: The specific vertices where the two wheels are attached via revolute constraints (axles).
*   `wheelR1`, `wheelR2`: The mathematical radii of the circular wheels.
*   `motorSpeed`: The uniform torque applied to both wheels.
*   `density`, `wheelDensity`: Mass distribution parameters critical for calculating the Moment of Inertia.

### B. Fitness Evaluation
Each car in the population size (N=25) is spawned simultaneously. The physics engine integrates their movements over time. The fitness function $F(x)$ is mathematically straightforward but highly effective:
$$ F = \max(x_{position}) $$
The fitness score is strictly the maximum horizontal distance traveled on the X-axis before the car "dies" (due to getting stuck, flipping, or time limit exhaustion).

### C. Selection (Elitism)
To prevent the loss of optimal solutions and avoid divergence across generations, a strict **Elitism Selection** method is applied. The population is sorted descending by $F(x)$:
*   The top-performing vehicles (Elites) are directly cloned into the next generation without changes, preserving the absolute maximums discovered.
*   The "parent pools" are drawn exclusively from the top 50% of the population, aggressively filtering out poor traits.

### D. Crossover and Mutation
To escape local maximums (e.g., a car shape that performs well on slight hills but fails immediately on steep drops), crossover and mutation are applied:
*   **Crossover:** Selected parents mix their distinct traits (e.g., Parent A's wheel radii combined with Parent B's body density and motor torque).
*   **Continuous Mutation:** A bounded noise variation is added to children with a given probability (Mutation Rate). For instance, $Radius_{new} = Radius_{old} + \Delta$, where $\Delta$ is a random scalar clamped between empirical limits. This mathematical perturbation mechanism searches the adjacent continuous solution space.

## 3. Code Architecture Overview

The software is implemented strictly using Vanilla JavaScript, HTML5, CSS3, and the **Matter.js** 2D physics engine. The architecture follows an Object-Oriented paradigm, separated into the following specific modules:

*   **`index.html` & `style.css` (UI Layer):** 
    Provides the frontend presentation, interactive controls (time scaling, generation skipping, mutation sliders), and the analytics dashboard rendering the `Chart.js` historical graphs.
*   **`engine.js` (Physics & Simulation Controller):** 
    Handles the `Matter.Engine` integration. It procedurally generates the endless physical terrain using interconnected rigid rectangles (anti-tunneling strategy). It is the central time-step loop, managing collisions, the collision slop (`_restingThresh`), and global gravity settings.
*   **`car.js` (Physical Manifestation):** 
    Takes a mathematical genome and translates it into physical bodies. It handles complex physics tasks such as generating concave shapes via an array of 8 triangulated convex composite bodies (pizza-slices) coupled with revolute joints with specific elastic stiffness matrices. It also correctly applies `body.torque` strictly based on the genomic `motorSpeed`, preventing impulsive "snap" hopping.
*   **`genetic.js` (Algorithm Core):** 
    Fully decoupled from the physics engine. It handles purely genomic data structures, scoring arrays, sorting logic, parent selection probabilities, crossover merging rules, and mutation clamping boundaries.

---

### Demonstration Video Link
**[INSERT YOUTUBE/DRIVE UNLISTED VIDEO LINK HERE]**
*(Note: As required, the video demonstrates the UI, the real-time simulation, the fast-forward mechanisms, and explains the background genetic progression briefly.)*
