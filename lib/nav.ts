import {
  type LucideIcon,
  Gauge,
  Tag,
  Database,
  Building2,
  SlidersHorizontal
} from "lucide-react";

export type NavItem = {
  title: string;
  url: string;
  icon?: LucideIcon;
  showSettingsIcon?: boolean;
};

export type NavGroup = {
  title: string;
  icon: LucideIcon;
  url: string;
  items: NavItem[];
};

// Dashboard entry removed; home is now the client icon
export const NAV_DASHBOARD: NavItem[] = [];

export const NAV_ACCOUNT: NavGroup[] = [];

export const NAV_MAIN: NavGroup[] = [
  {
    title: "Business Gauge",
    icon: Gauge,
    url: "/business-gauge",
    items: [
      { title: "Overview", url: "/business-gauge/overview" },
      { title: "Detailed", url: "/business-gauge/detailed" },
      { title: "Data Acquisition", url: "/business-gauge/data-acquisition", icon: Database },
    ],
  },
  {
    title: "Price Wise",
    icon: Tag,
    url: "/price-wise",
    items: [
      { title: "Overview", url: "/price-wise/overview" },
      { title: "Breakdown", url: "/price-wise/breakdown" },
      { title: "Data Acquisition", url: "/price-wise/data-acquisition", icon: Database },
    ],
  },
];

export const NAV_ORGANISATION: NavGroup[] = [
  {
    title: "Organisation",
    icon: Building2,
    url: "/organisation",
    items: [
      { title: "Overview", url: "/organisation/overview" },
      { title: "Breakdown", url: "/organisation/breakdown" },
      { title: "Configuration", url: "/organisation/configuration", icon: SlidersHorizontal },
    ],
  },
];

export function findTitleByUrl(pathname: string): string | undefined {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  const flat: NavItem[] = [
    ...NAV_DASHBOARD,
    ...NAV_MAIN.map((m) => ({ title: m.title, url: m.url })),
    ...NAV_MAIN.flatMap((m) => m.items),
    ...NAV_ORGANISATION.map((m) => ({ title: m.title, url: m.url })),
    ...NAV_ORGANISATION.flatMap((m) => m.items),
    ...NAV_ACCOUNT.map((p) => ({ title: p.title, url: p.url })),
    ...NAV_ACCOUNT.flatMap((p) => p.items),
  ];
  return flat.find((item) => item.url === normalized)?.title;
}

// Returns the matching group title and item title (if any) for a pathname.
export function findTitlesForPath(pathname: string): { group?: string; item?: string } | undefined {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  // Search main nav groups/items
  for (const group of NAV_MAIN) {
    if (normalized === group.url) {
      return { group: group.title };
    }
    for (const it of group.items) {
      if (normalized === it.url) {
        return { group: group.title, item: it.title };
      }
    }
    // Also consider nested routes under the group (e.g., /business-gauge/settings)
    if (normalized.startsWith(group.url + "/")) {
      return { group: group.title };
    }
  }
  for (const group of NAV_ORGANISATION) {
    if (normalized === group.url) {
      return { group: group.title };
    }
    for (const it of group.items) {
      if (normalized === it.url) {
        return { group: group.title, item: it.title };
      }
    }
    if (normalized.startsWith(group.url + "/")) {
      return { group: group.title };
    }
  }
  // Search account groups if ever used again
  for (const group of NAV_ACCOUNT) {
    if (normalized === group.url) {
      return { group: group.title };
    }
    for (const it of group.items) {
      if (normalized === it.url) {
        return { group: group.title, item: it.title };
      }
    }
    if (normalized.startsWith(group.url + "/")) {
      return { group: group.title };
    }
  }
  return undefined;
}
