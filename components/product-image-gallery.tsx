"use client";

import { useState } from "react";
import Image from "next/image";
import { SanityImageObject } from "@sanity/image-url/lib/types/types";
import { productImageUrl } from "@/lib/product-image";
import type { ImageDisplay } from "@/types";

interface ProductImageGalleryProps {
  productName: string;
  mainImage: SanityImageObject;
  additionalImages?: SanityImageObject[];
  inStock: boolean;
  imageDisplay?: ImageDisplay;
}

export function ProductImageGallery({
  productName,
  mainImage,
  additionalImages,
  inStock,
  imageDisplay,
}: ProductImageGalleryProps) {
  // Combine main image with additional images for the full gallery
  const allImages = [mainImage, ...(additionalImages || [])];
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  return (
    <div className="space-y-4">
      {/* Main Image Display */}
      <div className="relative aspect-square overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800">
        <Image
          fill
          priority
          alt={productName}
          className="object-cover"
          src={productImageUrl(allImages[selectedImageIndex], 1000, imageDisplay)}
          sizes="(max-width: 768px) 100vw, 50vw"
        />
        {!inStock && (
          <div className="absolute top-2 right-2 bg-black text-white px-3 py-1 text-sm rounded">
            Sold Out
          </div>
        )}
      </div>

      {/* Thumbnail Gallery */}
      {allImages.length > 1 && (
        <div className="grid grid-cols-4 gap-2">
          {allImages.map((image, index) => (
            <button
              key={index}
              className={`relative aspect-square overflow-hidden rounded-lg cursor-pointer transition-all ${
                selectedImageIndex === index
                  ? "ring-2 ring-black dark:ring-white ring-offset-2"
                  : "opacity-70 hover:opacity-100"
              }`}
              onClick={() => setSelectedImageIndex(index)}
            >
              <Image
                fill
                alt={`${productName} - Image ${index + 1}`}
                className="object-cover"
                src={productImageUrl(image, 200, imageDisplay)}
                sizes="(max-width: 768px) 25vw, 12.5vw"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
