// Block 1, transcribed from the Training Recipe (Crystal Life/Training-Recipe, sections 3 and 4).
// Programme data, not design: a second profile ships a different file and the code does not change.
//
// Per lift:
//   sets, lo, hi   rep range for double progression (per side when side: true)
//   kind           heavy | machine | iso | core  -> sets the effort rule and the rest floor
//   block, pair    the block letter; lifts in a superset block share a pair letter (rest after the pair)
//   effortText     the effort rule as the recipe words it for this lift
//   main           the one lift per day that is never cut (decision 0009)
//   cut            "first cut if the day runs long" (decision 0009)
//   inc            load jump when the top of the range is reached (recipe: +5 upper, +10 squat, RDL, leg press)
//   m              hard sets this lift contributes per set, by major muscle group (for the plan check, P12)
//   source         where the lift, the cue and the numbers come from (P13). status: "study" when a
//                  checked study backs it, "none" when no study tests the exercise (said on screen)

(function (root) {
  var P = {
    id: "block-1",
    name: "Block 1",
    start: "2026-10-11",
    end: "2026-12-05",
    deload: { start: "2026-12-07", end: "2026-12-13" },
    reviews: [
      { date: "2026-10-18", what: "Week 1 review: keep, swap or adjust each lift from your notes" },
      { date: "2026-11-08", what: "Week 4 check: 7-day average weight and the six main lifts vs week 1" },
      { date: "2026-12-06", what: "Week 8 review: the same two numbers decide block 2" },
      { date: "2026-12-07", what: "Deload week: same days, same weights, half the sets, 3 to 4 RIR" }
    ],
    noteWeekEnds: "2026-10-17",
    queue: ["push-a", "pull-a", "legs-a", "push-b", "pull-b", "legs-b"],
    conditioning: { perWeek: 1, day: 6, what: "Tennis, or a 25 to 30 min outdoor run at a conversational pace", source: "Decision 0011" },
    mobility: { days: [1, 3, 5], from: "2026-10-14", minutes: 10 },
    wallSquat: { perWeek: 3, after: ["push", "pull"], dose: "4 x 2 min holds, 2 min rest. Knee angle so the last 30 s of each hold is hard", why: "The blood-pressure lever the council chose over the breath trainer (ruled 7/26). Never after legs." },
    warmup: "The jog in is the general warm-up. Then 2 ramp sets on the first lift, about 50% and 75% of the working weight; 3 for squat.",
    effort: {
      heavy: "1 to 2 RIR every set, never to failure",
      machine: "First sets 1 to 2 RIR, last set to failure",
      iso: "First sets 1 to 2 RIR, last set to failure, then lengthened partials",
      core: "Controlled, last set hard"
    },
    tempo: "Lower in about 2 s, never drop it. Up fast, with intent.",
    // Each day is blocks (David, 10/16): a block is one lift done alone, or two done as a superset
    // at ONE station. Pairings, the pullover swap and the rest-period fillers come from the 10/16
    // panel (Nippard notes, Norton, Phillips; brief fleet/polaris-panel-brief.md). Sets, reps,
    // effort, cues and sources are Block 1 as settled 10/13 (the old app's program.json).
    sessions: {
     "push-a": {
      "name": "Push A",
      "focus": "chest",
      "blocks": [
       {
        "lifts": [
         {
          "id": "push-a-incline-db-press",
          "progressKey": "incline-db-press",
          "name": "Incline DB Press",
          "sets": 3,
          "lo": 6,
          "hi": 10,
          "side": false,
          "kind": "heavy",
          "effortText": "stop 1-2 reps short",
          "rest": 150,
          "inc": 5,
          "m": {
           "chest": 1
          },
          "cue": "Bench at 30 degrees, shoulder blades pinned, lower to chest level for the stretch, press up and slightly in.",
          "source": {
           "who": "Chaves et al. 2020, Int J Exerc Sci: incline pressing grew the upper-chest measuring site more than flat (8 weeks, ultrasound); strength gains were similar.",
           "status": "study"
          },
          "load": "per hand",
          "main": true,
          "block": "A"
         }
        ],
        "superset": false,
        "filler": "Band pull-aparts with the light band, 12 to 15, then sit. Uses none of the pressing muscles.",
        "name": "A"
       },
       {
        "lifts": [
         {
          "id": "push-a-machine-chest-press",
          "progressKey": "machine-chest-press",
          "name": "Machine Chest Press",
          "sets": 3,
          "lo": 8,
          "hi": 12,
          "side": false,
          "kind": "iso",
          "effortText": "last set to failure",
          "rest": 90,
          "inc": 5,
          "m": {
           "chest": 1
          },
          "cue": "Handles at mid-chest, full stretch at the back, shoulders stay back at the top.",
          "source": {
           "who": "Haugen et al. 2023, BMC Sports Sci Med Rehabil (meta-analysis, 13 studies): machines and free weights build muscle equally.",
           "status": "study"
          },
          "block": "B"
         }
        ],
        "superset": false,
        "name": "B"
       },
       {
        "lifts": [
         {
          "id": "push-a-cable-fly-or-pec-deck",
          "progressKey": "cable-fly-or-pec-deck",
          "name": "Cable Fly or Pec Deck",
          "sets": 2,
          "lo": 10,
          "hi": 15,
          "side": false,
          "kind": "iso",
          "effortText": "last set to failure, then half reps at the stretch",
          "rest": 90,
          "inc": 5,
          "m": {
           "chest": 1
          },
          "cue": "Arms softly bent and locked there, open wide until the chest stretches, hug back in.",
          "source": {
           "who": "Pinto et al. 2025, J Strength Cond Res: 12 weeks of pec deck alone grew upper and lower chest thickness about 17 to 21 percent (ultrasound) and raised 1RM about 45 percent; 1 set and 3 sets gave the same result.",
           "status": "study"
          },
          "cut": true,
          "block": "C",
          "pair": "c"
         },
         {
          "id": "push-a-pallof-press",
          "progressKey": "pallof-press",
          "name": "Pallof Press",
          "sets": 2,
          "lo": 10,
          "hi": 10,
          "side": true,
          "kind": "core",
          "effortText": "controlled, 2 s hold",
          "rest": 90,
          "inc": 5,
          "m": {
           "core": 1
          },
          "cue": "Side-on to the cable, handle at the chest, press straight out and hold 2 seconds while it tries to twist you.",
          "source": {
           "who": "No published study tests this exercise (checked 2026-10-13; the only record is a 4-person conference abstract). It stays on the general core evidence until it is kept or replaced.",
           "status": "none"
          },
          "block": "C",
          "pair": "c"
         }
        ],
        "superset": true,
        "where": "one cable tower",
        "note": "On the pec deck instead, do the Pallof alone after.",
        "name": "C"
       },
       {
        "lifts": [
         {
          "id": "push-a-lateral-raise",
          "progressKey": "lateral-raise",
          "name": "Lateral Raise",
          "sets": 5,
          "lo": 12,
          "hi": 20,
          "side": false,
          "kind": "iso",
          "effortText": "last set to failure, then half reps at the stretch",
          "rest": 75,
          "inc": 5,
          "m": {
           "shoulders": 1
          },
          "cue": "Stand tall or lean 10-15 degrees, arms 30 degrees in front, lead with the elbows to shoulder height, no shrug.",
          "source": {
           "who": "Larsen et al. 2025, Front Physiol: dumbbell and cable lateral raises grew the side delts equally in trained lifters (8 weeks, ultrasound).",
           "status": "study"
          },
          "load": "per hand",
          "block": "D",
          "pair": "d"
         },
         {
          "id": "push-a-overhead-triceps-extension",
          "progressKey": "overhead-triceps-extension",
          "name": "Overhead Triceps Extension",
          "sets": 4,
          "lo": 10,
          "hi": 15,
          "side": false,
          "kind": "iso",
          "effortText": "last set to failure",
          "rest": 75,
          "inc": 5,
          "m": {
           "arms": 1
          },
          "cue": "Elbows up and in, lower deep behind the head for the stretch, extend fully.",
          "source": {
           "who": "Maeo et al. 2022, Eur J Sport Sci: overhead elbow extension grew the triceps about 1.4 times more than the neutral-arm version (12 weeks, MRI).",
           "status": "study"
          },
          "block": "D",
          "pair": "d"
         }
        ],
        "superset": true,
        "where": "one cable tower, or dumbbells at the rack",
        "name": "D"
       }
      ]
     },
     "pull-a": {
      "name": "Pull A",
      "focus": "back thickness",
      "blocks": [
       {
        "lifts": [
         {
          "id": "pull-a-cable-row",
          "progressKey": "cable-row",
          "name": "Cable Row",
          "sets": 3,
          "lo": 6,
          "hi": 10,
          "side": false,
          "kind": "heavy",
          "effortText": "stop 1-2 reps short",
          "rest": 150,
          "inc": 5,
          "m": {
           "back": 1,
           "arms": 0.25
          },
          "cue": "Chest up, let the weight pull the shoulders forward for the stretch, row to the lower ribs, torso still.",
          "source": {
           "who": "Fenwick, Brown and McGill 2009, J Strength Cond Res: cable rowing works the back and challenges the trunk to resist twisting.",
           "status": "study"
          },
          "main": true,
          "block": "A"
         }
        ],
        "superset": false,
        "name": "A"
       },
       {
        "lifts": [
         {
          "id": "pull-a-lat-pulldown",
          "progressKey": "lat-pulldown",
          "name": "Lat Pulldown",
          "sets": 3,
          "lo": 6,
          "hi": 8,
          "side": false,
          "kind": "heavy",
          "effortText": "stop 1-2 reps short",
          "rest": 150,
          "inc": 5,
          "m": {
           "back": 1,
           "arms": 0.25
          },
          "cue": "Lean back slightly, elbows down to the back pockets, let the bar all the way up for the stretch. Same grip every week.",
          "source": {
           "who": "Wolf et al. 2025, PeerJ: 8 weeks of lat pulldowns in trained lifters raised pulldown 10RM and arm thickness (ultrasound) the same whether reps were full range or lengthened partials. Andersen et al. 2014, J Strength Cond Res: lat activation is the same at narrow, medium and wide grip. No study measures growth from pull-ups themselves.",
           "status": "study"
          },
          "block": "B"
         }
        ],
        "superset": false,
        "filler": "A 30 s lat stretch after each set (hang from the bar or the pulldown thigh pad), then sit.",
        "name": "B"
       },
       {
        "lifts": [
         {
          "id": "pull-a-chest-supported-high-row",
          "progressKey": "chest-supported-high-row",
          "name": "Chest-Supported High Row",
          "sets": 2,
          "lo": 8,
          "hi": 12,
          "side": false,
          "kind": "iso",
          "effortText": "last set to failure",
          "rest": 90,
          "inc": 5,
          "m": {
           "back": 1
          },
          "cue": "Hammer Strength Iso-Lateral High Row: chest on the pad, let the shoulders rise for the stretch, pull down and back.",
          "source": {
           "who": "Fischer et al. 2025, J Electromyogr Kinesiol: in a prone (chest-down) barbell row at 10RM, lat activation was highest in the top half of the pull; rear delt and biceps did not change with range. The closest study to a supported row; none tests the Hammer Strength high row itself.",
           "status": "study"
          },
          "block": "C"
         }
        ],
        "superset": false,
        "name": "C"
       },
       {
        "lifts": [
         {
          "id": "pull-a-face-pull",
          "progressKey": "face-pull",
          "name": "Face Pull",
          "sets": 2,
          "lo": 12,
          "hi": 20,
          "side": false,
          "kind": "iso",
          "effortText": "last set to failure",
          "rest": 60,
          "inc": 5,
          "m": {
           "shoulders": 1
          },
          "cue": "Rope at forehead height, pull to the eyes, hands finish beside the ears, thumbs back.",
          "source": {
           "who": "No published study tests this exercise (checked 2026-10-13). It stays on the general rear-delt and rotator-cuff evidence until it is kept or replaced.",
           "status": "none"
          },
          "block": "D",
          "pair": "d"
         },
         {
          "id": "pull-a-cable-external-rotation",
          "progressKey": "cable-external-rotation",
          "name": "Cable External Rotation",
          "sets": 2,
          "lo": 12,
          "hi": 15,
          "side": true,
          "kind": "iso",
          "effortText": "smooth, no swinging",
          "rest": 60,
          "inc": 5,
          "m": {
           "shoulders": 0.5
          },
          "cue": "Elbow pinned to the side (towel under the arm), rotate the forearm outward, slow back.",
          "source": {
           "who": "Reinold et al. 2004, J Orthop Sports Phys Ther: measured rotator cuff activity across common external rotation exercises.",
           "status": "study"
          },
          "block": "D",
          "pair": "d"
         }
        ],
        "superset": true,
        "where": "one cable tower",
        "name": "D"
       },
       {
        "lifts": [
         {
          "id": "pull-a-hammer-curl",
          "progressKey": "hammer-curl",
          "name": "Hammer Curl",
          "sets": 3,
          "lo": 10,
          "hi": 15,
          "side": false,
          "kind": "iso",
          "effortText": "last set to failure",
          "rest": 75,
          "inc": 5,
          "m": {
           "arms": 1
          },
          "cue": "Neutral grip, elbows still, all the way down each rep.",
          "source": {
           "who": "Coratella et al. 2023, Sports (Basel): in bodybuilders at 8RM, the palms-up curl gave 12 percent more biceps and 6 percent more brachioradialis activation than the hammer grip on the way up; the hammer grip did not win on brachioradialis.",
           "status": "study"
          },
          "load": "per hand",
          "cut": true,
          "block": "E",
          "pair": "e"
         },
         {
          "id": "pull-a-hanging-leg-raise",
          "progressKey": "hanging-leg-raise",
          "name": "Hanging Leg Raise",
          "sets": 3,
          "lo": 8,
          "hi": 12,
          "side": false,
          "kind": "core",
          "effortText": "last set to failure",
          "rest": 75,
          "inc": 0,
          "m": {
           "core": 1
          },
          "cue": "Curl the pelvis up, knees toward the chest, tailbone tucks. No swinging.",
          "source": {
           "who": "Escamilla et al. 2006, Phys Ther: the hanging knee-up with straps was among the highest of 12 exercises for upper and lower rectus abdominis and the obliques, and the highest for the external oblique together with the Power Wheel (21 adults, surface EMG).",
           "status": "study"
          },
          "load": "bodyweight",
          "block": "E",
          "pair": "e"
         }
        ],
        "superset": true,
        "where": "carry the dumbbells to the pull-up bar",
        "name": "E"
       }
      ]
     },
     "legs-a": {
      "name": "Legs A",
      "focus": "squat and quads",
      "blocks": [
       {
        "lifts": [
         {
          "id": "legs-a-back-squat",
          "progressKey": "back-squat",
          "name": "Back Squat",
          "sets": 3,
          "lo": 5,
          "hi": 8,
          "side": false,
          "kind": "heavy",
          "effortText": "stop 2 reps short, never to failure",
          "rest": 180,
          "inc": 10,
          "m": {
           "quads": 1
          },
          "cue": "High bar, brace first, sit down between the heels as deep as you stay tight, drive up fast.",
          "source": {
           "who": "Kubo et al. 2019, Eur J Appl Physiol: full-depth squats grew the glutes and adductors more than half squats; quads grew equally (10 weeks, MRI).",
           "status": "study"
          },
          "main": true,
          "block": "A"
         }
        ],
        "superset": false,
        "filler": "Ankle rocks at the rack: knee to the post, heel down, 10 each side. Nothing that tires the brace: no planks.",
        "name": "A"
       },
       {
        "lifts": [
         {
          "id": "legs-a-bulgarian-split-squat",
          "progressKey": "bulgarian-split-squat",
          "name": "Bulgarian Split Squat",
          "sets": 3,
          "lo": 8,
          "hi": 10,
          "side": true,
          "kind": "iso",
          "effortText": "stop 1-2 reps short",
          "rest": 90,
          "inc": 5,
          "m": {
           "quads": 1,
           "hamstrings": 0.5
          },
          "cue": "Back foot on the bench, front knee roughly over the toes, drop straight down.",
          "source": {
           "who": "Speirs et al. 2016, J Strength Cond Res: rear-foot-elevated split squats raised back squat strength as much as back squats did (5 weeks).",
           "status": "study"
          },
          "load": "per hand",
          "block": "B"
         }
        ],
        "superset": false,
        "name": "B"
       },
       {
        "lifts": [
         {
          "id": "legs-a-single-leg-extension",
          "progressKey": "single-leg-extension",
          "name": "Single-Leg Extension",
          "sets": 2,
          "lo": 12,
          "hi": 15,
          "side": true,
          "kind": "iso",
          "effortText": "last set to failure, then half reps at the stretch",
          "rest": 75,
          "inc": 5,
          "m": {
           "quads": 1
          },
          "cue": "Knee lined up with the pivot, pause 1 second at the top, control down. One leg at a time.",
          "source": {
           "who": "Pedrosa et al. 2022, Eur J Sport Sci: of four leg-extension ranges, training only the stretched (knee-bent) half grew the rectus femoris and vastus lateralis cross-section the most (45 untrained women).",
           "status": "study"
          },
          "block": "C",
          "pair": "c"
         },
         {
          "id": "legs-a-seated-leg-curl",
          "progressKey": "seated-leg-curl",
          "name": "Seated Leg Curl",
          "sets": 3,
          "lo": 10,
          "hi": 15,
          "side": false,
          "kind": "iso",
          "effortText": "last set to failure",
          "rest": 75,
          "inc": 5,
          "m": {
           "hamstrings": 1
          },
          "cue": "Lean the torso forward: more hamstring stretch, more growth.",
          "source": {
           "who": "Maeo et al. 2021, Med Sci Sports Exerc: seated leg curl grew the hamstrings more than lying (about 14% vs 9%, 12 weeks, MRI).",
           "status": "study"
          },
          "block": "C",
          "pair": "c"
         }
        ],
        "superset": true,
        "where": "the two leg machines, side by side at the CoRec",
        "name": "C"
       },
       {
        "lifts": [
         {
          "id": "legs-a-cable-woodchop",
          "progressKey": "cable-woodchop",
          "name": "Cable Woodchop",
          "sets": 2,
          "lo": 10,
          "hi": 10,
          "side": true,
          "kind": "core",
          "effortText": "controlled",
          "rest": 60,
          "inc": 5,
          "m": {
           "core": 1
          },
          "cue": "High to low across the body, turn through hips and upper back together, arms long.",
          "source": {
           "who": "No published study tests this exercise (checked 2026-10-13; one 2023 paper used it only as a strength test). It stays on the general core evidence until it is kept or replaced.",
           "status": "none"
          },
          "block": "D"
         }
        ],
        "superset": false,
        "name": "D"
       },
       {
        "lifts": [
         {
          "id": "legs-a-standing-calf-raise",
          "progressKey": "standing-calf-raise",
          "name": "Standing Calf Raise",
          "sets": 3,
          "lo": 10,
          "hi": 15,
          "side": false,
          "kind": "iso",
          "effortText": "last set to failure",
          "rest": 60,
          "inc": 5,
          "m": {},
          "cue": "Optional. Pause 2 seconds at the bottom stretch.",
          "source": {
           "who": "Kinoshita, Maeo et al. 2023, Front Physiol: standing calf raises grew the gastrocnemius far more than seated (12 weeks, MRI).",
           "status": "study"
          },
          "cut": true,
          "block": "E"
         }
        ],
        "superset": false,
        "name": "E"
       }
      ]
     },
     "push-b": {
      "name": "Push B",
      "focus": "shoulders",
      "blocks": [
       {
        "lifts": [
         {
          "id": "push-b-overhead-press",
          "progressKey": "overhead-press",
          "name": "Overhead Press",
          "sets": 3,
          "lo": 6,
          "hi": 10,
          "side": false,
          "kind": "heavy",
          "effortText": "stop 1-2 reps short",
          "rest": 150,
          "inc": 5,
          "m": {
           "shoulders": 1,
           "arms": 0.25
          },
          "cue": "Seated DB: bench upright or one notch back, start at ear height, press up and slightly in, no big arch.",
          "source": {
           "who": "Saeterbakken and Fimland 2013, J Strength Cond Res: standing and dumbbell overhead presses drew the most deltoid activity.",
           "status": "study"
          },
          "load": "per hand",
          "main": true,
          "block": "A"
         }
        ],
        "superset": false,
        "filler": "Nothing. This rest is what lets the next set happen.",
        "name": "A"
       },
       {
        "lifts": [
         {
          "id": "push-b-flat-bench-press",
          "progressKey": "flat-bench-press",
          "name": "Flat Bench Press",
          "sets": 3,
          "lo": 6,
          "hi": 10,
          "side": false,
          "kind": "heavy",
          "effortText": "stop 1-2 reps short",
          "rest": 150,
          "inc": 5,
          "m": {
           "chest": 1,
           "arms": 0.25
          },
          "cue": "Shoulder blades pinned, touch the lower chest, press back toward the face. Bar or DBs.",
          "source": {
           "who": "Chaves et al. 2020, Int J Exerc Sci: 8 weeks of flat, incline or both grew the chest (ultrasound) and strength equally; the only regional difference was incline beating flat at the upper-chest site by 0.62 cm. Ogasawara et al. 2013, Eur J Appl Physiol: 24 weeks of bench press 3x10 grew the pec major and triceps on MRI.",
           "status": "study"
          },
          "block": "B"
         }
        ],
        "superset": false,
        "filler": "Band pull-aparts with the light band, 12 to 15, then sit. Uses none of the pressing muscles.",
        "name": "B"
       },
       {
        "lifts": [
         {
          "id": "push-b-lateral-raise",
          "progressKey": "lateral-raise",
          "name": "Lateral Raise",
          "sets": 5,
          "lo": 12,
          "hi": 20,
          "side": false,
          "kind": "iso",
          "effortText": "last set to failure, then half reps at the stretch",
          "rest": 75,
          "inc": 5,
          "m": {
           "shoulders": 1
          },
          "cue": "Stand tall or lean 10-15 degrees, arms 30 degrees in front, lead with the elbows to shoulder height, no shrug.",
          "source": {
           "who": "Larsen et al. 2025, Front Physiol: dumbbell and cable lateral raises grew the side delts equally in trained lifters (8 weeks, ultrasound).",
           "status": "study"
          },
          "load": "per hand",
          "block": "C",
          "pair": "c"
         },
         {
          "id": "push-b-triceps-pushdown",
          "progressKey": "triceps-pushdown",
          "name": "Triceps Pushdown",
          "sets": 4,
          "lo": 12,
          "hi": 15,
          "side": false,
          "kind": "iso",
          "effortText": "last set to failure",
          "rest": 75,
          "inc": 5,
          "m": {
           "arms": 1
          },
          "cue": "Elbows pinned at the sides, full lockout, hands rise to the chest on the way up.",
          "source": {
           "who": "Maeo et al. 2023, Eur J Sport Sci: 12 weeks of cable elbow extensions, one arm overhead and the other at the side (the pushdown position), grew the triceps on MRI in both arms; the overhead arm grew about 1.4 times more, mostly in the long head.",
           "status": "study"
          },
          "block": "C",
          "pair": "c"
         }
        ],
        "superset": true,
        "where": "one cable tower",
        "name": "C"
       },
       {
        "lifts": [
         {
          "id": "push-b-cable-fly-or-pec-deck",
          "progressKey": "cable-fly-or-pec-deck",
          "name": "Cable Fly or Pec Deck",
          "sets": 3,
          "lo": 12,
          "hi": 15,
          "side": false,
          "kind": "iso",
          "effortText": "last set to failure",
          "rest": 90,
          "inc": 5,
          "m": {
           "chest": 1
          },
          "cue": "Low to high or flat. Lighter second chest hit; stretch wide, hug in.",
          "source": {
           "who": "Pinto et al. 2025, J Strength Cond Res: 12 weeks of pec deck alone grew upper and lower chest thickness about 17 to 21 percent (ultrasound) and raised 1RM about 45 percent; 1 set and 3 sets gave the same result.",
           "status": "study"
          },
          "cut": true,
          "block": "D",
          "pair": "d"
         },
         {
          "id": "push-b-cable-crunch",
          "progressKey": "cable-crunch",
          "name": "Cable Crunch",
          "sets": 2,
          "lo": 10,
          "hi": 12,
          "side": false,
          "kind": "core",
          "effortText": "last set to failure",
          "rest": 90,
          "inc": 5,
          "m": {
           "core": 1
          },
          "cue": "Kneel, rope beside the head, curl the ribs toward the hips (round the spine), not a hip hinge.",
          "source": {
           "who": "Moraes et al. 2009, Phys Ther Sport: in loaded crunches from 20 to 100 percent of 1RM, abdominal activation rose with load and was highest at the top load (13 people). Measured on a weighted crunch, not the kneeling cable version.",
           "status": "study"
          },
          "block": "D",
          "pair": "d"
         }
        ],
        "superset": true,
        "where": "one cable tower",
        "note": "On the pec deck instead, do the crunch alone after.",
        "name": "D"
       }
      ]
     },
     "pull-b": {
      "name": "Pull B",
      "focus": "lats and biceps",
      "blocks": [
       {
        "lifts": [
         {
          "id": "pull-b-weighted-pull-up",
          "progressKey": "weighted-pull-up",
          "name": "Weighted Pull-up",
          "sets": 3,
          "lo": 5,
          "hi": 8,
          "side": false,
          "kind": "heavy",
          "effortText": "stop 1-2 reps short",
          "rest": 150,
          "inc": 5,
          "m": {
           "back": 1,
           "arms": 0.25
          },
          "cue": "Full dead hang, chest to the bar. Bodyweight logs as 0 lb added.",
          "source": {
           "who": "Wolf et al. 2025, PeerJ: 8 weeks of lat pulldowns in trained lifters raised pulldown 10RM and arm thickness (ultrasound) the same whether reps were full range or lengthened partials. Andersen et al. 2014, J Strength Cond Res: lat activation is the same at narrow, medium and wide grip. No study measures growth from pull-ups themselves.",
           "status": "study"
          },
          "load": "added",
          "main": true,
          "block": "A"
         }
        ],
        "superset": false,
        "name": "A"
       },
       {
        "lifts": [
         {
          "id": "pull-b-cable-lat-pullover",
          "progressKey": "cable-lat-pullover",
          "name": "Cable Lat Pullover",
          "sets": 3,
          "lo": 10,
          "hi": 15,
          "side": false,
          "kind": "iso",
          "effortText": "last set to failure",
          "rest": 90,
          "inc": 5,
          "m": {
           "back": 1
          },
          "cue": "High cable, rope or straight bar. Hinge slightly forward, arms nearly straight, sweep the hands from overhead down to the thighs. Let the lats stretch fully at the top.",
          "source": {
           "who": "Picked by the 10/16 panel (Nippard notes, Norton) so Pull B's second lat lift is a different angle from the pull-up: planned variation helps regional growth (Kassiano et al. 2022, J Strength Cond Res, review). No trial tests the pullover itself.",
           "status": "study"
          },
          "block": "B"
         }
        ],
        "superset": false,
        "name": "B"
       },
       {
        "lifts": [
         {
          "id": "pull-b-cable-row",
          "progressKey": "cable-row-light",
          "name": "Cable Row",
          "sets": 2,
          "lo": 10,
          "hi": 12,
          "side": false,
          "kind": "iso",
          "effortText": "stop 1 rep short",
          "rest": 90,
          "inc": 5,
          "m": {
           "back": 1,
           "arms": 0.25
          },
          "cue": "Lighter than Pull A. Strict, big stretch forward, pause at the ribs.",
          "source": {
           "who": "Fenwick, Brown and McGill 2009, J Strength Cond Res: cable rowing works the back and challenges the trunk to resist twisting.",
           "status": "study"
          },
          "cut": true,
          "block": "C"
         }
        ],
        "superset": false,
        "note": "Lighter than Pull A. Not paired with the pullover: two lat pulls back to back cost reps.",
        "name": "C"
       },
       {
        "lifts": [
         {
          "id": "pull-b-incline-db-curl",
          "progressKey": "incline-db-curl",
          "name": "Incline DB Curl",
          "sets": 3,
          "lo": 10,
          "hi": 15,
          "side": false,
          "kind": "iso",
          "effortText": "last set to failure, then half reps at the stretch",
          "rest": 75,
          "inc": 5,
          "m": {
           "arms": 1
          },
          "cue": "Bench at 45-60 degrees, arms hang behind the body, curl without the elbows swinging forward.",
          "source": {
           "who": "Kassiano et al. 2025, Int J Sports Med: 8 weeks of incline curls grew the upper (proximal) biceps more and preacher curls the lower (distal) region more (63 untrained women, ultrasound); each group gained the most strength on its own exercise.",
           "status": "study"
          },
          "load": "per hand",
          "block": "D",
          "pair": "d"
         },
         {
          "id": "pull-b-hanging-leg-raise",
          "progressKey": "hanging-leg-raise",
          "name": "Hanging Leg Raise",
          "sets": 3,
          "lo": 8,
          "hi": 12,
          "side": false,
          "kind": "core",
          "effortText": "last set to failure",
          "rest": 75,
          "inc": 0,
          "m": {
           "core": 1
          },
          "cue": "Curl the pelvis up, knees toward the chest, tailbone tucks. No swinging.",
          "source": {
           "who": "Escamilla et al. 2006, Phys Ther: the hanging knee-up with straps was among the highest of 12 exercises for upper and lower rectus abdominis and the obliques, and the highest for the external oblique together with the Power Wheel (21 adults, surface EMG).",
           "status": "study"
          },
          "load": "bodyweight",
          "block": "D",
          "pair": "d"
         }
        ],
        "superset": true,
        "where": "bench by the pull-up bar",
        "note": "Superset only if a bench sits by the bar; otherwise straight.",
        "name": "D"
       },
       {
        "lifts": [
         {
          "id": "pull-b-face-pull",
          "progressKey": "face-pull",
          "name": "Face Pull",
          "sets": 2,
          "lo": 12,
          "hi": 20,
          "side": false,
          "kind": "iso",
          "effortText": "last set to failure",
          "rest": 60,
          "inc": 5,
          "m": {
           "shoulders": 1
          },
          "cue": "Rope at forehead height, pull to the eyes, hands finish beside the ears, thumbs back.",
          "source": {
           "who": "No published study tests this exercise (checked 2026-10-13). It stays on the general rear-delt and rotator-cuff evidence until it is kept or replaced.",
           "status": "none"
          },
          "block": "E",
          "pair": "e"
         },
         {
          "id": "pull-b-cable-external-rotation",
          "progressKey": "cable-external-rotation",
          "name": "Cable External Rotation",
          "sets": 2,
          "lo": 12,
          "hi": 15,
          "side": true,
          "kind": "iso",
          "effortText": "smooth, no swinging",
          "rest": 60,
          "inc": 5,
          "m": {
           "shoulders": 0.5
          },
          "cue": "Elbow pinned to the side (towel under the arm), rotate the forearm outward, slow back.",
          "source": {
           "who": "Reinold et al. 2004, J Orthop Sports Phys Ther: measured rotator cuff activity across common external rotation exercises.",
           "status": "study"
          },
          "block": "E",
          "pair": "e"
         }
        ],
        "superset": true,
        "where": "one cable tower",
        "name": "E"
       }
      ]
     },
     "legs-b": {
      "name": "Legs B",
      "focus": "hinge and hamstrings",
      "blocks": [
       {
        "lifts": [
         {
          "id": "legs-b-back-squat",
          "progressKey": "back-squat-light",
          "name": "Back Squat",
          "sets": 2,
          "lo": 8,
          "hi": 10,
          "side": false,
          "kind": "iso",
          "effortText": "stop 2 reps short, about 10-15% under Legs A",
          "rest": 180,
          "inc": 10,
          "m": {
           "quads": 1
          },
          "cue": "Same lift as Legs A, lighter and more reps.",
          "source": {
           "who": "Kubo et al. 2019, Eur J Appl Physiol: full-depth squats grew the glutes and adductors more than half squats; quads grew equally (10 weeks, MRI).",
           "status": "study"
          },
          "block": "A"
         }
        ],
        "superset": false,
        "filler": "Ankle rocks at the rack: knee to the post, heel down, 10 each side. Nothing that tires the brace: no planks.",
        "name": "A"
       },
       {
        "lifts": [
         {
          "id": "legs-b-romanian-deadlift",
          "progressKey": "romanian-deadlift",
          "name": "Romanian Deadlift",
          "sets": 3,
          "lo": 6,
          "hi": 10,
          "side": false,
          "kind": "heavy",
          "effortText": "stop 2 reps short",
          "rest": 180,
          "inc": 10,
          "m": {
           "hamstrings": 1
          },
          "cue": "Soft knees, hips back, bar slides down the thighs to a hard hamstring stretch, back flat, drive the hips forward.",
          "source": {
           "who": "McAllister et al. 2014, J Strength Cond Res: the Romanian deadlift drew among the highest hamstring activity of four hamstring lifts.",
           "status": "study"
          },
          "main": true,
          "block": "B"
         }
        ],
        "superset": false,
        "filler": "Nothing. This rest is what lets the next set happen.",
        "note": "Same rack as the squat.",
        "name": "B"
       },
       {
        "lifts": [
         {
          "id": "legs-b-seated-leg-curl",
          "progressKey": "seated-leg-curl",
          "name": "Seated Leg Curl",
          "sets": 4,
          "lo": 10,
          "hi": 15,
          "side": false,
          "kind": "iso",
          "effortText": "last set to failure, then half reps at the stretch",
          "rest": 75,
          "inc": 5,
          "m": {
           "hamstrings": 1
          },
          "cue": "Lean the torso forward. Hamstring day: three sets.",
          "source": {
           "who": "Maeo et al. 2021, Med Sci Sports Exerc: seated leg curl grew the hamstrings more than lying (about 14% vs 9%, 12 weeks, MRI).",
           "status": "study"
          },
          "block": "C",
          "pair": "c"
         },
         {
          "id": "legs-b-single-leg-extension",
          "progressKey": "single-leg-extension",
          "name": "Single-Leg Extension",
          "sets": 3,
          "lo": 12,
          "hi": 15,
          "side": true,
          "kind": "iso",
          "effortText": "last set to failure, then half reps at the stretch",
          "rest": 75,
          "inc": 5,
          "m": {
           "quads": 1
          },
          "cue": "Knee lined up with the pivot, pause 1 second at the top, control down. One leg at a time.",
          "source": {
           "who": "Pedrosa et al. 2022, Eur J Sport Sci: of four leg-extension ranges, training only the stretched (knee-bent) half grew the rectus femoris and vastus lateralis cross-section the most (45 untrained women).",
           "status": "study"
          },
          "block": "C",
          "pair": "c"
         }
        ],
        "superset": true,
        "where": "the two leg machines, side by side at the CoRec",
        "name": "C"
       },
       {
        "lifts": [
         {
          "id": "legs-b-leg-press",
          "progressKey": "leg-press",
          "name": "Leg Press",
          "sets": 2,
          "lo": 12,
          "hi": 15,
          "side": false,
          "kind": "iso",
          "effortText": "stop 1 rep short",
          "rest": 90,
          "inc": 10,
          "m": {
           "quads": 0.5,
           "hamstrings": 0.5
          },
          "cue": "Feet high and wide: shifts it to glutes and hamstrings.",
          "source": {
           "who": "Haugen et al. 2023, BMC Sports Sci Med Rehabil (meta-analysis, 13 studies): machines and free weights build muscle equally.",
           "status": "study"
          },
          "cut": true,
          "block": "D",
          "pair": "d"
         },
         {
          "id": "legs-b-calf-press-on-the-leg-press",
          "progressKey": "calf-press-sled",
          "name": "Calf Press on the Leg Press",
          "sets": 3,
          "lo": 10,
          "hi": 15,
          "side": false,
          "kind": "iso",
          "effortText": "last set to failure",
          "rest": 90,
          "inc": 5,
          "m": {},
          "cue": "Balls of the feet on the bottom edge of the platform, knees straight, lower into a deep stretch and pause 2 seconds, then press up tall.",
          "source": {
           "who": "Kinoshita, Maeo et al. 2023, Front Physiol: calf raises with the knee straight grew the gastrocnemius far more than seated (12 weeks, MRI). That study used a standing raise; the sled keeps the knee straight the same way, which is the point.",
           "status": "study"
          },
          "cut": true,
          "block": "D",
          "pair": "d"
         }
        ],
        "superset": true,
        "where": "the leg press",
        "name": "D"
       },
       {
        "lifts": [
         {
          "id": "legs-b-cable-crunch",
          "progressKey": "cable-crunch",
          "name": "Cable Crunch",
          "sets": 2,
          "lo": 10,
          "hi": 12,
          "side": false,
          "kind": "core",
          "effortText": "last set to failure",
          "rest": 60,
          "inc": 5,
          "m": {
           "core": 1
          },
          "cue": "Kneel, rope beside the head, curl the ribs toward the hips (round the spine), not a hip hinge.",
          "source": {
           "who": "Moraes et al. 2009, Phys Ther Sport: in loaded crunches from 20 to 100 percent of 1RM, abdominal activation rose with load and was highest at the top load (13 people). Measured on a weighted crunch, not the kneeling cable version.",
           "status": "study"
          },
          "block": "E"
         }
        ],
        "superset": false,
        "name": "E"
       }
      ]
     }
    },
    // Core Sessions (Crystal Life/Core-Sessions): four floor sessions, no equipment, timed rather than
    // counted so the clock drives itself. A must every day (David, 10/13: "core session should be a must").
    // Rotation is by date; any of the four can be taken instead. rest 0 = straight in.
    core: {
      source: "Core Sessions note: the baseline under the weighted gym work (Nippard read)",
      leadIn: 8,
      sessions: [
        { id: "core-baseline", name: "Baseline", focus: "all four patterns", moves: [
          ["dead-bug", 45, 10], ["front-plank", 45, 10], ["reverse-crunch", 40, 0], ["side-plank-l", 30, 0], ["side-plank-r", 30, 10], ["hollow-hold", 30, 10], ["slow-bicycle", 40, 0] ] },
        { id: "core-lower", name: "Lower + anti-extension", focus: "the part everyone skips", moves: [
          ["dead-bug", 40, 0], ["leg-raise", 45, 10], ["reverse-crunch", 40, 10], ["hollow-hold", 35, 10], ["front-plank", 45, 10], ["flutter-kicks", 30, 0] ] },
        { id: "core-sides", name: "Sides + Copenhagen", focus: "obliques, adductors, tennis insurance", moves: [
          ["side-plank-l", 35, 0], ["side-plank-r", 35, 10], ["copenhagen-l", 25, 0], ["copenhagen-r", 25, 10], ["hip-dips-l", 30, 0], ["hip-dips-r", 30, 10], ["russian-twist", 30, 0] ] },
        { id: "core-flexion", name: "Flexion focus", focus: "the growth pattern", moves: [
          ["crunch", 40, 10], ["reverse-crunch", 40, 10], ["slow-bicycle", 45, 10], ["leg-raise", 40, 10], ["front-plank", 60, 0] ] }
      ],
      moves: {
        "dead-bug": { name: "Dead bug", cue: "Lower back pressed into the floor. Reach the opposite arm and leg out slowly." },
        "front-plank": { name: "Front plank", cue: "Ribs down, glutes squeezed, one straight line from head to heels." },
        "reverse-crunch": { name: "Reverse crunch", cue: "Curl the hips off the floor, lower in 2 s. No swing." },
        "side-plank-l": { name: "Side plank, left", cue: "Hips high, body in one line." },
        "side-plank-r": { name: "Side plank, right", cue: "Hips high, body in one line." },
        "hollow-hold": { name: "Hollow hold", cue: "Lower back stays on the floor. If it arches, bend the knees." },
        "slow-bicycle": { name: "Slow bicycle", cue: "Slow: elbow to the opposite knee, shoulders off the floor." },
        "leg-raise": { name: "Lying leg raise", cue: "Lower back stays down. The moment it arches, the hip flexors took over." },
        "flutter-kicks": { name: "Flutter kicks", cue: "Small kicks, lower back flat." },
        "copenhagen-l": { name: "Copenhagen, knee, left", cue: "Knee on the couch, the short lever. Move to the foot when 25 s feels easy." },
        "copenhagen-r": { name: "Copenhagen, knee, right", cue: "Knee on the couch, the short lever. Move to the foot when 25 s feels easy." },
        "hip-dips-l": { name: "Side plank hip dips, left", cue: "Lower the hip a few inches, drive it back up, slow." },
        "hip-dips-r": { name: "Side plank hip dips, right", cue: "Lower the hip a few inches, drive it back up, slow." },
        "russian-twist": { name: "Slow Russian twist", cue: "Slow, pause each side. If it turns into a swing it does nothing." },
        "crunch": { name: "Crunch, full range", cue: "Lower back rounds off the floor at the top, not a two-inch neck twitch." }
      }
    },
    // The mobility block (Training Recipe section 7) as a timed session in the same player as the
    // Core Sessions (David, 10/16: the old core blocks were the part he liked). Mon, Wed, Fri.
    mobilitySession: { id: "mobility", name: "Mobility", focus: "hips, ankles, upper back, serving shoulder", moves: [
      ["m-9090", 120, 5], ["m-couch-l", 60, 0], ["m-couch-r", 60, 5], ["m-squat", 60, 5], ["m-books-l", 60, 0], ["m-books-r", 60, 5],
      ["m-needle", 60, 5], ["m-cross", 60, 5], ["m-band", 90, 0] ] },
    mobilityMoves: {
      "m-9090": { name: "90/90 hip switches", cue: "Sit tall, both knees at right angles, roll the knees side to side without the hands, 3 s pause at each end." },
      "m-couch-l": { name: "Couch stretch, left leg back", cue: "Rear foot up on the bed or couch, squeeze the glute, ribs down." },
      "m-couch-r": { name: "Couch stretch, right leg back", cue: "Rear foot up, squeeze the glute, ribs down." },
      "m-squat": { name: "Deep squat hold", cue: "Heels down, elbows push the knees out, chest up. Hold the door frame if the heels lift." },
      "m-books-l": { name: "Open books, lying on the left", cue: "Knees stacked at 90, top arm sweeps open until the shoulder blade touches the floor, eyes follow the hand. Slow." },
      "m-books-r": { name: "Open books, lying on the right", cue: "Same, other side." },
      "m-needle": { name: "Thread the needle", cue: "On all fours, one arm threads under the body, then reaches to the ceiling. Swap halfway." },
      "m-cross": { name: "Cross-body stretch, serving arm", cue: "Shoulder blade pinned against a wall, pull the arm across the chest. 30 s, rest, 30 s." },
      "m-band": { name: "Band external rotation, then 90/90", cue: "Light band, elbow at the side for 15, then arm at 90/90 for 10. Back off the 90/90 the night the shoulder complains." }
    },
    mobilityBlock: [
      { move: "90/90 hip switches", dose: "2 min, 10 slow switches each way, 3 s pause", cue: "Sit tall, knees at right angles, roll side to side without the hands.", source: "Moreside and McGill 2012" },
      { move: "Couch stretch", dose: "60 s each side", cue: "Rear foot up, squeeze the glute, ribs down.", source: "Training Recipe s.7" },
      { move: "Deep squat hold", dose: "60 s", cue: "Heels down, elbows push the knees out, chest up. Hold the door frame if the heels lift.", source: "Training Recipe s.7" },
      { move: "Open books", dose: "2 min, 8 slow reps each side", cue: "Side-lying, knees stacked, top arm sweeps open, eyes follow the hand.", source: "Training Recipe s.7" },
      { move: "Thread the needle", dose: "60 s, 5 each side", cue: "On all fours, thread under, then reach to the ceiling.", source: "Training Recipe s.7" },
      { move: "Cross-body stretch, serving arm", dose: "2 x 30 s", cue: "Blade pinned against a wall, pull the arm across.", source: "McClure et al. 2007" },
      { move: "Band external rotation, side then 90/90", dose: "15 reps, then 10, light band", cue: "Back off the 90/90 reps the night the shoulder complains.", source: "Tsuruike and Ellenbecker 2020" }
    ]
  };

  Object.keys(P.sessions).forEach(function (k) {
    var s = P.sessions[k];
    s.lifts = [].concat.apply([], s.blocks.map(function (b) { return b.lifts; }));
  });

  if (typeof module !== "undefined" && module.exports) module.exports = P; else root.ANVIL_PROGRAM = P;
})(this);
