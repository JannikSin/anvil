// Warm-ups and mobility, running on the same timed-step engine as the core
// sessions so the screen, the countdown, the beeps and the wake lock are all
// the ones that already work.
//
// TWO RULES FROM THE VAULT RESEARCH, AND THEY DECIDE THE WHOLE SHAPE OF THIS
// FILE (Fitness Vault, Principles/Training Principles.md, the myth-busting
// section):
//
//   1. STATIC STRETCHING BEFORE LIFTING IS THE WRONG TOOL. It can measurably
//      reduce force output in the session that follows. Dynamic movement is
//      the pre-lift warm-up. So WARMUPS below contain no long holds, and the
//      static work lives in MOBILITY, which is explicitly placed AFTER
//      training or on its own.
//
//   2. WARM-UPS GET 3 TO 5 MINUTES, NOT FIFTEEN. Time efficiency is David's
//      stated priority; the guidance is a short general warm-up plus ramp
//      sets on the first heavy compound only. Every routine here is under
//      five minutes and none of them replaces ramp sets, which belong on the
//      bar and are called out in the first cue.
//
// The ankle work is not filler. Tall Lifter Biomechanics names ankle
// dorsiflexion, not femur length, as the fixable bottleneck on his squat
// depth (Berglund 2024, Demers 2018, Brookbush 2026 review), and prescribes
// banded ankle mobilisation and knee-to-wall drills 2-3x/week. At 6'1" that
// is the single highest-leverage mobility item he has, so it opens every
// lower-body warm-up and gets its own mobility block.

/**
 * @typedef {import("./core.js").CoreStep} CoreStep
 * @typedef {import("./core.js").CoreSession} CoreSession
 */

/**
 * Pre-lift warm-ups, one per session type. Dynamic only.
 *
 * `match` is the template-id prefix this warm-up belongs to, so Today can
 * offer the right one without David choosing: a Lower day gets ankles and
 * hips, a Push day gets shoulders, a Pull day gets lats and scapulae.
 * @type {(CoreSession & { match: string[] })[]}
 */
