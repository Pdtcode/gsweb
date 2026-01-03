"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
// Using inline SVG icons instead of @heroicons/react to avoid dependency issues

interface OrderItem {
  id: string;
  quantity: number;
  price: number;
  Product: {
    id: string;
    name: string;
    images: string[];
  };
  ProductVariant?: {
    id: string;
    size: string;
    color: string;
    sku: string;
  };
}

interface Order {
  id: string;
  orderNumber: string;
  total: number;
  status: string;
  createdAt: string;
  OrderItem: OrderItem[];
}

export default function OrderSuccessPage() {
  const searchParams = useSearchParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const paymentIntentId = searchParams.get("payment_intent");

  useEffect(() => {
    async function fetchOrder() {
      if (!paymentIntentId) {
        setError("No payment intent ID found");
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/order/by-payment-intent?payment_intent=${paymentIntentId}`);

        if (!response.ok) {
          throw new Error("Failed to fetch order");
        }

        const data = await response.json();
        setOrder(data.order);
      } catch (err) {
        console.error("Error fetching order:", err);
        setError("Could not load order details");
      } finally {
        setLoading(false);
      }
    }

    fetchOrder();
  }, [paymentIntentId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center p-6">
          <div className="text-red-500 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Order Not Found</h1>
          <p className="text-gray-600 mb-6">
            {error || "We couldn't find your order details."}
          </p>
          <Link
            href="/"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Return Home
          </Link>
        </div>
      </div>
    );
  }

  const formatPrice = (price: any) => {
    const numericPrice = typeof price === 'number' ? price : parseFloat(price.toString());
    return `$${numericPrice.toFixed(2)}`;
  };
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Calculate the discount adjustment for proper item pricing display
  const calculateItemPrices = (order: Order) => {
    const subtotal = order.OrderItem.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const discountAmount = subtotal - order.total;
    const discountPercentage = discountAmount > 0 ? discountAmount / subtotal : 0;

    return order.OrderItem.map(item => {
      const itemTotal = item.price * item.quantity;
      const itemDiscount = itemTotal * discountPercentage;
      const adjustedItemTotal = itemTotal - itemDiscount;
      const adjustedItemPrice = adjustedItemTotal / item.quantity;

      return {
        ...item,
        displayPrice: adjustedItemPrice,
        displayTotal: adjustedItemTotal,
        originalPrice: item.price,
        discountAmount: itemDiscount
      };
    });
  };

  const itemsWithAdjustedPrices = order ? calculateItemPrices(order) : [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Success Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <svg className="w-16 h-16 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Order Confirmed!
          </h1>
          <p className="text-lg text-gray-600">
            Thank you for your purchase. Your order has been successfully placed.
          </p>
        </div>

        {/* Order Summary Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 bg-green-50 border-b border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Order #{order.orderNumber}
                </h2>
                <p className="text-sm text-gray-600">
                  Placed on {formatDate(order.createdAt)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-900">
                  {formatPrice(order.total)}
                </p>
                <p className="text-sm text-green-600 font-medium capitalize">
                  {order.status.toLowerCase()}
                </p>
              </div>
            </div>
          </div>

          {/* Order Items */}
          <div className="px-6 py-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              Items Ordered ({order.OrderItem.length})
            </h3>

            <div className="space-y-4">
              {itemsWithAdjustedPrices.map((item) => (
                <div key={item.id} className="flex items-start space-x-4 py-4 border-b border-gray-100 last:border-b-0">
                  {/* Product Image */}
                  <div className="flex-shrink-0">
                    {item.Product.images && item.Product.images.length > 0 ? (
                      <Image
                        src={item.Product.images[0]}
                        alt={item.Product.name}
                        width={64}
                        height={64}
                        className="w-16 h-16 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center">
                        <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Product Details */}
                  <div className="flex-grow">
                    <h4 className="font-medium text-gray-900">
                      {item.Product.name}
                    </h4>

                    {item.ProductVariant && (
                      <p className="text-sm text-gray-600">
                        {item.ProductVariant.size && `Size: ${item.ProductVariant.size}`}
                        {item.ProductVariant.size && item.ProductVariant.color && " • "}
                        {item.ProductVariant.color && `Color: ${item.ProductVariant.color}`}
                        {item.ProductVariant.sku && (
                          <span className="block text-xs text-gray-500 mt-1">
                            SKU: {item.ProductVariant.sku}
                          </span>
                        )}
                      </p>
                    )}

                    <p className="text-sm text-gray-600">
                      Quantity: {item.quantity}
                    </p>
                  </div>

                  {/* Price */}
                  <div className="text-right">
                    <p className="font-medium text-gray-900">
                      {formatPrice(item.displayTotal)}
                    </p>
                    {item.discountAmount > 0 && (
                      <p className="text-xs text-gray-500 line-through">
                        {formatPrice(item.originalPrice * item.quantity)}
                      </p>
                    )}
                    {item.quantity > 1 && (
                      <p className="text-xs text-gray-500">
                        {formatPrice(item.displayPrice)} each
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Price Breakdown */}
            {(() => {
              const subtotal = order.OrderItem.reduce((sum, item) => sum + (item.price * item.quantity), 0);
              const discountAmount = subtotal - order.total;

              return discountAmount > 0 ? (
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Subtotal:</span>
                      <span>{formatPrice(subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Discount:</span>
                      <span>-{formatPrice(discountAmount)}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-lg border-t border-gray-200 pt-2">
                      <span>Total:</span>
                      <span>{formatPrice(order.total)}</span>
                    </div>
                  </div>
                </div>
              ) : null;
            })()}
          </div>
        </div>

        {/* Next Steps */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center mb-4">
              <svg className="w-6 h-6 text-blue-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900">
                What&apos;s Next?
              </h3>
            </div>
            <div className="space-y-3 text-sm text-gray-600">
              <p>• You&apos;ll receive an email confirmation shortly</p>
              <p>• We&apos;ll notify you when your order ships</p>
              <p>• Track your order status in your account</p>
              <p>• Estimated delivery: 3-7 business days</p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Order Management
            </h3>
            <div className="space-y-3">
              <Link
                href="/account/orders"
                className="block w-full text-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                View All Orders
              </Link>
              <Link
                href="/"
                className="block w-full text-center px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
              >
                Continue Shopping
              </Link>
            </div>
          </div>
        </div>

        {/* Customer Support */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-600">
            Questions about your order? {" "}
            <Link href="/contact" className="text-blue-600 hover:text-blue-700 font-medium">
              Contact Support
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}