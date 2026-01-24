import { parseNewStrengthLogFormat } from "./strengthLogParser.ts";

const csv =
  `workout,start,end,exercise,weight,bodyweight,extraWeight,assistingWeight,distanceKM,distanceM,reps,rpm,time-per-500,calories,time,warmup,max,fail,checked,setComment,workoutComment,form,sleep,calories,stress
Friday Lunch: Quads, Shoulders, Chest etc.,1767955973239,1767958961657,Push-Up,,80,0,,,,25,,,,,false,false,false,1767956071380,,,,,,
Friday Lunch: Quads, Shoulders, Chest etc.,1767955973239,1767958961657,Push-Up,,80,0,,,,30,,,,,false,false,false,1767959046580,,,,,,
Friday Lunch: Quads, Shoulders, Chest etc.,1767955973239,1767958961657,Bench Press,30,,,,,,12,,,,,false,false,false,1767956165983,,,,,,
Friday Lunch: Quads, Shoulders, Chest etc.,1767955973239,1767958961657,Bench Press,50,,,,,,5,,,,,false,false,false,1767956255612,,,,,,
Friday Lunch: Quads, Shoulders, Chest etc.,1767955973239,1767958961657,Bench Press,62.5,,,,,,3,,,,,false,false,false,1767956536645,,,,,,
Friday Lunch: Quads, Shoulders, Chest etc.,1767955973239,1767958961657,Bench Press,67.5,,,,,,2,,,,,false,false,false,1767956797964,,,,,,
Friday Lunch: Quads, Shoulders, Chest etc.,1767955973239,1767958961657,Bench Press,70,,,,,,5,,,,,false,false,false,1767956959067,,,,,,
Friday Lunch: Quads, Shoulders, Chest etc.,1767955973239,1767958961657,Bench Press,65,,,,,,3,,,,,false,false,false,1767957152527,,,,,,
Friday Lunch: Quads, Shoulders, Chest etc.,1767955973239,1767958961657,Bench Press,60,,,,,,8,,,,,false,false,false,1767957502921,,,,,,
`;

const result = parseNewStrengthLogFormat(csv, "test-user");
console.log(JSON.stringify(result, null, 2));
