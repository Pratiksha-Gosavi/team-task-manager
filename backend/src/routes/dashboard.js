const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');

const prisma = new PrismaClient();

router.get('/', auth, async (req, res) => {
  const userId = req.user.id;
  const now = new Date();

  try {
    const [myTasks, overdueTasks, statusCounts, recentProjects] = await Promise.all([
      // All tasks assigned to me
      prisma.task.findMany({
        where: { assignedToId: userId },
        include: {
          project: { select: { id: true, name: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      }),

      // Overdue tasks
      prisma.task.findMany({
        where: {
          assignedToId: userId,
          dueDate: { lt: now },
          status: { not: 'DONE' }
        },
        include: { project: { select: { id: true, name: true } } }
      }),

      // Count by status
      prisma.task.groupBy({
        by: ['status'],
        where: { assignedToId: userId },
        _count: { status: true }
      }),

      // My recent projects
      prisma.project.findMany({
        where: {
          OR: [
            { ownerId: userId },
            { members: { some: { userId } } }
          ]
        },
        include: { _count: { select: { tasks: true } } },
        orderBy: { createdAt: 'desc' },
        take: 5
      })
    ]);

    res.json({
      myTasks,
      overdueTasks,
      statusCounts,
      recentProjects,
      summary: {
        totalTasks: myTasks.length,
        overdue: overdueTasks.length,
        todo: statusCounts.find(s => s.status === 'TODO')?._count.status || 0,
        inProgress: statusCounts.find(s => s.status === 'IN_PROGRESS')?._count.status || 0,
        done: statusCounts.find(s => s.status === 'DONE')?._count.status || 0,
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;