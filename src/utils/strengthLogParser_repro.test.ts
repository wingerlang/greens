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

  // Check Exercises count
  assertEquals(workout.exercises.length, 5);

  // 1. Rowing (Machine)
  // Input: 2 x 0 x 0 x 0 x 00:08:15
  const row = workout.exercises.find((e) =>
    e.exerciseName === "Rowing (Machine)"
  );
  const rowSet = row?.sets[0];
  // Expected: distance=2000m (from 2km), time="00:08:15"
  assertEquals(rowSet?.distance, 2000);
  assertEquals(rowSet?.time, "00:08:15");

  // 2. Cross Trainer
  // Input: 4.5 x 283 x 00:20:00 (km x kcal x time)
  const cross = workout.exercises.find((e) =>
    e.exerciseName === "Cross Trainer (Elliptical)"
  );
  const crossSet = cross?.sets[0];
  // Expected: distance=4500m (from 4.5km), kcal=283, time="00:20:00"
  assertEquals(crossSet?.distance, 4500);
  assertEquals(crossSet?.calories, 283);
  assertEquals(crossSet?.time, "00:20:00");

  // 3. Assault Air Bike
  // Input: 1 x 24 x 00:01:31 (km x kcal x time)
  const bike = workout.exercises.find((e) =>
    e.exerciseName === "Assault Air Bike"
  );
  const bikeSet1 = bike?.sets[0];
  // Expected: distance=1000m, kcal=24, time=01:31
  assertEquals(bikeSet1?.distance, 1000);
  assertEquals(bikeSet1?.calories, 24);
  assertEquals(bikeSet1?.time, "00:01:31");

  // 4. Stair Climber
  // Input: 2.5 x 31 x 00:04:00 "25 våningar"
  const stairs = workout.exercises.find((e) =>
    e.exerciseName === "Stair Climber"
  );
  const stairsSet = stairs?.sets[0];
  // Expected: reps=25 (from 2.5 * 10), calories=31, time="00:04:00"
  assertEquals(stairsSet?.reps, 25);
  assertEquals(stairsSet?.calories, 31);
  assertEquals(stairsSet?.time, "00:04:00");
});
