// Combines a base skill gem's stats with the support gems linked to it (same
// equipped item, matching tags — see supports.js) into one resolved skill
// object combat.js can schedule and cast. Multiplier fields stack
// multiplicatively across supports; additive fields (currently just
// projectile count) stack additively.
export function resolveSkill(baseDef, supports) {
  let damageMultiplier = 1;
  let speedMultiplier = 1;
  let manaCostMultiplier = 1;
  let areaMultiplier = 1;
  let projectileCountAdd = 0;

  for (const support of supports) {
    const mods = support.mods || {};
    if (mods.damageMultiplier) damageMultiplier *= mods.damageMultiplier;
    if (mods.speedMultiplier) speedMultiplier *= mods.speedMultiplier;
    if (mods.manaCostMultiplier) manaCostMultiplier *= mods.manaCostMultiplier;
    if (mods.areaMultiplier) areaMultiplier *= mods.areaMultiplier;
    if (mods.projectileCountAdd) projectileCountAdd += mods.projectileCountAdd;
  }

  return {
    ...baseDef,
    speed: baseDef.speed * speedMultiplier,
    manaCost: Math.round(baseDef.manaCost * manaCostMultiplier),
    supportDamageMultiplier: damageMultiplier,
    areaMultiplier,
    projectileCount: 1 + projectileCountAdd,
    appliedSupportIds: supports.map((s) => s.id),
  };
}

// Which of a skill gem's same-item supports actually apply to it: any
// support whose appliesToTags intersects the skill's own tags.
export function supportsFor(skillDef, supportDefs) {
  return supportDefs.filter((support) => support.appliesToTags.some((tag) => skillDef.tags.includes(tag)));
}
