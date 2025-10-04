import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertUserProfileSchema, insertSubscriptionSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  await setupAuth(app);

  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.get("/api/profile", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const profile = await storage.getUserProfile(userId);
    res.json(profile || {});
  });

  app.post("/api/profile", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;

    try {
      const data = insertUserProfileSchema.parse({
        ...req.body,
        userId,
      });

      const existingProfile = await storage.getUserProfile(userId);
      
      if (existingProfile) {
        const updated = await storage.updateUserProfile(userId, data);
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
    const userId = req.user.claims.sub;
    const subscription = await storage.getUserSubscription(userId);
    res.json(subscription || { tier: 'free', isActive: 1 });
  });

  app.post("/api/subscription", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;

    try {
      const data = insertSubscriptionSchema.parse({
        ...req.body,
        userId,
      });

      const existingSubscription = await storage.getUserSubscription(userId);
      
      if (existingSubscription) {
        const updated = await storage.updateSubscription(userId, data);
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
