// The story: four missions for Rex, a wheelman in Solmar City, and his fixer Dante.
// Each mission is a list of stages. A stage completes when its check passes; the
// mission module only reads state and calls the world's helpers, so the rules
// stay testable without any drawing or sound in here.

export const MISSION_DEFS = [
  {
    name: 'The Pickup',
    intro: 'Dante: "Rex, a package is waiting at the marina lockup. Bring it to my garage. No cops, no fuss."',
    reward: 200,
    stages: [
      { kind: 'goto', x: 600, y: 2200, label: 'Drive to the marina lockup (south-west)' },
      { kind: 'collect', x: 600, y: 2200, label: 'Grab the package — press E on foot' },
      { kind: 'goto', x: 600, y: 600, label: 'Deliver the package to Dante\'s garage' },
    ],
  },
  {
    name: 'Hot Wheels',
    intro: 'Dante: "A client wants a yellow Comet GT. It\'s parked by the east mall. Steal it, bring it to the chop shop."',
    reward: 350,
    stages: [
      { kind: 'steal', x: 2200, y: 1000, label: 'Steal the yellow Comet GT by the east mall' },
      { kind: 'deliver', x: 2600, y: 1800, label: 'Deliver the Comet GT to the chop shop' },
    ],
  },
  {
    name: 'The Rival Crew',
    intro: 'Dante: "The Vipers took our dock stash. Go to the port, deal with their crew, and bring the cash home."',
    reward: 500,
    stages: [
      { kind: 'goto', x: 2850, y: 2050, label: 'Go to the docks at the port' },
      { kind: 'fight', x: 2850, y: 2050, label: 'Defeat the 4 Viper crew members' },
      { kind: 'collect', x: 2850, y: 2050, label: 'Grab the stash cash — press E on foot' },
    ],
  },
  {
    name: 'The Big Score',
    intro: 'Dante: "One last job, Rex. The Solmar Trust vault. Grab the cash and get to the safehouse. The whole city will be after you."',
    reward: 800,
    stages: [
      { kind: 'goto', x: 1000, y: 600, label: 'Go to the Solmar Trust bank' },
      { kind: 'rob', x: 1000, y: 600, label: 'Crack the vault — stand at the vault door' },
      { kind: 'escape', x: 400, y: 2050, label: 'Escape to the safehouse — police are on you!' },
    ],
  },
];

/** Start mission `index` on the state: stage 0, marker and objective set. */
export function startMission(state, index) {
  const def = MISSION_DEFS[index];
  if (!def) return;
  state.mission.index = index;
  state.mission.stage = 0;
  state.mission.active = true;
  state.mission.timer = 0;
  state.mission.enemiesSpawned = false;
  state.mission.cashReady = false;
  applyStage(state);
}

/** Refresh the marker + objective text from the current stage. */
export function applyStage(state) {
  const def = MISSION_DEFS[state.mission.index];
  const stage = def ? def.stages[state.mission.stage] : null;
  if (!stage) return;
  state.mission.marker = { x: stage.x, y: stage.y };
  state.mission.objective = `${def.name}: ${stage.label}`;
  state.mission.timer = 0;
}

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

/**
 * Advance the active mission one step. `api` is the world's helper surface:
 * notify(text), addMoney(n), setWanted(n), spawnRivals(x, y), dropCash(x, y),
 * playerInCar(), playerCarKind(), markComplete(). Returns nothing; the world
 * reads state.mission for the HUD.
 */
export function updateMission(state, api, dt) {
  const m = state.mission;
  if (!m.active) return;
  const def = MISSION_DEFS[m.index];
  if (!def) return;
  const stage = def.stages[m.stage];
  if (!stage) return;
  const p = state.player;
  const d = dist(p.x, p.y, stage.x, stage.y);
  m.timer += dt;

  function advance() {
    m.stage += 1;
    if (m.stage >= def.stages.length) {
      api.addMoney(def.reward);
      api.notify(`Mission complete: ${def.name} — +$${def.reward}`);
      state.mission.done[m.index] = true;
      m.active = false;
      m.objective = '';
      m.marker = null;
      if (m.index === MISSION_DEFS.length - 1) api.markComplete();
      else startMission(state, m.index + 1);
    } else {
      applyStage(state);
      api.notify(def.stages[m.stage].label);
    }
  }

  if (stage.kind === 'goto') {
    if (d < 90) advance();
  } else if (stage.kind === 'collect') {
    if (d < 70 && !p.inCar && state.interactPressed) advance();
    else if (d < 70 && !p.inCar) m.objective = `${def.name}: Press E to grab it`;
  } else if (stage.kind === 'steal') {
    if (p.inCar && p.carKind === 'sport' && p.carTarget === true) advance();
    else if (d < 120 && !p.inCar) m.objective = `${def.name}: Press E to steal the yellow Comet GT`;
  } else if (stage.kind === 'deliver') {
    if (p.inCar && p.carKind === 'sport' && p.carTarget === true && d < 110) advance();
  } else if (stage.kind === 'fight') {
    if (!m.enemiesSpawned) {
      api.spawnRivals(stage.x, stage.y);
      m.enemiesSpawned = true;
    }
    const alive = state.enemies.filter((e) => e.kind === 'rival' && e.hp > 0).length;
    if (m.enemiesSpawned && alive === 0) {
      m.cashReady = true;
      advance();
    } else {
      m.objective = `${def.name}: Defeat the Viper crew (${alive} left)`;
    }
  } else if (stage.kind === 'rob') {
    if (d < 80 && !p.inCar) {
      if (m.timer > 3) {
        api.setWanted(3);
        api.notify('Vault cracked! Grab the cash and RUN!');
        advance();
      } else {
        m.objective = `${def.name}: Cracking the vault… ${Math.ceil(3 - m.timer)}`;
      }
    } else {
      m.timer = 0;
    }
  } else if (stage.kind === 'escape') {
    if (d < 110) advance();
  }
}
