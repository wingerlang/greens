const text = Deno.readTextFileSync("LivsmedelsDB_Cleaned_Vegan.csv");
const firstLine = text.split("\n")[0];
Deno.writeTextFileSync("headers.txt", firstLine);
export { };
