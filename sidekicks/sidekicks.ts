// Imports from your existing modules
import { Ability, Proficiencies, Statblock, getAbilityForSkill } from '../statblocks/statblocks';
import { SidekickClass } from './classes';
import { Abilities, Proficiency, Attack } from '../statblocks/components';
import { Feature, Option, Trait } from '../statblocks/statblocks';


/**
 * Class to represent a D&D 5e Sidekick based on TCoE rules.
 */
export class Sidekick {
    statblock: Statblock;
    sidekickClass: SidekickClass;
    level: number;
    expertiseSkills: string[]; 

    constructor(statblock: Statblock, sidekickClass: SidekickClass, level: number) {
        this.statblock = statblock;
        this.sidekickClass = sidekickClass;
        this.level = level;
    }

    // reimplementation with Attack class
    checkCondition(condition: string): boolean {
        switch (condition) {
            case "humanoid":
                if (!this.statblock.type) { return false; }
                else return this.statblock.type.toLowerCase().includes("humanoid");
            case "simple weapon":
                if (!this.statblock.actions) {
                    return false;
                }
    
                const simpleAttacks = this.statblock.actions
                    .map(action => new Attack(action))
                    .filter(attack => attack.isAttack && attack.isSimpleWeapon);
    
                return simpleAttacks.length > 0;
            case "martial weapon":
                if (!this.statblock.actions) {
                    return false;
                }
    
                const martialAttacks = this.statblock.actions
                    .map(action => new Attack(action))
                    .filter(attack => attack.isAttack && attack.isMartialWeapon);
    
                return martialAttacks.length > 0;
            default:
                return false;
        }
    }

    getOptions(feature: Feature): Option[] {
        if (!feature.options) { return []; }
        switch (feature.name) {
            case "Saving Throw Proficiency":
                if (this.statblock && this.statblock.saves) {
                    let existingSaves: string[];
                    if (Array.isArray(this.statblock.saves)) {
                        existingSaves = this.statblock.saves.map(save => Object.keys(save)[0]);
                    } 
                    else {
                        existingSaves = Object.keys(this.statblock.saves);
                    }
                    return feature.options.filter(option => !existingSaves.includes(option.name)
                    );
                }
                return feature.options;
            case "Skill Proficiencies":
                if (this.statblock && this.statblock.skillsaves) {
                    let existingSkills: string[];
                    if (Array.isArray(this.statblock.skillsaves)) {
                        existingSkills = this.statblock.skillsaves.map(skill => Object.keys(skill)[0]);
                    } else {
                        existingSkills = Object.keys(this.statblock.skillsaves);
                    }
                    return feature.options.filter(option =>
                        !existingSkills.includes(option.name)
                    );
                }
                return feature.options;
            case "Tool Proficiencies":
                if (this.statblock && this.statblock.traits) {
                    const existingProfString = this.statblock.traits.find(
                        (trait) => trait.name === "Equipment Proficiencies"
                    )?.desc.split("with")[1].slice(0, -1);;
                    const existingProfList = existingProfString
                        ? existingProfString.split(", ")
                        : [];
                    return feature.options.filter(
                        (option) => !existingProfList.includes(option.name)
                    );
                }
                return feature.options;
            case "Expertise":
                // Filter out skills where the sidekick already has Expertise
                const existingExpertiseSkills = new Set(this.expertiseSkills || []);
                if (this.statblock.skillsaves) {
                    return Object.keys(this.statblock.skillsaves)
                        .filter(skill => !existingExpertiseSkills.has(skill))
                        .map(skill => ({ name: skill }));
                }
                return [];
            case "Ability Score Improvement":
                const abilities = Abilities.fromArray(this.statblock.stats);
                feature.options = [];
            
                for (const [key, value] of Object.entries(abilities)) {
                    if (value < 20) { // Check if the ability score is less than 20
                        const abilityName = key.charAt(0).toUpperCase() + key.slice(1);
                        const abilityMod = Abilities.calculateModifier(value);
                        const modSign = abilityMod >= 0 ? "+" : "-";
                        feature.options.push({
                            name: abilityName,
                            desc: `${value} (${modSign}${Math.abs(abilityMod)})`
                        });
                    }
                }            
                return feature.options;
            default:
                // Return the existing options if any, otherwise return an empty array
                return feature.options;
        }
    }

