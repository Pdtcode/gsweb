/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i.ibb.co",
        pathname: "/**", // Allow all paths from this hostname
      },
      {
        protocol: "https",
        hostname: "cdn.sanity.io",
        pathname: "/**", // Allow all paths from this hostname
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/**", // Allow all paths from this hostname
      },
    ],
  },
}

// Define allowed development origins
const devConfig = {
  allowedDevOrigins: ['local-origin.dev', '*.local-origin.dev', '*.ngrok-free.app'],
}

module.exports = {
  ...nextConfig,
  ...devConfig,
}