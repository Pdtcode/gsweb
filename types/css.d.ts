// Newer TypeScript checks side-effect imports, and Next.js only declares types
// for CSS modules, so the global stylesheet needs declaring here.
declare module "@/styles/globals.css";