export const WARMUPS = [
  {
    id: "warmup-lower",
    name: "Lower warm-up",
    focus: "ankles, hips, then the bar",
    match: ["lower"],
    note: "Ankle first: dorsiflexion is the bottleneck on your squat depth, not your femurs. This does not replace ramp sets — still work up to your first heavy set on the bar.",
    steps: [
      {
        name: "Knee-to-wall ankle rock",
        seconds: 40,
        rest: 0,
        side: "L",
        cue: "Toes a hand's width from the wall, drive the knee forward OVER the toes, heel glued down. Slow rocks, not a hold.",
      },
      {
        name: "Knee-to-wall ankle rock",
        seconds: 40,
        rest: 10,
        side: "R",
        cue: "Same side-to-side distance as the left. If one side is tighter, that is the one to chase.",
      },
      {
        name: "Leg swings, front to back",
        seconds: 30,
        rest: 0,
        side: "L",
        cue: "Hold something. Relaxed and loose, let the range build over the reps. No forcing the end range.",
      },
      {
        name: "Leg swings, front to back",
        seconds: 30,
        rest: 10,
        side: "R",
        cue: "Same count as the left.",
      },
      {
        name: "Bodyweight squat to depth",
        seconds: 45,
        rest: 10,
        cue: "Slow down, pause a beat at the bottom, stand up. Stance a few cm past shoulder width, which is correct mechanics for your height, not a fault.",
      },
      {
        name: "Half-kneeling hip flexor + reach",
        seconds: 30,
        rest: 0,
        side: "L",
        cue: "Back glute ON, ribs down, then reach the same-side arm overhead and slightly across. You should feel the front of the back hip.",
      },
      {
        name: "Half-kneeling hip flexor + reach",
        seconds: 30,
        rest: 10,
        side: "R",
        cue: "Same.",
      },
      {
        name: "Glute bridge",
        seconds: 30,
        rest: 0,
        cue: "Squeeze at the top for a beat each rep. This wakes the glutes so the low back does not run the squat.",
      },
    ],
  },
  {
    id: "warmup-push",
    name: "Push warm-up",
    focus: "shoulders and the overhead position",
    match: ["push"],
    note: "The shoulder you protect is the one you play tennis on. Do not skip the external rotation just because it looks like nothing.",
    steps: [
      {
        name: "Arm circles",
        seconds: 40,
        rest: 0,
        cue: "Small to large, half the time forward, half back. Get blood in before anything gets loaded.",
      },
      {
        name: "Scapular push-up",
        seconds: 40,
        rest: 10,
        cue: "Arms stay straight. Only the shoulder blades move: spread apart at the top, pinch together at the bottom.",
      },
      {
        name: "Wall slide",
        seconds: 45,
        rest: 10,
        cue: "Back of the hands on the wall, ribs down, slide up as far as they stay in contact. Where they leave the wall is your real overhead range today.",
      },
      {
        name: "Push-up to down dog",
        seconds: 45,
        rest: 10,
        cue: "One push-up, push the hips back and up, heels toward the floor, return. Flowing, no pauses.",
      },
      {
        name: "External rotation, elbow at side",
        seconds: 30,
        rest: 0,
        side: "L",
        cue: "Band or nothing. Elbow pinned to the ribs, rotate the forearm out. Small range, deliberate. This is the prehab, not the workout.",
      },
      {
        name: "External rotation, elbow at side",
        seconds: 30,
        rest: 0,
        side: "R",
        cue: "Same.",
      },
    ],
  },
  {
    id: "warmup-pull",
    name: "Pull warm-up",
    focus: "lats, scapulae, and the hang",
    match: ["pull"],
    note: "The dead hang doubles as your daily shoulder decompression and it feeds the muscle-up work.",
    steps: [
      {
        name: "Dead hang",
        seconds: 30,
        rest: 10,
        cue: "Full hang, shoulders relaxed up by the ears, breathe. Let the spine lengthen.",
      },
      {
        name: "Scapular pull-up",
        seconds: 30,
        rest: 10,
        cue: "Arms stay straight. Pull the shoulders DOWN out of the ears and hold a beat, lower under control. This is the pull-up's first inch.",
      },
      {
        name: "Band pull-apart",
        seconds: 40,
        rest: 10,
        cue: "Straight arms, pull to the chest, squeeze the blades, slow on the way back. Band or a towel with tension.",
      },
      {
        name: "Cat-cow into thoracic rotation",
        seconds: 45,
        rest: 10,
        cue: "Five slow cat-cows, then hand behind the head and rotate the elbow to the ceiling, alternating. Breathe out at the end of each rotation.",
      },
      {
        name: "Prone Y-T raise",
        seconds: 40,
        rest: 0,
        cue: "Face down, thumbs up, lift into a Y then a T. Tiny range, no momentum. Rear delts and lower traps.",
      },
    ],
  },
  {
    id: "warmup-general",
    name: "General warm-up",
    focus: "anything, anywhere, no kit",
    match: [],
    note: "The one to run when the day's session is not a clean lower, push or pull, or when you are training somewhere unfamiliar.",
    steps: [
      {
        name: "Easy movement",
        seconds: 60,
        rest: 0,
        cue: "March, skip, jog on the spot, bike, whatever is there. Warm and slightly out of breath, not tired.",
      },
      {
        name: "Arm circles",
        seconds: 30,
        rest: 0,
        cue: "Small to large, both directions.",
      },
      {
        name: "Leg swings",
        seconds: 30,
        rest: 0,
        side: "L",
        cue: "Front to back, relaxed, building range.",
      },
      {
        name: "Leg swings",
        seconds: 30,
        rest: 10,
        side: "R",
        cue: "Same count.",
      },
      {
        name: "World's greatest stretch",
        seconds: 40,
        rest: 0,
        side: "L",
        cue: "Lunge, opposite elbow inside the front foot, then rotate that arm to the ceiling and follow it with your eyes.",
      },
      {
        name: "World's greatest stretch",
        seconds: 40,
        rest: 10,
        side: "R",
        cue: "Same.",
      },
      {
        name: "Bodyweight squat",
        seconds: 40,
        rest: 0,
        cue: "Slow, to full depth, pause at the bottom.",
      },
    ],
  },
];

/**
 * Mobility and stretching. Static holds, deliberately placed AFTER training or
 * on a rest day, never before a heavy session (see the header).
 * @type {CoreSession[]}
 */
