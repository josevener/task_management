const express = require('express');
const { prisma } = require('../config/database');
const { attachCurrentUser, requireAuth, checkPermission } = require('../middleware/auth');
const { asyncHandler } = require('../utils/async-handler');
const { sendError, sendSuccess, sendValidationError } = require('../utils/responses');
const { runSerializableTransaction } = require('../utils/serializable-transaction');
const { isValidDate } = require('../utils/validation');
const sseManager = require('../utils/sse-manager');

const tasksRouter = express.Router();

tasksRouter.use(attachCurrentUser, requireAuth);

async function getTaskTags(taskId) {
  const normalizedTaskId = Number(taskId);
  if (!Number.isSafeInteger(normalizedTaskId)) {
    throw new Error('Task tag lookup requires a valid task ID');
  }

  const assignments = await prisma.taskTagAssignment.findMany({
    where: { taskId: normalizedTaskId },
    include: { tag: true }
  });
  return assignments.map((a) => ({
    id: a.tag.id,
    name: a.tag.name,
    color: a.tag.color
  }));
}

async function isWorkspaceMember(workspaceId, userId) {
  const member = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId: parseInt(workspaceId, 10),
      userId: parseInt(userId, 10)
    },
    select: { id: true }
  });
  return Boolean(member);
}

function taskParentValidationError(message) {
  const error = new Error(message);
  error.validationErrors = { parent_task_id: message };
  return error;
}

async function validateParentTask(tx, existingTask, parentTaskId) {
  let parentTask = await tx.task.findFirst({
    where: {
      id: parentTaskId,
      projectId: existingTask.projectId
    },
    select: { id: true, parentTaskId: true }
  });

  if (!parentTask) {
    throw taskParentValidationError('Parent task must belong to the same project');
  }

  const visitedParentIds = new Set();
  while (parentTask) {
    if (parentTask.id === existingTask.id || visitedParentIds.has(parentTask.id)) {
      throw taskParentValidationError('Parent task cannot create a circular hierarchy');
    }
    visitedParentIds.add(parentTask.id);

    if (!parentTask.parentTaskId) {
      break;
    }

    parentTask = await tx.task.findFirst({
      where: {
        id: parentTask.parentTaskId,
        projectId: existingTask.projectId
      },
      select: { id: true, parentTaskId: true }
    });

    if (!parentTask) {
      throw taskParentValidationError('Parent task must belong to the same project');
    }
  }
}

function mapTask(t) {
  if (!t) return null;
  return {
    id: t.id,
    project_id: t.projectId,
    parent_task_id: t.parentTaskId,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    assignee_id: t.assigneeId,
    assigned_by: t.assignedBy,
    start_date: t.startDate,
    due_date: t.dueDate,
    position: t.position,
    created_by: t.createdBy,
    created_at: t.createdAt,
    updated_at: t.updatedAt,
    assignee_first_name: t.assignee?.firstName || null,
    assignee_last_name: t.assignee?.lastName || null,
    assignee_email: t.assignee?.email || null,
    creator_first_name: t.creator?.firstName || null,
    creator_last_name: t.creator?.lastName || null,
    creator_email: t.creator?.email || null,
    assigner_first_name: t.assignedByUser?.firstName || null,
    assigner_last_name: t.assignedByUser?.lastName || null,
    project_name: t.project?.name || null,
    tags: t.tags || []
  };
}

