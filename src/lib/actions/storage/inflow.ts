'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import * as Sentry from "@sentry/nextjs";

import { createClient } from '@/utils/supabase/server';
import { getUserWarehouse, getCustomer } from '@/lib/queries';
import { saveStorageRecord, updateStorageRecord } from '@/lib/data';
import { checkRateLimit } from '@/lib/rate-limit';
import { getNextInvoiceNumber } from '@/lib/sequence-utils';
import { FormState } from '../common';
import type { StorageRecord, Payment } from '@/lib/definitions'; // Updated import path
import { logError, logWarning } from '@/lib/error-logger';

const { logger } = Sentry;

const FinalizeDryingSchema = z.object({
  recordId: z.string(),
  finalBags: z.coerce.number().positive(),
});

/**
 * Finalizes the drying process of a plot.
 * Converts "Plot Bags" into actual "Stored Bags" and updates warehouse lot capacity accordingly.
 * 
 * @param {_prevState} _prevState - Form state (provided by useActionState).
 * @param {FormData} formData - Data containing recordId and finalBags.
 * @returns {Promise<{ message: string, success: boolean, recordId?: string }>} The result of the operation.
 */
export async function finalizePlotDrying(_prevState: FormState, formData: FormData) {
  try {
      const validatedFields = FinalizeDryingSchema.safeParse({
      recordId: formData.get('recordId'),
      finalBags: formData.get('finalBags'),
  });

  const hamaliPayable = Number(formData.get('hamaliPayable') || 0);

  if (!validatedFields.success) {
      return { message: 'Invalid Input', success: false };
  }

  const { recordId, finalBags } = validatedFields.data;

  const supabase = await createClient();
  const { data: record, error } = await supabase.from('storage_records')
      .select('lot_id, bags_stored')
      .eq('id', recordId)
      .single();

  if (error || !record) {
      return { message: 'Record not found', success: false };
  }

  // Update Lot Stock
  // Old logic: "Plot" stock assumes temporary. If converting to "Stored", we add to Lot.
  // BUT the record already HAS a lot_id (it was reserved).
  // The 'bags_stored' was likely 0 or accurate?
  // In 'Plot' inflow, we might have set 'bags_stored' to approximate.
  // If we update it now, we adjust the lot current_stock.
  
  // Logic: 
  // Difference = New - Old.
  // Lot Stock = Lot Stock + Difference.
  // OR: If it wasn't affecting stock before?
  // Assuming it affects stock.
  
  if (record.lot_id) { // snake_case from DB
       // Correction: record object from DB uses snake_case keys if typed by supabase client?
       // Yes, usually. But let's check. Select query 'lot_id, bags_stored' -> returns { lot_id: ..., bags_stored: ... }
       const lotId = record.lot_id;
       const recordBags = record.bags_stored || 0;

       const { data: lot } = await supabase.from('warehouse_lots').select('capacity, current_stock, name').eq('id', lotId).single();
       if (lot) {
           const oldStock = lot.current_stock || 0;
           const capacity = lot.capacity || 1000;
           
           const correction = finalBags - recordBags;
           const newStock = Math.max(0, oldStock + correction);
           
           if (newStock > capacity) {
                return { 
                    message: `Cannot finalize: Lot ${lot.name} capacity exceeded! Limit: ${capacity}, Projected: ${newStock}`, 
                    success: false 
                };
           }
           
           await supabase.from('warehouse_lots').update({ current_stock: newStock }).eq('id', lotId);
       }
  }
  
  // Update Record 
  await updateStorageRecord(recordId, {
      loadBags: finalBags,
      bagsStored: finalBags,
      bagsIn: finalBags, // Sync bagsIn
      hamaliPayable: hamaliPayable // Update Hamali
  });

  // Send SMS logic
  const sendSms = formData.get('sendSms') === 'true';
  if (sendSms) {
      const { sendDryingConfirmationSMS } = await import('@/lib/sms-event-actions');
      await sendDryingConfirmationSMS(recordId);
  }

  revalidatePath('/storage');
  return { message: `Drying finalized. Stock updated to ${finalBags} bags.`, success: true, recordId };
  } catch (error: any) {
      logError(error, {
          operation: 'finalizePlotDrying',
          metadata: {
              recordId: formData.get('recordId'),
              finalBags: formData.get('finalBags')
          }
      });
      return { message: `Failed to finalize drying: ${error.message}`, success: false };
  }
}

