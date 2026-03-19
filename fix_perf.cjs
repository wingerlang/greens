const fs = require('fs');

const file = 'c:/repos/greens/src/components/activities/ActivityDetailModal.tsx';
let content = fs.readFileSync(file, 'utf8');

console.log("Replacing perf variables inside Generic Stats Grid...");

// Exact replacements on lines that are inside the anonymous function combined layout
content = content.replace(/!!perf\?\.averageWatts/g, '!!effectivePerf?.averageWatts');
content = content.replace(/Math\.round\(perf\.averageWatts\)/g, 'Math.round(effectivePerf.averageWatts)');
content = content.replace(/\(perf\?\.achievementCount/g, '(effectivePerf?.achievementCount');
content = content.replace(/perf\?\.prCount/g, 'effectivePerf?.prCount');
content = content.replace(/perf\?\.kudosCount/g, 'effectivePerf?.kudosCount');
content = content.replace(/perf\.prCount/g, 'effectivePerf.prCount');
content = content.replace(/perf\.achievementCount/g, 'effectivePerf.achievementCount');

fs.writeFileSync(file, content, 'utf8');
console.log('Double checking edits...');
