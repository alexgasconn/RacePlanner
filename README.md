# Race Planner Pro 🏃‍♂️⛰️

**The ultimate strategic tool for trail runners and endurance athletes.**

Race Planner Pro transforms a standard GPX file into a professional-grade race strategy. Unlike basic calculators, it uses a **Bio-Metric Physics Engine** to generate realistic pacing plans based on terrain difficulty, physiological fatigue, and course technicality.

## 🧠 How It Works (The Engine)

The app utilizes a sophisticated algorithm inspired by metabolic cost research (Minetti et al.):

*   **Terrain Physics:** Calculates the exact energy cost of every meter. It understands that while -5% gradient is free speed, -20% requires "braking" which costs energy and time.
*   **Technicality Penalty:** Detects jagged, technical terrain. If a "flat" sector has high vertical oscillation (constant up/down), the engine penalizes the pace.
*   **Smart Fatigue Modeling:** Simulates glycogen depletion and muscular fatigue (eccentric load from downhills) to realistically decay your efficiency over the race duration.
*   **Strategic Pacing Arc:** Enforces a "Pro" strategy:
    1.  **Conservative Start:** Holds back effort in the first 10% to spare glycogen.
    2.  **Mid-Race Attack:** Increases intensity during the "flow state" miles.
    3.  **Grit Finish:** Models physiological drift but locks in a mental push for the final kilometers.

## 📊 Key Features

### 1. Advanced Terrain Analysis
*   **Pro Elevation Profile:** Dynamic coloring based on 7 levels of difficulty (Deep Teal for steep descents → Rich Red for vertical walls).
*   **Map Visualizer:** Interactive map with data overlays. Color the track by **Gradient**, **Target Pace**, **Time Bank**, or **Fatigue Level**.

### 2. Race Intelligence
*   **Course DNA:** Instant metrics on Vertical Density (m/km), Runnability %, and Steepness %.
*   **Key Moments:** Automatically identifies "The Summit" (max elevation), "The Crux" (steepest section), and "The Grind" (longest continuous climb).
*   **Split Strategy:** Visualizes negative vs. positive split strategy.

### 3. Strategic Charts
*   **Time Bank:** The most critical chart for racing. It shows exactly where you should be "ahead" or "behind" the average clock time, preventing panic on climbs.
*   **Pace Variance:** Visualizes how many seconds +/- per km you should deviate from your average pace.

### 4. Actionable Sector Breakdown
*   **Dynamic Splits:** Break the race into 500m, 1km, or 1mi sectors.
*   **Aid Station Management:** Input aid station locations and stop times. The algorithm recalculates moving pace to ensure you still hit your goal time.
*   **Export:** Download a **Visual Cheat Sheet (PNG)** for your phone or a **CSV** for detailed analysis.

## 🚀 How To Use

1.  **Upload:** Drag & drop your `.gpx` file (or load a sample from the Data folder).
2.  **Configure:**
    *   Set your **Target Finish Time**.
    *   Choose **Metric** (km/m) or **Imperial** (mi/ft).
    *   Add **Aid Stations** (Distance + Expected Stop Time).
3.  **Analyze:** Use the dashboard to memorize key climbs and pace targets. Hover over charts to see the exact location on the map.
4.  **Export:** Print your plan or save the Cheat Sheet image.

---
*Built for athletes who want to leave nothing to chance.*