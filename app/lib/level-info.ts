// Penjelasan tiap kelompok kemampuan (ujian) untuk peserta. Kunci = Level.key.
export const LEVEL_INFO: Record<string, { summary: string; traits: string }> = {
  basic: {
    summary: "Your current ability is at a basic level.",
    traits: "You handle the core ideas and straightforward questions, but longer, more complex, or time-pressured questions are still hard.",
  },
  intermediate: {
    summary: "Your current ability is at an intermediate level.",
    traits: "You handle most questions with confidence, spot the main idea quickly, and only lose points on the harder or trickier items.",
  },
  advanced: {
    summary: "Your current ability is at an advanced level.",
    traits: "You master complex questions, work steadily under time pressure, and apply your knowledge to unfamiliar situations.",
  },
};
