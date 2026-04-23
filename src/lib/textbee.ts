/**
 * TextBee SMS Service
 * Handles sending SMS via TextBee (Android gateway).
 *
 * Templates use a conversational "Dear {customer}, ..." style and avoid the
 * ₹ symbol (which forces UCS-2 encoding → 70-char segments → 2-3x cost).
 * We use "Rs." to stay in GSM 7-bit → 160-char segments.
 *
 * All messages end with "- {warehouseName}" as a signature.
 */

interface SendSMSParams {
  to: string; // Phone number (10 digits)
  message: string;
  senderId?: string;
}

interface SMSResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  segments?: number;
}

// GSM 7-bit default alphabet. If any char is NOT in this set, the message
// encodes as UCS-2 (70 chars/segment) instead of GSM (160 chars/segment).
const GSM_7BIT = /^[\u0040\u00a3\u0024\u00a5\u00e8\u00e9\u00f9\u00ec\u00f2\u00c7\n\u00d8\u00f8\r\u00c5\u00e5\u0394_\u03a6\u0393\u039b\u03a9\u03a0\u03a8\u03a3\u0398\u039e\u00c6\u00e6\u00df\u00c9 !"#\u00a4%&'()*+,\-./0-9:;<=>?\u00a1A-Z\u00c4\u00d6\u00d1\u00dc\u00a7\u00bfa-z\u00e4\u00f6\u00f1\u00fc\u00e0^{}\\\[~\]|\u20ac]*$/;

function detectSegments(message: string): { segments: number; isUnicode: boolean } {
  const isUnicode = !GSM_7BIT.test(message);
  const singleLimit = isUnicode ? 70 : 160;
  const multiLimit = isUnicode ? 67 : 153;
  if (message.length <= singleLimit) {
    return { segments: 1, isUnicode };
  }
  return { segments: Math.ceil(message.length / multiLimit), isUnicode };
}

// Format ₹ amounts consistently, rounded to 2 decimals.
function rs(amount: number | null | undefined): string {
  const n = Number(amount) || 0;
  return `Rs.${n.toFixed(2)}`;
}

export class TextBeeService {
  private apiKey: string;
  private deviceId: string;
  private baseUrl = 'https://api.textbee.dev/api/v1';

  constructor() {
    this.apiKey = process.env.TEXTBEE_API_KEY || '';
    this.deviceId = process.env.TEXTBEE_DEVICE_ID || '';

    if (!this.apiKey) {
      console.warn('TextBee API key not configured');
    }
    if (!this.deviceId) {
      console.warn('TextBee Device ID not configured. Get it from your TextBee dashboard.');
    }
  }

  /**
   * Send a single SMS via TextBee. Returns segment count for cost tracking.
   */
  async sendSMS({ to, message }: SendSMSParams): Promise<SMSResponse> {
    try {
      const cleanPhone = to.replace(/^\+91/, '').replace(/\D/g, '');

      if (cleanPhone.length !== 10) {
        return { success: false, error: 'Invalid phone number. Must be 10 digits.' };
      }

      if (!this.deviceId) {
        return {
          success: false,
          error: 'TextBee Device ID not configured. Please add TEXTBEE_DEVICE_ID to .env.local',
        };
      }

      const seg = detectSegments(message);

      const response = await fetch(`${this.baseUrl}/gateway/devices/${this.deviceId}/send-sms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
        },
        body: JSON.stringify({
          recipients: [`+91${cleanPhone}`],
          message: message,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('TextBee API error:', data);
        return {
          success: false,
          error: data.message || data.error || 'Failed to send SMS',
          segments: seg.segments,
        };
      }

      return {
        success: true,
        messageId: data.id || data.messageId,
        segments: seg.segments,
      };
    } catch (error) {
      console.error('TextBee service error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Payment reminder — summary version (just total outstanding).
   * Example: "Dear Namasvi, this is a reminder that you have a total
   * outstanding balance of Rs.410.00. Please make a payment at your
   * earliest convenience. Thank you. - Sri Lakshmi Warehouse"
   */
  async sendPaymentReminder({
    warehouseName,
    customerName,
    phone,
    amount,
    // Optional detailed breakdown — if rentDue/hamaliDue/insuranceDue are provided,
    // we send the detailed version instead of the summary.
    rentDue,
    hamaliDue,
    insuranceDue,
  }: {
    warehouseName: string;
    customerName: string;
    phone: string;
    amount: number;
    recordNumber?: string;
    rentDue?: number;
    hamaliDue?: number;
    insuranceDue?: number;
  }): Promise<SMSResponse> {
    const hasBreakdown =
      rentDue !== undefined || hamaliDue !== undefined || insuranceDue !== undefined;

    let message: string;
    if (hasBreakdown) {
      // Detailed breakdown — show each component
      const parts: string[] = [];
      if (rentDue !== undefined) parts.push(`Rent Due: ${rs(rentDue)}`);
      if (hamaliDue !== undefined) parts.push(`Hamali Due: ${rs(hamaliDue)}`);
      if (insuranceDue !== undefined && insuranceDue > 0) {
        parts.push(`Insurance Due: ${rs(insuranceDue)}`);
      }
      parts.push(`Total Due: ${rs(amount)}`);
      message = `Dear ${customerName}, this is a reminder that you have an outstanding balance. ${parts.join(', ')}. Please pay at your earliest convenience. Thank you. - ${warehouseName}`;
    } else {
      message = `Dear ${customerName}, this is a reminder that you have a total outstanding balance of ${rs(amount)}. Please make a payment at your earliest convenience. Thank you. - ${warehouseName}`;
    }

    return this.sendSMS({ to: phone, message });
  }

  /**
   * Payment confirmation — sent when a payment is recorded.
   */
  async sendPaymentConfirmation({
    warehouseName,
    customerName,
    phone,
    amount,
    paymentDate,
  }: {
    warehouseName: string;
    customerName: string;
    phone: string;
    amount: number;
    recordNumber?: string;
    paymentDate?: string;
  }): Promise<SMSResponse> {
    const dateStr = paymentDate ? ` on ${paymentDate}` : '';
    const message = `Dear ${customerName}, payment of ${rs(amount)} received${dateStr}. Thank you. - ${warehouseName}`;
    return this.sendSMS({ to: phone, message });
  }

  /**
   * Inflow welcome — sent when a storage record is created.
   * Example: "Dear Namasvi, your inflow of 30 bags of Paddy(Summer) has
   * been recorded on 23/04/26. Bill No: 1152. Hamali: Rs.300.00.
   * Thank you. - Sri Lakshmi Warehouse"
   */
  async sendInflowWelcome({
    warehouseName,
    customerName,
    phone,
    commodity,
    bags,
    recordNumber,
    storageDate,
    location,
    hamali,
  }: {
    warehouseName: string;
    customerName: string;
    phone: string;
    commodity: string;
    bags: number;
    recordNumber: string;
    storageDate?: string;
    location?: string;
    hamali?: number;
  }): Promise<SMSResponse> {
    const dateStr = storageDate ? ` on ${storageDate}` : '';
    const hamaliStr = hamali !== undefined && hamali > 0 ? ` Hamali: ${rs(hamali)}.` : '';
    const locationStr = location ? ` Location: ${location}.` : '';

    const message = `Dear ${customerName}, your inflow of ${bags} bags of ${commodity} has been recorded${dateStr}. Bill No: ${recordNumber}.${hamaliStr}${locationStr} Thank you. - ${warehouseName}`;

    return this.sendSMS({ to: phone, message });
  }

  /**
   * Outflow confirmation — sent when bags are withdrawn.
   */
  async sendOutflowConfirmation({
    warehouseName,
    customerName,
    phone,
    commodity,
    bags,
    recordNumber: _recordNumber,  // Unused in new template; invoiceNumber is the user-facing ref
    invoiceNumber,
    rentAmount,
    hamaliAmount,
    totalAmount,
    withdrawalDate,
  }: {
    warehouseName: string;
    customerName: string;
    phone: string;
    commodity: string;
    bags: number;
    recordNumber: string;
    invoiceNumber: string;
    rentAmount?: number;
    hamaliAmount?: number;
    totalAmount?: number;
    withdrawalDate?: string;
  }): Promise<SMSResponse> {
    const dateStr = withdrawalDate ? ` on ${withdrawalDate}` : '';
    const billParts: string[] = [`Invoice: ${invoiceNumber}`];
    if (rentAmount !== undefined) billParts.push(`Rent: ${rs(rentAmount)}`);
    if (hamaliAmount !== undefined && hamaliAmount > 0) billParts.push(`Hamali: ${rs(hamaliAmount)}`);
    if (totalAmount !== undefined) billParts.push(`Total: ${rs(totalAmount)}`);

    const message = `Dear ${customerName}, withdrawal of ${bags} bags of ${commodity} recorded${dateStr}. ${billParts.join(', ')}. Thank you. - ${warehouseName}`;

    return this.sendSMS({ to: phone, message });
  }

  /**
   * Drying finalized — sent when plot drying wraps up and the final stored
   * qty is locked in.
   */
  async sendDryingConfirmation({
    warehouseName,
    customerName,
    phone,
    commodity,
    bags,
    recordNumber,
    hamali,
  }: {
    warehouseName: string;
    customerName: string;
    phone: string;
    commodity: string;
    bags: number;
    recordNumber: string;
    hamali: number;
  }): Promise<SMSResponse> {
    const hamaliStr = hamali > 0 ? ` Hamali: ${rs(hamali)}.` : '';
    const recordStr = recordNumber ? ` Record: ${recordNumber}.` : '';
    const message = `Dear ${customerName}, drying finalized. Final stock: ${bags} bags of ${commodity}.${recordStr}${hamaliStr} Thank you. - ${warehouseName}`;
    return this.sendSMS({ to: phone, message });
  }

  /**
   * Bulk SMS — unchanged.
   */
  async sendBulkSMS(recipients: SendSMSParams[]): Promise<SMSResponse[]> {
    const results = await Promise.allSettled(
      recipients.map(recipient => this.sendSMS(recipient))
    );
    return results.map(result =>
      result.status === 'fulfilled'
        ? result.value
        : { success: false, error: 'Failed to send' }
    );
  }
}

export const textBeeService = new TextBeeService();
