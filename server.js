const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
  // Import Express backend
  const { default: expressApp } = await import("./backend/index.ts");

  createServer((req, res) => {
    const parsedUrl = parse(req.url, true);

    // Route /v1/* to Express
    if (parsedUrl.pathname?.startsWith("/v1/") || parsedUrl.pathname === "/health") {
      expressApp(req, res);
    } else {
      handle(req, res, parsedUrl);
    }
  }).listen(port, () => {
    console.log(`\n> Ready on http://localhost:${port}`);
    console.log(`> API routes: /v1/*`);
    console.log(`> Health: /health\n`);
  });
});
