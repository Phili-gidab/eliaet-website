// The ELIA website's startup file, for cPanel's "Setup Node.js App" (Phusion Passenger). The server itself is an ES
// module (server/dist/index.mjs, made by server/build.mjs, everything it needs inside it); this CommonJS file loads
// it, which every Passenger version can start. Passenger takes over the server's listen(): no port to set here.
import('./server/dist/index.mjs').catch((err) => {
  console.error('[elia] the server could not start:', err)
  process.exit(1)
})
