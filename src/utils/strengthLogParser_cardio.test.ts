import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { parseStrengthLogCSV } from "./strengthLogParser.ts";

const input = `01-20-2026 06:21 - 07:22
Duration: 01h 01m
Rowing (Machine): 2 x 0 x 0 x 0 x 00:08:15
Cross Trainer (Elliptical): 4.5 x 283 x 00:20:00
Assault Air Bike: 1 x 24 x 00:01:31, 0.5 x 15 x 00:00:45, 0.5 x 15 x 00:00:42, 0.5 x 15 x 00:00:42, 1.5 x 36 x 00:02:17, 0.5 x 11 x 00:00:47, 0.5 x 17 x 00:00:37
Machine Chest Fly: 15 x 50 (YR!), 12 x 57.5 (PR!), 10 x 65 (PR!), 4 x 74.5 (YR!)
Stair Climber: 2.5 x 31 x 00:04:00 "25 våningar"`;

Deno.test("Parses StrengthLog Cardio formats correctly", () => {
  const result = parseStrengthLogCSV(input, "test-user");
  const workout = result.workouts[0];

  console.log("Parsed workout:", JSON.stringify(workout, null, 2));

  // Check Exercises count
  assertEquals(workout.exercises.length, 5, "Should have 5 exercises");

  // 1. Rowing (Machine): 2 x 0 x 0 x 0 x 00:08:15
  const row = workout.exercises.find((e) =>
    e.exerciseName === "Rowing (Machine)"
  );
  console.log("Rowing sets:", row?.sets);
  assertEquals(row?.sets.length, 1, "Rowing should have 1 set");
  const rowSet = row?.sets[0];
  assertEquals(rowSet?.distance, 2000, "Rowing distance should be 2000m (2km)");
  assertEquals(rowSet?.time, "00:08:15", "Rowing time should be 00:08:15");

  // 2. Cross Trainer: 4.5 x 283 x 00:20:00 (km x kcal x time)
  const cross = workout.exercises.find((e) =>
    e.exerciseName === "Cross Trainer (Elliptical)"
  );
  console.log("Cross Trainer sets:", cross?.sets);
  assertEquals(cross?.sets.length, 1, "Cross Trainer should have 1 set");
  const crossSet = cross?.sets[0];
  assertEquals(
    crossSet?.distance,
    4500,
    "Cross Trainer distance should be 4500m",
  );
  assertEquals(crossSet?.calories, 283, "Cross Trainer calories should be 283");
  assertEquals(
    crossSet?.time,
    "00:20:00",
    "Cross Trainer time should be 00:20:00",
  );

  // 3. Assault Air Bike: 7 sets with km x kcal x time format
  const bike = workout.exercises.find((e) =>
    e.exerciseName === "Assault Air Bike"
  );
  console.log("Assault Air Bike sets:", bike?.sets);
  assertEquals(bike?.sets.length, 7, "Assault Bike should have 7 sets");

  const bikeSet1 = bike?.sets[0];
  assertEquals(bikeSet1?.distance, 1000, "Bike set 1 distance should be 1000m");
  assertEquals(bikeSet1?.calories, 24, "Bike set 1 calories should be 24");
  assertEquals(
    bikeSet1?.time,
    "00:01:31",
    "Bike set 1 time should be 00:01:31",
  );

  // 4. Stair Climber: 2.5 x 31 x 00:04:00 (floors/10 x kcal x time)
  const stairs = workout.exercises.find((e) =>
    e.exerciseName === "Stair Climber"
  );
  console.log("Stair Climber sets:", stairs?.sets);
  assertEquals(stairs?.sets.length, 1, "Stair Climber should have 1 set");
  const stairsSet = stairs?.sets[0];
  assertEquals(stairsSet?.reps, 25, "Stair Climber reps should be 25 (floors)");
  assertEquals(stairsSet?.calories, 31, "Stair Climber calories should be 31");
  assertEquals(
    stairsSet?.time,
    "00:04:00",
    "Stair Climber time should be 00:04:00",
  );

  // 5. Machine Chest Fly: 15 x 50, 12 x 57.5, 10 x 65, 4 x 74.5 (reps x weight)
  const fly = workout.exercises.find((e) =>
    e.exerciseName === "Machine Chest Fly"
  );
  console.log("Machine Chest Fly sets:", fly?.sets);
  assertEquals(fly?.sets.length, 4, "Machine Chest Fly should have 4 sets");
  assertEquals(fly?.sets[0]?.reps, 15, "Fly set 1 reps should be 15");
  assertEquals(fly?.sets[0]?.weight, 50, "Fly set 1 weight should be 50");
  assertEquals(fly?.sets[1]?.reps, 12, "Fly set 2 reps should be 12");
  assertEquals(fly?.sets[1]?.weight, 57.5, "Fly set 2 weight should be 57.5");
  assertEquals(fly?.sets[2]?.reps, 10, "Fly set 3 reps should be 10");
  assertEquals(fly?.sets[2]?.weight, 65, "Fly set 3 weight should be 65");
  assertEquals(fly?.sets[3]?.reps, 4, "Fly set 4 reps should be 4");
  assertEquals(fly?.sets[3]?.weight, 74.5, "Fly set 4 weight should be 74.5");
});
