// Seeds an RPG set of boards that use each other: Weapon, Armor piece and Skill (each with presets), a Character
// build with a collection for each of them (people add the pieces they use), and a Knight loadout that is the same
// build with some pieces already in. Run with `node scripts/seed-rpg.mjs`.
// Safe to run again: a board is only created if its owner has none with that title yet.
import Database from "better-sqlite3";
import { randomBytes } from "node:crypto";

const db = new Database(process.env.CHALKWORK_DB ?? "data/chalkwork.db");
const newId = () => randomBytes(9).toString("base64url");

let owner = db.prepare("SELECT id FROM users WHERE provider = 'dev' AND account_id = 'martin'").get();
if (!owner) {
  owner = { id: newId() };
  db.prepare("INSERT INTO users (id, provider, account_id, name) VALUES (?, 'dev', 'martin', 'Martin')").run(owner.id);
}

const find = (title) => db.prepare("SELECT id FROM boards WHERE owner_id = ? AND title = ?").get(owner.id, title)?.id;
const json = (v, fallback) => JSON.stringify(v ?? fallback);

function add(b) {
  const existing = find(b.title);
  if (existing) return existing;
  const id = newId();
  db.prepare(
    `INSERT INTO boards (id, owner_id, title, description, formulas, input_values, variable_descriptions, variable_units,
       variable_decimals, variable_labels, variable_hidden, variable_ranges, variable_order, variable_types, variable_formats,
       variable_choices, board_includes, board_tables, board_tags, board_collections, board_presets, visualizations, visibility)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    owner.id,
    b.title,
    b.description,
    json(b.formulas, []),
    json(b.values, {}),
    json(b.descriptions, {}),
    json(b.units, {}),
    json(b.decimals, {}),
    json(b.labels, {}),
    json(b.hidden, {}),
    json(b.ranges, {}),
    json(b.order, []),
    json(b.types, {}),
    json(b.formats, {}),
    json(b.choices, {}),
    json(b.includes, []),
    json(b.tables, []),
    json(b.tags, []),
    json(b.collections, []),
    json(b.presets, []),
    json(b.visualizations, []),
    "public",
  );
  // The first entry of the history, like a board saved in the editor.
  const draft = {
    title: b.title,
    description: b.description,
    formulas: b.formulas ?? [],
    values: b.values ?? {},
    descriptions: b.descriptions ?? {},
    units: b.units ?? {},
    labels: b.labels ?? {},
    hidden: b.hidden ?? {},
    decimals: b.decimals ?? {},
    ranges: b.ranges ?? {},
    tables: b.tables ?? [],
    order: b.order ?? [],
    tags: b.tags ?? [],
    collections: b.collections ?? [],
    presets: b.presets ?? [],
    types: b.types ?? {},
    formats: b.formats ?? {},
    choices: b.choices ?? {},
    visibility: "public",
    includes: b.includes ?? [],
    visualizations: b.visualizations ?? [],
  };
  if (PICTURES[b.title]) db.prepare("INSERT INTO board_images (board_id, image) VALUES (?, ?) ON CONFLICT(board_id) DO UPDATE SET image = excluded.image").run(id, picture(b.title));
  db.prepare("INSERT INTO board_versions (board_id, version, draft, saved_by, note) VALUES (?, 1, ?, ?, ?)").run(id, JSON.stringify(draft), owner.id, "Seeded");
  return id;
}

// Line-art pictures for the boards (transparent background, one medium-tone stroke), as they are drawn by the helper.
const art = (stroke, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120"><g fill="none" stroke="${stroke}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;
const PICTURES = {
  Weapon: art("#2FA8A0", '<line x1="50" y1="98" x2="110" y2="22"/><line x1="110" y1="98" x2="50" y2="22"/><line x1="54.8" y1="72.6" x2="73.6" y2="87.4"/><line x1="105.4" y1="72.6" x2="86.6" y2="87.4"/>'),
  "Armor piece": art("#E0A030", '<path d="M50 24 L70 18 Q80 28 90 18 L110 24 L124 44 L108 54 L108 98 H52 V54 L36 44 Z"/><line x1="80" y1="40" x2="80" y2="98"/>'),
  Skill: art("#E8715A", '<polygon points="80,15 90,42 118,32 102,57 128,70 100,80 108,108 80,92 52,108 60,80 32,70 58,57 42,32 70,42"/>'),
  "Character build": art("#2FA8A0", '<path d="M42 66 C42 36 60 20 80 20 C100 20 118 36 118 66 V96 H96 V76 H64 V96 H42 Z"/><line x1="64" y1="62" x2="96" y2="62"/>'),
  "Knight loadout": art("#E0A030", '<path d="M80 18 L120 30 V62 C120 88 100 102 80 108 C60 102 40 88 40 62 V30 Z"/><line x1="80" y1="34" x2="80" y2="94"/><line x1="56" y1="56" x2="104" y2="56"/>'),
};
const picture = (title) => `data:image/svg+xml;base64,${Buffer.from(PICTURES[title], "utf8").toString("base64")}`;

// A preset: the typed values, all of them locked.
const preset = (name, values) => ({ name, values: Object.fromEntries(Object.entries(values).map(([k, v]) => [k, String(v)])), locked: Object.keys(values) });

// ---------------------------------------------------------------------------------------------------------------
const weapon = add({
  title: "Weapon",
  description: "One weapon: the damage of a hit, how often it hits, criticals, and the damage per second that comes out. Pick a preset (Dagger, Longsword, Greatsword, Short bow) or set your own numbers.",
  formulas: [
    "avg_hit = (min_damage + max_damage) / 2",
    "crit_factor = 1 + crit_chance / 100 * (crit_multi / 100 - 1)",
    "attacks_per_second = base_speed * (1 + haste / 100)",
    "dps = avg_hit * crit_factor * attacks_per_second",
  ],
  values: { min_damage: "14", max_damage: "22", crit_chance: "6", crit_multi: "150", base_speed: "1.2", haste: "0" },
  labels: { min_damage: "Lowest hit", max_damage: "Highest hit", crit_chance: "Critical chance", crit_multi: "Critical damage", base_speed: "Attack speed", haste: "Haste", avg_hit: "Average hit", crit_factor: "Critical factor", attacks_per_second: "Attacks per second", dps: "Damage per second" },
  units: { min_damage: "dmg", max_damage: "dmg", avg_hit: "dmg", crit_chance: "%", crit_multi: "%", haste: "%", base_speed: "/s", attacks_per_second: "/s", dps: "dmg/s" },
  decimals: { avg_hit: 1, crit_factor: 2, attacks_per_second: 2, dps: 1 },
  descriptions: { crit_multi: "How much a critical hit does, in percent of a normal hit (150 is one and a half times).", haste: "Faster attacks from gear and skills, in percent." },
  ranges: { crit_chance: { min: 0, max: 100 }, crit_multi: { min: 100, max: 400 }, base_speed: { min: 0.2, max: 4 }, haste: { min: 0, max: 200 } },
  order: ["min_damage", "max_damage", "base_speed", "crit_chance", "crit_multi", "haste"],
  tags: ["rpg", "gear", "damage"],
  presets: [
    preset("Dagger", { min_damage: 6, max_damage: 11, base_speed: 2.1, crit_chance: 12, crit_multi: 175 }),
    preset("Longsword", { min_damage: 14, max_damage: 22, base_speed: 1.2, crit_chance: 6, crit_multi: 150 }),
    preset("Greatsword", { min_damage: 38, max_damage: 57, base_speed: 0.7, crit_chance: 5, crit_multi: 150 }),
    preset("Short bow", { min_damage: 9, max_damage: 16, base_speed: 1.5, crit_chance: 8, crit_multi: 160 }),
  ],
  visualizations: [
    { type: "sensitivity", map: { y: "dps" }, lists: { inputs: ["min_damage", "max_damage", "base_speed", "crit_chance", "crit_multi", "haste"] }, options: { percent: 10 } },
    { type: "sweep", map: { x: "crit_chance", y: "dps" }, options: { from: 0, to: 60 } },
  ],
});

const armor = add({
  title: "Armor piece",
  description: "One piece of armor: how much it defends after upgrades, what it adds to life and resistance, and how much it slows you down. Presets: Leather vest, Chainmail, Plate, Mage robe.",
  formulas: [
    "effective_defense = defense * (1 + upgrade_level * 0.1)",
    "mobility_cost = weight / 10",
    "life_with_upgrades = health_bonus * (1 + upgrade_level * 0.1)",
    "resist_with_upgrades = resist * (1 + upgrade_level * 0.05)",
  ],
  values: { defense: "28", upgrade_level: "0", weight: "11", health_bonus: "25", resist: "5" },
  labels: { defense: "Defense", upgrade_level: "Upgrade level", weight: "Weight", health_bonus: "Life", resist: "Resistance", effective_defense: "Defense with upgrades", mobility_cost: "Slows you by", life_with_upgrades: "Life with upgrades", resist_with_upgrades: "Resistance with upgrades" },
  units: { weight: "kg", health_bonus: "life", resist: "%", mobility_cost: "%", life_with_upgrades: "life", resist_with_upgrades: "%" },
  decimals: { effective_defense: 1, mobility_cost: 1, life_with_upgrades: 1, resist_with_upgrades: 1 },
  descriptions: { upgrade_level: "Each level adds 10 % to the defense." },
  ranges: { upgrade_level: { min: 0, max: 10 }, resist: { min: 0, max: 75 } },
  order: ["defense", "upgrade_level", "weight", "health_bonus", "resist"],
  tags: ["rpg", "gear", "defense"],
  presets: [
    preset("Leather vest", { defense: 12, weight: 4, health_bonus: 10, resist: 2 }),
    preset("Chainmail", { defense: 28, weight: 11, health_bonus: 25, resist: 5 }),
    preset("Plate", { defense: 55, weight: 22, health_bonus: 50, resist: 8 }),
    preset("Mage robe", { defense: 6, weight: 2, health_bonus: 5, resist: 15 }),
  ],
  visualizations: [{ type: "sweep", map: { x: "upgrade_level", y: "effective_defense" }, options: { from: 0, to: 10 } }],
});

const skill = add({
  title: "Skill",
  description: "One skill: the damage of a cast, how often it can be used, and what it costs in mana. Presets: Fireball, Slash, Backstab, Whirlwind. The weapon hit is the average hit of the weapon it is used with.",
  formulas: [
    "damage_per_cast = base_damage + weapon_hit * scaling / 100",
    "cycle_time = max(cast_time, cooldown)",
    "skill_dps = damage_per_cast / cycle_time",
    "mana_per_second = mana_cost / cycle_time",
    "damage_per_mana = damage_per_cast / mana_cost",
  ],
  values: { base_damage: "10", weapon_hit: "18", scaling: "140", cast_time: "0.5", cooldown: "0.6", mana_cost: "4" },
  labels: { base_damage: "Base damage", weapon_hit: "Weapon hit", scaling: "Weapon scaling", cast_time: "Cast time", cooldown: "Cooldown", mana_cost: "Mana cost", damage_per_cast: "Damage per cast", cycle_time: "Time per use", skill_dps: "Damage per second", mana_per_second: "Mana per second", damage_per_mana: "Damage per mana" },
  units: { base_damage: "dmg", weapon_hit: "dmg", scaling: "%", cast_time: "s", cooldown: "s", cycle_time: "s", damage_per_cast: "dmg", skill_dps: "dmg/s", mana_cost: "mana", mana_per_second: "mana/s", damage_per_mana: "dmg/mana" },
  decimals: { damage_per_cast: 1, cycle_time: 2, skill_dps: 1, mana_per_second: 2, damage_per_mana: 2 },
  descriptions: { scaling: "How much of the weapon's hit is added, in percent (140 is one and four tenths of it).", cooldown: "The skill can't be used again before this has passed; the longer of the cast time and the cooldown sets the pace." },
  ranges: { scaling: { min: 0, max: 400 } },
  order: ["base_damage", "weapon_hit", "scaling", "cast_time", "cooldown", "mana_cost"],
  tags: ["rpg", "skill", "damage"],
  presets: [
    preset("Fireball", { base_damage: 60, scaling: 0, cast_time: 0.8, cooldown: 1.5, mana_cost: 18 }),
    preset("Slash", { base_damage: 10, scaling: 140, cast_time: 0.5, cooldown: 0.6, mana_cost: 4 }),
    preset("Backstab", { base_damage: 25, scaling: 220, cast_time: 0.4, cooldown: 3, mana_cost: 8 }),
    preset("Whirlwind", { base_damage: 15, scaling: 90, cast_time: 1, cooldown: 4, mana_cost: 14 }),
  ],
  visualizations: [{ type: "sweep", map: { x: "weapon_hit", y: "skill_dps" }, options: { from: 5, to: 80 } }],
});

// ---------------------------------------------------------------------------------------------------------------
// The build's own formulas, shared by the empty build and the loadout that has pieces in it.
const buildFormulas = [
  "max_life = 80 + 14 * level + strength * 2 + sum(Armor.life_with_upgrades)",
  "total_defense = sum(Armor.effective_defense)",
  "damage_reduction = total_defense / (total_defense + 80 + 20 * level)",
  "evasion = dexterity / (dexterity + 150 + 5 * level)",
  "effective_life = max_life / ((1 - damage_reduction) * (1 - evasion))",
  "resistance = min(75, sum(Armor.resist_with_upgrades))",
  "move_speed = 100 - sum(Armor.mobility_cost)",
  "best_weapon_dps = max(Weapons.dps)",
  "skill_dps = sum(Skills.skill_dps)",
  "damage_bonus = 1 + strength / 200",
  "total_dps = (best_weapon_dps + skill_dps) * damage_bonus",
  "mana_regen = 2 + intelligence * 0.15",
  "mana_use = sum(Skills.mana_per_second)",
  "mana_balance = mana_regen - mana_use",
];
const buildSettings = {
  values: { level: "20", strength: "30", dexterity: "20", intelligence: "25" },
  labels: {
    level: "Level", strength: "Strength", dexterity: "Dexterity", intelligence: "Intelligence",
    max_life: "Life", total_defense: "Defense", damage_reduction: "Damage reduction", evasion: "Evasion", resistance: "Resistance", effective_life: "Effective life",
    move_speed: "Move speed", best_weapon_dps: "Best weapon", skill_dps: "Skills", damage_bonus: "Damage bonus",
    total_dps: "Total damage per second", mana_regen: "Mana regeneration", mana_use: "Mana use", mana_balance: "Mana balance",
  },
  units: { max_life: "life", total_defense: "def", effective_life: "life", move_speed: "%", resistance: "%", best_weapon_dps: "dmg/s", skill_dps: "dmg/s", total_dps: "dmg/s", mana_regen: "mana/s", mana_use: "mana/s", mana_balance: "mana/s" },
  decimals: { damage_reduction: 1, evasion: 1, resistance: 1, effective_life: 0, max_life: 0, total_defense: 1, move_speed: 1, best_weapon_dps: 1, skill_dps: 1, total_dps: 1, damage_bonus: 0, mana_regen: 2, mana_use: 2, mana_balance: 2 },
  formats: { damage_reduction: "percent", evasion: "percent", damage_bonus: "percent" },
  descriptions: {
    effective_life: "Life divided by what gets through: how much damage it takes to bring the build down.",
    total_dps: "The best weapon plus all skills, with the strength bonus.",
    mana_balance: "Above zero the mana lasts; below zero the skills run it dry.",
  },
  ranges: { level: { min: 1, max: 100 }, strength: { min: 0, max: 400 }, dexterity: { min: 0, max: 400 }, intelligence: { min: 0, max: 400 } },
  order: ["level", "strength", "dexterity", "intelligence", "total_dps", "effective_life", "max_life", "total_defense", "damage_reduction", "evasion", "resistance", "move_speed", "best_weapon_dps", "skill_dps", "damage_bonus", "mana_regen", "mana_use", "mana_balance"],
  tags: ["rpg", "build", "damage"],
  collections: [
    { name: "Weapons", stats: [], boards: [weapon] },
    { name: "Armor", stats: [], boards: [armor] },
    { name: "Skills", stats: [], boards: [skill] },
  ],
  visualizations: [
    { type: "sweep", map: { x: "level", y: "total_dps" }, options: { from: 1, to: 60 } },
    { type: "gauge", map: { value: "damage_reduction" }, options: { min: 0, max: 1 } },
  ],
};

add({
  title: "Character build",
  description: "A character built from pieces: add the weapons, armor and skills you use, and see life, defense, damage per second and mana. Everything adds up from the boards you add; presets give each piece its numbers.",
  formulas: buildFormulas,
  ...buildSettings,
});

add({
  title: "Knight loadout",
  description: "The character build with a Longsword and a Dagger, Chainmail and a Leather vest, and the skills Slash and Whirlwind already in. Add more pieces, or change what each one is.",
  formulas: buildFormulas,
  ...buildSettings,
  includes: [
    { board: weapon, alias: "longsword", group: "Weapons", preset: "Longsword" },
    { board: weapon, alias: "dagger", group: "Weapons", preset: "Dagger" },
    { board: armor, alias: "chainmail", group: "Armor", preset: "Chainmail" },
    { board: armor, alias: "leather", group: "Armor", preset: "Leather vest" },
    { board: skill, alias: "slash", group: "Skills", preset: "Slash" },
    { board: skill, alias: "whirlwind", group: "Skills", preset: "Whirlwind" },
  ],
  visualizations: [
    ...buildSettings.visualizations,
    { type: "contributions", map: { total: "Skills$skill_dps" } },
  ],
});

console.log(
  "boards:",
  db
    .prepare("SELECT title FROM boards WHERE owner_id = ? AND board_tags LIKE '%rpg%'")
    .all(owner.id)
    .map((r) => r.title),
);
