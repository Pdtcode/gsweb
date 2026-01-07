interface OrderConfirmedEvent {
  orderId: string;
  orderNumber: string;
  customerEmail: string;
  customerName: string;
  total: number;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    variantInfo?: string;
  }>;
  shippingAddress: string;
  paymentIntentId: string;
  serviceFee?: {
    baseAmount: number;
    discount: number;
    finalAmount: number;
  };
  discount?: {
    code: string;
    amount: number;
  };
  createdAt: string;
}

interface OrderEvent {
  type: 'ORDER_CONFIRMED';
  data: OrderConfirmedEvent;
  timestamp: string;
  id: string;
}

class OrderEventEmitter {
  private listeners: Map<string, Array<(event: OrderEvent) => Promise<void>>> = new Map();

  on(eventType: string, listener: (event: OrderEvent) => Promise<void>) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType)!.push(listener);
  }

  async emit(event: OrderEvent) {
    const listeners = this.listeners.get(event.type) || [];

    console.log(`🔄 Emitting ${event.type} event for order ${event.data.orderNumber}`);

    // Execute all listeners concurrently
    const promises = listeners.map(async (listener) => {
      try {
        await listener(event);
      } catch (error) {
        console.error(`Error in event listener for ${event.type}:`, error);
      }
    });

    await Promise.allSettled(promises);
  }

  async emitOrderConfirmed(data: OrderConfirmedEvent) {
    const event: OrderEvent = {
      type: 'ORDER_CONFIRMED',
      data,
      timestamp: new Date().toISOString(),
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    await this.emit(event);
  }
}

// Global event emitter instance
export const orderEventEmitter = new OrderEventEmitter();

// Export types for use in other modules
export type { OrderConfirmedEvent, OrderEvent };