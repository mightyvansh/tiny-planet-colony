/* =============================================================
   economy.js — the resource simulation.
   Economy.step(dt) advances the colony by `dt` seconds.
   Resources: Energy, Oxygen, Food (new), Science.
   Morale is derived from resource satisfaction and buildings.
   ============================================================= */

const Economy = {

  mults() {
    const t = State.data.techs;
    return {
      energy:  1 + (t.efficientSolar ? 0.25 : 0) + (t.fusionCells ? 0.25 : 0),
      oxygen:  1 + (t.denseAlgae ? 0.25 : 0),
      science: 1 + (t.quantumLab ? 0.30 : 0),
      oxyUse:  t.terraforming ? 0.70 : 1,
      food:    1 + (t.advancedBio ? 0.40 : 0),
      foodUse: t.advancedBio ? 0.80 : 1,
      auxEnergy: t.industrialAutomation ? 0.70 : 1,
    };
  },

  sun(daytime = State.data.daytime) {
    const elev = Math.sin(daytime * Math.PI * 2 - Math.PI / 2);
    const light = clamp(elev * 0.5 + 0.5, 0, 1);
    const factor = CONFIG.SOLAR_NIGHT + (1 - CONFIG.SOLAR_NIGHT) * light;
    return { elev, light, factor };
  },

  rates() {
    const d = State.data;
    const c = this.effectiveCounts();
    const m = this.mults();
    const pop = Math.max(0, d.population);

    const stormFactor = d.storm ? d.storm.factor : 1;
    const dayFactor = this.sun().factor;

    const energyProd = c.solar * BUILDINGS.solar.base.energy * m.energy * stormFactor * dayFactor;
    const energyUse =
      c.oxygen  * BUILDINGS.oxygen.base.energyUse +
      c.lab     * BUILDINGS.lab.base.energyUse +
      c.home    * BUILDINGS.home.base.energyUse +
      c.farm    * BUILDINGS.farm.base.energyUse * m.auxEnergy +
      c.medBay  * BUILDINGS.medBay.base.energyUse * m.auxEnergy +
      c.factory * BUILDINGS.factory.base.energyUse * m.auxEnergy +
      pop * CONFIG.POP_ENERGY_USE;

    const oxygenProdRaw = c.oxygen * BUILDINGS.oxygen.base.oxygen * m.oxygen;
    const oxygenUse =
      c.home  * BUILDINGS.home.base.oxygenUse +
      c.farm  * BUILDINGS.farm.base.oxygenUse +
      pop * CONFIG.POP_OXYGEN_USE * m.oxyUse;

    const scienceProdRaw = c.lab * BUILDINGS.lab.base.science * m.science;

    const foodProdRaw = c.farm * BUILDINGS.farm.base.food * m.food;
    const foodUse = pop * CONFIG.POP_FOOD_USE * m.foodUse;

    return { c, energyProd, energyUse, oxygenProdRaw, oxygenUse, scienceProdRaw, foodProdRaw, foodUse };
  },

  effectiveCounts() {
    const c = { solar: 0, oxygen: 0, lab: 0, home: 0, battery: 0, farm: 0, medBay: 0, factory: 0 };
    const grid = State.data.grid;
    for (let r = 0; r < grid.length; r++)
      for (let col = 0; col < grid[r].length; col++) {
        const k = grid[r][col];
        if (!k || !(k in c)) continue;
        c[k] += World.isChoked(col, r) ? CONFIG.INFEST_CHOKE : 1;
      }
    return c;
  },

  capacities() {
    const c = State.counts();
    return {
      energy: CONFIG.CAP_BASE + c.solar  * CONFIG.CAP_PER_SOLAR + c.home * CONFIG.CAP_PER_HOME
              + c.battery * BUILDINGS.battery.storage,
      oxygen: CONFIG.CAP_BASE + c.oxygen * CONFIG.CAP_PER_OXY   + c.home * CONFIG.CAP_PER_HOME,
      food:   CONFIG.FOOD_CAP_BASE + c.farm * CONFIG.FOOD_PER_FARM,
    };
  },

  /* Morale: 0–100 derived from resource fullness + support buildings.
     Morale scales all non-solar production via a multiplier. */
  morale() {
    const d = State.data;
    const cap = this.capacities();
    const c = State.counts();

    const energySat = clamp(d.energy / (cap.energy * 0.5), 0, 1);
    const oxygenSat = clamp(d.oxygen / (cap.oxygen * 0.5), 0, 1);
    const foodSat   = clamp(d.food   / (cap.food   * 0.4), 0, 1);

    const buildingBoost = Math.min(
      (c.medBay  || 0) * (BUILDINGS.medBay.moralePer  || 0) +
      (c.factory || 0) * (BUILDINGS.factory.moralePer || 0),
      30
    );

    const base = (energySat * 0.3 + oxygenSat * 0.4 + foodSat * 0.3) * 70;
    return clamp(base + buildingBoost, 0, 100);
  },

  /* Morale → production multiplier (affects oxygen, science, food but NOT solar). */
  moraleMult() {
    const m = this.morale();
    const t = m / 100;
    return CONFIG.MORALE_PROD_MIN + (CONFIG.MORALE_PROD_MAX - CONFIG.MORALE_PROD_MIN) * t;
  },

  step(dt) {
    const d = State.data;
    if (d.status !== 'playing') return;

    d.daytime = (d.daytime + dt / CONFIG.DAY_LENGTH) % 1;

    const R = this.rates();
    const cap = this.capacities();
    const mm = this.moraleMult();

    /* ENERGY */
    const energyAvail = d.energy + R.energyProd * dt;
    const energyNeed  = R.energyUse * dt;
    let brownout = 1;
    if (energyNeed > 0) brownout = clamp(energyAvail / energyNeed, 0, 1);
    d.energy = clamp(energyAvail - energyNeed, 0, cap.energy);

    /* OXYGEN — throttled by energy and morale */
    const oxygenProd = R.oxygenProdRaw * brownout * mm;
    const oxygenNet  = oxygenProd - R.oxygenUse;
    let newOxygen = d.oxygen + oxygenNet * dt;
    let suffocating = false;
    if (newOxygen < 0) { suffocating = true; newOxygen = 0; }
    d.oxygen = clamp(newOxygen, 0, cap.oxygen);

    /* FOOD — throttled by energy and morale */
    const foodProd = R.foodProdRaw * brownout * mm;
    const foodNet  = foodProd - R.foodUse;
    let newFood = d.food + foodNet * dt;
    let starving = false;
    if (newFood < 0) { starving = true; newFood = 0; }
    d.food = clamp(newFood, 0, cap.food);

    /* SCIENCE */
    const scienceProd = R.scienceProdRaw * brownout * mm;
    d.science += scienceProd * dt;

    /* POPULATION */
    const capacity = State.capacity();
    const c = State.counts();
    const medBayFactor = c.medBay > 0 ? 0.5 : 1;   // medBays halve the death rate

    if (suffocating) {
      const deficit  = R.oxygenUse - oxygenProd;
      const severity = clamp(deficit / Math.max(1, R.oxygenUse), 0.2, 1);
      d.population -= CONFIG.DIE_RATE * severity * medBayFactor * dt;
    } else if (starving) {
      d.population -= CONFIG.DIE_RATE * 0.3 * medBayFactor * dt;
    } else if (oxygenNet > 0.1 && foodNet > -0.5 && brownout > 0.95 && d.population < capacity) {
      const room = clamp(capacity - d.population, 0, 1);
      d.population += CONFIG.GROW_RATE * room * mm * dt;
    }
    d.population = Math.max(0, d.population);

    /* stash computed values for the HUD */
    d.rates = {
      energy:  R.energyProd - R.energyUse,
      oxygen:  oxygenProd - R.oxygenUse,
      food:    foodProd - R.foodUse,
      science: scienceProd,
    };
    d.morale = this.morale();

    /* WIN / LOSE */
    if (d.population <= 0) {
      d.population = 0;
      d.status = 'lost';
      d.lossReason = 'The last colonist is gone. The colony fell silent.';
    } else if (State.corruptionFraction() >= 0.85) {
      d.status = 'lost';
      d.lossReason = 'The blight consumed the planet. Nothing survives here now.';
    } else if (State.greenFraction() >= CONFIG.WIN_GREEN) {
      d.status = 'won';
    }
  },

  canAfford(key) {
    const cost = BUILDINGS[key].cost;
    return State.data.energy  >= (cost.energy  || 0) &&
           State.data.science >= (cost.science || 0);
  },

  pay(key) {
    const cost = BUILDINGS[key].cost;
    State.data.energy  -= (cost.energy  || 0);
    State.data.science -= (cost.science || 0);
  },
};

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
