import { Response } from "express";
import { Types } from "mongoose";
import Messages from "../model/chatting_model";
import { AuthRequest } from "../types/auth-request";

/**
 * SEND MESSAGE
 */
export const sendMessage = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const senderId = new Types.ObjectId(req.user.id);
    const { receiverId, content } = req.body;

    if (!receiverId || !content?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Receiver and content are required",
      });
    }

    if (!Types.ObjectId.isValid(receiverId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid receiver id",
      });
    }

    const message = await Messages.create({
      sender: senderId,
      receiver: new Types.ObjectId(receiverId),
      content: content.trim(),
    });

    return res.status(201).json({
      success: true,
      message: "Message sent",
      data: message,
    });
  } catch (error) {
    console.error("Send message error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

/**
 * GET MESSAGES
 */
export const getMessages = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const otherUserId = req.params.userId;

    if (!otherUserId) {
      return res.status(400).json({
        success: false,
        message: "User id is required",
      });
    }

    if (!Types.ObjectId.isValid(otherUserId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user id",
      });
    }

    const messages = await Messages.find({
      $or: [
        { sender: req.user.id, receiver: otherUserId },
        { sender: otherUserId, receiver: req.user.id },
      ],
    })
      .sort({ createdAt: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      messages,
    });
  } catch (error) {
    console.error("Get messages error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

/**
 * MARK READ
 */
export const markMessagesRead = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const { senderId } = req.body;

    if (!Types.ObjectId.isValid(senderId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid sender id",
      });
    }

    await Messages.updateMany(
      {
        sender: senderId,
        receiver: req.user.id,
        isRead: false,
      },
      { $set: { isRead: true } }
    );

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Mark read error:", error);
    return res.status(500).json({ success: false });
  }
};

export const getConversations = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false });
    }

    const userId = new Types.ObjectId(req.user.id);

    const conversations = await Messages.aggregate([
      {
        $match: {
          $or: [
            { sender: userId },
            { receiver: userId }
          ]
        }
      },
      {
        $addFields: {
          otherUser: {
            $cond: [
              { $eq: ["$sender", userId] },
              "$receiver",
              "$sender"
            ]
          }
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: "$otherUser",
          lastMessage: { $first: "$$ROOT" },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$receiver", userId] },
                    { $eq: ["$isRead", false] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user"
        }
      },
      { $unwind: "$user" }
    ]);

    return res.json({
      success: true,
      conversations
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
};
