import { orderEventEmitter, type OrderEvent, type OrderConfirmedEvent } from '../events/order-events';
import { gmailClient, type EmailMessage } from '../gmail/gmail-client';
import { generateOrderConfirmationEmail } from '../email-templates/order-confirmation';

class EmailService {
  private fromEmail: string;
  private isInitialized: boolean = false;

  constructor() {
    this.fromEmail = process.env.EMAIL_FROM_ADDRESS || 'noreply@grailseekers.com';
    this.initializeEventListeners();
  }

  private initializeEventListeners() {
    // Listen for OrderConfirmed events
    orderEventEmitter.on('ORDER_CONFIRMED', this.handleOrderConfirmed.bind(this));
    this.isInitialized = true;
    console.log('✅ Email service initialized - listening for order events');
  }

  private async handleOrderConfirmed(event: OrderEvent) {
    console.log(`📧 Processing order confirmation email for ${event.data.orderNumber}`);

    try {
      const orderData = event.data as OrderConfirmedEvent;

      // Generate email content
      const { subject, html, text } = generateOrderConfirmationEmail(orderData);

      // Prepare email message
      const emailMessage: EmailMessage = {
        to: orderData.customerEmail,
        from: this.fromEmail,
        subject,
        html,
        text,
      };

      // Send email
      const result = await gmailClient.sendEmail(emailMessage);

      if (result.success) {
        console.log(`✅ Order confirmation email sent successfully for ${orderData.orderNumber}`);
        console.log(`   To: ${orderData.customerEmail}`);
        console.log(`   Message ID: ${result.messageId}`);

        // Log the successful email send for audit purposes
        await this.logEmailActivity({
          orderId: orderData.orderId,
          orderNumber: orderData.orderNumber,
          emailType: 'order_confirmation',
          recipient: orderData.customerEmail,
          status: 'sent',
          messageId: result.messageId,
          sentAt: new Date().toISOString(),
        });
      } else {
        console.error(`❌ Failed to send order confirmation email for ${orderData.orderNumber}:`, result.error);

        // Log the failed email attempt
        await this.logEmailActivity({
          orderId: orderData.orderId,
          orderNumber: orderData.orderNumber,
          emailType: 'order_confirmation',
          recipient: orderData.customerEmail,
          status: 'failed',
          error: result.error,
          attemptedAt: new Date().toISOString(),
        });

        // Could implement retry logic here if needed
        await this.handleEmailFailure(orderData, result.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Error handling order confirmed event:', error);

      // Log the error
      await this.logEmailActivity({
        orderId: event.data.orderId,
        orderNumber: event.data.orderNumber,
        emailType: 'order_confirmation',
        recipient: event.data.customerEmail,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        attemptedAt: new Date().toISOString(),
      });
    }
  }

  private async logEmailActivity(activity: {
    orderId: string;
    orderNumber: string;
    emailType: string;
    recipient: string;
    status: 'sent' | 'failed' | 'error';
    messageId?: string;
    error?: string;
    sentAt?: string;
    attemptedAt?: string;
  }) {
    // In a production app, you might want to store this in a database
    // For now, we'll just log it to console
    console.log('📊 Email Activity:', JSON.stringify(activity, null, 2));

    // You could also send this to an analytics service, log aggregator, etc.
    // Example: await analyticsService.track('email_sent', activity);
  }

  private async handleEmailFailure(orderData: OrderConfirmedEvent, error: string) {
    console.log(`🔄 Handling email failure for order ${orderData.orderNumber}`);

    // Implement retry logic, fallback notifications, etc.
    // For example:
    // 1. Retry with exponential backoff
    // 2. Send notification to admin
    // 3. Queue for manual review

    console.log(`⚠️ Email failure logged for manual review: ${error}`);
  }

  async testEmailConnection(): Promise<boolean> {
    try {
      const isConnected = await gmailClient.testConnection();
      if (isConnected) {
        console.log('✅ Email service connection test passed');
      } else {
        console.log('❌ Email service connection test failed');
      }
      return isConnected;
    } catch (error) {
      console.error('Email service connection test error:', error);
      return false;
    }
  }

  async sendTestEmail(recipientEmail: string): Promise<boolean> {
    try {
      const testMessage: EmailMessage = {
        to: recipientEmail,
        from: this.fromEmail,
        subject: 'GrailSeekers Email Service Test',
        html: `
          <h1>Email Service Test</h1>
          <p>This is a test email from the GrailSeekers email service.</p>
          <p>If you received this email, the service is working correctly!</p>
          <p><em>Sent at: ${new Date().toISOString()}</em></p>
        `,
        text: `
Email Service Test

This is a test email from the GrailSeekers email service.
If you received this email, the service is working correctly!

Sent at: ${new Date().toISOString()}
        `,
      };

      const result = await gmailClient.sendEmail(testMessage);

      if (result.success) {
        console.log(`✅ Test email sent successfully to ${recipientEmail}`);
        return true;
      } else {
        console.error(`❌ Test email failed:`, result.error);
        return false;
      }
    } catch (error) {
      console.error('Error sending test email:', error);
      return false;
    }
  }

  isReady(): boolean {
    return this.isInitialized;
  }
}

// Global email service instance
export const emailService = new EmailService();

// Export the class for testing or manual instantiation
export { EmailService };