    // Method to apply features to the statblock
    applyFeature(feature: Feature, choice?: Option): void {
        const proficiencyBonus = Proficiency.calculatePB(this.level); // Calculate based on current level
        const abilities = Abilities.fromArray(this.statblock.stats);
        switch (feature.name) {
            case "Saving Throw Proficiency":
            case "Sharp Mind":
                if (choice) {
                    if (!this.statblock.saves) {
                        this.statblock.saves = {};
                    }
                    const abilityKey = choice.name.toLowerCase() as Ability;
                    // const abilityScore = abilities[abilityKey];
                    // const abilityMod = Abilities.calculateModifier(abilityScore);
                    this.statblock.saves[abilityKey] = 0;//abilityMod + proficiencyBonus;
                }
                break;
            case "Skill Proficiencies":
                if (choice) {
                    if (!this.statblock.skillsaves) {
                        this.statblock.skillsaves = {};
                    }
                    this.statblock.skillsaves[choice.name] = 0 
                }
                break;
            case "Tool Proficiencies":
            case "Armor Proficiency":
            case "Shield Proficiency":
            case "Weapon Proficiency":
                let equipment = ""
                if (choice) {
                    equipment = choice.name
                }
                else {
                    equipment = feature.desc
                }  
                if (this.statblock && this.statblock.traits) {
                    const existingEquipmentProficiencies = this.statblock.traits.find(
                        (trait) => trait.name === "Equipment Proficiencies");
                    if (existingEquipmentProficiencies) {
                        existingEquipmentProficiencies.desc = existingEquipmentProficiencies.desc.replace('.', ', ');
                        existingEquipmentProficiencies.desc += `${equipment}.`;
                    } 
                    else {
                        this.statblock.traits.push({
                            name: "Equipment Proficiencies",
                            desc: `The sidekick has proficiency with ${equipment}.`,
                        });
                    }
                }
                break; 
            case "Expertise":
                if (choice) {
                    if (!this.expertiseSkills) {
                        this.expertiseSkills = [];
                    }
                    this.expertiseSkills.push(choice.name);
                }
                break;
            case "Ability Score Improvement":
                if (choice) {
                    const abilityName = choice.name.toLowerCase() as Ability;
                    const abilities = new Abilities(...this.statblock.stats);                    
                    const index = Object.keys(abilities).indexOf(abilityName);
                    this.statblock.stats[index] = abilities[abilityName] += 1;                    
                }
                break;                
            case "Martial Role":
                if (!choice) { return }
                feature.name = choice.name
                feature.desc = choice.desc || ""
                feature.category = choice.category
                if (choice.name === "Attacker") {
                    const actions = this.statblock.actions;
                    if (!actions) return;
            
                    this.statblock.actions = actions.map(action => {
                        const attack = new Attack(action);
                        if (attack.isAttack && attack.toHit !== undefined) {
                            attack.toHit += 2;
                            return {
                                ...action,
                                desc: attack.constructDescription()
                            };
                        }
                        return action;
                    });
                };
                this.applyStandardFeature(feature);
                break;
            case "Spellcaster Role":
                // Remove existing 'Spells' or 'Spellcasting' traits
                if (choice){
                    if (this.statblock.traits) {
                        this.statblock.traits = this.statblock.traits.filter(
                            trait => trait.name.toLowerCase() !== 'spells' && trait.name.toLowerCase() !== 'spellcasting'
                        );
                    }
                    feature.name = choice.name;
                    feature.desc = "";
                };
                this.applyStandardFeature(feature)
                break;
            case "School of Magic for Empowered Spells":
                if (choice) {
                    feature.name = "Empowered Spells";
                    feature.desc = `Whenever the sidekick casts a spell in the ${choice.name} school by expending a spell slot, the sidekick can add its spellcasting ability modifier to the spell's damage roll or healing roll, if any.`;
                    this.applyStandardFeature(feature);
                }
                break;
            case "Improved Defense":
                let ac = this.statblock.ac;
                console.log(ac);
                if (typeof ac === 'string'){
                    const acParts = ac.split(' ', 2);
                    acParts[0] += 1;
                    ac = `${acParts[0]} ${acParts[1]}`
                }
                if (typeof ac === 'number'){
                    ac += 1;
                }
                console.log(ac);
                this.statblock.ac = ac;
            default:
                this.applyStandardFeature(feature);
                break;
        }
    }

