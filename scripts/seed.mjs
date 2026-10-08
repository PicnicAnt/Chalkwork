// Seeds sample boards that make sense to combine. Run with `node scripts/seed.mjs`.
// Safe to run again: a board is only created if its owner has none with that title yet.
// The boards belong to the test user "Martin" (created if missing).
import Database from "better-sqlite3";
import { randomBytes } from "node:crypto";

const db = new Database(process.env.CHALKWORK_DB ?? "data/chalkwork.db");
const newId = () => randomBytes(9).toString("base64url");

let owner = db.prepare("SELECT id FROM users WHERE provider = 'dev' AND account_id = 'martin'").get();
if (!owner) {
  owner = { id: newId() };
  db.prepare("INSERT INTO users (id, provider, account_id, name) VALUES (?, 'dev', 'martin', 'Martin')").run(owner.id);
}

const find = (title) => db.prepare("SELECT id FROM calculations WHERE owner_id = ? AND title = ?").get(owner.id, title)?.id;

function add(b) {
  const existing = find(b.title);
  if (existing) return existing;
  const id = newId();
  db.prepare(
    `INSERT INTO calculations (id, title, description, formulas, input_values, variable_descriptions,
       variable_units, variable_decimals, variable_labels, variable_hidden, board_includes, variable_links, owner_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    b.title,
    b.description,
    JSON.stringify(b.formulas),
    JSON.stringify(b.values ?? {}),
    JSON.stringify(b.descriptions ?? {}),
    JSON.stringify(b.units ?? {}),
    JSON.stringify(b.decimals ?? {}),
    JSON.stringify(b.labels ?? {}),
    JSON.stringify(b.hidden ?? {}),
    JSON.stringify(b.includes ?? []),
    JSON.stringify(b.links ?? {}),
    owner.id,
  );
  return id;
}

const character = add({
  title: "RPG character stats",
  description: "Level and attributes, and what they give: life, mana, accuracy and bonus damage.",
  formulas: [
    "max_life = 38 + 12 * level + strength / 2",
    "max_mana = 34 + 6 * level + intelligence / 2",
    "accuracy = 2 * dexterity + 10 * level",
    "bonus_damage = strength / 5",
  ],
  values: { level: "90", strength: "220", dexterity: "180", intelligence: "90" },
  labels: { max_life: "Life", max_mana: "Mana", accuracy: "Accuracy rating", bonus_damage: "Bonus damage" },
  units: { bonus_damage: "%" },
  decimals: { max_life: "0", max_mana: "0", accuracy: "0", bonus_damage: "1" },
  descriptions: {
    level: "Character level",
    strength: "Gives life, and 1% increased damage per 5",
    dexterity: "Gives accuracy",
    intelligence: "Gives mana",
  },
});

const dps = add({
  title: "Path of Exile DPS calculator",
  description: "Damage per second of an attack: damage, speed, crits and enemy evasion.",
  formulas: [
    "dps = avg_hit * aps * crit_factor * hit_chance / 100",
    "hit_chance = min(max(125 * accuracy / (accuracy + (enemy_evasion / 5) ^ 0.9), 5), 100)",
    "crit_factor = 1 + crit_chance / 100 * (crit_multi / 100 - 1)",
    "crit_chance = min(base_crit * (1 + inc_crit / 100), 100)",
    "aps = base_aps * (1 + inc_aps / 100)",
    "avg_hit = (min_dmg + max_dmg) / 2 * (1 + more_dmg / 100) * (1 + inc_dmg / 100)",
  ],
  values: {
    min_dmg: "38", max_dmg: "115", more_dmg: "49", inc_dmg: "250", base_aps: "1.55", inc_aps: "32",
    base_crit: "6.5", inc_crit: "300", crit_multi: "380", accuracy: "2400", enemy_evasion: "12000",
  },
  labels: {
    dps: "Damage per second", avg_hit: "Average hit", aps: "Attacks per second", crit_factor: "Crit factor",
    hit_chance: "Hit chance", crit_chance: "Crit chance", inc_dmg: "Increased damage", more_dmg: "More damage",
    inc_aps: "Increased attack speed", inc_crit: "Increased crit chance", crit_multi: "Crit multiplier",
    enemy_evasion: "Enemy evasion", min_dmg: "Minimum damage", max_dmg: "Maximum damage",
  },
  units: {
    hit_chance: "%", crit_chance: "%", inc_dmg: "%", more_dmg: "%", inc_aps: "%", inc_crit: "%", crit_multi: "%",
    base_crit: "%", dps: "/s",
  },
  decimals: { dps: "0", avg_hit: "1", aps: "2", crit_factor: "2", hit_chance: "1", crit_chance: "1" },
});

add({
  title: "Melee build: character and damage",
  description: "The character's attributes feed the damage calculator: accuracy and bonus damage come from the character.",
  formulas: ["total_dps = dps.dps"],
  includes: [
    { board: character, alias: "character" },
    { board: dps, alias: "dps" },
  ],
  // The damage board's accuracy and increased damage now come from the character.
  links: { dps$accuracy: "character$accuracy", dps$inc_dmg: "character$bonus_damage" },
  labels: { total_dps: "Total damage per second" },
});

console.log("boards:", db.prepare("SELECT title FROM calculations WHERE owner_id = ?").all(owner.id).map((r) => r.title));
