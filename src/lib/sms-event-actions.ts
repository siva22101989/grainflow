/**
 * SMS Actions for Inflow and Outflow
 */
'use server';

import { textBeeService } from '@/lib/textbee';
import { createClient } from '@/utils/supabase/server';
import { isSMSEnabled } from '@/lib/sms-settings-actions';
import { hasSMSPermission } from '@/lib/sms-actions';
import { logError } from '@/lib/error-logger';

/**
 * Send welcome SMS when inflow is created
 */
export async function sendInflowWelcomeSMS(storageRecordId: string, bypassSettings: boolean = false) {
    // Check SMS permission first
    const hasPermission = await hasSMSPermission();
    if (!hasPermission) {
        return { 
            success: false, 
            error: 'SMS service is disabled for trial users. Please upgrade your plan to enable SMS notifications.' 
        };
    }
    
    // Check settings
    const enabled = await isSMSEnabled('inflow_welcome');
    
    if (!enabled && !bypassSettings) {
        return { success: false, error: 'SMS disabled in settings' };
    }

    try {
        const supabase = await createClient();
        
        // Get storage record with customer and warehouse details
        const { data: record, error } = await supabase
            .from('storage_records')
            .select(`
                *,
                customers (
                    name,
                    phone
                ),
                warehouse_lots (
                    name
                ),
                warehouses (
                    name
                )
            `)
            .eq('id', storageRecordId)
            .single();
        
        if (error || !record || !record.customers) {
            logError(error || new Error('Record not found'), { operation: 'sendInflowWelcomeSMS', metadata: { storageRecordId } });
            return { success: false, error: 'Record not found' };
        }
        
        const customer = Array.isArray(record.customers) ? record.customers[0] : record.customers;
        const warehouse = Array.isArray(record.warehouses) ? record.warehouses[0] : record.warehouses;
        const lot = Array.isArray(record.warehouse_lots) ? record.warehouse_lots[0] : record.warehouse_lots;

        // If this inflow was linked to an unloading record, fetch it for the
        // full-journey SMS (unloading → plot → storage).
        let unloadingBags: number | undefined;
        let unloadingBillNo: string | undefined;
        if (record.unloading_record_id) {
            const { data: uRec } = await supabase
                .from('unloading_records')
                .select('bags_unloaded, record_number')
                .eq('id', record.unloading_record_id)
                .single();
            if (uRec) {
                unloadingBags = uRec.bags_unloaded || undefined;
                unloadingBillNo = uRec.record_number != null ? String(uRec.record_number) : undefined;
            }
        }

        // Format storage date
        const storageDate = record.storage_start_date
            ? new Date(record.storage_start_date).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
              })
            : undefined;

        const result = await textBeeService.sendInflowWelcome({
            warehouseName: warehouse?.name || 'Warehouse',
            customerName: customer.name,
            phone: customer.phone,
            commodity: record.commodity_description || 'Storage',
            bags: record.bags_stored || 0,
            recordNumber: record.record_number || record.id.substring(0, 8),
            storageDate,
            location: lot?.name,
            hamali: record.hamali_payable,
            plotBags: record.plot_bags || undefined,
            unloadingBags,
            unloadingBillNo,
        });
        
        // Log SMS
        if (result.success) {
            await supabase.from('sms_logs').insert({
                customer_id: record.customer_id,
                phone: customer.phone,
                message_type: 'inflow_welcome',
                message_id: result.messageId,
                status: 'sent',
                record_id: storageRecordId,
            });
        }
        
        return result;
    } catch (error) {
        logError(error, { operation: 'sendInflowWelcomeSMS', metadata: { storageRecordId } });
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to send SMS',
        };
    }
}

/**
 * Send confirmation SMS when outflow is processed
 */
export async function sendOutflowConfirmationSMS(transactionId: string, bypassSettings: boolean = false) {
    // Check SMS permission first
    const hasPermission = await hasSMSPermission();
    if (!hasPermission) {
        return { 
            success: false, 
            error: 'SMS service is disabled for trial users. Please upgrade your plan to enable SMS notifications.' 
        };
    }
    
    // Check settings
    const enabled = await isSMSEnabled('outflow_confirmation');
    
    if (!enabled && !bypassSettings) {
        return { success: false, error: 'SMS disabled in settings' };
    }

    try {
        const supabase = await createClient();
        
        // Get transaction with record, customer, and warehouse details
        const { data: transaction, error } = await supabase
            .from('withdrawal_transactions')
            .select(`
                *,
                storage_records (
                    record_number,
                    commodity_description,
                    warehouse_id,
                    customers (
                        name,
                        phone
                    ),
                    warehouses (
                        name
                    )
                )
            `)
            .eq('id', transactionId)
            .single();
        
        if (error || !transaction || !transaction.storage_records) {
            logError(error || new Error('Transaction not found'), { operation: 'sendOutflowConfirmationSMS', metadata: { transactionId } });
            return { success: false, error: 'Transaction not found' };
        }
        
        const record = transaction.storage_records;
        const customer = Array.isArray(record.customers) ? record.customers[0] : record.customers;
        const warehouse = Array.isArray(record.warehouses) ? record.warehouses[0] : record.warehouses;
        
        // Send SMS with detailed financial information
        const result = await textBeeService.sendOutflowConfirmation({
            warehouseName: warehouse?.name || 'Warehouse',
            customerName: customer.name,
            phone: customer.phone,
            commodity: record.commodity_description || 'Storage',
            bags: transaction.bags_withdrawn || 0,
            recordNumber: record.record_number || transaction.record_id.substring(0, 8),
            invoiceNumber: transaction.invoice_number || transaction.id.substring(0, 8),
            rentAmount: transaction.rent_collected,
            hamaliAmount: transaction.hamali_charged,
            totalAmount: (transaction.rent_collected || 0) + (transaction.hamali_charged || 0),
        });
        
        // Log SMS
        if (result.success) {
            await supabase.from('sms_logs').insert({
                customer_id: transaction.storage_records.customers.id,
                phone: customer.phone,
                message_type: 'outflow_confirmation',
                message_id: result.messageId,
                status: 'sent',
                record_id: transaction.record_id,
            });
        }
        
        return result;
    } catch (error) {
        logError(error, { operation: 'sendOutflowConfirmationSMS', metadata: { transactionId } });
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to send SMS',
        };
    }
}

