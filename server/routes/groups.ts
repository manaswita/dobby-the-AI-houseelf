import { Router, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

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

export default router;
