import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth routes
  app.post("/api/auth/signup", async (req: Request, res: Response) => {
    try {
      const { email, password, ...profileData } = req.body;
      
      const existingUser = await storage.getUserByUsername(email);
      if (existingUser) {
        return res.status(400).json({ error: "User already exists" });
      }

      const user = await storage.createUser({ username: email, password });
      
      if (Object.keys(profileData).length > 0) {
        await storage.updateUser(user.id, profileData);
      }

      (req as any).session.userId = user.id;
      const updatedUser = await storage.getUser(user.id);
      
      res.json(updatedUser);
    } catch (error) {
      console.error("Signup error:", error);
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  app.get("/api/auth/user", async (req: Request, res: Response) => {
    try {
      if (!(req as any).session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const user = await storage.getUser((req as any).session.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  app.put("/api/user/profile", async (req: Request, res: Response) => {
    try {
      if (!(req as any).session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const updates = req.body;
      const updatedUser = await storage.updateUser((req as any).session.userId, updates);
      
      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }

      const { password, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
