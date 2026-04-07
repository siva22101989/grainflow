'use client';

import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowRight, BookOpen, Truck, Wallet, Users, BarChart3, Settings, Shield, Check, Minus } from "lucide-react";

export default function GuidePage() {
  return (
    <>
      <PageHeader
        title="User Guide"
        description="Learn how to manage your warehouse effectively with Grain Flow."
        breadcrumbs={[
            { label: 'Dashboard', href: '/' },
            { label: 'Guide' }
        ]}
      />

      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Quick Start Card */}
        <Card className="bg-primary/5 border-primary/20">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-primary" />
                    Getting Started
                </CardTitle>
                <CardDescription>
                    Welcome to **Grain Flow**! This guide covers the core workflows to help you track stock and manage billing effortlessly.
                </CardDescription>
            </CardHeader>
        </Card>

        <Tabs defaultValue="setup" className="w-full">
            <TabsList className="grid w-full grid-cols-3 md:grid-cols-6 h-auto">
                <TabsTrigger value="setup" className="flex flex-col gap-1 p-3 data-[state=active]:bg-background">
                    <Settings className="h-4 w-4" />
                    Setup
                </TabsTrigger>
                <TabsTrigger value="inflow" className="flex flex-col gap-1 p-3 data-[state=active]:bg-background">
                    <Truck className="h-4 w-4" />
                    Inflow
                </TabsTrigger>
                <TabsTrigger value="outflow" className="flex flex-col gap-1 p-3 data-[state=active]:bg-background">
                    <ArrowRight className="h-4 w-4" />
                    Outflow
                </TabsTrigger>
                <TabsTrigger value="payments" className="flex flex-col gap-1 p-3 data-[state=active]:bg-background">
                    <Wallet className="h-4 w-4" />
                    Billing
                </TabsTrigger>
                <TabsTrigger value="customers" className="flex flex-col gap-1 p-3 data-[state=active]:bg-background">
                    <Users className="h-4 w-4" />
                    Customers
                </TabsTrigger>
                <TabsTrigger value="reports" className="flex flex-col gap-1 p-3 data-[state=active]:bg-background">
                    <BarChart3 className="h-4 w-4" />
                    Reports
                </TabsTrigger>
                <TabsTrigger value="roles" className="flex flex-col gap-1 p-3 data-[state=active]:bg-background">
                    <Shield className="h-4 w-4" />
                    Roles & Permissions
                </TabsTrigger>
            </TabsList>

            {/* Setup Section */}
            <TabsContent value="setup" className="mt-6 space-y-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Setting Up Your Warehouse</CardTitle>
                        <CardDescription>Your first step is to create a digital twin of your facility.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                         <div className="bg-muted/50 p-4 rounded-lg border">
                            <h3 className="font-semibold flex items-center gap-2 mb-2">
                                <Settings className="h-4 w-4" />
                                Create Warehouse
                            </h3>
                            <p className="text-sm text-muted-foreground mb-4">
                                If you see the "Welcome to RENT" screen, simply fill out the <strong>Create Warehouse</strong> form.
                            </p>
                            <ul className="list-disc pl-5 space-y-2 text-sm">
                                <li><strong>Name:</strong> Give your godown a recognizable name (e.g., "Main Unit").</li>
                                <li><strong>Location:</strong> Enter the city or village name.</li>
                                <li><strong>Capacity:</strong> Enter the total number of bags your warehouse can hold. This helps calculate occupancy percentage.</li>
                            </ul>
                        </div>
                        
                         <Accordion type="single" collapsible>
                            <AccordionItem value="setup-2">
                                <AccordionTrigger>Adding Team Members</AccordionTrigger>
                                <AccordionContent>
                                    Once your warehouse is created, go to <strong>Settings &gt; Team</strong> to invite managers or staff. You can control their permissions (e.g., View Only or Full Access).
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    </CardContent>
                </Card>
            </TabsContent>

            {/* Inflow Section */}
            <TabsContent value="inflow" className="mt-6 space-y-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Receiving Stock (Inflow)</CardTitle>
                        <CardDescription>How to record new arrivals at your warehouse.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Accordion type="single" collapsible>
                            <AccordionItem value="step-1">
                                <AccordionTrigger>1. Select a Customer</AccordionTrigger>
                                <AccordionContent>
                                    Go to the <strong>Inflow</strong> page. Search for an existing farmer/customer or create a new one instantly by clicking &quot;+ New Customer&quot;.
                                </AccordionContent>
                            </AccordionItem>
                            <AccordionItem value="step-2">
                                <AccordionTrigger>2. Enter Storage Details</AccordionTrigger>
                                <AccordionContent>
                                    <ul className="list-disc pl-5 space-y-2">
                                        <li><strong>Crop/Commodity:</strong> Choose the item (e.g., Paddy, Wheat).</li>
                                        <li><strong>Lot/Location:</strong> Assign a specific lot (e.g., Row A) to track capacity.</li>
                                        <li><strong>Bags:</strong> Enter the number of bags received.</li>
                                    </ul>
                                </AccordionContent>
                            </AccordionItem>
                            <AccordionItem value="step-3">
                                <AccordionTrigger>3. Handle Initial Payments</AccordionTrigger>
                                <AccordionContent>
                                    You can record initial charges like <strong>Hamali (Labor)</strong> directly on the inflow form. 
                                    Just enter the &quot;Paid Today&quot; amount, and the system will automatically create a payment record linked to this stock.
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                        <div className="bg-muted p-4 rounded-md text-sm">
                            <strong>Tip:</strong> The system automatically generates a readable Record ID (e.g., <code>REC-1001</code>) which you can write on the physical tag.
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>

            {/* Outflow Section */}
            <TabsContent value="outflow" className="mt-6 space-y-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Withdrawing Stock (Outflow)</CardTitle>
                        <CardDescription>Processing pickups and generating final bills.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                         <Accordion type="single" collapsible>
                            <AccordionItem value="out-1">
                                <AccordionTrigger>Partial vs Full Withdrawal</AccordionTrigger>
                                <AccordionContent>
                                    You don&apos;t have to withdraw everything at once! 
                                    <ul className="list-disc pl-5 mt-2 space-y-1">
                                        <li><strong>Partial:</strong> Withdraw 50 bags out of 100. The record stays active with 50 bags remaining.</li>
                                        <li><strong>Full:</strong> Withdraw all remaining bags to close the record and stop rent calculations.</li>
                                    </ul>
                                </AccordionContent>
                            </AccordionItem>
                            <AccordionItem value="out-2">
                                <AccordionTrigger>Audit Trail</AccordionTrigger>
                                <AccordionContent>
                                    Every withdrawal is logged in the <strong>Withdrawal Transactions</strong> ledger. Even if a record isn&apos;t fully closed, you can see the history of every bag taken out in the Reports section.
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    </CardContent>
                </Card>
            </TabsContent>

            {/* Billing Section */}
            <TabsContent value="payments" className="mt-6 space-y-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Payments & Rent</CardTitle>
                        <CardDescription>Understanding how billing works.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="border p-4 rounded-md">
                                <h4 className="font-semibold mb-2">Rent Calculation</h4>
                                <p className="text-sm text-muted-foreground">
                                    Rent is calculated based on the <strong>Storage Duration</strong>. 
                                    The system automatically determines if the stock has been stored for &lt; 6 months or &gt; 1 year and applies the correct rate defined in your settings.
                                </p>
                            </div>
                            <div className="border p-4 rounded-md">
                                <h4 className="font-semibold mb-2">Tracking Dues</h4>
                                <p className="text-sm text-muted-foreground">
                                    You can view a customer&apos;s <strong>Total Due</strong> on their profile page. This sums up unpaid rent across all their active records.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>

             {/* Customers Section */}
             <TabsContent value="customers" className="mt-6 space-y-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Customer Management</CardTitle>
                        <CardDescription>Managing your farmer/client database.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="mb-4">
                            The Customer Portal gives you a 360-degree view of each client:
                        </p>
                        <ul className="grid gap-2 text-sm">
                            <li className="flex items-center gap-2">
                                <span className="bg-blue-100 text-blue-700 p-1 rounded">Profile</span>
                                Edit contact details and address.
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="bg-green-100 text-green-700 p-1 rounded">History</span>
                                See every past transaction (In, Out, Paid).
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="bg-purple-100 text-purple-700 p-1 rounded">Statement</span>
                                Quickly check "Total Billed" vs "Total Paid".
                            </li>
                        </ul>
                    </CardContent>
                </Card>
            </TabsContent>
            
             {/* Reports Section */}
             <TabsContent value="reports" className="mt-6 space-y-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Reports & Insights</CardTitle>
                        <CardDescription>Track the health of your warehouse.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        Use the <strong>Reports</strong> tab to see:
                        <ul className="list-disc pl-5 mt-2 space-y-1">
                            <li><strong>Occupancy:</strong> How full are your lots?</li>
                            <li><strong>Financials:</strong> Total revenue collected vs pending dues.</li>
                            <li><strong>Transaction Log:</strong> A master list of all recent activity for auditing.</li>
                        </ul>
                    </CardContent>
                </Card>
            </TabsContent>

             {/* Roles Section */}
             <TabsContent value="roles" className="mt-6 space-y-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Roles & Permissions</CardTitle>
                        <CardDescription>Understanding who can do what in your warehouse.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-md border overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-muted/50 border-b">
                                        <th className="h-10 px-4 text-left font-medium">Feature / Action</th>
                                        <th className="h-10 px-4 text-center font-medium w-[100px]">Owner</th>
                                        <th className="h-10 px-4 text-center font-medium w-[100px]">Admin</th>
                                        <th className="h-10 px-4 text-center font-medium w-[100px]">Manager</th>
                                        <th className="h-10 px-4 text-center font-medium w-[100px]">Staff</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    <tr>
                                        <td className="p-4 font-medium">Manage Warehouse Settings</td>
                                        <td className="p-4 text-center"><Check className="mx-auto h-4 w-4 text-green-600" /></td>
                                        <td className="p-4 text-center"><Minus className="mx-auto h-4 w-4 text-muted-foreground" /></td>
                                        <td className="p-4 text-center"><Minus className="mx-auto h-4 w-4 text-muted-foreground" /></td>
                                        <td className="p-4 text-center"><Minus className="mx-auto h-4 w-4 text-muted-foreground" /></td>
                                    </tr>
                                    <tr>
                                        <td className="p-4 font-medium">Manage Team Members</td>
                                        <td className="p-4 text-center"><Check className="mx-auto h-4 w-4 text-green-600" /></td>
                                        <td className="p-4 text-center"><Check className="mx-auto h-4 w-4 text-green-600" /></td>
                                        <td className="p-4 text-center"><Minus className="mx-auto h-4 w-4 text-muted-foreground" /></td>
                                        <td className="p-4 text-center"><Minus className="mx-auto h-4 w-4 text-muted-foreground" /></td>
                                    </tr>
                                    <tr>
                                        <td className="p-4 font-medium">Backup & Export Data</td>
                                        <td className="p-4 text-center"><Check className="mx-auto h-4 w-4 text-green-600" /></td>
                                        <td className="p-4 text-center"><Minus className="mx-auto h-4 w-4 text-muted-foreground" /></td>
                                        <td className="p-4 text-center"><Minus className="mx-auto h-4 w-4 text-muted-foreground" /></td>
                                        <td className="p-4 text-center"><Minus className="mx-auto h-4 w-4 text-muted-foreground" /></td>
                                    </tr>
                                    <tr>
                                        <td className="p-4 font-medium">Manage Subscriptions</td>
                                        <td className="p-4 text-center"><Check className="mx-auto h-4 w-4 text-green-600" /></td>
                                        <td className="p-4 text-center"><Minus className="mx-auto h-4 w-4 text-muted-foreground" /></td>
                                        <td className="p-4 text-center"><Minus className="mx-auto h-4 w-4 text-muted-foreground" /></td>
                                        <td className="p-4 text-center"><Minus className="mx-auto h-4 w-4 text-muted-foreground" /></td>
                                    </tr>
                                    <tr>
                                        <td className="p-4 font-medium">Create/Edit Records (Inflow/Outflow)</td>
                                        <td className="p-4 text-center"><Check className="mx-auto h-4 w-4 text-green-600" /></td>
                                        <td className="p-4 text-center"><Check className="mx-auto h-4 w-4 text-green-600" /></td>
                                        <td className="p-4 text-center"><Check className="mx-auto h-4 w-4 text-green-600" /></td>
                                        <td className="p-4 text-center"><Check className="mx-auto h-4 w-4 text-green-600" /></td>
                                    </tr>
                                    <tr>
                                        <td className="p-4 font-medium">Accept Payments</td>
                                        <td className="p-4 text-center"><Check className="mx-auto h-4 w-4 text-green-600" /></td>
                                        <td className="p-4 text-center"><Check className="mx-auto h-4 w-4 text-green-600" /></td>
                                        <td className="p-4 text-center"><Check className="mx-auto h-4 w-4 text-green-600" /></td>
                                        <td className="p-4 text-center"><Check className="mx-auto h-4 w-4 text-green-600" /></td>
                                    </tr>
                                    <tr>
                                        <td className="p-4 font-medium">Delete Records</td>
                                        <td className="p-4 text-center"><Check className="mx-auto h-4 w-4 text-green-600" /></td>
                                        <td className="p-4 text-center"><Check className="mx-auto h-4 w-4 text-green-600" /></td>
                                        <td className="p-4 text-center"><Minus className="mx-auto h-4 w-4 text-muted-foreground" /></td>
                                        <td className="p-4 text-center"><Minus className="mx-auto h-4 w-4 text-muted-foreground" /></td>
                                    </tr>
                                    <tr>
                                        <td className="p-4 font-medium">View Financial Reports</td>
                                        <td className="p-4 text-center"><Check className="mx-auto h-4 w-4 text-green-600" /></td>
                                        <td className="p-4 text-center"><Check className="mx-auto h-4 w-4 text-green-600" /></td>
                                        <td className="p-4 text-center"><Check className="mx-auto h-4 w-4 text-green-600" /></td>
                                        <td className="p-4 text-center"><Minus className="mx-auto h-4 w-4 text-muted-foreground" /></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>

        {/* FAQ Section */}
        <Card>
            <CardHeader>
                <CardTitle>Frequently Asked Questions</CardTitle>
            </CardHeader>
            <CardContent>
                <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="faq-1">
                        <AccordionTrigger>How is rent calculated?</AccordionTrigger>
                        <AccordionContent>
                            Rent is calculated per bag based on storage duration. <strong>0-6 months: Rs. 36/bag</strong>, <strong>7-12 months: Rs. 55/bag</strong>. Even 1 day into a new month counts as a full month. For storage beyond 12 months, each additional year follows the same tiered structure.
                        </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="faq-2">
                        <AccordionTrigger>What is Bulk Outflow and how does FIFO work?</AccordionTrigger>
                        <AccordionContent>
                            Bulk Outflow lets you withdraw bags across multiple storage records in one operation. The system uses <strong>FIFO (First-In, First-Out)</strong>: it withdraws from the oldest records first. This ensures customers are charged fairly based on actual storage duration. You can preview the allocation before confirming.
                        </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="faq-3">
                        <AccordionTrigger>What is Hamali?</AccordionTrigger>
                        <AccordionContent>
                            Hamali refers to labor charges for loading and unloading bags at the warehouse. You can set the hamali rate per bag during inflow, and it is tracked separately from storage rent. Hamali can be collected at inflow or during outflow.
                        </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="faq-4">
                        <AccordionTrigger>Can my customers see their own records?</AccordionTrigger>
                        <AccordionContent>
                            Yes! Customers can access the <strong>Customer Portal</strong> using their phone number. They get a read-only view of their active stock, withdrawal history, payments, and outstanding balance. They cannot modify any records.
                        </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="faq-5">
                        <AccordionTrigger>What happens if I accidentally delete a record?</AccordionTrigger>
                        <AccordionContent>
                            GrainFlow uses <strong>soft deletes</strong>. Deleted records are marked as removed but not physically erased. Contact your admin or super admin to restore accidentally deleted records.
                        </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="faq-6">
                        <AccordionTrigger>Why can&apos;t I see any records after logging in?</AccordionTrigger>
                        <AccordionContent>
                            You need to be assigned to a warehouse. Ask your admin to add you via <strong>Settings &gt; Team</strong>. If you are assigned but still see nothing, check that you are viewing the correct warehouse using the warehouse switcher in the sidebar.
                        </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="faq-7">
                        <AccordionTrigger>How do I export data to Excel?</AccordionTrigger>
                        <AccordionContent>
                            Most data tables have an <strong>Export</strong> button in the top-right corner. Click it to download the current view as an Excel (.xlsx) file. You can also generate PDF reports from the Reports section.
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </CardContent>
        </Card>

        <div className="flex justify-center pt-8">
            <p className="text-muted-foreground text-sm">
                Need more help? Contact support or check the full documentation in the docs/manual/ directory.
            </p>
        </div>
      </div>
    </>
  );
}
