// The blank profile: the template every phone starts from. Nothing measured about a person lives in
// this public repo (Core Purpose: "the public repo contains nothing measured about a person").
// The real profile is profile.json in the private data repo; sync.js pulls it with the token and
// core.profile() lays it over this template, then lays the local training edits over that.
// While this template is in use (template: true) the Day tab says so instead of pretending.
// Anvil writes only the training section (decision 0002); base is read, never written here.

(function (root) {
  var PROFILE = {
    template: true,
    base: {
      goal: null,                  // { what, target, unit, date } comes from the private profile
      units: "lb"
    },
    training: {
      programme: "block-1",
      sessionMinutes: 60,
      sessionsIntent: 6,
      // weekday 0 = Sunday. Neutral times; the person's own come with the private profile.
      days: {
        weekday: { wake: "07:00", supps: "07:15", out: "", gym: "08:00" },
        weekend: { wake: "08:00", supps: "08:15", out: "", gym: "09:00" }
      },
      gymLabel: "Gym",
      noon: "12:00",
      evening: {
        rulesOn: [],                 // no clock rules until the profile names the nights
        kitchen: "21:00", magnesium: "21:30", firstLine: "21:30", read: "22:00", lightsOut: "23:00"
      },
      water: { what: "through the day", by: "20:00", remind: "16:00" },
      pushups: null,
      supplements: [],
      reward: "",
      readWhat: "",
      reminders: { on: false, repeatMinutes: 15 },
      restTimer: false,            // the Rest button on each lift; off unless turned on in Settings
      core: { remind: "21:30" },
      startLoads: {},
      strengthGoals: []
    }
  };
  if (typeof module !== "undefined" && module.exports) module.exports = PROFILE; else root.ANVIL_PROFILE = PROFILE;
})(this);
