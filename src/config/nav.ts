import { 
    LayoutDashboard, 
    Truck, 
    ArrowRight, 
    Users, 
    BarChart3, 
    Settings,
    HelpCircle,
    Package,
    IndianRupee,
    CreditCard,
    Shield,
    QrCode
} from 'lucide-react';

export const navItems = [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    // Admin Panel is platform-level (super_admin only). Owners manage their warehouse via /settings.
    { label: 'Admin Panel', href: '/admin', icon: Shield, roles: ['super_admin'] },
    { label: 'Inflow', href: '/inflow', icon: Truck },
    { label: 'Outflow', href: '/outflow', icon: ArrowRight },
    { label: 'Storage', href: '/storage', icon: Package },
    { label: 'Scan QR', href: '/scan', icon: QrCode },
    { label: 'Customers', href: '/customers', icon: Users },
    { label: 'Payments', href: '/payments/pending', icon: IndianRupee },
    { label: 'Expenses', href: '/expenses', icon: CreditCard },
    { label: 'Reports', href: '/reports', icon: BarChart3 },
];

export const bottomItems = [
    { label: 'Guide', href: '/guide', icon: HelpCircle },
    { label: 'Settings', href: '/settings', icon: Settings },
];
