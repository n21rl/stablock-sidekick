import { Notice, normalizePath, parseYaml, stringifyYaml } from 'obsidian';
import { showNameInputModal, showFolderSelectModal } from 'modals/show';
import StatblockSidekick from '../main';

export type Ability = "strength" | "dexterity" | "constitution" | "intelligence" | "wisdom" | "charisma";
export type Skill = string;

export interface Proficiencies {
    [key: string]: number | undefined;
}

export function getAbilityForSkill(skill: Skill): Ability {
    const skillToAbilityMap: Record<Skill, Ability> = {
        acrobatics: 'dexterity',
        animal_handling: 'wisdom',
        arcana: 'intelligence',
        athletics: 'strength',
        deception: 'charisma',
        history: 'intelligence',
        insight: 'wisdom',
        intimidation: 'charisma',
        investigation: 'intelligence',
        medicine: 'wisdom',
        nature: 'intelligence',
        perception: 'wisdom',
        performance: 'charisma',
        persuasion: 'charisma',
        religion: 'intelligence',
        sleight_of_hand: 'dexterity',
        stealth: 'dexterity',
        survival: 'wisdom'
    };

    const normalizedSkill = skill.toLowerCase().replace(/ /g, '_'); // Normalize input

    // Check if the skill exists in the map
    if (skillToAbilityMap[normalizedSkill]) {
        return skillToAbilityMap[normalizedSkill];
    } else {
        throw new Error(`Ability not found for skill: ${skill}`);
    }
}

export interface Trait {
    name: string;
    desc: string;
    traits?: Trait[];
    [key: string]: any;
}

export interface Feature {
    name: string;
    desc: string;
    category?: string;
    options?: Option[];
    nbChoices?: number;
    conditions?: string[]
}

export interface Option {
    name: string;
    desc?: string;
    category?: string
}

export type Spell = string | { [key: string]: string };

export class Statblock {
    image?: string;
    name?: string;
    size?: string;
    type?: string;
    subtype?: string;
    alignment?: string;
    ac?: string | number;
    hp?: number;
    hit_dice: string;
    speed?: string;
    stats: [number, number, number, number, number, number];
    saves?: { [K in Ability]?: number };
    skillsaves?: { [key: string]: number };
    damage_vulnerabilities?: string;
    damage_resistances?: string;
    damage_immunities?: string;
    condition_immunities?: string;
    senses?: string;
    languages?: string;
    cr: string | number;
    traits?: Trait[];
    spells?: Spell[];
    actions?: Trait[];
    bonus_actions?: Trait[];
    legendary_actions?: Trait[];
    legendary_description?: string;
    mythic_actions?: Trait[];
    mythic_description?: string;
    reactions?: Trait[];
    lair_actions?: Trait[];
    source?: string | string[];
    spellsNotes?: string;
    "statblock-link"?: string;

    constructor(data: any) {
        Object.assign(this, data);
    }
}

export type CategoryKey = {
    [Key in keyof Statblock]: Statblock[Key] extends Trait[] ? Key : never
}[keyof Statblock]; 

// Function to extract a Statblock from markdown content
export function extractStatblock(noteContent: string): Statblock | null {
    const regex = /```statblock\n([\s\S]+?)\n```/;
    const match = noteContent.match(regex);
    if (match && match[1]) {
        try {
            const data = parseYaml(match[1]);

            return new Statblock(data)
        } catch (e) {
            console.error("Failed to parse YAML:", e);
            return null;
        }
    } else {
        console.error("No statblock found");
        return null;
    }
}

// Function to format a Statblock as markdown text
export function formatStatblockAsText(statblock: Statblock): string {
    const yamlContent = stringifyYaml(statblock);
    return `\n\`\`\`statblock\n${yamlContent}\n\`\`\``;
}

export async function saveStatblockToFile(plugin: StatblockSidekick, content: string, name: string) {
    const { settings } = plugin;
    let folderPath: string;
    switch (settings.saveMode) {
        case 'sameFolder':
        const activeFile = plugin.app.workspace.getActiveFile();
        if (!activeFile?.parent) {
            throw new Error('Expected an active file when saving to the same folder.');
        }
        folderPath = activeFile.parent.path;
        break;
        case 'defaultFolder':
        folderPath = normalizePath(settings.saveFolder);
        break;
        case 'promptFolder':         // not fully implemented yet
        const Folder = await showFolderSelectModal(plugin.app);
        if (!Folder) {
            return;
        }
        folderPath = Folder;
        break;
        default:
        new Notice('Invalid save mode setting.');
        return;
    }

    try {
        // Check if the folder exists, and create it if it doesn't
        const exists = await plugin.app.vault.adapter.exists(folderPath);
        if (!exists) {
            await plugin.app.vault.createFolder(folderPath);
        }

        let fileName = `${name}`;
        const filePath = `${folderPath}/${fileName}`;

        // Check if the file already exists
        const fileExists = await plugin.app.vault.adapter.exists(filePath);

        if (fileExists) {
            // If the file already exists, show the NameInputModal again
            let newFileName: string | undefined;
            while (true) {
                const modalResult = await showNameInputModal(plugin.app);
                if (typeof modalResult === 'string') {
                    newFileName = modalResult;
                } else {
                    // User cancelled the modal, return without saving
                    return;
                }

                if (!newFileName) {
                    // User entered an empty string, return without saving
                    return;
                }

                fileName = `${newFileName}.md`;
                const newFilePath = `${folderPath}/${fileName}`;
                const newFileExists = await plugin.app.vault.adapter.exists(newFilePath);

                if (!newFileExists) {
                    // Found a unique file name, break out of the loop
                    name = newFileName;
                    break;
                } else {
                    new Notice(`File ${newFileName}.md already exists. Please choose a different name.`);
                }
            }
        }

        // Create new file with the updated content
        await plugin.app.vault.create(filePath, content);
        // new Notice(`Sidekick saved as ${fileName}`);
        plugin.app.workspace.openLinkText(fileName, filePath, true, { active: true });

    } catch (error) {
        console.error("Failed to save the file:", error);
        new Notice("Error saving the sidekick");
    }
}