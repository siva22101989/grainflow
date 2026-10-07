'use client';

import { TeamMember } from "@/lib/definitions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, Calendar, Shield, UserX, PenBox } from "lucide-react";
import { format } from "date-fns";
import { deactivateTeamMember, updateTeamMember } from "@/lib/actions/auth";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useTeamMembers } from '@/hooks/use-team-members';
import { WarehouseAccessManager } from "./warehouse-access-manager";

interface TeamMemberDetailsProps {
    member: TeamMember;
    currentUserRole?: string;
}

const roleHierarchy: Record<string, number> = {
    'super_admin': 100,
    'owner': 90,
    'admin': 80,
    'manager': 50,
    'staff': 10,
    'customer': 0
};

export function TeamMemberDetails({ member, currentUserRole = 'staff' }: TeamMemberDetailsProps) {
    const [isEditing, setIsEditing] = useState(false);
    const { toast } = useToast();
    const { refreshMembers } = useTeamMembers();

    const currentRank = roleHierarchy[currentUserRole] || 0;
    const targetRank = roleHierarchy[member.role] || 0;

    // Rule: Can only edit if my rank > target rank OR (I am owner/super_admin and target is anything). 
    // Strict hierarchy: My Rank MUST be greater than Target Rank to edit.
    // Exception: Self-edit? Usually handeled by Settings > Profile, not Team Manager.
    // Let's allow editing if Rank > Target.
    // AND: Admin cannot edit other Admins (Rank 80 vs 80 -> false). Good.
    const canEdit = currentRank > targetRank;

    if (isEditing) {
        return <EditMemberForm member={member} currentUserRole={currentUserRole} onCancel={() => setIsEditing(false)} onSuccess={refreshMembers} />;
    }

    return (
        <div className="p-6 space-y-8 animate-in fade-in-50 duration-300">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary/20">
                        <span className="text-2xl font-bold text-primary">
                            {member.fullName?.substring(0, 2).toUpperCase()}
                        </span>
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold">{member.fullName}</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="capitalize">
                                {member.role === 'super_admin' ? 'Super Admin' : member.role}
                            </Badge>
                            {member.role !== 'suspended' && (
                                <Badge variant="default" className="bg-green-500 hover:bg-green-600">Active</Badge>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    {canEdit && (
                        <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                            <PenBox className="w-4 h-4 mr-2" />
                            Edit Profile
                        </Button>
                    )}
                </div>
            </div>

            {/* Info Grid */}
            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Contact Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm">{member.email}</span>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Account Status</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm">Joined {format(new Date(member.createdAt), 'dd MMM yyyy')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Shield className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm capitalize">{member.role} Access</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Warehouse Access Management */}
            {(currentUserRole === 'owner' || currentUserRole === 'super_admin') && (
                <div className="pt-6 border-t">
                    <WarehouseAccessManager userId={member.id} />
                </div>
            )}

            {/* Danger Zone - Only if can edit */}
            {canEdit && (
                <div className="pt-6 border-t">
                    <h3 className="text-sm font-medium text-destructive mb-4">Danger Zone</h3>
                    <div className="flex items-center justify-between p-4 border border-destructive/20 rounded-lg bg-destructive/5">
                        <div>
                            <p className="font-medium text-destructive">Deactivate User Account</p>
                            <p className="text-sm text-muted-foreground">They will no longer be able to log in.</p>
                        </div>
                        <form action={async () => {
                             if(!confirm('Are you sure?')) return;
                             await deactivateTeamMember(member.id);
                             toast({ title: 'User Deactivated', variant: 'destructive' });
                             refreshMembers();
                        }}>
                            <Button variant="destructive" size="sm">
                                <UserX className="w-4 h-4 mr-2" />
                                Deactivate
                            </Button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

function EditMemberForm({ member, currentUserRole, onCancel, onSuccess }: { member: TeamMember, currentUserRole: string, onCancel: () => void, onSuccess: () => void }) {
    const { toast } = useToast();
    
    async function handleSubmit(formData: FormData) {
        const res = await updateTeamMember(member.id, formData);
        if (res.success) {
            toast({ title: 'Success', description: 'Member updated successfully', variant: 'success' });
            onSuccess();
            onCancel();
        } else {
            toast({ title: 'Error', description: res.message, variant: 'destructive' });
        }
    }
    
    // Determine selectable roles based on currentUserRole
    const showAdminOption = currentUserRole === 'owner' || currentUserRole === 'super_admin';

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Edit Team Member</h2>
                <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
            </div>
            
            <form action={handleSubmit} className="space-y-4">
                <div className="grid gap-2">
                    <Label>Full Name</Label>
                    <Input name="fullName" defaultValue={member.fullName} required />
                </div>
                
                <div className="grid gap-2">
                    <Label>Role</Label>
                    <Select name="role" defaultValue={member.role}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                             <SelectItem value="staff">Staff</SelectItem>
                             <SelectItem value="manager">Manager</SelectItem>
                             {showAdminOption && <SelectItem value="admin">Admin</SelectItem>}
                             {currentUserRole === 'super_admin' && <SelectItem value="owner">Owner</SelectItem>}
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex justify-end gap-2 mt-6">
                    <Button variant="outline" type="button" onClick={onCancel}>Cancel</Button>
                    <Button type="submit">Save Changes</Button>
                </div>
            </form>
        </div>
    );
}
