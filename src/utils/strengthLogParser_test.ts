import { parseStrengthLogCSV } from "./strengthLogParser.ts";

const userId = "test-user";

async function runTest() {
  try {
    console.log("Testing OLD format...");
    const oldContent = await Deno.readTextFile(
      "data/johannes_strengthlog_old_format.csv",
    );
    const oldParsed = parseStrengthLogCSV(oldContent, userId);
    console.log(`OLD: Found ${oldParsed.workouts.length} workouts`);
    console.log(`OLD: First workout date: ${oldParsed.workouts[0]?.date}`);
    console.log(`OLD: Personal Bests found: ${oldParsed.personalBests.length}`);

    console.log("\nTesting NEW format...");
    const newContent = await Deno.readTextFile(
      "data/johannes_strengthlog_new_format.csv",
    );
    const newParsed = parseStrengthLogCSV(newContent, userId);
    console.log(`NEW: Found ${newParsed.workouts.length} workouts`);
    console.log(`NEW: First workout date: ${newParsed.workouts[0]?.date}`);
    console.log(`NEW: Personal Bests found: ${newParsed.personalBests.length}`);

    if (oldParsed.workouts.length > 0 && newParsed.workouts.length > 0) {
      console.log("\n✅ Success! Both formats parsed correctly.");
    } else {
      console.log(
        "\n❌ Failure! One or both formats failed to return workouts.",
      );
      Deno.exit(1);
    }
  } catch (err) {
    console.error("\n❌ Error during testing:", err);
    Deno.exit(1);
  }
}

runTest();
