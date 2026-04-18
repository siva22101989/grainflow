'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EditCropDialog } from '@/components/lots/edit-crop-dialog';
import { DeleteCropButton } from '@/components/lots/delete-crop-button';
import { Plus, Wheat } from "lucide-react";
import { AddCropForm } from "@/components/lots/add-crop-form";
import { MobileCard } from "@/components/ui/mobile-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";

type CropTabProps = {
    crops: any[];
};

// Local SubmitButton removed in favor of shared component

export function CropSettingsTab({ crops }: CropTabProps) {
    return (
        <div className="grid gap-6">
             <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <CardTitle>Crop Configuration</CardTitle>
                            <CardDescription>Configure standard rates for varying crops.</CardDescription>
                        </div>
                        <Wheat className="w-8 h-8 text-muted-foreground opacity-20" />
                    </div>
                </CardHeader>
                <CardContent className="grid gap-6">
                    <div className="md:hidden space-y-4">
                        {crops.map((crop) => (
                            <MobileCard key={crop.id}>
                                <MobileCard.Header>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                                                <Wheat className="w-4 h-4" />
                                            </div>
                                            <MobileCard.Title>{crop.name}</MobileCard.Title>
                                            {crop.pricing_slabs?.mode === 'minimum_monthly' && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Min+Monthly</Badge>}
                                            {crop.pricing_slabs?.mode === 'slabs' && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Custom</Badge>}
                                        </div>
                                    </div>
                                    <MobileCard.Actions>
                                        <div className="flex items-center gap-1">
                                            <EditCropDialog 
                                                crop={{
                                                    id: crop.id,
                                                    name: crop.name,
                                                    rent_price_6m: crop.rent_price_6m,
                                                    rent_price_1y: crop.rent_price_1y,
                                                    pricing_slabs: crop.pricing_slabs
                                                }}
                                            />
                                            <DeleteCropButton 
                                                cropId={crop.id}
                                                cropName={crop.name}
                                            />
                                        </div>
                                    </MobileCard.Actions>
                                </MobileCard.Header>
                                <MobileCard.Content>
                                    <MobileCard.Row label="Rent (6M)" value={`₹${crop.rent_price_6m}`} />
                                    <MobileCard.Row label="Rent (1Y)" value={`₹${crop.rent_price_1y}`} />
                                </MobileCard.Content>
                            </MobileCard>
                        ))}
                        {(!crops || crops.length === 0) && (
                            <EmptyState
                                icon={Wheat}
                                title="No crops configured"
                                description="Add one below to get started."
                            />
                        )}
                    </div>

                    <div className="rounded-xl border bg-card hidden md:block">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[300px]">Crop Name</TableHead>
                                    <TableHead>Rent (6M)</TableHead>
                                    <TableHead>Rent (1Y)</TableHead>
                                    <TableHead className="w-[100px] text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {crops?.map((crop) => (
                                    <TableRow key={crop.id}>
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                                                    <Wheat className="w-4 h-4" />
                                                </div>
                                                {crop.name}
                                                {crop.pricing_slabs?.mode === 'minimum_monthly' && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Min+Monthly</Badge>}
                                                {crop.pricing_slabs?.mode === 'slabs' && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Custom</Badge>}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <span className="inline-flex items-center px-2 py-1 rounded-md bg-muted text-xs font-medium">
                                                ₹{crop.rent_price_6m}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                             <span className="inline-flex items-center px-2 py-1 rounded-md bg-muted text-xs font-medium">
                                                ₹{crop.rent_price_1y}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <EditCropDialog 
                                                    crop={{
                                                        id: crop.id,
                                                        name: crop.name,
                                                        rent_price_6m: crop.rent_price_6m,
                                                        rent_price_1y: crop.rent_price_1y
                                                    }}
                                                />
                                                <DeleteCropButton 
                                                    cropId={crop.id}
                                                    cropName={crop.name}
                                                />
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {(!crops || crops.length === 0) && (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                                            No crops configured. Add one below to get started.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    <div className="border-t pt-6">
                       <h3 className="mb-4 text-base font-medium flex items-center gap-2">
                           <Plus className="w-4 h-4 text-primary" /> Add New Crop
                       </h3>
                        <AddCropForm />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