tasksRouter.get('/', asyncHandler(async (req, res) => {
  const where = {};

  if (req.query.project_id) {
    const project = await prisma.project.findFirst({
      where: {
        id: parseInt(req.query.project_id, 10),
        workspace: {
          members: {
            some: {
              userId: req.currentUser.id
            }
          }
        }
      },
      select: { id: true }
    });

    if (!project) {
      return sendError(res, 'Project access denied', 403);
    }

    where.projectId = parseInt(req.query.project_id, 10);
  } else if (req.query.workspace_id) {
    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: parseInt(req.query.workspace_id, 10),
        userId: req.currentUser.id
      },
      select: { role: true }
    });

    if (!workspaceMember) {
      return sendError(res, 'Workspace access denied', 403);
    }

    where.project = {
      workspaceId: parseInt(req.query.workspace_id, 10)
    };
  } else {
    where.project = {
      workspace: {
        members: {
          some: {
            userId: req.currentUser.id
          }
        }
      }
    };
  }

  if (Object.prototype.hasOwnProperty.call(req.query, 'parent_task_id')) {
    if (req.query.parent_task_id === '') {
      where.parentTaskId = null;
    } else {
      where.parentTaskId = parseInt(req.query.parent_task_id, 10);
    }
  }

  if (req.query.status) {
    where.status = req.query.status;
  }

  if (req.query.assignee_id) {
    where.assigneeId = parseInt(req.query.assignee_id, 10);
  }

  const tasksDb = await prisma.task.findMany({
    where,
    include: {
      assignee: true,
      creator: true,
      assignedByUser: true,
      project: {
        select: {
          name: true
        }
      }
    },
    orderBy: [
      { position: 'asc' },
      { createdAt: 'desc' }
    ]
  });

  const tasks = [];
  for (const t of tasksDb) {
    const mapped = mapTask(t);
    mapped.tags = await getTaskTags(t.id);
    tasks.push(mapped);
  }

  return sendSuccess(res, { tasks });
}));

tasksRouter.get('/:id', asyncHandler(async (req, res) => {
  const taskDb = await prisma.task.findFirst({
    where: {
      id: parseInt(req.params.id, 10),
      project: {
        workspace: {
          members: {
            some: {
              userId: req.currentUser.id
            }
          }
        }
      }
    },
    include: {
      assignee: true,
      creator: true,
      assignedByUser: true,
      project: {
        select: {
          name: true
        }
      }
    }
  });

  if (!taskDb) {
    return sendError(res, 'Task not found or access denied', 404);
  }

  const task = mapTask(taskDb);
  task.tags = await getTaskTags(taskDb.id);

  return sendSuccess(res, { task });
}));

