// The first profile. Everything personal arrives here as data (Core Purpose: no person is named in
// the design; a second profile must get a different app out of the same code). Values come from
// Crystal Life/Training-Recipe ("Profile answers, 2026-10-12") and Life/Daily-Routine Tier 1.
// Anvil writes only the training section (decision 0002); base is read, never written here.

(function (root) {
  var PROFILE = {
    base: {
      goal: { what: "Body weight about 200 lb, lean: body fat steady or lower", target: 200, unit: "lb", date: "2026-12-30" },
      units: "lb"
    },
    training: {
      programme: "block-1",
      sessionMinutes: 60,          // stated budget; decision 0011: about 50, shorter is better
      sessionsIntent: 6,          // the week is six sessions (David, 10/13); no set is dropped for a shorter week
      // weekday 0 = Sunday. Times are the profile's, not the code's (decision 0003).
      // David 10/16: breakfast and the morning supplements at home, then out the door to the CoRec,
      // shower there, straight to class. L-theanine and caffeine around noon, "whenever it works".
      days: {
        weekday: { wake: "06:35", supps: "06:40", out: "06:50", gym: "07:00" },
        weekend: { wake: "07:00", supps: "07:10", out: "07:20", gym: "07:30" }
      },
      noon: "12:00",
      evening: {
        rulesOn: [0, 1, 2, 3, 4],    // Sun to Thu have clock rules; Fri and Sat do not
        kitchen: "22:00", magnesium: "22:45", firstLine: "22:45", read: "23:05", lightsOut: "23:30"
      },
      water: { what: "3 to 4 L, front-loaded before 8:00 pm", by: "20:00", remind: "16:00" },
      pushups: 25,
      // ids are Mise's supplementPlan ids, so a tick here and a tick in Mise land on the same field
      supplements: [
        { id: "creatine", name: "Creatine", dose: "5 g", when: "morning" },
        { id: "d3", name: "Vitamin D3", dose: "2,000 IU", when: "morning" },
        { id: "fishOil", name: "Fish oil", dose: "with breakfast", when: "morning" },
        { id: "caffeine", name: "Caffeine", dose: "100 mg, one pill (two if you really need it)", when: "noon" },
        { id: "ltheanine", name: "L-theanine", dose: "200 mg, with the caffeine", when: "noon" },
        { id: "magnesium", name: "Magnesium glycinate", dose: "200 mg, 30 to 60 min before bed", when: "evening" }
      ],
      reward: "Instagram, unlocked, for an hour",
      readWhat: "the book by a lamp, 20 min, paper",
      reminders: { on: true, repeatMinutes: 15 },
      core: { remind: "21:30" },   // the Core Session is a must every day; "built for the morning or just before bed"
      // starting top-set loads the person gave (Training-Recipe strength goals table, "Now").
      // Used only for a lift with no record yet, and labelled as coming from the profile.
      startLoads: { "incline-db-press": 75, "back-squat": 275, "incline-db-curl": 40 },
      strengthGoals: [
        { lift: "Incline DB press", now: "75s", goal: "100s" },
        { lift: "Back squat", now: "275", goal: "315 for reps" },
        { lift: "DB curl", now: "40s", goal: "50s" },
        { lift: "Flat bench", now: "not on file", goal: "225" },
        { lift: "Weighted pull-up", now: "not on file", goal: "+45 lb for 5" },
        { lift: "Overhead press", now: "not on file", goal: "135 for 5" }
      ]
    }
  };
  if (typeof module !== "undefined" && module.exports) module.exports = PROFILE; else root.ANVIL_PROFILE = PROFILE;
})(this);
