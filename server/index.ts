import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import { registerRoutes } from "./routes.ts";
import { setupVite, serveStatic, log } from "./vite.ts";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from '@supabase/supabase-js';
import { initializeEmailTransporter } from "./email-config.ts";

const app = express();
dotenv.config();


// Initialize Supabase client
let supabase: any = null;

try {
  console.log("🔍 Starting Supabase client initialization...");

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  console.log("🧩 Environment Variables Check:");
  console.log("  SUPABASE_URL:", supabaseUrl ? "✅ Found" : "❌ Missing");
  console.log("  SUPABASE_ANON_KEY:", supabaseAnonKey ? "✅ Found" : "❌ Missing");

  if (supabaseUrl && supabaseAnonKey) {
    console.log("🚀 Creating Supabase client...");
    supabase = createClient(supabaseUrl, supabaseAnonKey);
    console.log("✅ Supabase client successfully created!");
  } else {
    console.warn("⚠️ Missing environment variables. Supabase client not created.");
  }
} catch (error) {
  console.error("❌ Failed to initialize Supabase client:", error);
} finally {
  console.log("🧾 Supabase client status:", supabase ? "Initialized ✅" : "Not initialized ❌");
}


app.use(cors({
  origin: true,
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Authentication middleware
app.use(async (req: Request & { user?: any }, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    console.log('[AUTH-MIDDLEWARE] Token received, length:', token.length);
    
    // Try to decode JWT directly (works with anon key)
    try {
      // JWT format: header.payload.signature
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        console.log('[AUTH-MIDDLEWARE] 🔓 JWT decoded:', { sub: payload.sub, email: payload.email });
        console.log('[AUTH-MIDDLEWARE] 📋 Full payload:', JSON.stringify(payload, null, 2));
        
        if (payload.sub && payload.exp && payload.exp * 1000 > Date.now()) {
          req.user = { 
            id: payload.sub, 
            email: payload.email,
            role: payload.role 
          };
          console.log('[AUTH-MIDDLEWARE] ✅ User authenticated from JWT:', payload.sub);
        } else if (payload.exp && payload.exp * 1000 <= Date.now()) {
          console.log('[AUTH-MIDDLEWARE] ⚠️ Token expired');
        }
      }
    } catch (error) {
      console.log('[AUTH-MIDDLEWARE] ❌ JWT decode failed:', error);
      // Invalid token, continue without user
    }
  }
  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Handle favicon.ico to prevent 404 errors
app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

(async () => {
  // Initialize email transporter
  await initializeEmailTransporter();

  const server = await registerRoutes(app, supabase);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
if (process.env.NODE_ENV === "production") {
  // Serve static frontend files in production
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const buildPath = path.join(__dirname, "../dist/public");
  app.use(express.static(buildPath));

  // SPA catch-all
  app.get("*", (_req, res) => {
    res.sendFile(path.join(buildPath, "index.html"));
  });
} else {
  // Development: use Vite dev server
  await setupVite(app, server);
}


  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5005 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5005', 10);
  server.listen(port, '0.0.0.0', () => {
    log(`serving on port ${port}`);
  });
})();
