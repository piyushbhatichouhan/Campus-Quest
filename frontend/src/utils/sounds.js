let audioContext = null;

function getAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }

  return audioContext;
}

function playTone({
  frequency,
  duration,
  type = "sine",
  volume = 0.08,
  delay = 0,
}) {
  const context = getAudioContext();

  if (context.state === "suspended") {
    context.resume();
  }

  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, context.currentTime + delay);

  gain.gain.setValueAtTime(0, context.currentTime + delay);

  gain.gain.linearRampToValueAtTime(volume, context.currentTime + delay + 0.01);

  gain.gain.exponentialRampToValueAtTime(
    0.001,
    context.currentTime + delay + duration,
  );

  oscillator.connect(gain);
  gain.connect(context.destination);

  oscillator.start(context.currentTime + delay);
  oscillator.stop(context.currentTime + delay + duration + 0.02);
}

export function playDiscoverySound() {
  playTone({
    frequency: 660,
    duration: 0.12,
    type: "sine",
    volume: 0.08,
  });

  playTone({
    frequency: 880,
    duration: 0.18,
    type: "sine",
    volume: 0.08,
    delay: 0.1,
  });
}

export function playSuccessSound() {
  playTone({
    frequency: 523,
    duration: 0.12,
    type: "triangle",
    volume: 0.09,
  });

  playTone({
    frequency: 659,
    duration: 0.12,
    type: "triangle",
    volume: 0.09,
    delay: 0.1,
  });

  playTone({
    frequency: 784,
    duration: 0.25,
    type: "triangle",
    volume: 0.1,
    delay: 0.2,
  });
}

export function playClaimSound() {
  playTone({
    frequency: 440,
    duration: 0.08,
    type: "square",
    volume: 0.04,
  });

  playTone({
    frequency: 660,
    duration: 0.12,
    type: "square",
    volume: 0.04,
    delay: 0.08,
  });
}
