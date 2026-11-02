import { groq } from "next-sanity";

import GrailChapterView from "@/components/grail-chapter";
import GrailJoin from "@/components/grail-join";
import GrailNext from "@/components/grail-next";
import GrailVideo from "@/components/grail-video";
import {
  type GrailChapter,
  grailChapters,
  type GrailImage,
  openerVideo,
} from "@/lib/grails";
import { client } from "@/sanity/lib/client";

// Entries added in the Studio become extra chapters after the curated ones.
interface StudioGrail {
  _id: string;
  title: string;
  description: string;
  images: GrailImage[];
  videoUrl?: string | null;
  linkUrl?: string | null;
  linkLabel?: string | null;
}

const studioGrailsQuery = groq`*[_type == "project" && isActive != false && count(images) > 0] | order(date desc){
  _id,
  title,
  description,
  "images": images[defined(asset)]{
    alt,
    "url": asset->url,
    "width": asset->metadata.dimensions.width,
    "height": asset->metadata.dimensions.height
  },
  "videoUrl": video.asset->url,
  linkUrl,
  linkLabel
}`;

function studioGrailToChapter(grail: StudioGrail): GrailChapter {
  return {
    id: grail._id,
    headline: grail.title,
    intro: grail.description,
    link: grail.linkUrl
      ? {
          href: grail.linkUrl,
          label: grail.linkLabel || "Learn more",
          external: true,
        }
      : null,
    media: grail.videoUrl
      ? [
          {
            videoUrl: grail.videoUrl,
            posterUrl: grail.images[0]?.url,
            label: grail.title,
            width: 9,
            height: 16,
          },
        ]
      : grail.images.slice(0, 4),
  };
}

// The homepage's Grails section. If Sanity can't be reached, the curated
// chapters still show.
export default async function GrailsSection() {
  let studioGrails: StudioGrail[] = [];

  try {
    studioGrails = await client.fetch<StudioGrail[]>(studioGrailsQuery);
  } catch {
    studioGrails = [];
  }

  const chapters = [...grailChapters, ...studioGrails.map(studioGrailToChapter)];

  return (
    <section aria-labelledby="grails-heading" className="grails">
      <div className="grail-opener">
        <div className="grail-opener-video">
          <GrailVideo
            decorative
            label={openerVideo.label}
            poster={openerVideo.posterUrl}
            src={openerVideo.videoUrl}
          />
        </div>
        <div className="grail-opener-copy">
          <p className="grail-opener-statement">Not a commodity.</p>
          <p className="grail-opener-line">Seek until you find.</p>
        </div>
      </div>

      <h2 className="grail-header" id="grails-heading">
        Grails
      </h2>

      {chapters.map((chapter, index) => (
        <GrailChapterView
          key={chapter.id}
          chapter={chapter}
          flip={index % 2 === 1}
          number={index + 1}
        />
      ))}

      <GrailNext />
      <GrailJoin />
    </section>
  );
}