export const MOBILITY_SESSIONS = [
  {
    id: "mobility-ankles",
    name: "Ankles + squat depth",
    focus: "the highest-leverage 5 minutes you have",
    note: "2-3x/week is the prescription, and it is aimed at one thing: getting depth back without your pelvis tucking under. Best done AFTER training or on a rest day, never as a pre-lift warm-up.",
    steps: [
      {
        name: "Knee-to-wall dorsiflexion hold",
        seconds: 45,
        rest: 0,
        side: "L",
        cue: "Knee driven past the toes, heel down, and HOLD at the end range. Breathe out and sink a little further each breath.",
      },
      {
        name: "Knee-to-wall dorsiflexion hold",
        seconds: 45,
        rest: 10,
        side: "R",
        cue: "Same. Note which ankle stops first; that is the one deciding your squat.",
      },
      {
        name: "Calf stretch, knee straight",
        seconds: 40,
        rest: 0,
        side: "L",
        cue: "Back leg straight, heel down. This is gastrocnemius.",
      },
      {
        name: "Calf stretch, knee straight",
        seconds: 40,
        rest: 10,
        side: "R",
        cue: "Same.",
      },
      {
        name: "Soleus stretch, knee bent",
        seconds: 40,
        rest: 0,
        side: "L",
        cue: "Same position, now BEND the back knee and keep the heel down. Different muscle, and it is the one that limits depth.",
      },
      {
        name: "Soleus stretch, knee bent",
        seconds: 40,
        rest: 10,
        side: "R",
        cue: "Same.",
      },
      {
        name: "Deep squat hold",
        seconds: 60,
        rest: 0,
        cue: "Sit in the bottom, elbows inside the knees, prise them apart, chest tall. Rock gently. This is where the ankle work cashes out.",
      },
    ],
  },
  {
    id: "mobility-hips",
    name: "Hips + hamstrings",
    focus: "after lower days, or any evening",
    note: "Hip flexors shorten under a squat and hinge program and from sitting through lectures. Static holds are correct here because nothing heavy follows.",
    steps: [
      {
        name: "Couch stretch",
        seconds: 45,
        rest: 0,
        side: "L",
        cue: "Back foot up on a couch or wall, back glute squeezed ON, ribs down. If the low back arches, drop the knee further from the wall.",
      },
      {
        name: "Couch stretch",
        seconds: 45,
        rest: 10,
        side: "R",
        cue: "Same.",
      },
      {
        name: "Pigeon",
        seconds: 45,
        rest: 0,
        side: "L",
        cue: "Front shin across, hips square, fold forward only as far as the hip lets you. Glute, not knee. Back off if the knee talks.",
      },
      {
        name: "Pigeon",
        seconds: 45,
        rest: 10,
        side: "R",
        cue: "Same.",
      },
      {
        name: "Supine hamstring hold",
        seconds: 45,
        rest: 0,
        side: "L",
        cue: "On your back, leg up, knee softly bent, other leg flat. Pull to a stretch you could hold a conversation through.",
      },
      {
        name: "Supine hamstring hold",
        seconds: 45,
        rest: 10,
        side: "R",
        cue: "Same.",
      },
      {
        name: "Figure-four glute stretch",
        seconds: 40,
        rest: 0,
        side: "L",
        cue: "Ankle across the opposite knee, pull the far thigh toward you. Breathe out into it.",
      },
      {
        name: "Figure-four glute stretch",
        seconds: 40,
        rest: 0,
        side: "R",
        cue: "Same.",
      },
    ],
  },
  {
    id: "mobility-shoulders",
    name: "Shoulders + thoracic",
    focus: "after push and pull days",
    note: "Aimed straight at the tennis shoulder and at the overhead position. Nothing here is forced: if a position pinches at the front of the shoulder, come out of it.",
    steps: [
      {
        name: "Doorway pec stretch",
        seconds: 45,
        rest: 0,
        side: "L",
        cue: "Forearm on the frame, elbow at shoulder height, step through and rotate away. Chest, never the front of the shoulder joint.",
      },
      {
        name: "Doorway pec stretch",
        seconds: 45,
        rest: 10,
        side: "R",
        cue: "Same.",
      },
      {
        name: "Thoracic extension over an edge",
        seconds: 45,
        rest: 10,
        cue: "Upper back on a couch edge or foam roller, hands behind the head, breathe out and let the mid back extend. Ribs stay down.",
      },
      {
        name: "Lat stretch on a bench",
        seconds: 45,
        rest: 10,
        cue: "Elbows on a surface, hips back, chest sinks toward the floor. Breathe into the armpits.",
      },
      {
        name: "Sleeper stretch",
        seconds: 40,
        rest: 0,
        side: "L",
        cue: "On your side, shoulder under you at 90 degrees, gently press the forearm toward the floor. STOP at a stretch, never at a pinch. This is the internal rotation an overhead athlete loses.",
      },
      {
        name: "Sleeper stretch",
        seconds: 40,
        rest: 10,
        side: "R",
        cue: "Same. The serving side is usually the tighter one.",
      },
      {
        name: "Cross-body posterior shoulder",
        seconds: 35,
        rest: 0,
        side: "L",
        cue: "Arm across the chest, pull from above the elbow, shoulder DOWN not shrugged.",
      },
      {
        name: "Cross-body posterior shoulder",
        seconds: 35,
        rest: 10,
        side: "R",
        cue: "Same.",
      },
      {
        name: "Child's pose with side reach",
        seconds: 50,
        rest: 0,
        cue: "Sit back on the heels, walk the hands left and hold, then right and hold. Lats and the side of the ribcage.",
      },
    ],
  },
];

