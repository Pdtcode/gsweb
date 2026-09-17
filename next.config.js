const os = require("os");
const path = require("path");

/**
 * Next's file tracer (@vercel/nft) statically evaluates path expressions to
 * decide what to ship. google-gax — pulled in transitively by
 * @google-cloud/secret-manager — contains:
 *
 *   join(this.baseDirectory || os.homedir(), '.secureConnect', 'context_aware_metadata.json')
 *
 * The tracer cannot resolve `this.baseDirectory`, falls back to os.homedir(),
 * and treats the rest as a wildcard — so it globs the ENTIRE user profile
 * (C:\Users\<you>\**\*) hunting for assets. On Windows that walk reaches
 * ACL-protected folders such as AppData\Local\ElevatedDiagnostics and aborts
 * the build:
 *
 *   glob error [Error: EPERM: operation not permitted, scandir
 *     'C:\Users\<you>\AppData\Local\ElevatedDiagnostics']
 *   > Build failed because of webpack errors
 *
 * Even where it does not fail outright it costs minutes of wall clock and a lot
 * of memory. Nothing in the user profile is a build input, so the tracer is
 * told to skip it.
 *
 * Guarded deliberately: if the project itself lives under the home directory
 * (a checkout in C:\Users\<you>\projects\..., or a CI box whose workspace sits
 * under $HOME) this would ignore the project, so in that case tracing is left
 * alone. `traceIgnores` is internal to the plugin, hence the defensive checks —
 * if a future Next release renames it this quietly becomes a no-op.
 */
function ignoreHomeDirectoryInFileTracing(config) {
  const home = os.homedir();
  const fromHome = path.relative(home, __dirname);
  const projectIsInsideHome =
    fromHome !== "" && !fromHome.startsWith("..") && !path.isAbsolute(fromHome);

  if (projectIsInsideHome) return;

  const tracePlugin = config.plugins?.find(
    (plugin) => plugin?.constructor?.name === "TraceEntryPointsPlugin",
  );

  if (tracePlugin && Array.isArray(tracePlugin.traceIgnores)) {
    // picomatch expects forward slashes; path.sep keeps this correct on both
    // Windows and POSIX without embedding a literal separator here.
    tracePlugin.traceIgnores.push(home.split(path.sep).join("/") + "/**");
  }
}

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
  webpack: (config, { isServer }) => {
    // Exclude Windows protected directories from webpack scanning
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
    }

    // Add ignore patterns for Windows system directories
    config.watchOptions = {
      ...config.watchOptions,
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/AppData/**',
        '**/ElevatedDiagnostics/**',
      ],
    };

    // Server build only — the tracer runs solely for the Node.js server bundle.
    if (isServer) {
      ignoreHomeDirectoryInFileTracing(config);
    }

    return config;
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