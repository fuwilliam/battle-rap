// A tiny "one sound at a time" coordinator shared by the artist card's hover
// preview and every track row's own preview clip.

export type Pausable = { pause: () => void };

// whoever plays last wins; everyone else gets paused
let current: Pausable | null = null;

export const audioBus = {
  claim(source: Pausable) {
    if (current && current !== source) current.pause();
    current = source;
  },
  release(source: Pausable) {
    if (current === source) current = null;
  },
};
