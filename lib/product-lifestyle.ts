// Worn and lifestyle photos for the store and product pages, by product slug,
// from the same Instagram set as the homepage's Grails section. The first one
// is also the store card's hover photo.
export interface LifestylePhoto {
  url: string;
  alt: string;
}

export const lifestylePhotos: Record<string, LifestylePhoto[]> = {
  crewneck: [
    { url: "/grails/crewneck-1.jpg", alt: "Person lying on grass wearing the black crewneck" },
    { url: "/grails/crewneck-3.jpg", alt: "Three people wearing black and pink crewnecks against a brick wall" },
    { url: "/grails/crewneck-2.jpg", alt: "Person from behind in the pink crewneck" },
  ],
  "crash-dummy-hoodie": [
    { url: "/grails/crash-dummy-1.jpg", alt: "Woman wearing the blue Crash Dummy hoodie with the hood up" },
    { url: "/grails/crash-dummy-2.jpg", alt: "Man wearing the blue Crash Dummy hoodie" },
    { url: "/grails/crash-dummy-3.jpg", alt: "Grid of people wearing blue and charcoal Crash Dummy hoodies" },
    { url: "/grails/crash-dummy-4.jpg", alt: "Grid of friends and family wearing Crash Dummy hoodies" },
  ],
  yots: [
    { url: "/grails/beach-action-2.jpg", alt: "Two women wearing Year of the Snake pump covers on sand" },
    { url: "/grails/hit-the-sand-1.jpg", alt: "Two women in Year of the Snake pump covers sitting on sand" },
  ],
  "hoop-shorts": [
    { url: "/grails/beach-action-2.jpg", alt: "Woman wearing lavender shorts on sand with a volleyball" },
  ],
};
