'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { getUserWarehouse } from '@/lib/queries';
import { logError } from '@/lib/error-logger';
import { createPaymentLink } from '@/lib/services/razorpay-service';
import { textBeeService } from '@/lib/textbee';
import { isSMSMasterEnabled } from '@/lib/sms-settings-actions';

export interface CreatePaymentLinkResult {
  success: boolean;
  shortUrl?: string;
  smsStatus?: boolean;
  error?: string;
}

/**
 * Create and send payment link to customer
 */
export async function createAndSendPaymentLink(
  customerId: string,
  amount: number,
  description: string,
  recordId?: string
): Promise<CreatePaymentLinkResult> {
  try {
    const supabase = await createClient();
    const warehouseId = await getUserWarehouse();

    if (!warehouseId) {
      return { success: false, error: 'Unauthorized' };
    }

    // Get customer details
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('name, phone')
      .eq('id', customerId)
      .single();

    if (customerError || !customer) {
      return { success: false, error: 'Customer not found' };
    }

    if (!customer.phone) {
      return { success: false, error: 'Customer phone number not available' };
    }

    // Create payment link
    const linkResult = await createPaymentLink({
      warehouseId,
      customerId,
      customerName: customer.name,
      customerPhone: customer.phone,
      amount,
      description,
      recordId,
      expiryInDays: 7,
    });

    if (!linkResult.success || !linkResult.shortUrl) {
      return { success: false, error: linkResult.error || 'Failed to create payment link' };
    }

    // Send SMS via TextBee
    const businessName = process.env.RAZORPAY_BUSINESS_NAME || 'GrainFlow';
    const smsMessage = `Dear ${customer.name},\nPending dues: ₹${amount.toLocaleString('en-IN')}\nPay online: ${linkResult.shortUrl}\n- ${businessName}`;

    let smsStatus = false;
    try {
      if (await isSMSMasterEnabled()) {
        const smsResult = await textBeeService.sendSMS({ to: customer.phone, message: smsMessage });
        smsStatus = smsResult.success;
      }
    } catch (smsError) {
      logError(smsError as Error, { operation: 'createAndSendPaymentLink:SMS' });
      // Continue even if SMS fails - user can still copy link
    }

    revalidatePath(`/customers/${customerId}`);
    revalidatePath('/customers');

    return {
      success: true,
      shortUrl: linkResult.shortUrl,
      smsStatus,
    };
  } catch (error: any) {
    logError(error, { operation: 'createAndSendPaymentLink', metadata: { customerId } });
    return { success: false, error: error.message || 'Failed to create payment link' };
  }
}