const InflowSchema = z.object({
  customerId: z.string().min(1, 'Customer is required.'),
  commodityDescription: z.string().min(2, 'Commodity description is required.'),
  location: z.string().optional(),
  storageStartDate: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid date format" }),
  bagsStored: z.coerce.number().int().nonnegative('Number of bags must be a non-negative number.').optional(),
  hamaliRate: z.coerce.number().nonnegative('Hamali rate must be a non-negative number.').optional(),
  hamaliPaid: z.coerce.number().nonnegative('Hamali paid must be a non-negative number.').optional(),
  lorryTractorNo: z.string().optional(),
  fatherName: z.string().optional(),
  village: z.string().optional(),
  // Support both Legacy UI and New DB Enum
  inflowType: z.enum(['Direct', 'Plot', 'purchase', 'transfer_in', 'return', 'other']).optional(),
  plotBags: z.coerce.number().nonnegative('Plot bags must be a non-negative number.').optional(),
  loadBags: z.coerce.number().optional(),
  khataAmount: z.coerce.number().nonnegative('Khata amount must be a non-negative number.').optional(),
  lotId: z.string().min(1, 'Lot selection is required.'),
  cropId: z.string().min(1, 'Crop selection is required.'),
  unloadingRecordId: z.string().optional(),
});

export type InflowFormState = {
  message: string;
  success: boolean;
  data?: Record<string, any>;
};

/**
 * Core server action to record a new inflow (deposit) of stock.
 * Validates input, checks warehouse capacity limit, performs security checks,
 * saves the initial record, and triggers an SMS notification if requested.
 * 
 * @param {InflowFormState} _prevState - Form state (provided by useActionState).
 * @param {FormData} formData - Data containing all inflow fields (customer, bags, lot, etc.).
 * @returns {Promise<InflowFormState>} Object indicating success or returning error messages.
 */
