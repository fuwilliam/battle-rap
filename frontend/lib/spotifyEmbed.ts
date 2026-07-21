// Spotify iFrame API loader + a tiny "one sound at a time" coordinator.
//
// Plain <iframe> embeds are cross-origin black boxes — you can't pause them or
// know they're playing. The iFrame API hands back a *controller* per track with
// play/pause + playback events, so we can enforce a single active sound across
// all track embeds AND the hover preview clip.

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

export type SpotifyController = {
  play: () => void;
  pause: () => void;
  destroy: () => void;
  addListener: (
    event: string,
    cb: (e: { data: { isPaused: boolean } }) => void,
  ) => void;
};

export type SpotifyIframeApi = {
  createController: (
    el: HTMLElement,
    opts: { uri: string; width: string | number; height: string | number },
    cb: (controller: SpotifyController) => void,
  ) => void;
};

declare global {
  interface Window {
    onSpotifyIframeApiReady?: (api: SpotifyIframeApi) => void;
  }
}

let apiPromise: Promise<SpotifyIframeApi> | null = null;

// load the API script once; resolves with the IFrameAPI handle
export function getSpotifyIframeApi(): Promise<SpotifyIframeApi> {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    window.onSpotifyIframeApiReady = (api) => resolve(api);
    const script = document.createElement("script");
    script.src = "https://open.spotify.com/embed/iframe-api/v1";
    script.async = true;
    document.body.appendChild(script);
  });
  return apiPromise;
}
