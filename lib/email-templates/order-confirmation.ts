import { OrderConfirmedEvent } from '../events/order-events';

// Logo URL for email templates - must be an absolute URL to a hosted image
const LOGO_URL = 'https://gsdesignresearch.com/01%20Logo%20Exports/Logo%202/02%20white/GS-02-White.png';

interface EmailTemplateData {
  orderNumber: string;
  customerName: string;
  total: number;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    variantInfo?: string;
  }>;
  shippingAddress: string;
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

export function generateOrderConfirmationEmail(orderData: OrderConfirmedEvent): {
  subject: string;
  html: string;
  text: string;
} {
  const data: EmailTemplateData = {
    orderNumber: orderData.orderNumber,
    customerName: orderData.customerName,
    total: orderData.total,
    items: orderData.items,
    shippingAddress: orderData.shippingAddress,
    serviceFee: orderData.serviceFee,
    discount: orderData.discount,
    createdAt: orderData.createdAt,
  };

  const subject = `Order Confirmation - ${data.orderNumber} | GrailSeekers`;

  const html = generateHTMLTemplate(data);
  const text = generateTextTemplate(data);

  return { subject, html, text };
}

function generateHTMLTemplate(data: EmailTemplateData): string {
  const orderDate = new Date(data.createdAt).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const subtotal = data.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Order Confirmation</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: #1a1a1a; color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 28px; font-weight: bold; }
        .content { padding: 30px; }
        .order-info { background: #f8f9fa; padding: 20px; border-radius: 6px; margin-bottom: 25px; }
        .order-info h2 { margin: 0 0 10px 0; color: #1a1a1a; font-size: 20px; }
        .order-details { margin-bottom: 25px; }
        .items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .items-table th { background: #1a1a1a; color: white; padding: 12px; text-align: left; }
        .items-table td { padding: 12px; border-bottom: 1px solid #eee; }
        .items-table .item-name { font-weight: 600; }
        .items-table .variant-info { font-size: 0.9em; color: #666; }
        .totals { border-top: 2px solid #1a1a1a; padding-top: 15px; }
        .total-row { display: flex; justify-content: space-between; margin-bottom: 5px; }
        .total-row.final { font-weight: bold; font-size: 1.1em; color: #1a1a1a; border-top: 1px solid #ddd; padding-top: 10px; }
        .discount { color: #28a745; }
        .shipping { background: #e9ecef; padding: 15px; border-radius: 6px; margin-top: 25px; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 0.9em; }
        .footer a { color: #1a1a1a; text-decoration: none; }
        @media (max-width: 600px) {
            .container { margin: 10px; }
            .content { padding: 20px; }
            .items-table th, .items-table td { padding: 8px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <img src="${LOGO_URL}" alt="GrailSeekers" style="max-width: 180px; height: auto; margin-bottom: 10px;" />
        </div>

        <div class="content">
            <div class="order-info">
                <h2>Order Confirmed!</h2>
                <p>Hi ${data.customerName},</p>
                <p>Thank you for your order! We've received your order and will begin processing it immediately.</p>
                <p><strong>Order Number:</strong> ${data.orderNumber}<br>
                <strong>Order Date:</strong> ${orderDate}</p>
            </div>

            <div class="order-details">
                <h3>Order Details</h3>
                <table class="items-table">
                    <thead>
                        <tr>
                            <th>Item</th>
                            <th>Quantity</th>
                            <th>Price</th>
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.items.map(item => `
                        <tr>
                            <td>
                                <div class="item-name">${item.name}</div>
                                ${item.variantInfo ? `<div class="variant-info">${item.variantInfo}</div>` : ''}
                            </td>
                            <td>${item.quantity}</td>
                            <td>$${item.price.toFixed(2)}</td>
                            <td>$${(item.price * item.quantity).toFixed(2)}</td>
                        </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div class="totals">
                    <div class="total-row">
                        <span>Subtotal:</span>
                        <span>$${subtotal.toFixed(2)}</span>
                    </div>
                    ${data.discount ? `
                    <div class="total-row discount">
                        <span>Discount (${data.discount.code}):</span>
                        <span>-$${data.discount.amount.toFixed(2)}</span>
                    </div>
                    ` : ''}
                    ${data.serviceFee ? `
                    <div class="total-row">
                        <span>Service Fee (5%):</span>
                        <span>$${data.serviceFee.baseAmount.toFixed(2)}</span>
                    </div>
                    ${data.serviceFee.discount > 0 ? `
                    <div class="total-row discount">
                        <span>Service Fee Discount:</span>
                        <span>-$${data.serviceFee.discount.toFixed(2)}</span>
                    </div>
                    ` : ''}
                    ` : ''}
                    <div class="total-row final">
                        <span>Total:</span>
                        <span>$${data.total.toFixed(2)}</span>
                    </div>
                </div>
            </div>

            <div class="shipping">
                <h3>Shipping Address</h3>
                <p>${data.shippingAddress}</p>
            </div>

            <div style="margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 6px;">
                <h3>What's Next?</h3>
                <ul>
                    <li>We'll process your order within 1-2 business days</li>
                    <li>You'll receive a shipping confirmation email with tracking information</li>
                    <li>Standard shipping takes 5-7 business days</li>
                </ul>
            </div>
        </div>

        <div class="footer">
            <p>Questions about your order? Reply to this email or contact us at <a href="mailto:contact@gsdesignresearch.com">contact@gsdesignresearch.com</a></p>
            <p>© 2026 GrailSeekers. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
  `;
}

function generateTextTemplate(data: EmailTemplateData): string {
  const orderDate = new Date(data.createdAt).toLocaleDateString();
  const subtotal = data.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  return `
GRAILSEEKERS - ORDER CONFIRMATION

Hi ${data.customerName},

Thank you for your order! We've received your order and will begin processing it immediately.

ORDER DETAILS
Order Number: ${data.orderNumber}
Order Date: ${orderDate}

ITEMS ORDERED
${data.items.map(item =>
  `- ${item.name}${item.variantInfo ? ` (${item.variantInfo})` : ''}\n  Quantity: ${item.quantity} × $${item.price.toFixed(2)} = $${(item.price * item.quantity).toFixed(2)}`
).join('\n')}

ORDER SUMMARY
Subtotal: $${subtotal.toFixed(2)}${data.discount ? `\nDiscount (${data.discount.code}): -$${data.discount.amount.toFixed(2)}` : ''}${data.serviceFee ? `\nService Fee (5%): $${data.serviceFee.baseAmount.toFixed(2)}${data.serviceFee.discount > 0 ? `\nService Fee Discount: -$${data.serviceFee.discount.toFixed(2)}` : ''}` : ''}
Total: $${data.total.toFixed(2)}

SHIPPING ADDRESS
${data.shippingAddress}

WHAT'S NEXT?
• We'll process your order within 1-2 business days
• You'll receive a shipping confirmation email with tracking information
• Standard shipping takes 5-7 business days

Questions about your order? Reply to this email or contact us at support@grailseekers.com

© 2024 GrailSeekers. All rights reserved.
  `;
}