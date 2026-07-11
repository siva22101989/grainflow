import { forwardRef } from 'react';
import { format } from 'date-fns';

interface ReceiptTemplateProps {
    data: any;
    type: 'inflow' | 'outflow' | 'bill';
}

export const ReceiptTemplate = forwardRef<HTMLDivElement, ReceiptTemplateProps>(({ data, type }, ref) => {
    // Basic Warehouse Info (Dynamic or Static based on requirements)
    // Ideally this comes from 'data.warehouse' or context. Assuming static or passed in data for now.
    // Basic Warehouse Info (Dynamic)
    const warehouseName = data.warehouseName || "Sai Cold Storage"; 
    const warehouseAddress = data.warehouseAddress || "Guntur, Andhra Pradesh";
    const gstNo = data.gstNo || data.gst_number || ""; // Display if available

    return (
        <div ref={ref} className="p-8 max-w-[800px] mx-auto text-black bg-white font-sans text-sm">
            {/* Header */}
            <div className="border-b-2 border-black pb-4 mb-6 flex justify-between items-start">
                <div>
                    <h1 className="text-2xl font-bold uppercase tracking-wider">{warehouseName}</h1>
                    <p className="text-gray-600 whitespace-pre-line">{warehouseAddress}</p>
                    {gstNo && <p className="text-xs mt-1 text-gray-500">GSTIN: {gstNo}</p>}
                </div>
                <div className="text-right">
                    <h2 className="text-xl font-bold text-gray-800 uppercase">
                        {type === 'inflow' ? 'Deposit Receipt' : type === 'outflow' ? 'Withdrawal Slip' : 'Invoice'}
                    </h2>
                    <p className="font-mono text-lg mt-1">#{data.recordNumber || data.id.slice(0, 8).toUpperCase()}</p>
                    <p className="text-gray-600">Date: {format(new Date(), 'dd MMM yyyy')}</p>
                </div>
            </div>

            {/* Customer Info */}
            <div className="grid grid-cols-2 gap-8 mb-8">
                <div>
                    <h3 className="font-bold text-gray-400 text-xs uppercase mb-1">Billed To</h3>
                    <p className="font-bold text-lg">{data.customerName || 'Customer'}</p>
                    {/* Optional: Add address/phone if available in data */}
                </div>
                <div className="text-right">
                    <h3 className="font-bold text-gray-400 text-xs uppercase mb-1">Details</h3>
                    <p><span className="font-medium">Commodity:</span> {data.commodityDescription || data.crops?.name || 'N/A'}</p>
                    <p><span className="font-medium">Lot ID:</span> {data.lotId || 'N/A'}</p>
                </div>
            </div>

            {/* Main Table */}
            <table className="w-full mb-8 border-collapse">
                <thead>
                    <tr className="border-b-2 border-black">
                        <th className="py-2 text-left font-bold uppercase text-xs">Description</th>
                        <th className="py-2 text-right font-bold uppercase text-xs">Quantity (Bags)</th>
                        <th className="py-2 text-right font-bold uppercase text-xs">Rate / Bag</th>
                        <th className="py-2 text-right font-bold uppercase text-xs">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    {/* Logic to display rows based on type */}
                    {type === 'inflow' && (
                        <tr>
                            <td className="py-3 border-b border-gray-100">Deposit: {data.commodityDescription}</td>
                            <td className="py-3 border-b border-gray-100 text-right">{data.bagsIn}</td>
                            <td className="py-3 border-b border-gray-100 text-right">-</td>
                            <td className="py-3 border-b border-gray-100 text-right">-</td>
                        </tr>
                    )}

                    {type === 'outflow' && (
                        <tr>
                            <td className="py-3 border-b border-gray-100">Withdrawal: {data.commodityDescription}</td>
                            <td className="py-3 border-b border-gray-100 text-right">{data.bagsOut || data.bags}</td>
                            <td className="py-3 border-b border-gray-100 text-right">-</td>
                            <td className="py-3 border-b border-gray-100 text-right">-</td>
                        </tr>
                    )}
                    
                     {type === 'bill' && (
                        <>
                            <tr>
                                <td className="py-3 border-b border-gray-100">Cold Storage Rent</td>
                                <td className="py-3 border-b border-gray-100 text-right">{data.bagsStored}</td>
                                <td className="py-3 border-b border-gray-100 text-right">₹{((data.totalRentBilled || 0) / (data.bagsStored || 1)).toFixed(2)}</td>
                                <td className="py-3 border-b border-gray-100 text-right">₹{data.totalRentBilled}</td>
                            </tr>
                             <tr>
                                <td className="py-3 border-b border-gray-100">Hamali Charges</td>
                                <td className="py-3 border-b border-gray-100 text-right">-</td>
                                <td className="py-3 border-b border-gray-100 text-right">-</td>
                                <td className="py-3 border-b border-gray-100 text-right">₹{data.hamaliPayable}</td>
                            </tr>
                            {((data as any).insurancePayable || 0) > 0 && (
                             <tr>
                                <td className="py-3 border-b border-gray-100">Insurance Charges</td>
                                <td className="py-3 border-b border-gray-100 text-right">-</td>
                                <td className="py-3 border-b border-gray-100 text-right">-</td>
                                <td className="py-3 border-b border-gray-100 text-right">₹{(data as any).insurancePayable}</td>
                            </tr>
                            )}
                        </>
                    )}

                    {/* Total Row */}
                    {type === 'bill' && (() => {
                        const totalPayable = (data.totalRentBilled || 0) + (data.hamaliPayable || 0) + ((data as any).insurancePayable || 0);
                        const totalPaid = ((data.payments || []) as any[]).reduce(
                          (s: number, p: any) => s + Number(p.amount || 0), 0
                        );
                        const balanceDue = Math.max(0, totalPayable - totalPaid);
                        const hasPayments = totalPaid > 0;
                        return (
                            <>
                                <tr className="font-bold text-lg">
                                    <td className="py-4 pt-6 text-right" colSpan={3}>Total Billed</td>
                                    <td className="py-4 pt-6 text-right">₹{totalPayable}</td>
                                </tr>
                                {hasPayments && (
                                    <>
                                        <tr className="text-green-700">
                                            <td className="py-2 text-right" colSpan={3}>Paid</td>
                                            <td className="py-2 text-right">₹{totalPaid}</td>
                                        </tr>
                                        <tr className={`font-bold text-lg ${balanceDue > 0 ? 'text-destructive' : 'text-green-700'}`}>
                                            <td className="py-3 text-right" colSpan={3}>{balanceDue > 0 ? 'Balance Due' : 'Fully Paid'}</td>
                                            <td className="py-3 text-right">₹{balanceDue}</td>
                                        </tr>
                                    </>
                                )}
                            </>
                        );
                    })()}
                </tbody>
            </table>

             {/* Footer */}
            <div className="grid grid-cols-2 gap-8 mt-12 pt-8 border-t-2 border-gray-100">
                <div className="text-xs text-gray-500">
                    <p className="font-bold uppercase text-gray-400 mb-2">Terms & Conditions</p>
                    <ol className="list-decimal pl-4 space-y-1">
                        <li>Goods stored at owner's risk.</li>
                        <li>Subject to Guntur jurisdiction.</li>
                        <li>Payment due within 15 days of invoice.</li>
                    </ol>
                </div>
                <div className="text-center">
                    <div className="h-16 mb-2"></div> {/* Space for stamp/sign */}
                    <p className="font-bold border-t border-gray-300 pt-2 inline-block px-8">Authorized Signatory</p>
                </div>
            </div>
            
            {/* Print Time Watermark */}
             <div className="fixed bottom-4 right-4 text-[10px] text-gray-300 print:block hidden">
                Generated via GrainFlow • {new Date().toLocaleString()}
            </div>
        </div>
    );
});

ReceiptTemplate.displayName = 'ReceiptTemplate';
