"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

// SKU Data Types
export interface ProductSku {
  productId: string;
  productName: string;
  productSlug: string;
  variants: {
    id: string;
    sku: string;
    size: string;
    color: string | null;
    stock: number;
  }[];
}

export interface SkuLookup {
  [sku: string]: {
    productId: string;
    productName: string;
    variantId: string;
    size: string;
    color: string | null;
    stock: number;
  };
}

interface SkuContextType {
  skuData: {
    products: ProductSku[];
    skuLookup: SkuLookup;
  } | null;
  isLoading: boolean;
  error: string | null;
  refetchSkus: () => Promise<void>;
  getSkuByVariantOptions: (productSlug: string, size?: string, color?: string) => string | null;
}

const SkuContext = createContext<SkuContextType | undefined>(undefined);

export function useSkuContext() {
  const context = useContext(SkuContext);
  if (context === undefined) {
    throw new Error('useSkuContext must be used within a SkuProvider');
  }
  return context;
}

interface SkuProviderProps {
  children: ReactNode;
}

export function SkuProvider({ children }: SkuProviderProps) {
  const [skuData, setSkuData] = useState<{
    products: ProductSku[];
    skuLookup: SkuLookup;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSkus = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/products/skus');

      if (!response.ok) {
        throw new Error(`Failed to fetch SKUs: ${response.status}`);
      }

      const data = await response.json();
      setSkuData({
        products: data.products,
        skuLookup: data.skuLookup,
      });

      console.log('✅ SKU data loaded globally:', {
        totalProducts: data.totalProducts,
        totalVariants: data.totalVariants,
        sampleSkus: Object.keys(data.skuLookup).slice(0, 5)
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('❌ Failed to load SKU data:', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to find SKU by product slug and variant options
  const getSkuByVariantOptions = (
    productSlug: string,
    size?: string,
    color?: string
  ): string | null => {
    if (!skuData) return null;

    // Find the product by slug
    const product = skuData.products.find(p => p.productSlug === productSlug);
    if (!product) return null;

    // Find matching variant
    for (const variant of product.variants) {
      const sizeMatch = !size || variant.size.toLowerCase().includes(size.toLowerCase());
      const colorMatch = !color ||
        (variant.color && variant.color.toLowerCase().includes(color.toLowerCase()));

      if (sizeMatch && colorMatch) {
        return variant.sku;
      }
    }

    return null;
  };

  useEffect(() => {
    fetchSkus();
  }, []);

  const value: SkuContextType = {
    skuData,
    isLoading,
    error,
    refetchSkus: fetchSkus,
    getSkuByVariantOptions,
  };

  return (
    <SkuContext.Provider value={value}>
      {children}
    </SkuContext.Provider>
  );
}