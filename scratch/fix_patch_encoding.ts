// Script to fix encoding / Mojibake in the patch file
const patchPath = "scratch/training_calendar_diff.txt";
let content = await Deno.readTextFile(patchPath);

// Mappings of Mojibake characters to correct characters
const replacements = [
    { from: "├Â", to: "ö" },
    { from: "├ñ", to: "ä" },
    { from: "├Ñ", to: "å" },
    { from: "ÔÇó", to: "•" }
];

for (const { from, to } of replacements) {
    content = content.replaceAll(from, to);
}

await Deno.writeTextFile(patchPath, content);
console.log("Encoding fixed in patch file.");
