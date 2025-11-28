import { Request, Response } from "express";
import { User } from "../models/user.model";

export const getProfileController = async (req: Request, res: Response) => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const user = await User.findById(req.userId).select("-password");

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json(user);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const updateProfileController = async (req: Request, res: Response) => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { fullName } = req.body;
    const user = await User.findByIdAndUpdate(
      req.userId,
      { fullName },
      { new: true }
    ).select("-password");

    res.json(user);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