tasksRouter.post('/', asyncHandler(async (req, res) => {
  const project_id = req.body.project_id;
  const parent_task_id = req.body.parent_task_id || null;
  const title = String(req.body.title || '').trim();
  const description = String(req.body.description || '').trim();
  const status = req.body.status || 'todo';
  const priority = req.body.priority || 'medium';
  const assignee_id = req.body.assignee_id || null;
  const start_date = req.body.start_date || null;
  const due_date = req.body.due_date || null;
  const tags = Array.isArray(req.body.tags) ? req.body.tags : [];
  const errors = {};

  if (!project_id) {
    errors.project_id = 'Project ID is required';
  }
  if (!title) {
    errors.title = 'Task title is required';
  } else if (title.length > 500) {
    errors.title = 'Task title must be 500 characters or less';
  }
  if (!['todo', 'in_progress', 'review', 'done', 'cancelled'].includes(status)) {
    errors.status = 'Invalid status. Must be one of: todo, in_progress, review, done, cancelled';
  }
  if (!['low', 'medium', 'high', 'urgent'].includes(priority)) {
    errors.priority = 'Invalid priority. Must be one of: low, medium, high, urgent';
  }
  if (!isValidDate(start_date)) {
    errors.start_date = 'Invalid start date format';
  }
  if (!isValidDate(due_date)) {
    errors.due_date = 'Invalid due date format';
  }

  const project = project_id ? await prisma.project.findFirst({
    where: {
      id: parseInt(project_id, 10),
      workspace: {
        members: {
          some: {
            userId: req.currentUser.id
          }
        }
      }
    },
    select: {
      id: true,
      workspaceId: true,
      name: true
    }
  }) : null;

  if (project_id) {
    if (!project) {
      errors.project_id = 'Project access denied';
    } else {
      const canCreate = await checkPermission(project.workspaceId, req.currentUser.id, 'tasks:create');
      if (!canCreate) {
        errors.project_id = 'You do not have permission to create tasks in this workspace';
      }
    }
  }

  if (parent_task_id) {
    const parentTask = await prisma.task.findFirst({
      where: {
        id: parseInt(parent_task_id, 10),
        projectId: parseInt(project_id, 10)
      },
      select: { id: true }
    });

    if (!parentTask) {
      errors.parent_task_id = 'Parent task not found or belongs to different project';
    }
  }

  if (assignee_id && project) {
    const assigneeIsMember = await isWorkspaceMember(project.workspaceId, assignee_id);
    if (!assigneeIsMember) {
      errors.assignee_id = 'Assignee must be a member of this workspace';
    }
  }

  if (Object.keys(errors).length > 0) {
    return sendValidationError(res, errors);
  }

  const task = await prisma.$transaction(async (tx) => {
    const aggregate = await tx.task.aggregate({
      where: {
        projectId: parseInt(project_id, 10),
        parentTaskId: parent_task_id ? parseInt(parent_task_id, 10) : null
      },
      _max: {
        position: true
      }
    });

    const position = (aggregate._max.position || 0) + 1;

    const newTask = await tx.task.create({
      data: {
        projectId: parseInt(project_id, 10),
        parentTaskId: parent_task_id ? parseInt(parent_task_id, 10) : null,
        title,
        description: description || null,
        status,
        priority,
        assigneeId: assignee_id ? parseInt(assignee_id, 10) : null,
        assignedBy: assignee_id ? req.currentUser.id : null,
        startDate: start_date ? new Date(start_date) : null,
        dueDate: due_date ? new Date(due_date) : null,
        position,
        createdBy: req.currentUser.id
      }
    });

    for (const tagId of tags) {
      const tag = await tx.taskTag.findFirst({
        where: {
          id: parseInt(tagId, 10),
          workspaceId: project.workspaceId
        },
        select: { id: true }
      });

      if (tag) {
        await tx.taskTagAssignment.create({
          data: {
            taskId: newTask.id,
            tagId: tag.id
          }
        });
      }
    }

    await tx.taskFollower.create({
      data: {
        taskId: newTask.id,
        userId: req.currentUser.id
      }
    });

    await tx.activityLog.create({
      data: {
        userId: req.currentUser.id,
        workspaceId: project.workspaceId,
        projectId: parseInt(project_id, 10),
        taskId: newTask.id,
        activityType: 'task_created',
        description: `Task '${title}' was created`
      }
    });

    if (assignee_id && Number(assignee_id) !== Number(req.currentUser.id)) {
      const newNotif = await tx.notification.create({
        data: {
          userId: parseInt(assignee_id, 10),
          type: 'task_assigned',
          title: `New task assigned: ${title}`,
          message: 'You have been assigned to a new task',
          relatedWorkspaceId: project.workspaceId,
          relatedProjectId: parseInt(project_id, 10),
          relatedTaskId: newTask.id
        }
      });

      const workspaceObj = await tx.workspace.findUnique({
        where: { id: project.workspaceId },
        select: { name: true }
      });

      const broadcastPayload = {
        id: newNotif.id,
        user_id: newNotif.userId,
        type: newNotif.type,
        title: newNotif.title,
        message: newNotif.message,
        related_workspace_id: newNotif.relatedWorkspaceId,
        related_project_id: newNotif.relatedProjectId,
        related_task_id: newNotif.relatedTaskId,
        is_read: newNotif.isRead,
        read_at: newNotif.readAt,
        created_at: newNotif.createdAt,
        workspace_name: workspaceObj?.name || null,
        project_name: project.name,
        task_title: title
      };

      sseManager.broadcastToUser(parseInt(assignee_id, 10), 'new_notification', broadcastPayload);
    }

    const taskWithRelations = await tx.task.findUnique({
      where: { id: newTask.id },
      include: {
        assignee: true,
        creator: true,
        assignedByUser: true
      }
    });

    return mapTask(taskWithRelations);
  });

  task.tags = await getTaskTags(task.id);
  return sendSuccess(res, { task }, 201);
}));