/**
 * Send drying confirmation SMS
 */
export async function sendDryingConfirmationSMS(recordId: string, bypassSettings: boolean = false) {
    // Check SMS permission first
    const hasPermission = await hasSMSPermission();
    if (!hasPermission) {
        return { 
            success: false, 
            error: 'SMS service is disabled for trial users. Please upgrade your plan to enable SMS notifications.' 
        };
    }
    
    // Check settings (Using 'inflow_welcome' as master switch for Inflow-related events as requested)
    const enabled = await isSMSEnabled('inflow_welcome');
    
    if (!enabled && !bypassSettings) {
        return { success: false, error: 'SMS disabled in settings' };
    }

    try {
        const supabase = await createClient();
        
        // Get storage record with details
        const { data: record, error } = await supabase
            .from('storage_records')
            .select(`
                *,
                customers (
                    name,
                    phone
                ),
                warehouses (
                    name
                )
            `)
            .eq('id', recordId)
            .single();
        
        if (error || !record || !record.customers) {
            logError(error || new Error('Record not found'), { operation: 'sendDryingConfirmationSMS', metadata: { recordId } });
            return { success: false, error: 'Record not found' };
        }
        
        const customer = Array.isArray(record.customers) ? record.customers[0] : record.customers;
        const warehouse = Array.isArray(record.warehouses) ? record.warehouses[0] : record.warehouses;
        
        // Send SMS
        const result = await textBeeService.sendDryingConfirmation({
            warehouseName: warehouse?.name || 'Warehouse',
            customerName: customer.name,
            phone: customer.phone,
            commodity: record.commodity_description || 'Crop',
            bags: record.bags_stored || 0, // Should be the updated final bags
            recordNumber: record.record_number || record.id.substring(0, 8),
            hamali: record.hamali_payable || 0
        });
        
        // Log SMS
        if (result.success) {
            await supabase.from('sms_logs').insert({
                customer_id: record.customer_id,
                phone: customer.phone,
                message_type: 'drying_confirmation',
                message_id: result.messageId,
                status: 'sent',
                record_id: recordId,
            });
        }

        return result;
    } catch (error) {
        logError(error, { operation: 'sendDryingConfirmationSMS', metadata: { recordId } });
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to send SMS',
        };
    }
}

/**
 * Send a payment confirmation SMS after a payment is recorded.
 * Includes the remaining outstanding balance for the customer.
 */
export async function sendPaymentConfirmationSMS(
  customerId: string,
  paidAmount: number,
  paymentDateISO?: string,
  bypassSettings: boolean = false
) {
  const hasPermission = await hasSMSPermission();
  if (!hasPermission) {
    return {
      success: false,
      error: 'SMS service is disabled for trial users. Please upgrade your plan to enable SMS notifications.'
    };
  }

  const enabled = await isSMSEnabled('payment_confirmation');
  if (!enabled && !bypassSettings) {
    return { success: false, error: 'SMS disabled in settings' };
  }

  try {
    const supabase = await createClient();

    // Customer + warehouse
    const { data: customer, error: cErr } = await supabase
      .from('customers')
      .select('id, name, phone, warehouses(name)')
      .eq('id', customerId)
      .single();

    if (cErr || !customer) {
      logError(cErr || new Error('Customer not found'), { operation: 'sendPaymentConfirmationSMS', metadata: { customerId } });
      return { success: false, error: 'Customer not found' };
    }

    const warehouse = Array.isArray(customer.warehouses) ? customer.warehouses[0] : customer.warehouses;

    // Remaining balance from the existing view (updated AFTER payment was recorded)
    const { data: bal } = await supabase
      .from('customer_balances')
      .select('balance')
      .eq('customer_id', customerId)
      .single();

    const remainingBalance = bal?.balance != null ? Number(bal.balance) : undefined;

    const paymentDate = paymentDateISO
      ? new Date(paymentDateISO).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : undefined;

    const result = await textBeeService.sendPaymentConfirmation({
      warehouseName: warehouse?.name || 'Warehouse',
      customerName: customer.name,
      phone: customer.phone,
      amount: paidAmount,
      paymentDate,
      remainingBalance,
    });

    if (result.success) {
      await supabase.from('sms_logs').insert({
        customer_id: customerId,
        phone: customer.phone,
        message_type: 'payment_confirmation',
        message_id: result.messageId,
        status: 'sent',
      });
    }

    return result;
  } catch (error) {
    logError(error, { operation: 'sendPaymentConfirmationSMS', metadata: { customerId, paidAmount } });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send SMS',
    };
  }
}