    applyStandardFeature(feature: Feature) {
        const validCategories = ["traits", "actions", "bonus_actions", "legendary_actions", "mythic_actions", "reactions"] as const;
        type ValidCategoryKeys = typeof validCategories[number];
    
        // Type guard to check if a category is valid
        function isValidCategory(category: any): category is ValidCategoryKeys {
            return validCategories.includes(category);
        }
    
        // Use the type guard function
        const category = (feature.category && isValidCategory(feature.category)) ? feature.category : "traits";
    
        if (!this.statblock[category]) {
            this.statblock[category] = [];
        }
    
        const index = (this.statblock[category] as Trait[]).findIndex(trait => trait.name === feature.name);
    
        const newTrait: Trait = {
            name: feature.name,
            desc: feature.desc
        };
    
        if (index !== -1) {
            (this.statblock[category] as Trait[])[index] = newTrait;
        } else {
            (this.statblock[category] as Trait[]).push(newTrait);
        }
    }

    applySpellcasting() {
        const proficiencyBonus = Proficiency.calculatePB(this.level); // Calculate based on current level
        let spellList = "";
        let spellAbility = "";
        if (this.statblock.traits) {
            const role = this.statblock.traits.find(trait => ['Healer', 'Mage', 'Prodigy'].includes(trait.name));
            if (!role) {
                return;                
            }
            switch (role.name) {
                case "Mage":
                    spellList = "Wizard";
                    spellAbility = "Intelligence";
                    break;
                case "Healer":
                    spellList = "Cleric and Druid";
                    spellAbility = "Wisdom";
                    break;
                case "Prodigy":
                    spellList = "Bard and Warlock";
                    spellAbility = "Charisma";
                    break;
            }
            const abilities = Abilities.fromArray(this.statblock.stats);
            const abilityName = spellAbility.toLowerCase() as Ability;
            const spellMod = Abilities.calculateModifier(abilities[abilityName]);
            const spellDC = 8 + proficiencyBonus + spellMod;
            const spellAttack = proficiencyBonus + spellMod;
            const spellAttackSign = spellAttack >= 0 ? "+" : "-";
            const spellAttackWithSign = `${spellAttackSign}${Math.abs(spellAttack)}`;
    
            const spellcasterLevel = this.level;
            const spellSlots: { [key: string]: number } = {
                1: 0, 2: 0, 3: 0, 4: 0, 5: 0
            };
    
            const spellTable = [
                { level: 1, cantrips: 2, spells: 1, slots: { 1: 2 } },
                { level: 2, cantrips: 2, spells: 2, slots: { 1: 2 } },
                { level: 3, cantrips: 2, spells: 3, slots: { 1: 3 } },
                { level: 4, cantrips: 3, spells: 3, slots: { 1: 3 } },
                { level: 5, cantrips: 3, spells: 4, slots: { 1: 4, 2: 2 } },
                { level: 6, cantrips: 3, spells: 4, slots: { 1: 4, 2: 2 } },
                { level: 7, cantrips: 3, spells: 5, slots: { 1: 4, 2: 3 } },
                { level: 8, cantrips: 3, spells: 5, slots: { 1: 4, 2: 3 } },
                { level: 9, cantrips: 3, spells: 6, slots: { 1: 4, 2: 3, 3: 2 } },
                { level: 10, cantrips: 4, spells: 6, slots: { 1: 4, 2: 3, 3: 2 } },
                { level: 11, cantrips: 4, spells: 7, slots: { 1: 4, 2: 3, 3: 3 } },
                { level: 12, cantrips: 4, spells: 7, slots: { 1: 4, 2: 3, 3: 3 } },
                { level: 13, cantrips: 4, spells: 8, slots: { 1: 4, 2: 3, 3: 3, 4: 1 } },
                { level: 14, cantrips: 4, spells: 8, slots: { 1: 4, 2: 3, 3: 3, 4: 1 } },
                { level: 15, cantrips: 4, spells: 9, slots: { 1: 4, 2: 3, 3: 3, 4: 2 } },
                { level: 16, cantrips: 4, spells: 9, slots: { 1: 4, 2: 3, 3: 3, 4: 2 } },
                { level: 17, cantrips: 4, spells: 10, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 } },
                { level: 18, cantrips: 4, spells: 10, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 } },
                { level: 19, cantrips: 4, spells: 11, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 } },
                { level: 20, cantrips: 4, spells: 11, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 } }
            ];
    
            const levelData = spellTable.find(entry => entry.level === spellcasterLevel);
    
            if (levelData) {
                const cantripsKnown = levelData.cantrips;
                const spellsKnown = levelData.spells;
    
                for (const [level, slots] of Object.entries(levelData.slots)) {
                    spellSlots[level] = slots;
                }
    
                const spellcasting = `The sidekick is a level ${spellcasterLevel} spellcaster. Its spellcasting ability is ${spellAbility} (spell save DC ${spellDC}, ${spellAttackWithSign} to hit with spell attacks). The sidekick can cast the following ${cantripsKnown} cantrips and ${spellsKnown} spells from the ${spellList} spell list${spellList.includes("and") ? 's' : ''}:\n` +
                    `- Cantrips (at will): \n` +
                    Object.entries(spellSlots)
                        .filter(([_, value]) => value > 0)
                        .map(([level, slots]) => `- Level ${level} (${slots} slot${slots !== 1 ? 's' : ''}): \n`)
                        .join('');
    
                role.desc = spellcasting;
            } else {
                role.desc = '';
            }
        }
    }

    updateSkills(oldAbilities: Abilities, oldProficiencyBonus: number) {
        const newAbilities = Abilities.fromArray(this.statblock.stats);
        const oldMods = Abilities.calculateModifiers(oldAbilities);
        const newMods = Abilities.calculateModifiers(newAbilities);
        const newProficiencyBonus = Proficiency.calculatePB(this.level);
    
        const updatedSkills: { [key: string]: number } = {};
    
        for (const skill in this.statblock.skillsaves) {
            const skillAbility = getAbilityForSkill(skill);
            const oldAbilityMod = oldMods[skillAbility];
            const newAbilityMod = newMods[skillAbility];
    
            const isExpertise = this.expertiseSkills?.includes(skill) || false;
    
            let oldSkillBonus = this.statblock.skillsaves[skill];
    
            if (oldSkillBonus === 0) {
                oldSkillBonus = oldAbilityMod + oldProficiencyBonus;
            }
    
            const newProficiencyBonusToAdd = isExpertise ? newProficiencyBonus * 2 : newProficiencyBonus;
    
            const newSkillBonus = oldSkillBonus - oldAbilityMod - oldProficiencyBonus + newAbilityMod + newProficiencyBonusToAdd;
    
            updatedSkills[skill] = newSkillBonus;
        }
    
        // Sort the skills alphabetically
        const sortedSkills = Object.entries(updatedSkills)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .reduce((obj, [key, value]) => {
                obj[key] = value;
                return obj;
            }, {} as { [key: string]: number });
    
        this.statblock.skillsaves = sortedSkills;
    }

    updateSaves(oldAbilities: Abilities, oldProficiencyBonus: number) {
        const newAbilities = Abilities.fromArray(this.statblock.stats);
        const oldMods = Abilities.calculateModifiers(oldAbilities);
        const newMods = Abilities.calculateModifiers(newAbilities);
        const newProficiencyBonus = Proficiency.calculatePB(this.level);
    
        const updatedSaves: { [key in Ability]?: number } = {};
    
        for (const save in this.statblock.saves) {
            const saveKey = save.toLowerCase() as Ability;
            const oldAbilityMod = oldMods[saveKey];
            const newAbilityMod = newMods[saveKey];
    
            let oldSaveBonus = (this.statblock.saves as Proficiencies)[save];
    
            if (oldSaveBonus === undefined || oldSaveBonus === 0) {
                oldSaveBonus = oldAbilityMod + oldProficiencyBonus;
            }
    
            const newSaveBonus = oldSaveBonus - oldAbilityMod - oldProficiencyBonus + newAbilityMod + newProficiencyBonus;
    
            updatedSaves[saveKey] = newSaveBonus;
        }
    
        // Sort the saves alphabetically
        const sortedSaves = Object.entries(updatedSaves)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .reduce((obj, [key, value]) => {
                obj[key as Ability] = value;
                return obj;
            }, {} as { [key in Ability]?: number });
    
        this.statblock.saves = sortedSaves;
    }


    updateAttacks(oldAbilities: Abilities, oldProficiencyBonus: number) {
        const newAbilities = Abilities.fromArray(this.statblock.stats);
        const oldMods = Abilities.calculateModifiers(oldAbilities);
        const newMods = Abilities.calculateModifiers(newAbilities);
        const newProficiencyBonus = Proficiency.calculatePB(this.level);
    
        const actions = this.statblock.actions ?? [];
        const updatedActions: typeof actions = [];

        for (const action of actions) {
            const attack = new Attack(action);
            if (attack.isAttack) {
                const relevantAbility = attack.getRelevantAbility(newAbilities);
                const oldAbilityMod = oldMods[relevantAbility];
                const newAbilityMod = newMods[relevantAbility];

                const proficiencyBonusDiff = newProficiencyBonus - oldProficiencyBonus;
                const modifierDiff = newAbilityMod - oldAbilityMod;

                if (attack.toHit !== undefined) {
                    attack.toHit += modifierDiff;
                    attack.toHit += proficiencyBonusDiff;
                }
    
                if (attack.damageMod !== undefined) {
                    attack.damageMod += modifierDiff;
                }
    
                const updatedAction = {
                    ...action,
                    desc: attack.constructDescription()
                };

                updatedActions.push(updatedAction);
            } else {
                updatedActions.push(action);
            }
        }

        this.statblock.actions = updatedActions;
    }

    updateSenses() {
        const senses = this.statblock.senses;
        if (!senses) return;
    
        const passivePerceptionMatch = senses.match(/passive Perception (\d+)/i);
        if (passivePerceptionMatch) {
            const currentPassivePerception = parseInt(passivePerceptionMatch[1], 10);
    
            const abilities = Abilities.fromArray(this.statblock.stats);
            const wisdomMod = Abilities.calculateModifier(abilities.wisdom);
    
            const proficiencyBonus = Proficiency.calculatePB(this.level);
    
            let perception = 10;
            if (this.statblock.skillsaves && this.statblock.skillsaves.hasOwnProperty('Perception')) {
                perception += wisdomMod + proficiencyBonus;
            } else {
                perception += wisdomMod;
            }
    
            const newPassivePerception = perception;
    
            if (newPassivePerception !== currentPassivePerception) {
                this.statblock.senses = senses.replace(/passive Perception \d+/i, `passive Perception ${newPassivePerception}`);
            }
        }
    }

    /**
     * Serialize the sidekick to a string format for saving or debugging.
     */
    toString(): string {
        return `Sidekick: ${this.statblock.name}, Class: ${this.sidekickClass.name}, Level: ${this.level}`;
    }
}