export async function addInflow(_prevState: InflowFormState, formData: FormData): Promise<InflowFormState> {
  return Sentry.startSpan(
      {
          op: "function",
          name: "addInflow",
      },
      async (span) => {
          const customerId = formData.get('customerId') as string;
          const sendSms = formData.get('sendSms') === 'true';
          await checkRateLimit(customerId || 'anon', 'addInflow', { limit: 10 });
          
          const rawData = {
              customerId: formData.get('customerId'),
              commodityDescription: formData.get('commodityDescription'),
              location: formData.get('location'),
              storageStartDate: formData.get('storageStartDate'),
              bagsStored: formData.get('bagsStored'),
              hamaliRate: formData.get('hamaliRate'),
              hamaliPaid: formData.get('hamaliPaid'),
              lorryTractorNo: formData.get('lorryTractorNo'),
              fatherName: formData.get('fatherName'),
              village: formData.get('village'),
              inflowType: formData.get('inflowType'),
              plotBags: formData.get('plotBags'),
              loadBags: formData.get('loadBags'),
              khataAmount: formData.get('khataAmount'),
              lotId: formData.get('lotId'),
              cropId: formData.get('cropId'),
              unloadingRecordId: formData.get('unloadingRecordId'),
          };

          // Start: Subscription Check
          const warehouseId = await getUserWarehouse();
          if (warehouseId) {
              const { checkSubscriptionLimits } = await import('@/services/subscription-service');
              const check = await checkSubscriptionLimits(warehouseId, 'add_record');
              if (!check.allowed) {
                   return { message: check.message || 'Subscription limit reached.', success: false };
              }
          }
          // End: Subscription Check
          span.setAttribute("customerId", rawData.customerId as string);
          span.setAttribute("lotId", rawData.lotId as string);

          const validatedFields = InflowSchema.safeParse(rawData);

          if (!validatedFields.success) {
              const error = validatedFields.error.flatten().fieldErrors;
              const message = Object.values(error).flat().join(', ');
              logWarning("Inflow validation failed", { operation: 'addInflow', metadata: { errors: error, customerId } });
              return { message: `Invalid data: ${message}`, success: false, data: rawData };
          }

          let { bagsStored, hamaliRate, hamaliPaid, storageStartDate, fatherName, village, plotBags, loadBags, inflowType, ...rest } = validatedFields.data;

          // Update customer if father's name or village was changed
          if (fatherName || village) {
              const customer = await getCustomer(rest.customerId);
              if (customer) {
                  const customerUpdate: Partial<typeof customer> = {};
                  if (fatherName && customer.fatherName !== fatherName) customerUpdate.fatherName = fatherName;
                  if (village && customer.village !== village) customerUpdate.village = village;
                  if (Object.keys(customerUpdate).length > 0) {
                      logger.debug("Plan to update customer details during inflow", { customerId: rest.customerId, updates: customerUpdate });
                      // await updateCustomer(rest.customerId, customerUpdate); 
                      // Note: updateCustomer is in actions/customers.ts now. 
                      // We can import it to use it properly if needed, but the original code had this commented out.
                  }
              }
          }

          let savedRecordId: string | undefined;

          try {
              let inflowBags = 0;
              if (inflowType === 'Plot') {
                  if (!plotBags || plotBags <= 0) {
                      logWarning("Invalid plot bags for plot inflow", { operation: 'addInflow', metadata: { customerId: rest.customerId } });
                      return { message: "Plot Bags must be a positive number for 'Plot' inflow.", success: false };
                  }
                  inflowBags = plotBags;
              } else { // 'Direct'
                  if (!bagsStored || bagsStored <= 0) {
                      logWarning("Invalid bags stored for direct inflow", { operation: 'addInflow', metadata: { customerId: rest.customerId } });
                      return { message: "Number of Bags must be a positive number for 'Direct' inflow.", success: false };
                  }
                  inflowBags = bagsStored;
              }
              span.setAttribute("inflowBags", inflowBags);

              // Capacity Check & Location Fetch
              let lotName = rest.location ?? '';
              if (rest.lotId) {
                  const supabase = await createClient();
                  const { data: lot } = await supabase.from('warehouse_lots').select('capacity, current_stock, name').eq('id', rest.lotId).single();
                  
                  if (lot) {
                      lotName = lot.name;
                      const capacity = lot.capacity || 1000;
                      const current = lot.current_stock || 0;
                      const available = capacity - current;
                      
                      if (inflowBags > available) {
                          logWarning("Lot capacity exceeded during inflow", { operation: 'addInflow', metadata: { lotId: rest.lotId, requested: inflowBags, available } });
                          return { 
                              message: `Lot is full! Available: ${available} bags. You tried to add ${inflowBags}.`, 
                              success: false,
                              data: rawData
                          };
                      }
                  }
              }

              // Calculate Hamali Payable (Inflow + Unloading Carry-over)
              let hamaliPayable = inflowBags * (hamaliRate || 0);

              // Add proportionate share from Unloading Record if selected
              if (rawData.unloadingRecordId && rawData.unloadingRecordId !== '_none_') {
                  const supabase = await createClient();
                  const { data: uRecord } = await supabase
                      .from('unloading_records')
                      .select('hamali_amount, bags_unloaded')
                      .eq('id', rawData.unloadingRecordId)
                      .single();
                  
                  if (uRecord && uRecord.hamali_amount && uRecord.bags_unloaded > 0) {
                      const costPerBag = uRecord.hamali_amount / uRecord.bags_unloaded;
                      const carryOverAmount = costPerBag * inflowBags;
                      hamaliPayable += carryOverAmount;
                      logger.info("Added unloading hamali carry-over", { 
                          inflowBags, 
                          costPerBag, 
                          carryOverAmount,
                          totalHamali: hamaliPayable 
                      });
                  }
              }
              const payments: Payment[] = [];
              if (hamaliPaid && hamaliPaid > 0) {
                  payments.push({ amount: hamaliPaid, date: new Date(storageStartDate), type: 'hamali' });
              }
              
              const newRecordId = await getNextInvoiceNumber('inflow');

              const finalPlotBags = (plotBags && plotBags > 0) ? plotBags : undefined;
              const finalLoadBags = (loadBags && loadBags > 0) ? loadBags : undefined;

              const newRecord: StorageRecord = {
                  ...rest,
                  id: newRecordId,
                  bagsIn: inflowBags,
                  bagsOut: 0,
                  bagsStored: inflowBags,
                  storageStartDate: new Date(storageStartDate),
                  storageEndDate: null,
                  billingCycle: '6m', // Default new records to 6m Enum
                  payments: payments,
                  hamaliPayable: hamaliPayable,
                  totalRentBilled: 0,
                  lorryTractorNo: rest.lorryTractorNo ?? '',
                  // Map Legacy Types to DB Enums
                  inflowType: (inflowType === 'Direct' || inflowType === 'purchase') ? 'purchase' : 
                              (inflowType === 'Plot' || inflowType === 'transfer_in') ? 'transfer_in' : 
                              (inflowType === 'return' || inflowType === 'other') ? inflowType : 'purchase',
                  plotBags: finalPlotBags,
                  loadBags: finalLoadBags,
                  location: lotName,
                  khataAmount: rest.khataAmount ?? 0,
                  lotId: rest.lotId,
                  cropId: rest.cropId,
                  notes: (rawData.unloadingRecordId && rawData.unloadingRecordId !== '_none_')
                      ? `Quick Inflow. Hamali: ₹${inflowBags * (hamaliRate || 0)} (Inflow) + ₹${Math.round(hamaliPayable - (inflowBags * (hamaliRate || 0)))} (Unloading Share).`
                      : undefined,
              };

              const savedRecord = await saveStorageRecord(newRecord);
              savedRecordId = savedRecord.id;

              // Check Lot Capacity for Alert (Low Stock / High Utilization)
              if (rest.lotId) {
                  const supabase = await createClient();
                  const { data: lot } = await supabase.from('warehouse_lots').select('capacity, current_stock, name').eq('id', rest.lotId).single();
                  if (lot && lot.capacity > 0) {
                      const utilization = (lot.current_stock || 0) / lot.capacity;
                      if (utilization >= 0.9) {
                           const { createNotification } = await import('@/lib/logger');
                           await createNotification(
                               'Lot Capacity Warning', 
                               `Lot ${lot.name} is at ${Math.round(utilization * 100)}% capacity.`, 
                               'warning', 
                               'stock' // Maps to 'low_stock_alert' preference
                           );
                      }
                  }
              }

              const { createNotification } = await import('@/lib/logger');
              await createNotification(
                   `Inflow Recorded`,
                   `Received ${inflowBags} bags (${rest.commodityDescription}) from customer`,
                   'info',
                   'inflow'
               );

              if (sendSms) {
                  const { sendInflowWelcomeSMS } = await import('@/lib/sms-event-actions');
                  await sendInflowWelcomeSMS(savedRecord.id, true);
              }

              logger.info("Inflow record created successfully", { recordId: savedRecord.id });
              revalidatePath('/storage');
          } catch (error: any) {
              logError(error, {
                  operation: 'addInflow',
                  metadata: { customerId: rest.customerId, commodity: rest.commodityDescription }
              });
              return { message: `Failed to create record: ${error.message || 'Unknown error'}`, success: false, data: rawData };
          }
          if (savedRecordId) {
              redirect(`/inflow/receipt/${savedRecordId}`);
          }
           return { message: "Inflow created but ID lost.", success: false }; // Should not happen
      }
  );
}
