const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

const prisma = new PrismaClient();

// GET tasks for a project
router.get('/project/:projectId', auth, async (req, res) => {
  try {
    const tasks = await prisma.task.findMany({
      where: { projectId: parseInt(req.params.projectId) },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST create task (ADMIN only)
router.post('/project/:projectId', auth, roleCheck('ADMIN'), [
  body('title').notEmpty().withMessage('Task title is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  const { title, description, assignedToId, dueDate } = req.body;

  try {
    const task = await prisma.task.create({
      data: {
        title,
        description,
        projectId: parseInt(req.params.projectId),
        createdById: req.user.id,
        assignedToId: assignedToId ? parseInt(assignedToId) : null,
        dueDate: dueDate ? new Date(dueDate) : null
      },
      include: {
        assignedTo: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } }
      }
    });
    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH update task status or assignment
router.patch('/:id', auth, async (req, res) => {
  const { status, assignedToId, title, description, dueDate } = req.body;

  // Members can only update status; Admins can update everything
  const updateData = {};
  if (status) updateData.status = status;
  if (req.user.role === 'ADMIN') {
    if (title) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (assignedToId !== undefined) updateData.assignedToId = assignedToId ? parseInt(assignedToId) : null;
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
  }

  try {
    const task = await prisma.task.update({
      where: { id: parseInt(req.params.id) },
      data: updateData,
      include: {
        assignedTo: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } }
      }
    });
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE task (ADMIN only)
router.delete('/:id', auth, roleCheck('ADMIN'), async (req, res) => {
  try {
    await prisma.task.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: 'Task deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;