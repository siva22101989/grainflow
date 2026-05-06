'use client';

import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ExportButton } from "@/components/shared/export-button";
import { formatCurrency } from "@/lib/utils";
import {
    exportFinancialReportToExcel,
    exportUnloadingRegisterToExcel,
    exportHamaliRevenueToExcel,
    exportPendingBreakdownToExcel,
    exportUnloadingExpensesToExcel
} from "@/lib/export-utils";
import { 
    LineChart, Line, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import {
    TrendingUp, DollarSign,
    Clock, AlertCircle
} from "lucide-react";
import Link from "next/link";
import type { 
    RevenueMetrics, 
    MonthlyRevenue, 
    CustomerRevenue, 
    AgingAnalysis 
} from "@/lib/analytics";
import { ReportTable } from "@/components/reports/report-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";

interface Props {
    revenueMetrics: RevenueMetrics;
    monthlyTrends: MonthlyRevenue[];
    topCustomers: CustomerRevenue[];
    agingAnalysis: AgingAnalysis[];
    collectionMetrics: {
        collectionRate: number;
        averageDaysToPayment: number;
        totalCollected: number;
        totalBilled: number;
    };
    hamaliRecords: any[];
    unloadingRecords: any[];
    unloadingExpenses: any[];
    rentPendingBreakdown: any[];
    allowExport: boolean;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'];

export function FinancialDashboardClient({
    revenueMetrics,
    monthlyTrends,
    topCustomers,
    agingAnalysis,
    collectionMetrics,
    hamaliRecords,
    unloadingRecords,
    unloadingExpenses,
    rentPendingBreakdown,
    allowExport
}: Props) {
    // Format monthly trends for charts
    const chartData = monthlyTrends.map(m => ({
        month: new Date(m.month + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        Rent: m.rent,
        Hamali: m.hamali,
        Total: m.total
    }));

    // Format aging data for pie chart
    const agingChartData = agingAnalysis.map((a, i) => ({
        name: a.range,
        value: a.amount,
        count: a.count,
        fill: COLORS[i]
    }));

    const [activeTab, setActiveTab] = useState("overview");

    const handleExport = (format: 'excel' | 'pdf' = 'excel') => {
        if (activeTab === 'overview') {
            const exportData = {
                summary: [
                    { label: 'Total Revenue', value: revenueMetrics.totalRevenue },
                    { label: 'Rent Revenue', value: revenueMetrics.rentRevenue },
                    { label: 'Hamali Revenue', value: revenueMetrics.hamaliRevenue },
                    { label: 'Total Collected', value: revenueMetrics.totalPaid },
                    { label: 'Outstanding Dues', value: revenueMetrics.totalOutstanding },
                    { label: 'Collection Rate (%)', value: collectionMetrics.collectionRate },
                    { label: 'Avg Days to Payment', value: collectionMetrics.averageDaysToPayment }
                ],
                topCustomers: topCustomers.map(c => ({
                    name: c.customerName,
                    revenue: c.totalRevenue,
                    paid: c.amountPaid,
                    outstanding: c.outstanding
                })),
                aging: agingAnalysis.map(a => ({
                    range: a.range,
                    count: a.count,
                    amount: a.amount
                }))
            };
            exportFinancialReportToExcel(exportData, format);
        } else if (activeTab === 'unloading') {
            exportUnloadingRegisterToExcel(unloadingRecords, format);
        } else if (activeTab === 'hamali') {
            exportHamaliRevenueToExcel(hamaliRecords, format);
        } else if (activeTab === 'pending') {
            exportPendingBreakdownToExcel(rentPendingBreakdown, format);
        } else if (activeTab === 'expenses') {
            exportUnloadingExpensesToExcel(unloadingExpenses, format);
        }
    };
    const handleExportExcel = () => handleExport('excel');
    const handleExportPdf = () => handleExport('pdf');

    return (
        <>
            <PageHeader
                title="Financial Analytics"
                description="Comprehensive revenue tracking and financial insights"
                backHref="/reports"
            >
                {allowExport ? (
                    <ExportButton
                        onExportExcel={handleExportExcel}
                        onExportPdf={handleExportPdf}
                        label="Export Data"
                    />
                ) : (
                    <div className="hidden md:block text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                        Export unavailable on current plan
                    </div>
                )}
            </PageHeader>

            <Tabs defaultValue="overview" className="space-y-4" onValueChange={setActiveTab}>
                <TabsList className="w-full flex justify-start flex-wrap h-auto gap-1">
                    <TabsTrigger value="overview" className="flex-grow basis-[45%] md:basis-auto">Overview</TabsTrigger>
                    <TabsTrigger value="unloading" className="flex-grow basis-[45%] md:basis-auto">Unloading (Ops)</TabsTrigger>
                    <TabsTrigger value="hamali" className="flex-grow basis-[45%] md:basis-auto">Hamali (Rev)</TabsTrigger>
                    <TabsTrigger value="pending" className="flex-grow basis-[45%] md:basis-auto">Receivables</TabsTrigger>
                    <TabsTrigger value="expenses" className="flex-grow basis-[45%] md:basis-auto">Expenses</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                     {/* Key Metrics */}
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{formatCurrency(revenueMetrics.totalRevenue)}</div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Rent: {formatCurrency(revenueMetrics.rentRevenue)} | 
                                    Hamali: {formatCurrency(revenueMetrics.hamaliRevenue)}
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Collected</CardTitle>
                                <TrendingUp className="h-4 w-4 text-green-600" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-green-600">
                                    {formatCurrency(revenueMetrics.totalPaid)}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {collectionMetrics.collectionRate.toFixed(1)}% collection rate
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Outstanding Dues</CardTitle>
                                <AlertCircle className="h-4 w-4 text-destructive" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-destructive">
                                    {formatCurrency(revenueMetrics.totalOutstanding)}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Pending collection
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Avg. Days to Payment</CardTitle>
                                <Clock className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    {Math.round(collectionMetrics.averageDaysToPayment)} days
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Collection efficiency
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Revenue Trends Chart */}
                    <Card className="mb-6">
                        <CardHeader>
                            <CardTitle>Revenue Trends (Last 12 Months)</CardTitle>
                            <CardDescription>Monthly breakdown of Rent vs Hamali revenue</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={350}>
                                <LineChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="month" />
                                    <YAxis />
                                    <Tooltip 
                                        formatter={(value: number) => formatCurrency(value)}
                                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                                    />
                                    <Legend />
                                    <Line type="monotone" dataKey="Rent" stroke="#3b82f6" strokeWidth={2} />
                                    <Line type="monotone" dataKey="Hamali" stroke="#10b981" strokeWidth={2} />
                                    <Line type="monotone" dataKey="Total" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="5 5" />
                                </LineChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    <div className="grid gap-6 md:grid-cols-2 mb-6">
                        {/* Top Customers */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Top 10 Customers by Revenue</CardTitle>
                                <CardDescription>Highest revenue contributors</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {topCustomers.map((customer, index) => (
                                        <div key={customer.customerId} className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
                                                    {index + 1}
                                                </div>
                                                <div>
                                                    <Link 
                                                        href={`/customers/${customer.customerId}`}
                                                        className="font-medium hover:underline"
                                                    >
                                                        {customer.customerName}
                                                    </Link>
                                                    <p className="text-xs text-muted-foreground">
                                                        Paid: {formatCurrency(customer.amountPaid)}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-bold">{formatCurrency(customer.totalRevenue)}</div>
                                                {customer.outstanding > 0 && (
                                                    <p className="text-xs text-destructive">
                                                        Due: {formatCurrency(customer.outstanding)}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Aging Analysis */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Outstanding Dues Aging</CardTitle>
                                <CardDescription>Age distribution of pending payments</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={300}>
                                    <PieChart>
                                        <Pie
                                            data={agingChartData}
                                            cx="50%"
                                            cy="50%"
                                            labelLine={false}
                                            label={({ name, percent }) => 
                                                `${name}: ${(percent * 100).toFixed(0)}%`
                                            }
                                            outerRadius={100}
                                            fill="#8884d8"
                                            dataKey="value"
                                        >
                                            {agingChartData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.fill} />
                                            ))}
                                        </Pie>
                                        <Tooltip 
                                            formatter={(value: number) => formatCurrency(value)}
                                            contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="mt-4 space-y-2">
                                    {agingAnalysis.map((a, i) => (
                                        <div key={a.range} className="flex justify-between text-sm">
                                            <span className="flex items-center gap-2">
                                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                                                {a.range}
                                            </span>
                                            <span className="font-medium">
                                                {a.count} records · {formatCurrency(a.amount)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="unloading">
                    <ReportTable 
                        type="unloading-register" 
                        title="Unloading Register" 
                        description="Log of all unloading activities"
                        data={unloadingRecords}
                    />
                </TabsContent>

                <TabsContent value="hamali">
                    <ReportTable 
                        type="hamali-register" 
                        title="Hamali Revenue Reports" 
                        description="Revenue generated from Hamali charges"
                        records={hamaliRecords} // Pass as records since it's StorageRecord[]
                    />
                </TabsContent>

                <TabsContent value="pending">
                     <ReportTable 
                        type="rent-pending-breakdown" 
                        title="Rent & Hamali Pending Summary" 
                        description="Detailed breakdown of outstanding dues per customer"
                        data={rentPendingBreakdown}
                    />
                </TabsContent>

                <TabsContent value="expenses">
                     <ReportTable 
                        type="unloading-expenses" 
                        title="Unloading Expenses" 
                        description="Expenses categorized as Hamali/Unloading labor"
                        data={unloadingExpenses}
                    />
                </TabsContent>
            </Tabs>
        </>
    );
}

