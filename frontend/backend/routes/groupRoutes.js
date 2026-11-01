const express = require("express");
const router = express.Router();
const Group = require("../models/Group");
const Message = require("../models/Message");
const User = require("../models/User");
const Notification = require("../models/Notification");
const authMiddleware = require("../middleware/auth");

// GET /api/groups - List all groups and direct conversations for the current user
router.get("/", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const organizationId = req.user.organizationId;
    const isAdmin = req.user.role === "admin";

    let filter;
    if (isAdmin) {
      // Admins see all org groups plus direct chats they participate in
      filter = {
        organizationId,
        $or: [
          { isDirectChat: false },
          { isDirectChat: true, directParticipants: userId },
        ],
      };
    } else {
      // Regular members see groups they are part of and their direct chats
      filter = {
        organizationId,
        $or: [
          { "members.userId": userId },
          { isDirectChat: true, directParticipants: userId },
        ],
      };
    }

    const groups = await Group.find(filter).sort({ updatedAt: -1 }).lean();

    // Compute unread message count and dynamically format direct chat titles
    const enhancedGroups = await Promise.all(
      groups.map(async (group) => {
        let displayName = group.name;
        let displayAvatar = group.avatar;
        let otherParticipant = null;

        if (group.isDirectChat) {
          const otherMember = group.members.find(
            (m) => m.userId.toString() !== userId.toString()
          );
          if (otherMember) {
            displayName = otherMember.name;
            otherParticipant = otherMember;
          }
        }

        // Count unread messages for current user
        const unreadCount = await Message.countDocuments({
          groupId: group._id,
          senderId: { $ne: userId },
          readBy: { $ne: userId },
        });

        return {
          ...group,
          displayName,
          displayAvatar,
          otherParticipant,
          unreadCount,
        };
      })
    );

    res.json(enhancedGroups);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/groups - Create a new team/group
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { name, description = "", memberIds = [] } = req.body;
    const userId = req.user.id;
    const organizationId = req.user.organizationId;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Group name is required." });
    }

    // Creator user record
    const creatorUser = await User.findById(userId);
    const creatorName = `${creatorUser.firstName} ${creatorUser.lastName}`.trim();

    // Unique members list starting with creator
    const membersMap = new Map();
    membersMap.set(userId.toString(), {
      userId: creatorUser._id,
      name: creatorName,
      email: creatorUser.email,
      role: "admin",
      joinedAt: new Date(),
    });

    // Add selected members from current organization
    if (Array.isArray(memberIds) && memberIds.length > 0) {
      const usersToAdd = await User.find({
        _id: { $in: memberIds },
        organizationId,
      });

      usersToAdd.forEach((u) => {
        const uId = u._id.toString();
        if (!membersMap.has(uId)) {
          membersMap.set(uId, {
            userId: u._id,
            name: `${u.firstName} ${u.lastName}`.trim(),
            email: u.email,
            role: "member",
            joinedAt: new Date(),
          });
        }
      });
    }

    const members = Array.from(membersMap.values());

    const group = await Group.create({
      name: name.trim(),
      description: description.trim(),
      organizationId,
      createdBy: userId,
      createdByName: creatorName,
      members,
      isDirectChat: false,
    });

    // Notify newly added members
    for (const member of members) {
      if (member.userId.toString() !== userId.toString()) {
        await Notification.create({
          userId: member.userId,
          organizationId,
          type: "group_added",
          title: "Added to New Group",
          message: `${creatorName} added you to the group "${group.name}".`,
          link: `/grouping?group=${group._id}`,
          metadata: { groupId: group._id },
        }).catch(() => {});
      }
    }

    res.status(201).json({
      message: "Group created successfully.",
      group: {
        ...group.toObject(),
        displayName: group.name,
        unreadCount: 0,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/groups/direct/:targetUserId - Find or create 1-on-1 direct conversation
router.post("/direct/:targetUserId", authMiddleware, async (req, res) => {
  try {
    const { targetUserId } = req.params;
    const userId = req.user.id.toString();
    const organizationId = req.user.organizationId;

    if (targetUserId === userId) {
      return res.status(400).json({ message: "Cannot create a direct conversation with yourself." });
    }

    const targetUser = await User.findOne({ _id: targetUserId, organizationId });
    if (!targetUser) {
      return res.status(404).json({ message: "Colleague not found in your organization." });
    }

    const currentUser = await User.findById(userId);

    // Check if direct conversation already exists
    let group = await Group.findOne({
      organizationId,
      isDirectChat: true,
      directParticipants: { $all: [userId, targetUserId] },
    });

    if (!group) {
      const currentName = `${currentUser.firstName} ${currentUser.lastName}`.trim();
      const targetName = `${targetUser.firstName} ${targetUser.lastName}`.trim();

      group = await Group.create({
        name: targetName,
        description: `Direct conversation between ${currentName} and ${targetName}`,
        organizationId,
        createdBy: userId,
        createdByName: currentName,
        isDirectChat: true,
        directParticipants: [userId, targetUserId],
        members: [
          {
            userId: currentUser._id,
            name: currentName,
            email: currentUser.email,
            role: "admin",
          },
          {
            userId: targetUser._id,
            name: targetName,
            email: targetUser.email,
            role: "member",
          },
        ],
      });
    }

    const otherMember = group.members.find((m) => m.userId.toString() !== userId);
    res.status(200).json({
      group: {
        ...group.toObject(),
        displayName: otherMember?.name || group.name,
        otherParticipant: otherMember,
        unreadCount: 0,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/groups/:id - Get single group details
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const group = await Group.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
    });

    if (!group) {
      return res.status(404).json({ message: "Group not found." });
    }

    const isMember = group.members.some(
      (m) => m.userId.toString() === req.user.id.toString()
    );
    if (!isMember && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied to this group." });
    }

    let displayName = group.name;
    let otherParticipant = null;
    if (group.isDirectChat) {
      const other = group.members.find(
        (m) => m.userId.toString() !== req.user.id.toString()
      );
      if (other) {
        displayName = other.name;
        otherParticipant = other;
      }
    }

    res.json({
      ...group.toObject(),
      displayName,
      otherParticipant,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/groups/:id - Update group details (name, description)
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const { name, description } = req.body;
    const group = await Group.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
    });

    if (!group) {
      return res.status(404).json({ message: "Group not found." });
    }

    const isGroupAdmin = group.members.some(
      (m) => m.userId.toString() === req.user.id.toString() && m.role === "admin"
    );
    const isCreator = group.createdBy.toString() === req.user.id.toString();
    const isAppAdmin = req.user.role === "admin";

    if (!isGroupAdmin && !isCreator && !isAppAdmin) {
      return res.status(403).json({ message: "Only group admins can edit group details." });
    }

    if (name && name.trim()) group.name = name.trim();
    if (description !== undefined) group.description = description.trim();

    await group.save();

    res.json({
      message: "Group updated successfully.",
      group: {
        ...group.toObject(),
        displayName: group.name,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/groups/:id/members - Add members to group
router.post("/:id/members", authMiddleware, async (req, res) => {
  try {
    const { memberIds = [] } = req.body;
    const group = await Group.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
    });

    if (!group) {
      return res.status(404).json({ message: "Group not found." });
    }

    if (group.isDirectChat) {
      return res.status(400).json({ message: "Cannot add members to a 1-on-1 direct conversation." });
    }

    const isGroupAdmin = group.members.some(
      (m) => m.userId.toString() === req.user.id.toString() && m.role === "admin"
    );
    const isCreator = group.createdBy.toString() === req.user.id.toString();
    const isAppAdmin = req.user.role === "admin";

    if (!isGroupAdmin && !isCreator && !isAppAdmin) {
      return res.status(403).json({ message: "Only group admins can add new members." });
    }

    const existingMemberIds = new Set(group.members.map((m) => m.userId.toString()));
    const newMemberIds = memberIds.filter((id) => !existingMemberIds.has(id.toString()));

    if (newMemberIds.length > 0) {
      const usersToAdd = await User.find({
        _id: { $in: newMemberIds },
        organizationId: req.user.organizationId,
      });

      const currentUserName = `${req.user.firstName} ${req.user.lastName}`.trim();

      for (const u of usersToAdd) {
        group.members.push({
          userId: u._id,
          name: `${u.firstName} ${u.lastName}`.trim(),
          email: u.email,
          role: "member",
          joinedAt: new Date(),
        });

        // Dispatch notification
        await Notification.create({
          userId: u._id,
          organizationId: req.user.organizationId,
          type: "group_added",
          title: "Added to Group",
          message: `${currentUserName} added you to the group "${group.name}".`,
          link: `/grouping?group=${group._id}`,
          metadata: { groupId: group._id },
        }).catch(() => {});
      }

      await group.save();
    }

    res.json({
      message: `Added ${newMemberIds.length} members to group.`,
      group: {
        ...group.toObject(),
        displayName: group.name,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/groups/:id/members/:targetUserId - Remove member from group
router.delete("/:id/members/:targetUserId", authMiddleware, async (req, res) => {
  try {
    const { id, targetUserId } = req.params;
    const currentUserId = req.user.id.toString();

    const group = await Group.findOne({
      _id: id,
      organizationId: req.user.organizationId,
    });

    if (!group) {
      return res.status(404).json({ message: "Group not found." });
    }

    if (group.isDirectChat) {
      return res.status(400).json({ message: "Cannot remove members from a 1-on-1 direct conversation." });
    }

    const isSelfLeaving = currentUserId === targetUserId;
    const isGroupAdmin = group.members.some(
      (m) => m.userId.toString() === currentUserId && m.role === "admin"
    );
    const isCreator = group.createdBy.toString() === currentUserId;
    const isAppAdmin = req.user.role === "admin";

    if (!isSelfLeaving && !isGroupAdmin && !isCreator && !isAppAdmin) {
      return res.status(403).json({ message: "You are not authorized to remove this member." });
    }

    group.members = group.members.filter((m) => m.userId.toString() !== targetUserId);
    await group.save();

    res.json({
      message: isSelfLeaving ? "You left the group." : "Member removed from group.",
      group: {
        ...group.toObject(),
        displayName: group.name,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/groups/:id/messages - Retrieve message history
router.get("/:id/messages", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const group = await Group.findOne({
      _id: id,
      organizationId: req.user.organizationId,
    });

    if (!group) {
      return res.status(404).json({ message: "Group not found." });
    }

    const isMember = group.members.some(
      (m) => m.userId.toString() === userId.toString()
    );
    if (!isMember && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied." });
    }

    const messages = await Message.find({ groupId: id })
      .sort({ createdAt: 1 })
      .limit(200)
      .lean();

    // Mark unread messages as read
    await Message.updateMany(
      {
        groupId: id,
        senderId: { $ne: userId },
        readBy: { $ne: userId },
      },
      {
        $addToSet: { readBy: userId },
      }
    );

    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/groups/:id/messages - Send a message with optional replyTo
router.post("/:id/messages", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { text, replyTo = null } = req.body;
    const userId = req.user.id;
    const organizationId = req.user.organizationId;

    if (!text || !text.trim()) {
      return res.status(400).json({ message: "Message text cannot be empty." });
    }

    const group = await Group.findOne({
      _id: id,
      organizationId,
    });

    if (!group) {
      return res.status(404).json({ message: "Group not found." });
    }

    const isMember = group.members.some(
      (m) => m.userId.toString() === userId.toString()
    );
    if (!isMember && req.user.role !== "admin") {
      return res.status(403).json({ message: "You are not a member of this conversation." });
    }

    const senderName = `${req.user.firstName} ${req.user.lastName}`.trim();
    const senderAvatar = req.user.profilePhoto || "";

    // Build reply metadata if present
    let replyPayload = null;
    if (replyTo && replyTo.text) {
      replyPayload = {
        messageId: replyTo.messageId || replyTo._id || null,
        senderName: replyTo.senderName || "User",
        text: replyTo.text.substring(0, 150),
      };
    }

    const message = await Message.create({
      groupId: id,
      organizationId,
      senderId: userId,
      senderName,
      senderAvatar,
      text: text.trim(),
      replyTo: replyPayload,
      readBy: [userId],
    });

    // Update group last message preview
    group.lastMessage = {
      text: text.trim().substring(0, 100),
      senderId: userId,
      senderName,
      timestamp: new Date(),
    };
    await group.save();

    // Create notifications for group members / direct partner
    if (group.isDirectChat) {
      const otherMember = group.members.find(
        (m) => m.userId.toString() !== userId.toString()
      );
      if (otherMember) {
        await Notification.create({
          userId: otherMember.userId,
          organizationId,
          type: "chat_message",
          title: `Message from ${senderName}`,
          message: text.trim().substring(0, 120),
          link: `/grouping?group=${group._id}`,
          metadata: { groupId: group._id, messageId: message._id },
        }).catch(() => {});
      }
    } else if (replyPayload && replyPayload.senderName && replyPayload.senderName !== senderName) {
      // Notify the person replied to
      const repliedMember = group.members.find((m) => m.name === replyPayload.senderName);
      if (repliedMember && repliedMember.userId.toString() !== userId.toString()) {
        await Notification.create({
          userId: repliedMember.userId,
          organizationId,
          type: "group_message",
          title: `Reply from ${senderName}`,
          message: `${senderName} replied to your message in ${group.name}: "${text.trim().substring(0, 80)}"`,
          link: `/grouping?group=${group._id}`,
          metadata: { groupId: group._id, messageId: message._id },
        }).catch(() => {});
      }
    }

    res.status(201).json({
      message: "Message sent.",
      chatMessage: message,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
