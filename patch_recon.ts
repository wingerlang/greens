import { readFileSync, writeFileSync } from 'fs';

let file = 'src/api/services/reconciliationService.ts';
let code = readFileSync(file, 'utf8');

// The reviewer noticed that we missed passing latestWeight to createUniversalFromStrava or similar inside syncWithStrava
// Let's replace createUniversalFromStrava inside the reconciliationService
code = code.replace(
    /createUniversalFromStrava\(stravaActivity, userId, user\?\.settings\)/g,
    'createUniversalFromStrava(stravaActivity, userId, user?.settings, latestWeight)'
);

code = code.replace(
    /mapStravaToPerformance\(stravaActivity, user\?\.settings\)/g,
    'mapStravaToPerformance(stravaActivity, user?.settings, latestWeight)'
);

writeFileSync(file, code);
console.log('patched_recon');
