// The chapters in the homepage's Grails section, in story order. Photos, videos
// and quotes come from the @gsdesignresearch Instagram (posts shared with
// @lexgonemad). Quotes are word for word; headlines and descriptions were
// written for the site.

export interface GrailImage {
  url: string;
  alt: string;
  width: number;
  height: number;
}

export interface GrailVideoMedia {
  videoUrl: string;
  posterUrl?: string | null;
  label: string;
  width: number;
  height: number;
}

export type GrailMedia = GrailImage | GrailVideoMedia;

export interface GrailChapter {
  id: string;
  headline: string;
  quote?: string | null;
  intro?: string | null;
  link?: { href: string; label: string; external?: boolean } | null;
  // Wider than tall: on phones it sits above the text instead of filling the
  // screen, so the sides don't get cropped off.
  wide?: boolean;
  // The first item leads the chapter. Extra photos can be tapped to swap in.
  media: GrailMedia[];
}

const seeking = "Is This What You've Been Seeking graphic";

// Different scenes from the Tokyo chapter's clip, so the two never repeat
export const openerVideo: GrailVideoMedia = {
  videoUrl: "/grails/malcolm-tokyo-loop.mp4",
  posterUrl: "/grails/malcolm-tokyo-loop.jpg",
  label: "Malcolm skating in Tokyo",
  width: 1276,
  height: 718,
};

export const grailChapters: GrailChapter[] = [
  {
    id: "first-shirt",
    headline: "The first shirt",
    quote: "If you’re broke fix it",
    intro:
      "Inspired by a life around cars, from North Carolina to Japan to OKC, and the Skyline a few friends had in Okinawa.",
    wide: true,
    media: [
      {
        videoUrl: "/grails/first-shirt.mp4",
        posterUrl: "/grails/first-shirt.jpg",
        label: "Friends wearing the first Grail Seekers shirt",
        width: 1080,
        height: 608,
      },
    ],
  },
  {
    id: "crewneck",
    headline: "The first cut and sewn piece",
    quote: "Thank you for supporting my bad habits.",
    intro:
      "A lightweight, oversized crewneck inspired by one Lex has had for years, and the debut of the new Holy Grail tag.",
    link: { href: "/store/products/crewneck", label: "Shop the crewneck" },
    media: [
      {
        url: "/grails/crewneck-1.jpg",
        alt: `Person lying face down on grass in a black crewneck with the ${seeking}`,
        width: 640,
        height: 800,
      },
      {
        url: "/grails/crewneck-3.jpg",
        alt: `Three people against a brick wall in black and pink crewnecks with the ${seeking}`,
        width: 640,
        height: 800,
      },
      {
        url: "/grails/crewneck-2.jpg",
        alt: `Person seen from behind in a pink crewneck with the ${seeking}, leaning on a wooden box`,
        width: 640,
        height: 800,
      },
    ],
  },
  {
    id: "year-of-the-snake",
    headline: "Year of the Snake",
    quote: "Ain’t nothing wrong with a little pump",
    intro: "The Year of the Snake pump cover, in white and black.",
    link: { href: "/store/products/yots", label: "Shop the pump cover" },
    media: [
      {
        url: "/grails/beach-action-2.jpg",
        alt: "Two women in Year of the Snake tops posing on sand with volleyballs",
        width: 640,
        height: 800,
      },
      {
        url: "/grails/hit-the-sand-2.jpg",
        alt: "Year of the Snake pump covers in white and black, front and back",
        width: 640,
        height: 853,
      },
    ],
  },
  {
    id: "gs-volleyball",
    headline: "Then we took it to the sand",
    quote: "It got a little serious out there",
    intro:
      "The GS Volleyball Tournament at Boombox in Oklahoma City. The entry fee was one piece from the collection.",
    media: [
      {
        videoUrl: "/grails/volleyball-vid.mp4",
        posterUrl: "/grails/volleyball-vid.jpg",
        label: "The GS Volleyball Tournament at Boombox in Oklahoma City",
        width: 720,
        height: 1280,
      },
    ],
  },
  {
    id: "try-again",
    headline: "Try again",
    intro: "The teaser for the Crash Dummy hoodie rollout.",
    wide: true,
    media: [
      {
        videoUrl: "/grails/try-again.mp4",
        posterUrl: "/grails/try-again.jpg",
        label: "A car on a tow truck, ending on the Crash Dummy Try Again logo",
        width: 1276,
        height: 718,
      },
    ],
  },
  {
    id: "crash-dummy",
    headline: "The Crash Dummy hoodie",
    quote: "Special thanks you everyone who has made roll out possible",
    intro: "Blue and charcoal hoodies, shot on friends and family.",
    link: {
      href: "/store/products/crash-dummy-hoodie",
      label: "Shop the hoodie",
    },
    media: [
      {
        url: "/grails/crash-dummy-1.jpg",
        alt: "Woman in a blue Crash Dummy hoodie with the hood up",
        width: 640,
        height: 853,
      },
      {
        url: "/grails/crash-dummy-2.jpg",
        alt: "Man in a blue Crash Dummy hoodie holding a sneaker to his ear",
        width: 640,
        height: 853,
      },
      {
        url: "/grails/crash-dummy-3.jpg",
        alt: "Grid of people modelling blue and charcoal Crash Dummy hoodies",
        width: 640,
        height: 853,
      },
      {
        url: "/grails/crash-dummy-4.jpg",
        alt: "Grid of friends and family wearing blue and charcoal Crash Dummy hoodies",
        width: 640,
        height: 853,
      },
    ],
  },
  {
    id: "tokyo",
    headline: "Win a trip to Tokyo. Malcolm did.",
    quote: "Let’s do it again sometime",
    intro:
      "The Crash Dummy hoodie rollout came with a giveaway for a roundtrip ticket to Tokyo. Malcolm won it, then skated in the brand on the trip.",
    wide: true,
    media: [
      {
        videoUrl: "/grails/malcolm-tokyo.mp4",
        posterUrl: "/grails/malcolm-tokyo.jpg",
        label: "Malcolm skating in Tokyo",
        width: 1276,
        height: 718,
      },
    ],
  },
  {
    id: "han-jan",
    headline: "Two years of Han Jan",
    quote: "Go buy G$ so I can afford a gf",
    intro:
      "We sponsored Han Jan Pocha Kitchen’s two-year anniversary with a collab shirt, and gave one away every hour of the party.",
    link: {
      href: "/store/products/gs-x-han-jan-collab",
      label: "Shop the collab",
    },
    media: [
      {
        videoUrl: "/grails/han-jan-anniversary.mp4",
        posterUrl: "/grails/han-jan-anniversary.jpg",
        label: "Han Jan 2 Year Anniversary announcement",
        width: 720,
        height: 1280,
      },
    ],
  },
];
