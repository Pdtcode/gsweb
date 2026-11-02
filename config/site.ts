export type SiteConfig = typeof siteConfig;

export const siteConfig = {
  name: "Grail Seekers",
  description: "Seek until you find",
  navItems: [
    {
      label: "Store",
      href: "/store",
    },
    {
      label: "About",
      href: "/about",
    },
  ],
  navMenuItems: [
    {
      label: "Store",
      href: "/store",
    },
    {
      label: "About",
      href: "/about",
    },
  ],
  links: {
    login: "/login",
  },
};
