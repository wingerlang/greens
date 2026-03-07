const aReq = await fetch('http://localhost:8000/api/activities').then(r => r.json());
const sReq = await fetch('http://localhost:8000/api/strengthlog').then(r => r.json());

const a = Array.isArray(aReq) ? aReq : (aReq.data || aReq.activities || []);
const s = Array.isArray(sReq) ? sReq : (sReq.data || sReq.strengthWorkouts || []);

// Loose search, check anything containing 1-22 or 01-22
const strava = a.filter((x: any) => x.id === '13296155607' || (x.startDateLocal && x.startDateLocal.includes('01-22')));
const strength = s.filter((x: any) => x.id === 'str-1767850236754-m7dv12' || (x.date && x.date.includes('01-22')));

console.log('STRAVA:', JSON.stringify(strava.map((x: any) => ({ id: x.id, title: x.title, type: x.type, duration: x.movingTime / 60, elapsed: x.performance?.elapsedTimeSeconds / 60 })), null, 2));
console.log('STRENGTHLOG:', JSON.stringify(strength.map((x: any) => ({ id: x.id, title: x.name, date: x.date, isMerged: x.mergeInfo?.isMerged, durationMinutes: x.durationMinutes, exercises: x.exercises?.map((e: any) => ({ n: e.exerciseName, s: e.sets })) })), null, 2));
