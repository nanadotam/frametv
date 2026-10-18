/**
 * Showcase photos for the landing page, from Unsplash (free to use under
 * the Unsplash License; hotlinked from their CDN with credit, as their API
 * guidelines ask). `photo(p, w)` sizes them through Unsplash's imgix.
 */
export interface ShowcasePhoto { id: string; src: string; w: number; h: number; by: string; user: string; alt: string }

export const SHOWCASE: ShowcasePhoto[] = [
  {
    "id": "WQT6IQbXCB4",
    "src": "https://images.unsplash.com/photo-1721840432289-d0041522103d?ixlib=rb-4.1.0",
    "w": 5567,
    "h": 3712,
    "by": "Jayanth Muppaneni",
    "user": "jay_5",
    "alt": "A group of people standing on top of a beach next to the ocean"
  },
  {
    "id": "V-bUqND0jPo",
    "src": "https://images.unsplash.com/photo-1641849461096-7e796050f12b?ixlib=rb-4.1.0",
    "w": 5000,
    "h": 3333,
    "by": "Ty Downs",
    "user": "tydowns",
    "alt": "a group of people standing on top of a sandy beach"
  },
  {
    "id": "WQ6oGJ_Ergo",
    "src": "https://images.unsplash.com/photo-1600377202759-e783ff47dff7?ixlib=rb-4.1.0",
    "w": 6016,
    "h": 4000,
    "by": "Tamara Bellis",
    "user": "tamarabellis",
    "alt": "woman in white tank top carrying child in blue shirt"
  },
  {
    "id": "0-uzdU3gUYw",
    "src": "https://images.unsplash.com/photo-1530047139082-5435ca3c4614?ixlib=rb-4.1.0",
    "w": 5472,
    "h": 3648,
    "by": "Omar Lopez",
    "user": "omarlopez1",
    "alt": "woman hugging other woman while smiling at beach"
  },
  {
    "id": "UmV2wr-Vbq8",
    "src": "https://images.unsplash.com/photo-1539635278303-d4002c07eae3?ixlib=rb-4.1.0",
    "w": 6000,
    "h": 4000,
    "by": "Felix Rostig",
    "user": "felixrstg",
    "alt": "low-angle photography of two men playing beside two women"
  },
  {
    "id": "vBUGdI7JAvc",
    "src": "https://images.unsplash.com/photo-1761839256602-0e28a5ab928d?ixlib=rb-4.1.0",
    "w": 6192,
    "h": 4128,
    "by": "Land O'Lakes, Inc.",
    "user": "landolakesinc",
    "alt": "Two smiling women in a park"
  },
  {
    "id": "twukN12EN7c",
    "src": "https://images.unsplash.com/photo-1500964757637-c85e8a162699?ixlib=rb-4.1.0",
    "w": 4608,
    "h": 2963,
    "by": "simon",
    "user": "simon_berger",
    "alt": "landscape photography of mountains"
  },
  {
    "id": "_kd5cxwZOK4",
    "src": "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?ixlib=rb-4.1.0",
    "w": 6720,
    "h": 4480,
    "by": "Pang Yuhao",
    "user": "yuhao",
    "alt": "people throwing hats on air"
  },
  {
    "id": "ltsKOg_q_Gc",
    "src": "https://images.unsplash.com/photo-1625794084867-8ddd239946b1?ixlib=rb-4.1.0",
    "w": 5184,
    "h": 3456,
    "by": "Taylor Sondgeroth",
    "user": "ridingseaside",
    "alt": "golden retriever puppy lying on white textile"
  },
  {
    "id": "zO5L8zzI3ZY",
    "src": "https://images.unsplash.com/photo-1783441286721-893acb9a5a46?ixlib=rb-4.1.0",
    "w": 5719,
    "h": 3813,
    "by": "Wojciech Wyszkowski",
    "user": "fotodruk",
    "alt": "A golden retriever dog lies among yellow dandelions"
  },
  {
    "id": "Al2Kps9hipo",
    "src": "https://images.unsplash.com/photo-1670296047577-36c2c1281a85?ixlib=rb-4.1.0",
    "w": 6720,
    "h": 4480,
    "by": "Akash Gurle",
    "user": "chitr_agraph",
    "alt": "a person wearing a garment"
  },
  {
    "id": "NjQ_gzJfeiw",
    "src": "https://images.unsplash.com/photo-1652169892293-ba174ef19931?ixlib=rb-4.1.0",
    "w": 5431,
    "h": 3621,
    "by": "Svitlana",
    "user": "kekse_und_ich",
    "alt": "A picnic spread with waffles and berries on a blanket in a blooming orchard"
  },
  {
    "id": "Nc-hc5g5yhw",
    "src": "https://images.unsplash.com/photo-1657664043009-c4975cb4eed3?ixlib=rb-4.1.0",
    "w": 8164,
    "h": 6123,
    "by": "OPPO Find X5 Pro",
    "user": "oppofindx5pro",
    "alt": "a man and a child looking at a plant"
  },
  {
    "id": "L4nwL3195U0",
    "src": "https://images.unsplash.com/photo-1593100126453-19b562a800c1?ixlib=rb-4.1.0",
    "w": 3872,
    "h": 2592,
    "by": "Ekaterina Shakharova",
    "user": "minigirl",
    "alt": "An elderly woman with white hair and glasses hugging a young child"
  },
  {
    "id": "0QEG_xOoY7Y",
    "src": "https://images.unsplash.com/photo-1616141893496-fbc65370493e?ixlib=rb-4.1.0",
    "w": 6720,
    "h": 4480,
    "by": "Matt Paul Catalano",
    "user": "mattpaul",
    "alt": "white and blue ocean waves"
  }
];

export function photo(p: ShowcasePhoto, width: number, height?: number) {
  return `${p.src}&w=${width}${height ? `&h=${height}&fit=crop` : ''}&auto=format&q=70`;
}

export const UNSPLASH_REF = '?utm_source=mantel&utm_medium=referral';

