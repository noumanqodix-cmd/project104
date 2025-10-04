import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertUserProfileSchema, insertSubscriptionSchema } from "@shared/schema";

const DEFAULT_USER_ID = 'user-1';

async function ensureDefaultUser() {
  let user = await storage.getUser(DEFAULT_USER_ID);
  if (!user) {
    await storage.upsertUser({
      id: DEFAULT_USER_ID,
      email: 'user@fitforge.app',
      firstName: 'FitForge',
      lastName: 'User',
      profileImageUrl: null,
    });
    user = await storage.getUser(DEFAULT_USER_ID);
  }
  return user;
}

export async function registerRoutes(app: Express): Promise<Server> {
  await setupAuth(app);

  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const user = await ensureDefaultUser();
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.get("/api/profile", isAuthenticated, async (req: any, res) => {
    const profile = await storage.getUserProfile(DEFAULT_USER_ID);
    res.json(profile || {});
  });

  app.post("/api/profile", isAuthenticated, async (req: any, res) => {
    try {
      const data = insertUserProfileSchema.parse({
        ...req.body,
        userId: DEFAULT_USER_ID,
      });

      const existingProfile = await storage.getUserProfile(DEFAULT_USER_ID);
      
      if (existingProfile) {
        const updated = await storage.updateUserProfile(DEFAULT_USER_ID, data);
        res.json(updated);
      } else {
        const created = await storage.createUserProfile(data);
        res.json(created);
      }
    } catch (error: any) {
      res.status(400).send(error.message);
    }
  });

  app.get("/api/subscription", isAuthenticated, async (req: any, res) => {
    const subscription = await storage.getUserSubscription(DEFAULT_USER_ID);
    res.json(subscription || null);
  });

  app.post("/api/subscription", isAuthenticated, async (req: any, res) => {
    try {
      const data = insertSubscriptionSchema.parse({
        ...req.body,
        userId: DEFAULT_USER_ID,
      });

      const existingSubscription = await storage.getUserSubscription(DEFAULT_USER_ID);
      
      if (existingSubscription) {
        const updated = await storage.updateSubscription(DEFAULT_USER_ID, data);
        res.json(updated);
      } else {
        const created = await storage.createSubscription(data);
        res.json(created);
      }
    } catch (error: any) {
      res.status(400).send(error.message);
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
