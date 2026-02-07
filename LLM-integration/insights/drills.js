const DRILLS = {
  pass: {
    name: "Quick Scan + Pass",
    steps: [
      "Coach calls a color; player scans before receive.",
      "One-touch pass to target; reset and repeat.",
      "Add a defender after 5 reps."
    ],
    duration_min: 10
  },
  dribble: {
    name: "Exit Pressure Dribble",
    steps: [
      "Start with back to pressure.",
      "Open hips, take first touch away from defender.",
      "Accelerate 5m into space."
    ],
    duration_min: 10
  },
  turnover: {
    name: "Two-Touch Under Press",
    steps: [
      "Receive with defender closing fast.",
      "First touch away, second touch to release pass.",
      "Progress to limited time windows."
    ],
    duration_min: 12
  },
  press: {
    name: "Press + Cover Shadow",
    steps: [
      "First player presses; second cuts passing lane.",
      "Trigger on backward pass.",
      "Reset when ball escapes."
    ],
    duration_min: 12
  },
  shot: {
    name: "Shot Selection",
    steps: [
      "Two options: shoot or slip pass.",
      "Coach signals late; player decides quickly.",
      "Track outcomes and discuss."
    ],
    duration_min: 10
  },
  tackle: {
    name: "Timing the Tackle",
    steps: [
      "Defender delays then steps in on heavy touch.",
      "Keep low stance, body between ball and goal.",
      "Rotate roles every 5 reps."
    ],
    duration_min: 10
  },
  none: {
    name: "Scanning Habit",
    steps: [
      "Every 3 seconds, quick shoulder check.",
      "Receive and play to neutral target.",
      "Increase speed each round."
    ],
    duration_min: 8
  }
};

function getDrill(eventType) {
  return DRILLS[eventType] || DRILLS.none;
}

module.exports = { getDrill };

