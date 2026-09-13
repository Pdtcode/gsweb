import { urlForImage } from "@/sanity/lib/image";

/**
 * Product image display settings.
 *
 * Product photos arrive at inconsistent aspect ratios, but every storefront
 * surface frames them in a square with `object-cover`. A landscape photo
 * therefore gets its sides cropped and reads as zoomed-in next to square ones.
 *
 * `contain` fixes that by letterboxing the whole photo onto a square canvas of
 * `background`, with `pad` shrinking the subject further inside that canvas.
 * The result is already square, so the existing `object-cover` markup displays
 * it in full and no layout changes are needed.
 */
export interface ImageDisplay {
  fit?: "cover" | "contain";
  background?: string;
  pad?: number;
}

// Asset refs look like: image-<hash>-<width>x<height>-<ext>
const REF_DIMENSIONS = /-(\d+)x(\d+)-\w+$/;

function refOf(image: any): string | undefined {
  if (!image) return undefined;
  if (typeof image === "string") return image;

  return image.asset?._ref || image.asset?._id || image._ref || image._id;
}

function sourceDimensions(image: any): { width: number; height: number } | null {
  const ref = refOf(image);
  const match = ref ? REF_DIMENSIONS.exec(ref) : null;

  if (!match) return null;

  return { width: Number(match[1]), height: Number(match[2]) };
}

function normalizeBackground(background?: string): string {
  const value = (background || "ffffff").trim().replace(/^#/, "");

  return /^[0-9a-fA-F]{3,8}$/.test(value) ? value : "ffffff";
}

/**
 * Build a square product image URL honouring the product's display settings.
 *
 * Falls back to the previous behaviour (a centred crop) whenever no settings
 * are present, so untouched products render exactly as before.
 */
export function productImageUrl(
  image: any,
  size: number = 800,
  display?: ImageDisplay | null,
): string {
  if (!image) return "";

  const builder = urlForImage(image);

  if (display?.fit !== "contain") {
    return builder.width(size).height(size).url();
  }

  const dimensions = sourceDimensions(image);

  let contained = builder;

  // Pinning the rect to the full image stops @sanity/image-url from inserting
  // its own centred square crop, which would defeat the padding entirely.
  if (dimensions) {
    contained = contained.rect(0, 0, dimensions.width, dimensions.height);
  }

  contained = contained
    .width(size)
    .height(size)
    .fit("fill")
    .bg(normalizeBackground(display.background));

  // `pad` is expressed against the rendered size, so scale it with `size` to
  // keep the framing identical across thumbnails and full-size renders.
  const pad = Math.max(0, Math.min(display.pad ?? 0, 400));

  if (pad > 0) {
    contained = contained.pad(Math.round((pad * size) / 800));
  }

  return contained.url();
}
