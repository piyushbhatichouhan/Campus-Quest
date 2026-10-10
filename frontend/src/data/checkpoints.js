const checkpoints = [
  {
    id: "library",
    order: 1,

    name: "Central Library",

    latitude: 22.677795,
    longitude: 75.878891,

    radius: 30,

    points: 100,

    discoveryText:
      "You have discovered the first checkpoint of the DAVV Quest.",

    challenge: {
      type: "riddle",

      question:
        "I hold thousands of voices, yet I remain silent. Students visit me to seek answers. What am I?",

      answer: "library",
    },

    nextClue:
      "Where hundreds gather, voices echo, and the campus comes together...",
  },

  {
    id: "auditorium",
    order: 2,

    name: "Auditorium",

    latitude: 22.6805,
    longitude: 75.8795,

    radius: 30,

    points: 150,

    discoveryText: "You have found a place where the campus comes together.",

    challenge: {
      type: "multiple-choice",

      question:
        "Which of these places is most associated with campus gatherings and performances?",

      options: [
        "Central Library",
        "Auditorium",
        "Sports Complex",
        "Engineering Block",
      ],

      answer: "Auditorium",
    },

    nextClue:
      "Where champions train, compete, and push themselves beyond their limits...",
  },

  {
    id: "sports",
    order: 3,

    name: "Sports Complex",

    latitude: 22.683,
    longitude: 75.8815,

    radius: 30,

    points: 200,

    discoveryText: "You have entered the grounds where campus champions train.",

    challenge: {
      type: "riddle",

      question:
        "I am a place where strength, speed, and teamwork come together. What am I?",

      answer: "sports",
    },

    nextClue:
      "Where circuits, machines, and engineering ideas come together...",
  },

  {
    id: "engineering",
    order: 4,

    name: "Engineering Block",

    latitude: 22.6812,
    longitude: 75.881,

    radius: 30,

    points: 200,

    discoveryText:
      "You have reached a place where ideas become engineering projects.",

    challenge: {
      type: "multiple-choice",

      question: "What is 1010 in binary converted to decimal?",

      options: ["8", "10", "12", "14"],

      answer: "10",
    },

    nextClue: "Return to the place where your adventure began...",
  },

  {
    id: "final-library",
    order: 5,

    name: "Central Library — Final",

    latitude: 22.6819,
    longitude: 75.8796,

    radius: 30,

    points: 300,

    discoveryText:
      "You have returned to where your adventure began. This is the final checkpoint.",

    challenge: {
      type: "riddle",

      question:
        "You followed the clues, crossed the campus, and reached the end. What have you completed?",

      answer: "quest",
    },

    nextClue: null,
  },
];

export default checkpoints;
