const path = "coverage/cov_profile/html/index.html";

// Check if file exists
try {
  const stat = await Deno.stat(path);
  if (!stat.isFile) {
    console.error(`Error: ${path} is not a file.`);
    Deno.exit(1);
  }
} catch {
  console.error(`Error: Coverage file ${path} not found. Please run tests first.`);
  Deno.exit(1);
}

console.log(`Opening coverage report in default browser: ${path}...`);

let cmd: string[];
if (Deno.build.os === "windows") {
  cmd = ["cmd", "/c", "start", path];
} else if (Deno.build.os === "darwin") {
  cmd = ["open", path];
} else {
  cmd = ["xdg-open", path];
}

const process = new Deno.Command(cmd[0], {
  args: cmd.slice(1),
  stdout: "null",
  stderr: "null",
});

try {
  await process.output();
  console.log("Coverage report opened successfully.");
} catch (err) {
  console.error("Failed to open coverage report automatically:", err);
}
