module.exports = [
  {
    id: "mechanical_workshop",
    order: 1,
    name: "Mechanical Workshop",
    latitude: 22.681478702822382,
    longitude: 75.86794773833824,
    radius: 30,
    points: 100,

    discoveryText:
      "You've found the Mechanical Workshop, where machines, tools, and engineering ideas come together. Your campus quest begins here.",

    challenge: {
      type: "riddle",
      question:
        "I am where engineering leaves the page and meets real machines. Tools and materials help turn designs into working creations. What am I?",
      answer: "mechanical workshop",
    },

    nextClue:
      "Leave the sound of machines behind. Find a place where thousands of pages hold knowledge, and students search for answers in silence.",

    rewardItem: {
      id: "item_mechanical_workshop",
      name: "Engineer's Gear",
      type: "ARTIFACT",
      icon: "⚙️",
      rarity: "COMMON",
      description: "Awarded for solving the Mechanical Workshop riddle.",
    },
  },

  {
    id: "library",
    order: 2,
    name: "Library",
    latitude: 22.681316711314793,
    longitude: 75.8809725199231,
    radius: 30,
    points: 100,

    discoveryText:
      "Checkpoint discovered! You've reached the Library, a place where ideas live on pages and knowledge waits to be explored.",

    challenge: {
      type: "riddle",
      question:
        "I hold countless stories, theories, and discoveries without speaking a word. Students visit me when they need knowledge beyond the classroom. What am I?",
      answer: "library",
    },

    nextClue:
      "Your next destination is not filled with books or machines. Look for a quiet body of water beside the F-block.",

    rewardItem: {
      id: "item_library",
      name: "Scholar's Scroll",
      type: "ARTIFACT",
      icon: "📜",
      rarity: "RARE",
      description: "Awarded for solving the Library riddle.",
    },
  },

  {
    id: "f_block_pond",
    order: 3,
    name: "F-block Pond",
    latitude: 22.681074144618975,
    longitude: 75.87895367386496,
    radius: 30,
    points: 100,

    discoveryText:
      "You've discovered the F-block Pond! You've found a quieter corner of campus. Solve the riddle to uncover your next destination.",

    challenge: {
      type: "riddle",
      question:
        "I have no classroom, no lecture, and no machines. I hold water in the open air and borrow my name from the nearby F-block. What am I?",
      answer: "f-block pond",
    },

    nextClue:
      "Now head toward the world of algorithms, programming, and computer systems. Find the academic block known as B-block.",

    rewardItem: {
      id: "item_f_block_pond",
      name: "Waterside Crystal",
      type: "ARTIFACT",
      icon: "💎",
      rarity: "UNCOMMON",
      description: "Awarded for solving the F-block Pond riddle.",
    },
  },

  {
    id: "cse_block",
    order: 4,
    name: "CSE Block (B-block)",
    latitude: 22.68187892525396,
    longitude: 75.88041420756254,
    radius: 30,
    points: 100,

    discoveryText:
      "Checkpoint discovered! You've arrived at the CSE Block, where logic and code help turn ideas into digital solutions.",

    challenge: {
      type: "riddle",
      question:
        "I am the home of algorithms, software, and computational thinking. Students here teach machines to follow instructions, and my campus nickname is B-block. Who am I?",
      answer: "cse block",
    },

    nextClue:
      "Your next stop helps students take their first steps toward professional life. Find the place where placement opportunities, recruiters, and interviews come together.",

    rewardItem: {
      id: "item_cse_block",
      name: "Logic Core",
      type: "ARTIFACT",
      icon: "🧩",
      rarity: "RARE",
      description: "Awarded for solving the CSE Block riddle.",
    },
  },

  {
    id: "central_placement_cell",
    order: 5,
    name: "Central Placement Cell",
    latitude: 22.68099759104618,
    longitude: 75.88043838648288,
    radius: 30,
    points: 100,

    discoveryText:
      "You've reached the Central Placement Cell! This checkpoint marks the bridge between campus life and future career opportunities.",

    challenge: {
      type: "riddle",
      question:
        "I help connect students with opportunities beyond their degree. Resumes, recruiters, interviews, and campus placements point toward my door. What am I?",
      answer: "central placement cell",
    },

    nextClue:
      "Seek the first of two electronics destinations. Look for D-block, where the world of circuits and electronic systems belongs.",

    rewardItem: {
      id: "item_placement_cell",
      name: "Career Compass",
      type: "ARTIFACT",
      icon: "🧭",
      rarity: "RARE",
      description: "Awarded for solving the Central Placement Cell riddle.",
    },
  },

  {
    id: "electronics_block_1",
    order: 6,
    name: "Electronics Block-1 (D-block)",
    latitude: 22.680485895591957,
    longitude: 75.88086964940952,
    radius: 30,
    points: 100,

    discoveryText:
      "You've discovered Electronics Block-1! Your quest has brought you to D-block, where electronic systems and signals are the theme of this stop.",

    challenge: {
      type: "riddle",
      question:
        "I belong to the world of electronics, and my campus nickname starts the alphabetic pair D and E. I am the first block in that pair. Which block am I?",
      answer: "electronics block-1",
    },

    nextClue:
      "Next, look for the campus building associated with official decisions, institutional paperwork, and administration. Students often call it M-block.",

    rewardItem: {
      id: "item_electronics_block_1",
      name: "Circuit Shard",
      type: "ARTIFACT",
      icon: "🔌",
      rarity: "UNCOMMON",
      description: "Awarded for solving the Electronics Block-1 riddle.",
    },
  },

  {
    id: "admin_block",
    order: 7,
    name: "Admin Block (M-block)",
    latitude: 22.681269630220495,
    longitude: 75.87978667725237,
    radius: 30,
    points: 100,

    discoveryText:
      "Checkpoint discovered at the Admin Block! You've arrived at the place associated with managing the institution and its official affairs.",

    challenge: {
      type: "riddle",
      question:
        "I am not where you study circuits or build machines. Official campus work and institutional administration are associated with me, and students know me as M-block. What am I?",
      answer: "admin block",
    },

    nextClue:
      "Return to the electronics trail. You have visited D-block; now find its companion, the electronics building known as E-block.",

    rewardItem: {
      id: "item_admin_block",
      name: "Administrator's Seal",
      type: "ARTIFACT",
      icon: "🏅",
      rarity: "UNCOMMON",
      description: "Awarded for solving the Admin Block riddle.",
    },
  },

  {
    id: "electronics_block_2",
    order: 8,
    name: "Electronics Block-2 (E-block)",
    latitude: 22.680629638295027,
    longitude: 75.88148380425196,
    radius: 30,
    points: 100,

    discoveryText:
      "You've reached Electronics Block-2! E-block is your next milestone in the campus quest. Solve the riddle to keep moving.",

    challenge: {
      type: "riddle",
      question:
        "My companion is D-block, but my own letter comes immediately after it. I belong to the electronics part of campus. Which block am I?",
      answer: "electronics block-2",
    },

    nextClue:
      "Your next destination shares a nickname with the pond you visited earlier. This time, seek the academic block associated with Information Technology, not the water.",

    rewardItem: {
      id: "item_electronics_block_2",
      name: "Signal Beacon",
      type: "ARTIFACT",
      icon: "📡",
      rarity: "RARE",
      description: "Awarded for solving the Electronics Block-2 riddle.",
    },
  },

  {
    id: "it_block",
    order: 9,
    name: "IT Block (F-block)",
    latitude: 22.681398535703895,
    longitude: 75.878812429059,
    radius: 30,
    points: 100,

    discoveryText:
      "Checkpoint discovered at the IT Block! You've reached the academic destination associated with Information Technology. Only one checkpoint remains.",

    challenge: {
      type: "riddle",
      question:
        "I share the F-block nickname with a nearby campus pond, but I am a building associated with information technology. Which place am I?",
      answer: "it block",
    },

    nextClue:
      "For the final destination, find A-block. It is associated with mechanical engineering, but unlike the workshop, it is the named academic block itself.",

    rewardItem: {
      id: "item_it_block",
      name: "Data Crystal",
      type: "ARTIFACT",
      icon: "💠",
      rarity: "UNCOMMON",
      description: "Awarded for solving the IT Block riddle.",
    },
  },

  {
    id: "mechanical_block",
    order: 10,
    name: "Mechanical Block (A-block)",
    latitude: 22.682089657641697,
    longitude: 75.88099134066539,
    radius: 30,
    points: 150,

    discoveryText:
      "You've found the final checkpoint! Mechanical Block (A-block) completes your journey through the DAVV Quest. Solve the last riddle to claim your final reward.",

    challenge: {
      type: "riddle",
      question:
        "The workshop is where tools and machines support practical work, but I am the academic block associated with mechanical engineering. Students identify me by the letter A. What am I?",
      answer: "mechanical block",
    },

    nextClue:
      "The trail ends here! You've completed all ten checkpoints of the DAVV Quest. Return to your map and review your XP, collected artifacts, and completed journey.",

    rewardItem: {
      id: "item_mechanical_block",
      name: "Master Engineer's Emblem",
      type: "ARTIFACT",
      icon: "🏆",
      rarity: "EPIC",
      description: "Awarded for completing the final Mechanical Block riddle.",
    },
  },
];
