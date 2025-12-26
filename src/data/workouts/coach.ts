import { WorkoutDefinition } from '../../models/workout.ts';

export const COACH_WORKOUTS: WorkoutDefinition[] = [
    {
        id: 'coach_intervals_vvo2',
        title: 'vVO2max Intervals',
        category: 'RUNNING',
        durationMin: 60,
        difficulty: 'Advanced',
        description: 'Klassiska intervaller för att höja ditt maximala syreupptag. Baserat på din 5k-tid.',
        tags: ['Intervals', 'VO2max', 'Running'],
        source: 'COACH_AI',
        inputs: [
            {
                id: 'capacity',
                label: 'Nuvarande 5k tid (min)',
                type: 'number',
                defaultValue: 20,
                min: 13,
                max: 45,
                unit: 'min'
            },
            {
                id: 'volume',
                label: 'Antal intervaller',
                type: 'slider',
                defaultValue: 5,
                min: 3,
                max: 8,
                step: 1
            }
        ],
        generator: (inputs) => {
            const timeMin = Number(inputs['capacity']) || 20;
            const count = Number(inputs['volume']) || 5;

            // Calculate vVO2max pace approx (5k pace is roughly 95% of vVO2max)
            // Let's simplified say Interval Pace = 5k pace - 5-10 sec/km
            const paceSecPerKm = (timeMin * 60) / 5;
            const intervalPace = paceSecPerKm - 5; // A bit faster than 5k pace

            const paceMin = Math.floor(intervalPace / 60);
            const paceSec = Math.round(intervalPace % 60);
            const paceStr = `${paceMin}:${paceSec.toString().padStart(2, '0')}`;

            return [
                "15 min uppvärmning (lågintensivt)",
                "3x fartökningslopp (strides)",
                `${count} x 3 min @ ${paceStr}/km`,
                "Vila: 2 min joggvila mellan intervaller",
                "10 min nedvarvning"
            ];
        },
        tips: "Håll farten jämn på alla intervaller. Det ska kännas hårt men hanterbart."
    },
    {
        id: 'coach_threshold_mix',
        title: 'Threshold & Strength Mix',
        category: 'HYBRID',
        durationMin: 55,
        difficulty: 'Intermediate',
        description: 'Ett kombinationspass som blandar tröskellöpning med styrkemoment för att bygga uthållighet.',
        tags: ['Threshold', 'Strength', 'Hybrid'],
        source: 'COACH_AI',
        inputs: [
            {
                id: 'intensity',
                label: 'Intensitet (RPE 1-10)',
                type: 'slider',
                defaultValue: 7,
                min: 5,
                max: 9,
                step: 1
            }
        ],
        generator: (inputs) => {
            const rpe = Number(inputs['intensity']) || 7;

            return [
                "10 min Warmup",
                "EMOM 10 min: 10 Wall Balls + 5 Burpees",
                "5 min Rest/Transition",
                `20 min Run @ RPE ${rpe} (Tröskelfart)`,
                "5 min Cooldown"
            ];
        },
        tips: "Fokusera på att snabbt hitta löprytmen efter styrkedelen."
    }
];