tasksRouter.patch('/:id', asyncHandler(async (req, res) => {
  const existingTask = await prisma.task.findFirst({
    where: {
      id: parseInt(req.params.id, 10),
      project: {
        workspace: {
          members: {
            some: {
              userId: req.currentUser.id
            }
          }
        }
      }
    },
    include: {
      project: {
        select: {
          workspaceId: true,
          name: true
        }
      }
    }
  });

  if (!existingTask) {
    return sendError(res, 'Task not found or access denied', 404);
  }

  const workspaceId = existingTask.project.workspaceId;
  const canEdit = await checkPermission(workspaceId, req.currentUser.id, 'tasks:edit');
  if (!canEdit && Number(existingTask.assigneeId) !== Number(req.currentUser.id)) {
    return sendError(res, 'You do not have permission to edit this task', 403);
  }

  if (Object.prototype.hasOwnProperty.call(req.body, 'title')) {
    const title = String(req.body.title || '').trim();
    if (!title) {
      return sendValidationError(res, { title: 'Task title cannot be empty' });
    }
    if (title.length > 500) {
      return sendValidationError(res, { title: 'Task title must be 500 characters or less' });
    }
    req.body.title = title;
  }
  if (Object.prototype.hasOwnProperty.call(req.body, 'status') && !['todo', 'in_progress', 'review', 'done', 'cancelled'].includes(req.body.status)) {
    return sendValidationError(res, { status: 'Invalid status' });
  }
  if (Object.prototype.hasOwnProperty.call(req.body, 'priority') && !['low', 'medium', 'high', 'urgent'].includes(req.body.priority)) {
    return sendValidationError(res, { priority: 'Invalid priority' });
  }
  if (Object.prototype.hasOwnProperty.call(req.body, 'start_date') && !isValidDate(req.body.start_date)) {
    return sendValidationError(res, { start_date: 'Invalid start date format' });
  }
  if (Object.prototype.hasOwnProperty.call(req.body, 'due_date') && !isValidDate(req.body.due_date)) {
    return sendValidationError(res, { due_date: 'Invalid due date format' });
  }
  if (Object.prototype.hasOwnProperty.call(req.body, 'assignee_id') && req.body.assignee_id) {
    const assigneeIsMember = await isWorkspaceMember(workspaceId, req.body.assignee_id);
    if (!assigneeIsMember) {
      return sendValidationError(res, { assignee_id: 'Assignee must be a member of this workspace' });
    }
  }
  let requestedParentTaskId = null;
  if (Object.prototype.hasOwnProperty.call(req.body, 'parent_task_id') && req.body.parent_task_id) {
    const rawParentTaskId = String(req.body.parent_task_id);
    requestedParentTaskId = /^\d+$/.test(rawParentTaskId) ? Number(rawParentTaskId) : Number.NaN;
    if (!Number.isSafeInteger(requestedParentTaskId) || requestedParentTaskId === existingTask.id) {
      return sendValidationError(res, { parent_task_id: 'Parent task must be another task in this project' });
    }
  }

  const updateData = {};
  if (Object.prototype.hasOwnProperty.call(req.body, 'title')) updateData.title = req.body.title;
  if (Object.prototype.hasOwnProperty.call(req.body, 'description')) updateData.description = req.body.description || null;
  if (Object.prototype.hasOwnProperty.call(req.body, 'status')) updateData.status = req.body.status;
  if (Object.prototype.hasOwnProperty.call(req.body, 'priority')) updateData.priority = req.body.priority;
  if (Object.prototype.hasOwnProperty.call(req.body, 'start_date')) updateData.startDate = req.body.start_date ? new Date(req.body.start_date) : null;
  if (Object.prototype.hasOwnProperty.call(req.body, 'due_date')) updateData.dueDate = req.body.due_date ? new Date(req.body.due_date) : null;
  if (Object.prototype.hasOwnProperty.call(req.body, 'parent_task_id')) updateData.parentTaskId = req.body.parent_task_id ? requestedParentTaskId : null;
  if (Object.prototype.hasOwnProperty.call(req.body, 'position')) updateData.position = parseInt(req.body.position, 10);

  if (Object.prototype.hasOwnProperty.call(req.body, 'assignee_id')) {
    updateData.assigneeId = req.body.assignee_id ? parseInt(req.body.assignee_id, 10) : null;
    updateData.assignedBy = req.body.assignee_id ? req.currentUser.id : null;
  }

  const shouldUpdateTags = Array.isArray(req.body.tags);

  if (Object.keys(updateData).length === 0 && !shouldUpdateTags) {
    return sendError(res, 'No fields to update', 400);
  }

  const performTaskUpdate = async (tx) => {
    const broadcasts = [];

    if (requestedParentTaskId) {
      // Validate immediately before the write under serializable isolation.
      await validateParentTask(tx, existingTask, requestedParentTaskId);
    }

    if (Object.keys(updateData).length > 0) {
      await tx.task.update({
        where: { id: parseInt(req.params.id, 10) },
        data: updateData
      });
    }

    if (shouldUpdateTags) {
      await tx.taskTagAssignment.deleteMany({
        where: { taskId: parseInt(req.params.id, 10) }
      });

      for (const tagId of req.body.tags) {
        const tag = await tx.taskTag.findFirst({
          where: {
            id: parseInt(tagId, 10),
            workspaceId
          },
          select: { id: true }
        });

        if (tag) {
          await tx.taskTagAssignment.create({
            data: {
              taskId: parseInt(req.params.id, 10),
              tagId: tag.id
            }
          });
        }
      }
    }

    const changes = [];
    if (Object.prototype.hasOwnProperty.call(req.body, 'status') && req.body.status !== existingTask.status) {
      changes.push(`status changed from '${existingTask.status}' to '${req.body.status}'`);
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'assignee_id') && Number(req.body.assignee_id || 0) !== Number(existingTask.assigneeId || 0)) {
      changes.push('assignee changed');
    }

    if (changes.length > 0) {
      await tx.activityLog.create({
        data: {
          userId: req.currentUser.id,
          workspaceId,
          projectId: existingTask.projectId,
          taskId: parseInt(req.params.id, 10),
          activityType: 'task_updated',
          description: `Task updated: ${changes.join(', ')}`
        }
      });
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'assignee_id') &&
      Number(req.body.assignee_id || 0) !== Number(existingTask.assigneeId || 0) &&
      Number(req.body.assignee_id || 0) !== Number(req.currentUser.id)) {
      const updatedTaskTitle = updateData.title || existingTask.title;

      const newNotif = await tx.notification.create({
        data: {
          userId: parseInt(req.body.assignee_id, 10),
          type: 'task_assigned',
          title: `Task assigned: ${updatedTaskTitle}`,
          message: `You have been assigned to a task in ${existingTask.project.name}`,
          relatedWorkspaceId: workspaceId,
          relatedProjectId: existingTask.projectId,
          relatedTaskId: parseInt(req.params.id, 10)
        }
      });

      const workspaceObj = await tx.workspace.findUnique({
        where: { id: workspaceId },
        select: { name: true }
      });

      const broadcastPayload = {
        id: newNotif.id,
        user_id: newNotif.userId,
        type: newNotif.type,
        title: newNotif.title,
        message: newNotif.message,
        related_workspace_id: newNotif.relatedWorkspaceId,
        related_project_id: newNotif.relatedProjectId,
        related_task_id: newNotif.relatedTaskId,
        is_read: newNotif.isRead,
        read_at: newNotif.readAt,
        created_at: newNotif.createdAt,
        workspace_name: workspaceObj?.name || null,
        project_name: existingTask.project.name,
        task_title: updatedTaskTitle
      };

      broadcasts.push({ userId: parseInt(req.body.assignee_id, 10), payload: broadcastPayload });
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'status') &&
      req.body.status !== existingTask.status &&
      existingTask.assigneeId &&
      Number(existingTask.assigneeId) !== Number(req.currentUser.id)) {
      const updatedTaskTitle = updateData.title || existingTask.title;

      const newNotif = await tx.notification.create({
        data: {
          userId: existingTask.assigneeId,
          type: 'task_status_changed',
          title: `Task status changed: ${updatedTaskTitle}`,
          message: `The status is now '${req.body.status}'`,
          relatedWorkspaceId: workspaceId,
          relatedProjectId: existingTask.projectId,
          relatedTaskId: parseInt(req.params.id, 10)
        }
      });

      const workspaceObj = await tx.workspace.findUnique({
        where: { id: workspaceId },
        select: { name: true }
      });

      const broadcastPayload = {
        id: newNotif.id,
        user_id: newNotif.userId,
        type: newNotif.type,
        title: newNotif.title,
        message: newNotif.message,
        related_workspace_id: newNotif.relatedWorkspaceId,
        related_project_id: newNotif.relatedProjectId,
        related_task_id: newNotif.relatedTaskId,
        is_read: newNotif.isRead,
        read_at: newNotif.readAt,
        created_at: newNotif.createdAt,
        workspace_name: workspaceObj?.name || null,
        project_name: existingTask.project.name,
        task_title: updatedTaskTitle
      };

      broadcasts.push({ userId: existingTask.assigneeId, payload: broadcastPayload });
    }

    return broadcasts;
  };

  let pendingBroadcasts;
  try {
    pendingBroadcasts = await runSerializableTransaction(prisma, performTaskUpdate);
  }
  catch (error) {
    if (error.validationErrors) {
      return sendValidationError(res, error.validationErrors);
    }
    throw error;
  }

  // Emit external side effects only after the database transaction commits successfully.
  for (const broadcast of pendingBroadcasts) {
    sseManager.broadcastToUser(broadcast.userId, 'new_notification', broadcast.payload);
  }

  const updatedTaskDb = await prisma.task.findUnique({
    where: { id: parseInt(req.params.id, 10) },
    include: {
      assignee: true,
      creator: true,
      assignedByUser: true,
      project: {
        select: {
          name: true
        }
      }
    }
  });

  const updatedTask = mapTask(updatedTaskDb);
  updatedTask.tags = await getTaskTags(updatedTask.id);

  return sendSuccess(res, { task: updatedTask });
}));

