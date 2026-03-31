import { kv } from "../kv.ts";
import { RaceDefinition, RaceIgnoreRule } from "../../models/types.ts";

export const raceDefinitionRepo = {
    async getDefinitions(userId: string): Promise<RaceDefinition[]> {
        const key = ["users", userId, "race_definitions"];
        const res = await kv.get<RaceDefinition[]>(key);
        return res.value || [];
    },

    async saveDefinitions(userId: string, definitions: RaceDefinition[]): Promise<void> {
        const key = ["users", userId, "race_definitions"];
        await kv.set(key, definitions);
    },

    async saveDefinition(userId: string, definition: RaceDefinition): Promise<void> {
        const defs = await this.getDefinitions(userId);
        const index = defs.findIndex(d => d.id === definition.id);
        if (index >= 0) {
            defs[index] = definition;
        } else {
            defs.push(definition);
        }
        await this.saveDefinitions(userId, defs);
    },

    async deleteDefinition(userId: string, id: string): Promise<void> {
        const defs = await this.getDefinitions(userId);
        const filtered = defs.filter(d => d.id !== id);
        await this.saveDefinitions(userId, filtered);
    },

    async getIgnoreRules(userId: string): Promise<RaceIgnoreRule[]> {
        const key = ["users", userId, "race_ignore_rules"];
        const res = await kv.get<RaceIgnoreRule[]>(key);
        return res.value || [];
    },

    async saveIgnoreRules(userId: string, rules: RaceIgnoreRule[]): Promise<void> {
        const key = ["users", userId, "race_ignore_rules"];
        await kv.set(key, rules);
    },

    async saveIgnoreRule(userId: string, rule: RaceIgnoreRule): Promise<void> {
        const rules = await this.getIgnoreRules(userId);
        const index = rules.findIndex(r => r.id === rule.id);
        if (index >= 0) {
            rules[index] = rule;
        } else {
            rules.push(rule);
        }
        await this.saveIgnoreRules(userId, rules);
    },

    async deleteIgnoreRule(userId: string, id: string): Promise<void> {
        const rules = await this.getIgnoreRules(userId);
        const filtered = rules.filter(r => r.id !== id);
        await this.saveIgnoreRules(userId, filtered);
    }
};
