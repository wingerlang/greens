import { assertEquals } from "jsr:@std/assert";
import {
    isRun,
    isStrength,
    isCompetition,
    isWarmupOrCooldown,
    isTempoInterval,
    isRecovery,
    formatTime,
    parseTimeInSeconds,
    detectRunningPBs,
    isLongRun,
    isUltra,
    isQualitySession
} from "../../src/utils/activityUtils.ts";

Deno.test("isRun - checks run classification correctly", () => {
    // Standard runs
    assertEquals(isRun({ type: "running" }), true);
    assertEquals(isRun({ type: "run" }), true);
    assertEquals(isRun({ type: "Löpning" }), true);
    assertEquals(isRun({ performance: { activityType: "trail" } }), true);

    // Falsy and safety exclusions
    assertEquals(isRun(null), false);
    assertEquals(isRun({ type: "strength" }), false);
    assertEquals(isRun({ type: "cycling" }), false);
    assertEquals(isRun({ type: "ride" }), false);
    assertEquals(isRun({ type: "cardio" }), false);
});

Deno.test("isStrength - checks strength training", () => {
    assertEquals(isStrength({ type: "strength" }), true);
    assertEquals(isStrength({ type: "styrka" }), true);
    assertEquals(isStrength({ type: "running" }), false);
    assertEquals(isStrength(null), false);
});

Deno.test("isWarmupOrCooldown - checks warmup and cooldown categories/titles", () => {
    assertEquals(isWarmupOrCooldown({ subType: "warmup" }), true);
    assertEquals(isWarmupOrCooldown({ performance: { subType: "cooldown" } }), true);
    assertEquals(isWarmupOrCooldown({ name: "Uppjogg" }), true);
    assertEquals(isWarmupOrCooldown({ title: "Nerjogg inför tävling" }), true);
    assertEquals(isWarmupOrCooldown({ notes: "Nedjogg" }), true);
    assertEquals(isWarmupOrCooldown({ title: "Snabbt pass" }), false);
    
    // Cooldown containing "distans" should not be classified as warmup or cooldown
    assertEquals(isWarmupOrCooldown({ title: "Nerjogg distans" }), false);
    assertEquals(isWarmupOrCooldown({ name: "Distanspass / nerjogg" }), false);
});

Deno.test("isCompetition - checks race category rules", () => {
    // Explicit race flags
    assertEquals(isCompetition({ plan: { isRace: true } }), true);
    assertEquals(isCompetition({ plan: { category: "RACE" } }), true);
    assertEquals(isCompetition({ isRace: true }), true);
    assertEquals(isCompetition({ category: "RACE" }), true);
    assertEquals(isCompetition({ subType: "race" }), true);

    // Warmup exclusion has priority
    assertEquals(isCompetition({ isRace: true, subType: "warmup" }), false);
    assertEquals(isCompetition({ plan: { category: "RACE" }, title: "Uppjogg" }), false);

    // Bib & rank
    assertEquals(isCompetition({ raceDetails: { bib: "123" } }), true);
    assertEquals(isCompetition({ raceDetails: { rank: 1 } }), true);

    // Keywords
    assertEquals(isCompetition({ title: "Göteborgsvarvet halvmarathon" }), true);
    assertEquals(isCompetition({ title: "Virtuell tävling 5km" }), true);

    // Keyword exclusion cases
    assertEquals(isCompetition({ title: "Inför lopp", distance: 10 }), false);
    assertEquals(isCompetition({ title: "Marathon test", distance: 3 }), false); // Distance too short
});

Deno.test("isTempoInterval - checks quality types", () => {
    assertEquals(isTempoInterval({ subType: "interval" }), true);
    assertEquals(isTempoInterval({ title: "Tempo 10km" }), true);
    assertEquals(isTempoInterval({ title: "4x4min intervaller" }), true);
    assertEquals(isTempoInterval({ name: "Lugn distans" }), false);
});