tasksRouter.delete('/:id', asyncHandler(async (req, res) => {
  const task = await prisma.task.findFirst({
    where: {
      id: parseInt(req.params.id, 10),
      project: {
        workspace: {
          members: {
            some: {
              userId: req.currentUser.id
            }
          }
        }
      }
    },
    include: {
      project: {
        select: {
          workspaceId: true
        }
      }
    }
  });

  if (!task) {
    return sendError(res, 'Task not found or access denied', 404);
  }

  const workspaceId = task.project.workspaceId;
  const canDelete = await checkPermission(workspaceId, req.currentUser.id, 'tasks:delete');
  if (!canDelete) {
    return sendError(res, 'You do not have permission to delete this task', 403);
  }

  const subtaskCount = await prisma.task.count({
    where: { parentTaskId: parseInt(req.params.id, 10) }
  });

  if (subtaskCount > 0) {
    return sendError(res, 'Cannot delete task with subtasks. Please delete or move subtasks first.', 400);
  }

  await prisma.$transaction(async (tx) => {
    await tx.activityLog.create({
      data: {
        userId: req.currentUser.id,
        workspaceId,
        projectId: task.projectId,
        taskId: parseInt(req.params.id, 10),
        activityType: 'task_deleted',
        description: `Task '${task.title}' was deleted`
      }
    });

    await tx.task.delete({
      where: { id: parseInt(req.params.id, 10) }
    });
  });

  return sendSuccess(res, { message: 'Task deleted successfully' });
}));

module.exports = { tasksRouter };