/**
 * Shoulder prehab. Strengthening, not stretching, and deliberately its own
 * routine rather than a circuit tacked onto a pressing day.
 *
 * It came OFF Push B on 2026-08-19. His own Tennis Conditioning note says to do
 * this work after tennis or on a non-lifting day and NOT stacked onto a heavy
 * bench and overhead session, and the programme was doing exactly that. The old
 * entry also had no prescription at all: its whole dose was the string
 * "ext rotations + face pulls + band pull-aparts". These are Ellenbecker's
 * actual numbers, light band, 3 sets of 15 to 20 per arm.
 *
 * The evidence that matters here is unglamorous: 22 RCTs and 1,281 people say
 * PROGRESSIVE loading works for shoulder pain, and that non-progressive,
 * non-resisted movement confers no benefit. So the band gets heavier over time
 * or this is decoration.
 * @type {CoreSession[]}
 */
export const PREHAB_SESSIONS = [
  {
    id: "prehab-shoulder",
    name: "Shoulder prehab",
    focus: "the tennis shoulder, on a day you did not press",
    note: "After tennis, or on a rest day. NOT on Push A or Push B. Light band, slow, and step the band up when 20 reps stops being work.",
    steps: [
      {
        name: "Band external rotation, elbow at side",
        seconds: 45,
        rest: 0,
        side: "L",
        cue: "Elbow pinned to the ribs, forearm rotates out. Small range, deliberate. 15 to 20 reps in the time.",
      },
      {
        name: "Band external rotation, elbow at side",
        seconds: 45,
        rest: 10,
        side: "R",
        cue: "Same. This is the conservative entry point and it stays in the programme.",
      },
      {
        name: "Standing 90/90 external rotation",
        seconds: 45,
        rest: 0,
        side: "L",
        cue: "Elbow up at shoulder height, rotate the forearm up and back. Better activation of the cuff and lower trap without the upper trap stealing it. STOP if it pinches at the front.",
      },
      {
        name: "Standing 90/90 external rotation",
        seconds: 45,
        rest: 10,
        side: "R",
        cue: "Same. Added on top of the elbow-at-side version, never as a replacement for it.",
      },
      {
        name: "Band pull-apart",
        seconds: 45,
        rest: 10,
        cue: "Straight arms, pull to the chest, squeeze the blades, slow on the way back.",
      },
      {
        name: "Face pull, high to eyes",
        seconds: 45,
        rest: 10,
        cue: "Pull to eye level, elbows high, finish with the hands wide and the thumbs back.",
      },
      {
        name: "Prone Y-T-W",
        seconds: 60,
        rest: 0,
        cue: "Face down, thumbs up. Twenty seconds in each shape. Tiny range, zero momentum. Lower traps and rear delts.",
      },
    ],
  },
];

/**
 * The warm-up that fits a given session, chosen from its template id.
 * Falls back to the general one, which is also what a rest day gets.
 * @param {string | null | undefined} templateId
 * @returns {CoreSession & { match: string[] }}
 */
export function warmupFor(templateId) {
  const id = String(templateId ?? "").toLowerCase();
  const hit = WARMUPS.find((w) => w.match.some((m) => id.startsWith(m)));
  return hit ?? /** @type {any} */ (WARMUPS.find((w) => w.id === "warmup-general"));
}
