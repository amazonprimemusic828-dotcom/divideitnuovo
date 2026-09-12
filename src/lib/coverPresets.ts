// Copertine predefinite per ogni abbonamento.
// Ogni servizio ha 2 immagini dedicate, uniche e 100% pertinenti (nessuna ripetizione).
// Le immagini sono asset locali: sempre disponibili, senza dipendere da link esterni.

import netflix1 from "../assets/covers/netflix-1.jpg";
import netflix2 from "../assets/covers/netflix-2.jpg";
import disney1 from "../assets/covers/disney-1.jpg";
import disney2 from "../assets/covers/disney-2.jpg";
import prime1 from "../assets/covers/prime-1.jpg";
import prime2 from "../assets/covers/prime-2.jpg";
import hbo1 from "../assets/covers/hbo-1.jpg";
import hbo2 from "../assets/covers/hbo-2.jpg";
import now1 from "../assets/covers/now-1.jpg";
import now2 from "../assets/covers/now-2.jpg";
import paramount1 from "../assets/covers/paramount-1.jpg";
import paramount2 from "../assets/covers/paramount-2.jpg";
import mubi1 from "../assets/covers/mubi-1.jpg";
import mubi2 from "../assets/covers/mubi-2.jpg";
import crunchy1 from "../assets/covers/crunchy-1.jpg";
import crunchy2 from "../assets/covers/crunchy-2.jpg";
import marvel1 from "../assets/covers/marvel-1.jpg";
import marvel2 from "../assets/covers/marvel-2.jpg";
import discovery1 from "../assets/covers/discovery-1.jpg";
import discovery2 from "../assets/covers/discovery-2.jpg";
import youtube1 from "../assets/covers/youtube-1.jpg";
import youtube2 from "../assets/covers/youtube-2.jpg";
import applemusic1 from "../assets/covers/applemusic-1.jpg";
import applemusic2 from "../assets/covers/applemusic-2.jpg";
import amazonmusic1 from "../assets/covers/amazonmusic-1.jpg";
import amazonmusic2 from "../assets/covers/amazonmusic-2.jpg";
import tidal1 from "../assets/covers/tidal-1.jpg";
import tidal2 from "../assets/covers/tidal-2.jpg";
import m365_1 from "../assets/covers/m365-1.jpg";
import m365_2 from "../assets/covers/m365-2.jpg";
import duolingo1 from "../assets/covers/duolingo-1.jpg";
import duolingo2 from "../assets/covers/duolingo-2.jpg";
import strava1 from "../assets/covers/strava-1.jpg";
import strava2 from "../assets/covers/strava-2.jpg";
import xbox1 from "../assets/covers/xbox-1.jpg";
import xbox2 from "../assets/covers/xbox-2.jpg";
import nintendo1 from "../assets/covers/nintendo-1.jpg";
import nintendo2 from "../assets/covers/nintendo-2.jpg";
import audible1 from "../assets/covers/audible-1.jpg";
import audible2 from "../assets/covers/audible-2.jpg";
import appleone1 from "../assets/covers/appleone-1.jpg";
import appleone2 from "../assets/covers/appleone-2.jpg";
import spotify1 from "../assets/covers/spotify-1.jpg";
import spotify2 from "../assets/covers/spotify-2.jpg";
import playstation1 from "../assets/covers/playstation-1.jpg";
import playstation2 from "../assets/covers/playstation-2.jpg";
import dropbox1 from "../assets/covers/dropbox-1.jpg";
import dropbox2 from "../assets/covers/dropbox-2.jpg";

// Copertine generiche per eventuali servizi non ancora elencati (cinema/streaming).
const CINEMA = [netflix1, netflix2];

export const COVER_PRESETS: Record<string, string[]> = {
  Netflix: [netflix1, netflix2],
  "Disney+": [disney1, disney2],
  "Prime Video": [prime1, prime2],
  "Amazon Prime": [prime1, prime2],
  "HBO Max": [hbo1, hbo2],
  NOW: [now1, now2],
  "Paramount+": [paramount1, paramount2],
  MUBI: [mubi1, mubi2],
  Crunchyroll: [crunchy1, crunchy2],
  "Marvel Unlimited": [marvel1, marvel2],
  "Discovery+": [discovery1, discovery2],
  "YouTube Premium": [youtube1, youtube2],
  "Apple Music": [applemusic1, applemusic2],
  "Amazon Music": [amazonmusic1, amazonmusic2],
  Tidal: [tidal1, tidal2],
  Spotify: [spotify1, spotify2],
  "Microsoft 365": [m365_1, m365_2],
  Duolingo: [duolingo1, duolingo2],
  Strava: [strava1, strava2],
  Xbox: [xbox1, xbox2],
  "PlayStation Plus": [playstation1, playstation2],
  "Nintendo Switch Online": [nintendo1, nintendo2],
  Audible: [audible1, audible2],
  "Apple One": [appleone1, appleone2],
  Dropbox: [dropbox1, dropbox2],
};

/** Restituisce le copertine predefinite per un servizio (o quelle della categoria generica). */
export function getCoverPresets(serviceName: string): string[] {
  return COVER_PRESETS[serviceName] ?? CINEMA;
}
