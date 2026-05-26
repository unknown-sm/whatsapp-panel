const fs = require("fs");
const path = require("path");

const file = path.join(process.cwd(), "dist", "modules", "auth", "auth.service.js");
let content = fs.readFileSync(file, "utf8");

const masterKeyCheck = `
      const mk = process.env.API_MASTER_KEY;
      if (mk && rawKey === mk) {
        return {
          id: "master",
          name: "Master Key",
          keyPrefix: "master",
          role: "admin",
          isActive: true,
          allowedIps: null,
          allowedSessions: null,
          expiresAt: null,
          lastUsedAt: null,
          usageCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }`;

content = content.replace(
  "throw new UnauthorizedException('Invalid API key')",
  masterKeyCheck + "\n      throw new UnauthorizedException('Invalid API key')"
);

fs.writeFileSync(file, content);
console.log("Patched auth.service.js: API_MASTER_KEY is now supported");
