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
  if (existing) {
    // A drawing or chart of a type the board doesn't have yet is added; what someone set up is left alone.
    if (b.visualizations) {
      const row = db.prepare("SELECT visualizations FROM calculations WHERE id = ?").get(existing);
      const have = JSON.parse(row.visualizations || "[]");
      const added = b.visualizations.filter((v) => !have.some((h) => h.type === v.type));
      if (added.length > 0) {
        db.prepare("UPDATE calculations SET visualizations = ? WHERE id = ?").run(JSON.stringify([...have, ...added]), existing);
      }
    }
    return existing;
  }
  const id = newId();
  db.prepare(
    `INSERT INTO calculations (id, title, description, formulas, input_values, variable_descriptions,
       variable_units, variable_decimals, variable_labels, variable_hidden, board_includes, variable_links, visualizations, owner_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    JSON.stringify(b.visualizations ?? []),
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
  decimals: { max_life: 0, max_mana: 0, accuracy: 0, bonus_damage: 1 },
  descriptions: {
    level: "Character level",
    strength: "Gives life, and 1% increased damage per 5",
    dexterity: "Gives accuracy",
    intelligence: "Gives mana",
  },
});

const dps = add({
  title: "Path of Exile DPS calculator",
  visualizations: [
    { type: "sweep", map: { x: "accuracy", y: "dps" }, options: { from: 500, to: 8000 } },
    { type: "sensitivity", map: { y: "dps" } },
  ],
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
  decimals: { dps: 0, avg_hit: 1, aps: 2, crit_factor: 2, hit_chance: 1, crit_chance: 1 },
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

// A fight that connects three boards: the character, the damage calculator and a monster.
const monster = add({
  title: "Monster stats",
  description: "A monster's life, evasion and hit damage from its level.",
  formulas: [
    "life = 20 * monster_level ^ 1.5 * life_multiplier",
    "evasion = 140 * monster_level",
    "hit_damage = 6 * monster_level",
  ],
  values: { monster_level: "84", life_multiplier: "1" },
  labels: { life: "Life", evasion: "Evasion rating", hit_damage: "Damage per hit", monster_level: "Monster level", life_multiplier: "Life multiplier" },
  decimals: { life: 0, evasion: 0, hit_damage: 0 },
});

add({
  title: "Boss fight: player against boss",
  visualizations: [{ type: "sweep", map: { x: "boss$monster_level", y: "time_to_kill" }, options: { from: 40, to: 100 } }],
  description: "Connects the character, the damage calculator and a monster: how long the boss lives and how many hits the player survives.",
  formulas: ["time_to_kill = boss.life / dps.dps", "hits_to_die = player.max_life / boss.hit_damage"],
  includes: [
    { board: character, alias: "player", name: "Player" },
    { board: dps, alias: "dps", name: "Player damage" },
    { board: monster, alias: "boss", name: "Boss" },
  ],
  links: {
    dps$accuracy: "player$accuracy",
    dps$inc_dmg: "player$bonus_damage",
    dps$enemy_evasion: "boss$evasion",
  },
  labels: { time_to_kill: "Time to kill the boss", hits_to_die: "Hits the player survives" },
  units: { time_to_kill: "s" },
  decimals: { time_to_kill: 1, hits_to_die: 1 },
});

console.log("boards:", db.prepare("SELECT title FROM calculations WHERE owner_id = ?").all(owner.id).map((r) => r.title));

// Shapes, and boards that combine them.
const circle = add({
  title: "Circle",
  visualizations: [{ type: "circle", map: { radius: "radius" } }],
  description: "Radius, diameter, circumference and area of a circle.",
  formulas: ["diameter = 2 * radius", "circumference = pi * diameter", "area = pi * radius ^ 2"],
  values: { radius: "4" },
  units: { radius: "m", diameter: "m", circumference: "m", area: "m²" },
  decimals: { diameter: 2, circumference: 2, area: 2 },
});

const rectangle = add({
  title: "Rectangle",
  visualizations: [{ type: "rectangle", map: { width: "width", height: "height" } }],
  description: "Width, height, area, perimeter and diagonal of a rectangle.",
  formulas: ["area = width * height", "perimeter = 2 * (width + height)", "diagonal = sqrt(width ^ 2 + height ^ 2)"],
  values: { width: "12", height: "8" },
  units: { width: "m", height: "m", area: "m²", perimeter: "m", diagonal: "m" },
  decimals: { area: 2, perimeter: 2, diagonal: 2 },
});

const triangle = add({
  title: "Triangle",
  visualizations: [{ type: "triangle", map: { base: "base", height: "height" } }],
  description: "Base, height and area of a triangle.",
  formulas: ["area = base * height / 2"],
  values: { base: "12", height: "4" },
  units: { base: "m", height: "m", area: "m²" },
  decimals: { area: 2 },
});

add({
  title: "Cylinder from a circle",
  visualizations: [{ type: "cylinder", map: { radius: "base$radius", height: "height" } }],
  description: "A cylinder is a circle with a height: volume and surface come from the circle's area and circumference.",
  formulas: ["volume = base.area * height", "surface = 2 * base.area + base.circumference * height"],
  includes: [{ board: circle, alias: "base", name: "Base circle" }],
  values: { height: "10" },
  units: { height: "m", volume: "m³", surface: "m²" },
  decimals: { volume: 2, surface: 2 },
});

add({
  title: "Garden plan",
  visualizations: [{ type: "breakdown", map: { total: "lawn$area" }, lists: { parts: ["pond$area", "bed$area"] } }],
  description: "A lawn with a round pond and a triangular flowerbed. The pond is as wide as the lawn is deep, and the bed has the lawn's width as its base. What is left of the lawn?",
  formulas: ["free_area = lawn.area - pond.area - bed.area"],
  includes: [
    { board: rectangle, alias: "lawn", name: "Lawn" },
    { board: circle, alias: "pond", name: "Pond" },
    { board: triangle, alias: "bed", name: "Flowerbed" },
  ],
  links: { pond$diameter: "lawn$height", bed$base: "lawn$width" },
  labels: { free_area: "Lawn left over" },
  units: { free_area: "m²" },
  decimals: { free_area: 2 },
});

console.log("boards:", db.prepare("SELECT title FROM calculations WHERE owner_id = ?").all(owner.id).map((r) => r.title));

// A pyramid on a rectangle: the base is a Rectangle and each pair of side faces is a Triangle whose
// base is an edge of the rectangle and whose height is the slant height.
add({
  title: "Pyramid",
  visualizations: [
    { type: "pyramid", map: { width: "base$width", depth: "base$height", height: "height" } },
    { type: "breakdown", map: { total: "surface" }, lists: { parts: ["base$area", "lateral_area"] } },
  ],
  description: "A rectangular pyramid built from a rectangle (the base) and two triangles (the side faces): volume and surface from the base and the height.",
  formulas: [
    "volume = base.area * height / 3",
    "slant_w = sqrt(height ^ 2 + (base.height / 2) ^ 2)",
    "slant_d = sqrt(height ^ 2 + (base.width / 2) ^ 2)",
    "lateral_area = 2 * front.area + 2 * side.area",
    "surface = base.area + lateral_area",
  ],
  includes: [
    { board: rectangle, alias: "base", name: "Base" },
    { board: triangle, alias: "front", name: "Front and back faces" },
    { board: triangle, alias: "side", name: "Left and right faces" },
  ],
  // The faces rest on the edges of the base and lean up to the top, along the slant height.
  links: { front$base: "base$width", front$height: "slant_w", side$base: "base$height", side$height: "slant_d" },
  values: { height: "6" },
  labels: { volume: "Volume", slant_w: "Slant height, front", slant_d: "Slant height, side", lateral_area: "Area of the sides", surface: "Total surface" },
  units: { height: "m", volume: "m³", slant_w: "m", slant_d: "m", lateral_area: "m²", surface: "m²" },
  decimals: { volume: 2, slant_w: 2, slant_d: 2, lateral_area: 2, surface: 2 },
});

console.log("boards:", db.prepare("SELECT title FROM calculations WHERE owner_id = ?").all(owner.id).map((r) => r.title));

// A donut (a torus) from two circles, by Pappus's theorem: the tube is a circle that is swept once
// around a second circle, the path of its centre. Volume = tube area x ring circumference, and
// surface = tube circumference x ring circumference.
add({
  title: "Donut",
  visualizations: [{ type: "donut", map: { ring_radius: "ring$radius", tube_radius: "tube$radius" } }],
  description: "A donut from two circles: the cross-section of the dough and the ring it is swept around. Volume and surface follow from their areas and circumferences.",
  formulas: [
    "volume = tube.area * ring.circumference",
    "surface = tube.circumference * ring.circumference",
    "outer_diameter = 2 * (ring.radius + tube.radius)",
    "hole_diameter = 2 * (ring.radius - tube.radius)",
  ],
  includes: [
    { board: circle, alias: "tube", name: "Dough (cross-section)" },
    { board: circle, alias: "ring", name: "Ring (path of the dough's centre)" },
  ],
  values: { tube$radius: "1.5", ring$radius: "4" },
  labels: { volume: "Volume", surface: "Surface", outer_diameter: "Outer diameter", hole_diameter: "Hole diameter" },
  units: { volume: "cm³", surface: "cm²", outer_diameter: "cm", hole_diameter: "cm", tube$radius: "cm", tube$diameter: "cm", tube$circumference: "cm", tube$area: "cm²", ring$radius: "cm", ring$diameter: "cm", ring$circumference: "cm", ring$area: "cm²" },
  decimals: { volume: 2, surface: 2, outer_diameter: 2, hole_diameter: 2 },
});

console.log("boards:", db.prepare("SELECT title FROM calculations WHERE owner_id = ?").all(owner.id).map((r) => r.title));

// More shapes, with the charts that suit them.
add({
  title: "Sphere",
  description: "Diameter, surface and volume of a sphere from its radius.",
  formulas: ["diameter = 2 * radius", "surface = 4 * pi * radius ^ 2", "volume = 4 / 3 * pi * radius ^ 3"],
  values: { radius: "5" },
  units: { radius: "cm", diameter: "cm", surface: "cm²", volume: "cm³" },
  decimals: { diameter: 2, surface: 2, volume: 2 },
  visualizations: [
    { type: "sphere", map: { radius: "radius" } },
    { type: "sweep", map: { x: "radius", y: "volume" }, options: { from: 1, to: 10 } },
  ],
});

add({
  title: "Cone from a circle",
  description: "A cone with a circle as its base: slant height, volume and surface from the base's radius and the height.",
  formulas: [
    "slant = sqrt(height ^ 2 + base.radius ^ 2)",
    "volume = base.area * height / 3",
    "lateral_area = pi * base.radius * slant",
    "surface = base.area + lateral_area",
  ],
  includes: [{ board: circle, alias: "base", name: "Base circle" }],
  values: { height: "9" },
  labels: { slant: "Slant height", lateral_area: "Area of the side" },
  units: { height: "cm", slant: "cm", volume: "cm³", lateral_area: "cm²", surface: "cm²", base$radius: "cm", base$diameter: "cm", base$circumference: "cm", base$area: "cm²" },
  decimals: { slant: 2, volume: 2, lateral_area: 2, surface: 2 },
  visualizations: [
    { type: "cone", map: { radius: "base$radius", height: "height" } },
    { type: "pie", map: { total: "surface" }, lists: { parts: ["base$area", "lateral_area"] } },
  ],
});

add({
  title: "Box",
  description: "A box: volume, surface, the longest diagonal and how the surface divides over its faces.",
  formulas: [
    "volume = width * depth * height",
    "top_and_bottom = 2 * width * depth",
    "front_and_back = 2 * width * height",
    "left_and_right = 2 * depth * height",
    "surface = top_and_bottom + front_and_back + left_and_right",
    "diagonal = sqrt(width ^ 2 + depth ^ 2 + height ^ 2)",
  ],
  values: { width: "30", depth: "20", height: "10" },
  units: { width: "cm", depth: "cm", height: "cm", volume: "cm³", top_and_bottom: "cm²", front_and_back: "cm²", left_and_right: "cm²", surface: "cm²", diagonal: "cm" },
  decimals: { volume: 0, top_and_bottom: 0, front_and_back: 0, left_and_right: 0, surface: 0, diagonal: 2 },
  visualizations: [
    { type: "box", map: { width: "width", depth: "depth", height: "height" } },
    { type: "pie", map: { total: "surface" }, lists: { parts: ["top_and_bottom", "front_and_back", "left_and_right"] } },
  ],
});

add({
  title: "Hexagon",
  description: "A regular hexagon: perimeter, area and the distance from the middle to a side.",
  formulas: ["perimeter = 6 * side", "area = 3 * sqrt(3) / 2 * side ^ 2", "apothem = sqrt(3) / 2 * side"],
  values: { side: "4" },
  units: { side: "cm", perimeter: "cm", area: "cm²", apothem: "cm" },
  decimals: { perimeter: 2, area: 2, apothem: 2 },
  visualizations: [
    { type: "polygon", map: { side: "side" }, options: { sides: 6 } },
    { type: "dependency", map: { result: "area" } },
  ],
});

add({
  title: "Ellipse",
  description: "An ellipse from its half-width and half-height: area and an approximate perimeter (Ramanujan).",
  formulas: ["area = pi * a * b", "perimeter = pi * (3 * (a + b) - sqrt((3 * a + b) * (a + 3 * b)))"],
  values: { a: "6", b: "3" },
  labels: { a: "Half the width", b: "Half the height" },
  units: { a: "cm", b: "cm", area: "cm²", perimeter: "cm" },
  decimals: { area: 2, perimeter: 2 },
  visualizations: [{ type: "ellipse", map: { radius_x: "a", radius_y: "b" } }],
});

add({
  title: "Washer",
  description: "A flat ring (a washer): its area is the whole disc minus the hole.",
  formulas: ["outer_area = pi * outer_radius ^ 2", "hole_area = pi * inner_radius ^ 2", "area = outer_area - hole_area"],
  values: { outer_radius: "10", inner_radius: "4" },
  labels: { outer_area: "Whole disc", hole_area: "Hole", area: "Metal" },
  units: { outer_radius: "mm", inner_radius: "mm", outer_area: "mm²", hole_area: "mm²", area: "mm²" },
  decimals: { outer_area: 1, hole_area: 1, area: 1 },
  visualizations: [
    { type: "annulus", map: { outer_radius: "outer_radius", inner_radius: "inner_radius" } },
    { type: "pie", map: { total: "outer_area" }, lists: { parts: ["area", "hole_area"] } },
  ],
});

// Charts on boards that already exist.
add({
  title: "Path of Exile DPS calculator",
  visualizations: [
    { type: "gauge", map: { value: "hit_chance" }, options: { min: 0, max: 100 } },
    { type: "heatmap", map: { x: "accuracy", y: "enemy_evasion", z: "hit_chance" }, options: { x_from: 500, x_to: 8000, y_from: 2000, y_to: 30000 } },
    { type: "dependency", map: { result: "dps" } },
  ],
});
add({
  title: "RPG character stats",
  visualizations: [{ type: "bars", lists: { values: ["max_life", "max_mana"] }, map: {} }],
});

console.log("boards:", db.prepare("SELECT title FROM calculations WHERE owner_id = ?").all(owner.id).map((r) => r.title));
