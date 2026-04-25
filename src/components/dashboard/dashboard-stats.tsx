'use client';

import Link from 'next/link';
import { Card, CardContent } from "@/components/ui/card";
import { Warehouse, Package, IndianRupee, Sun, AlertCircle } from "lucide-react";

interface DashboardStatsProps {
    metrics: {
        totalCapacity: number;
        totalStock: number;
        confirmedStock?: number;
        dryingBags?: number;
        dryingCount?: number;
        staleDryingCount?: number;
        occupancyRate: number;
        activeRecordsCount: number;
        pendingRevenue?: number;
    } | null;
}

export function DashboardStats({ metrics }: DashboardStatsProps) {
    if (!metrics) return null;

    // If there are records currently in drying, surface them as a top-line
    // metric. Otherwise hide the card and show "Active Records" instead so
    // owners without any drying activity get the standard 4-card layout.
    const dryingCount = metrics.dryingCount || 0;
    const dryingBags = metrics.dryingBags || 0;
    const confirmedStock = metrics.confirmedStock ?? metrics.totalStock;
    const showDryingCard = dryingCount > 0;

    const stats = [
        {
            title: "Confirmed Stock",
            value: `${confirmedStock.toLocaleString()} bags`,
            subValue: showDryingCard
                ? `${metrics.totalStock.toLocaleString()} total · ${dryingBags.toLocaleString()} drying`
                : `${metrics.occupancyRate.toFixed(1)}% Capacity`,
            icon: Package,
            color: "text-blue-600",
            bg: "bg-blue-100",
            href: '/storage',
        },
        showDryingCard
            ? {
                title: "In Drying",
                value: `${dryingBags.toLocaleString()} bags`,
                subValue:
                    (metrics.staleDryingCount || 0) > 0
                        ? `${dryingCount} record${dryingCount === 1 ? '' : 's'} · ${metrics.staleDryingCount} pending >7 days`
                        : `${dryingCount} record${dryingCount === 1 ? '' : 's'} pending finalization`,
                icon: (metrics.staleDryingCount || 0) > 0 ? AlertCircle : Sun,
                color: (metrics.staleDryingCount || 0) > 0 ? "text-red-600" : "text-amber-600",
                bg: (metrics.staleDryingCount || 0) > 0 ? "bg-red-100" : "bg-amber-100",
                href: '/storage?filter=drying',
            }
            : null,
        {
            title: "Available Space",
            value: `${(metrics.totalCapacity - metrics.totalStock).toLocaleString()} bags`,
            subValue: "Ready to fill",
            icon: Warehouse,
            color: "text-green-600",
            bg: "bg-green-100",
            href: '/storage',
        },
        {
            title: "Pending Revenue",
            value: `₹${(metrics.pendingRevenue || 0).toLocaleString()}`,
            subValue: "Outstanding",
            icon: IndianRupee,
            color: "text-orange-600",
            bg: "bg-orange-100",
            href: '/payments/pending',
        },
    ].filter(Boolean) as Array<{ title: string; value: string; subValue: string; icon: any; color: string; bg: string; href: string }>;

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat, index) => (
                <Link key={index} href={stat.href} className="block">
                    <Card className="overflow-hidden hover:shadow-lg transition-all duration-300 border-none shadow-sm group h-full">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between space-y-0 pb-2">
                                <div className={`p-3 rounded-xl ${stat.bg} ${stat.color} group-hover:scale-110 transition-transform`}>
                                    <stat.icon className="h-5 w-5" />
                                </div>
                            </div>
                            <div className="mt-4">
                                <h3 className="text-2xl font-bold tracking-tight">{stat.value}</h3>
                                <p className="text-sm text-muted-foreground mt-1 font-medium">{stat.title}</p>
                                <p className="text-xs text-muted-foreground mt-1 opacity-80">{stat.subValue}</p>
                            </div>
                        </CardContent>
                    </Card>
                </Link>
            ))}
        </div>
    );
}
