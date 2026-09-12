import { Router, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { generateFamilyChatReply } from '../services/gemini';
import { IGroup } from '../models/types';

const router = Router();

// GET /api/groups/available-users - list existing users to add as members
router.get('/available-users', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const allUsers = await db.users.listAll();
    const sanitized = allUsers.map((u) => ({
      _id: u._id,
      name: u.name,
      email: u.email,
      phoneNumber: u.phoneNumber || '',
      timeZone: u.timeZone || 'UTC',
    }));

    res.json({ users: sanitized });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/groups
router.get('/', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const groups = await db.groups.findForUser(req.user._id);

    // Hydrate members with user names
    const allUsers = await db.users.listAll();
    const userMap = new Map(allUsers.map((u) => [u._id, u.name]));

    const enriched = groups.map((g) => ({
      ...g,
      members: g.members.map((m) => ({
        ...m,
        name: userMap.get(m.userId) || 'Unknown Member',
      })),
    }));

    res.json({ groups: enriched });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/groups
router.post('/', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { name, description, type } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Group name is required' });
      return;
    }

    const group = await db.groups.create({
      name: name.trim(),
      description: description?.trim() || '',
      type: type || 'family',
      createdBy: req.user._id,
      members: [{ userId: req.user._id, role: 'admin', joinedAt: new Date().toISOString() }],
      inviteCode: crypto.randomBytes(3).toString('hex').toUpperCase(),
    });

    res.status(201).json({ group });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/groups/join
router.post('/join', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { inviteCode } = req.body;
    if (!inviteCode) {
      res.status(400).json({ error: 'Invite code is required' });
      return;
    }

    const group = await db.groups.findByInviteCode(inviteCode);
    if (!group) {
      res.status(404).json({ error: 'Invalid or expired invite code' });
      return;
    }

    const isMember = group.members.some((m) => m.userId === req.user!._id);
    if (isMember) {
      res.status(400).json({ error: 'You are already a member of this group' });
      return;
    }

    const updatedMembers = [
      ...group.members,
      {
        userId: req.user._id,
        role: 'member' as const,
        joinedAt: new Date().toISOString(),
      },
    ];

    const updated = await db.groups.update(group._id, { members: updatedMembers });

    // Notify group creator
    await db.notifications.create({
      userId: group.createdBy,
      title: 'New Member Joined',
      message: `${req.user.name} joined ${group.name} using the invite code.`,
      type: 'group_invite',
      refId: group._id,
    });

    res.json({ message: 'Successfully joined group', group: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/groups/:id
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const group = await db.groups.findById(req.params.id);
    if (!group) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }

    const isMember = group.members.some((m) => m.userId === req.user!._id);
    if (!isMember) {
      res.status(403).json({ error: 'Access denied. You are not a member of this group.' });
      return;
    }

    const allUsers = await db.users.listAll();
    const userMap = new Map(allUsers.map((u) => [u._id, u.name]));

    const enriched = {
      ...group,
      members: group.members.map((m) => ({
        ...m,
        name: userMap.get(m.userId) || 'Unknown Member',
      })),
    };

    res.json({ group: enriched });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/groups/:id - edit family name, description, type
router.patch('/:id', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { name, description, type } = req.body;
    if (name !== undefined && (!name || !name.trim())) {
      res.status(400).json({ error: 'Family name cannot be empty' });
      return;
    }

    const group = await db.groups.findById(req.params.id);
    if (!group) {
      res.status(404).json({ error: 'Family not found' });
      return;
    }

    // Check if requester is a member of this family
    const isMember = group.members.some((m) => m.userId === req.user!._id) || group.createdBy === req.user._id;
    if (!isMember) {
      res.status(403).json({ error: 'Only family members can update family details.' });
      return;
    }

    const updates: Partial<IGroup> = {};
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description.trim();
    if (type !== undefined) {
      const validTypes: Array<IGroup['type']> = ['family', 'work', 'personal', 'project', 'other'];
      const cleanType = type.trim().toLowerCase() as IGroup['type'];
      updates.type = validTypes.includes(cleanType) ? cleanType : 'family';
    }

    const updated = await db.groups.update(group._id, updates);

    // Hydrate members
    const allUsers = await db.users.listAll();
    const userMap = new Map(allUsers.map((u) => [u._id, u.name]));
    const enriched = {
      ...updated!,
      members: updated!.members.map((m) => ({
        ...m,
        name: userMap.get(m.userId) || 'Unknown Member',
      })),
    };

    res.json({
      message: 'Family updated successfully',
      group: enriched,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Also support PUT /api/groups/:id
router.put('/:id', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { name, description, type } = req.body;
    if (!name || !name.trim()) {
      res.status(400).json({ error: 'Family name cannot be empty' });
      return;
    }

    const group = await db.groups.findById(req.params.id);
    if (!group) {
      res.status(404).json({ error: 'Family not found' });
      return;
    }

    const isMember = group.members.some((m) => m.userId === req.user!._id) || group.createdBy === req.user._id;
    if (!isMember) {
      res.status(403).json({ error: 'Only family members can update family details.' });
      return;
    }

    const validTypes: Array<IGroup['type']> = ['family', 'work', 'personal', 'project', 'other'];
    const cleanType = type !== undefined ? (type.trim().toLowerCase() as IGroup['type']) : group.type;
    const resolvedType = validTypes.includes(cleanType) ? cleanType : group.type;

    const updated = await db.groups.update(group._id, {
      name: name.trim(),
      description: description !== undefined ? description.trim() : group.description,
      type: resolvedType,
    });

    const allUsers = await db.users.listAll();
    const userMap = new Map(allUsers.map((u) => [u._id, u.name]));
    const enriched = {
      ...updated!,
      members: updated!.members.map((m) => ({
        ...m,
        name: userMap.get(m.userId) || 'Unknown Member',
      })),
    };

    res.json({
      message: 'Family updated successfully',
      group: enriched,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/groups/:id/members - add an existing user as a member to a family
router.post('/:id/members', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { userId, email, role } = req.body;
    if (!userId && !email) {
      res.status(400).json({ error: 'Please provide the user ID or email of the existing user to add.' });
      return;
    }

    const group = await db.groups.findById(req.params.id);
    if (!group) {
      res.status(404).json({ error: 'Family group not found' });
      return;
    }

    // Check if requester is a member of this family
    const isMember = group.members.some((m) => m.userId === req.user!._id) || group.createdBy === req.user._id;
    if (!isMember) {
      res.status(403).json({ error: 'Only members of this family can add other members.' });
      return;
    }

    // Locate target existing user
    let targetUser = null;
    if (userId) {
      targetUser = await db.users.findById(userId);
    }
    if (!targetUser && email) {
      targetUser = await db.users.findByEmail(String(email).trim().toLowerCase());
    }

    if (!targetUser) {
      res.status(404).json({ error: 'Existing user not found. Please ensure they have registered an account.' });
      return;
    }

    // Check if the user is already a member of this specific family
    const alreadyMember = group.members.some((m) => m.userId === targetUser!._id);
    if (alreadyMember) {
      res.status(400).json({ error: `${targetUser.name} is already a member of ${group.name}.` });
      return;
    }

    const newRole: 'admin' | 'member' = role === 'admin' ? 'admin' : 'member';
    const updatedMembers = [
      ...group.members,
      {
        userId: targetUser._id,
        role: newRole,
        joinedAt: new Date().toISOString(),
      },
    ];

    const updated = await db.groups.update(group._id, { members: updatedMembers });

    // Notify the added user
    await db.notifications.create({
      userId: targetUser._id,
      title: 'Added to Family',
      message: `${req.user.name} added you as a ${newRole} to the "${group.name}" family.`,
      type: 'group_invite',
      refId: group._id,
    });

    // Hydrate members
    const allUsers = await db.users.listAll();
    const userMap = new Map(allUsers.map((u) => [u._id, u.name]));
    const enriched = {
      ...updated!,
      members: updated!.members.map((m) => ({
        ...m,
        name: userMap.get(m.userId) || 'Unknown Member',
      })),
    };

    res.status(201).json({
      message: `Successfully added ${targetUser.name} to ${group.name}!`,
      group: enriched,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/groups/:id/members/:memberId
router.delete('/:id/members/:memberId', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const group = await db.groups.findById(req.params.id);
    if (!group) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }

    const callerMembership = group.members.find((m) => m.userId === req.user!._id);
    if (!callerMembership || callerMembership.role !== 'admin') {
      res.status(403).json({ error: 'Only group admins can remove members.' });
      return;
    }

    const updatedMembers = group.members.filter((m) => m.userId !== req.params.memberId);
    const updated = await db.groups.update(group._id, { members: updatedMembers });

    res.json({ message: 'Member removed', group: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/groups/:id/messages - get chat messages for a family
router.get('/:id/messages', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const group = await db.groups.findById(req.params.id);
    if (!group) {
      res.status(404).json({ error: 'Family group not found' });
      return;
    }

    const isMember = group.members.some((m) => m.userId === req.user!._id) || group.createdBy === req.user._id;
    if (!isMember) {
      res.status(403).json({ error: 'You must be a member of this family to view chat messages.' });
      return;
    }

    const messages = await db.messages.findForGroup(group._id, 150);
    res.json({ messages });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/groups/:id/messages - send chat message between family members
router.post('/:id/messages', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { content, askElf } = req.body;
    if (!content || !content.trim()) {
      res.status(400).json({ error: 'Message content cannot be empty' });
      return;
    }

    const group = await db.groups.findById(req.params.id);
    if (!group) {
      res.status(404).json({ error: 'Family group not found' });
      return;
    }

    const isMember = group.members.some((m) => m.userId === req.user!._id) || group.createdBy === req.user._id;
    if (!isMember) {
      res.status(403).json({ error: 'You must be a member of this family to chat.' });
      return;
    }

    const userMessage = await db.messages.create({
      groupId: group._id,
      senderId: req.user._id,
      senderName: req.user.name,
      content: content.trim(),
      isAiElf: false,
    });

    const trimmedContent = content.trim();
    const shouldAskElf =
      askElf === true ||
      trimmedContent.toLowerCase().includes('@dobby') ||
      trimmedContent.toLowerCase().includes('@elf') ||
      trimmedContent.toLowerCase().includes('@assistant') ||
      trimmedContent.toLowerCase().startsWith('dobby,') ||
      trimmedContent.toLowerCase().startsWith('dobby ');

    let elfMessage = null;
    if (shouldAskElf) {
      try {
        const recentMessages = await db.messages.findForGroup(group._id, 8);
        const elfReply = await generateFamilyChatReply({
          familyName: group.name,
          senderName: req.user.name,
          userMessage: trimmedContent,
          recentMessages: recentMessages.map((m) => ({
            senderName: m.senderName,
            content: m.content,
            isAiElf: m.isAiElf,
          })),
        });

        elfMessage = await db.messages.create({
          groupId: group._id,
          senderId: 'ai-elf-dobby',
          senderName: 'Dobby (The AI Elf)',
          content: elfReply,
          isAiElf: true,
        });
      } catch (elfErr: any) {
        console.warn('Error generating Dobby response in family chat:', elfErr);
      }
    }

    // Retrieve all updated messages
    const allMessages = await db.messages.findForGroup(group._id, 150);

    res.status(201).json({
      message: 'Message sent',
      userMessage,
      elfMessage,
      messages: allMessages,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/groups/:id/messages/:messageId
router.delete('/:id/messages/:messageId', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const group = await db.groups.findById(req.params.id);
    if (!group) {
      res.status(404).json({ error: 'Family group not found' });
      return;
    }

    const isMember = group.members.some((m) => m.userId === req.user!._id) || group.createdBy === req.user._id;
    if (!isMember) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    await db.messages.delete(req.params.messageId);
    res.json({ message: 'Message deleted' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