Deno.test("isRecovery - checks recovery types", () => {
    assertEquals(isRecovery({ subType: "recovery" }), true);
    assertEquals(isRecovery({ plan: { category: "recovery" } }), true);
    assertEquals(isRecovery({ title: "Återhämtningspass" }), true);
    assertEquals(isRecovery({ title: "Hårt tempo" }), false);
});

Deno.test("formatTime - formats seconds correctly", () => {
    assertEquals(formatTime(0), "-");
    assertEquals(formatTime(-10), "-");
    assertEquals(formatTime(45), "0:45");
    assertEquals(formatTime(60), "1:00");
    assertEquals(formatTime(3600), "1:00:00");
    assertEquals(formatTime(3665), "1:01:05");
});

Deno.test("parseTimeInSeconds - parses duration strings correctly", () => {
    assertEquals(parseTimeInSeconds("-"), 0);
    assertEquals(parseTimeInSeconds(undefined), 0);
    assertEquals(parseTimeInSeconds("1:00:00"), 3600);
    assertEquals(parseTimeInSeconds("1:01:05"), 3665);
    assertEquals(parseTimeInSeconds("1:00"), 60);
    assertEquals(parseTimeInSeconds("45"), 45);
});

Deno.test("detectRunningPBs - aggregates stats and identifies personal bests", () => {
    const activities = [
        {
            id: "act1",
            type: "running",
            distance: 5.0,
            duration: 1500, // 25 min = 1500 sec
            date: "2023-01-01"
        },
        {
            id: "act2",
            type: "running",
            distance: 5.1,
            duration: 1320, // 22 min = 1320 sec (New PB!)
            date: "2023-01-02"
        },
        {
            id: "act3",
            type: "running",
            distance: 10.0,
            duration: 3000, // 50 min = 3000 sec
            date: "2023-01-03"
        },
        {
            id: "act4",
            type: "running",
            distance: 21.1,
            duration: 6600, // 110 min = 6600 sec
            date: "2023-01-04"
        },
        {
            id: "act5",
            type: "running",
            distance: 42.2,
            duration: 14400, // 240 min = 14400 sec
            date: "2023-01-05"
        },
        {
            id: "act6",
            type: "running",
            distance: 12.0,
            duration: 3600,
            date: "2023-01-06",
            plan: { category: "RACE" } // competition
        }
    ];

    const pbs = detectRunningPBs(activities);

    assertEquals(pbs.best5k.time, "22:00");
    assertEquals(pbs.best5k.date, "2023-01-02");
    assertEquals(pbs.best5k.id, "act2");
    
    assertEquals(pbs.best10k.time, "50:00");
    assertEquals(pbs.bestHalf.time, "1:50:00");
    assertEquals(pbs.bestFull.time, "4:00:00");
    
    assertEquals(pbs.longestRun.dist, 42.2);
    assertEquals(pbs.longestRun.time, "4:00:00");
    
    assertEquals(pbs.competitions, 1);
});

Deno.test("isLongRun and isUltra - checks thresholds", () => {
    const activityNormal = { type: "running", distance: 10 };
    const activityLong = { type: "running", distance: 25 };
    const activityUltra = { type: "running", distance: 50 };

    assertEquals(isLongRun(activityNormal), false);
    assertEquals(isLongRun(activityLong), true);
    assertEquals(isLongRun(activityUltra), false); // Ultra is not long run since >= 42.2

    assertEquals(isUltra(activityNormal), false);
    assertEquals(isUltra(activityLong), false);
    assertEquals(isUltra(activityUltra), true);
});

Deno.test("isQualitySession - identifies quality training", () => {
    assertEquals(isQualitySession({ subType: "interval" }), true);
    assertEquals(isQualitySession({ plan: { category: "RACE" } }), true);
    assertEquals(isQualitySession({ title: "Tröskelintervaller" }), true);
    assertEquals(isQualitySession({ title: "Nerjogg", subType: "cooldown" }), false);
    assertEquals(isQualitySession({ title: "Distanspass" }), false);
});
