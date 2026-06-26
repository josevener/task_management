const express = require('express');
const { prisma } = require('../config/database');
const { attachCurrentUser, requireAuth, checkPermission } = require('../middleware/auth');
const { asyncHandler } = require('../utils/async-handler');
const { sendError, sendSuccess, sendValidationError } = require('../utils/responses');
const { isValidDate } = require('../utils/validation');

const projectsRouter = express.Router();

projectsRouter.use(attachCurrentUser, requireAuth);

function mapProject(p) {
  if (!p) return null;
  const total_tasks = p.tasks ? p.tasks.length : 0;
  const completed_tasks = p.tasks ? p.tasks.filter(t => t.status === 'done').length : 0;
  const progress_percentage = total_tasks > 0 ? Math.round((completed_tasks * 100) / total_tasks) : 0;

  return {
    id: p.id,
    workspace_id: p.workspaceId,
    name: p.name,
    description: p.description,
    status: p.status,
    owner_id: p.ownerId,
    start_date: p.startDate,
    end_date: p.endDate,
    health_status: p.healthStatus,
    is_template: p.isTemplate,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
    owner_first_name: p.owner?.firstName || null,
    owner_last_name: p.owner?.lastName || null,
    owner_email: p.owner?.email || null,
    workspace_name: p.workspace?.name || undefined,
    total_tasks,
    completed_tasks,
    progress_percentage,
  };
}

projectsRouter.get('/', asyncHandler(async (req, res) => {
  if (req.query.workspace_id) {
    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: parseInt(req.query.workspace_id, 10),
        userId: req.currentUser.id,
      },
      select: { role: true }
    });

    if (!workspaceMember) {
      return sendError(res, 'Workspace access denied', 403);
    }

    const projects = await prisma.project.findMany({
      where: {
        workspaceId: parseInt(req.query.workspace_id, 10),
      },
      include: {
        owner: true,
        tasks: {
          select: {
            id: true,
            status: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc',
      }
    });

    return sendSuccess(res, { projects: projects.map(mapProject) });
  }

  const projects = await prisma.project.findMany({
    where: {
      workspace: {
        members: {
          some: {
            userId: req.currentUser.id,
          }
        }
      }
    },
    include: {
      owner: true,
      workspace: true,
      tasks: {
        select: {
          id: true,
          status: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc',
    }
  });

  return sendSuccess(res, { projects: projects.map(mapProject) });
}));

projectsRouter.get('/:id', asyncHandler(async (req, res) => {
  const project = await prisma.project.findFirst({
    where: {
      id: parseInt(req.params.id, 10),
      workspace: {
        members: {
          some: {
            userId: req.currentUser.id
          }
        }
      }
    },
    include: {
      owner: true,
      workspace: true,
      tasks: {
        select: {
          id: true,
          status: true
        }
      }
    }
  });

  if (!project) {
    return sendError(res, 'Project not found or access denied', 404);
  }

  return sendSuccess(res, { project: mapProject(project) });
}));

projectsRouter.post('/', asyncHandler(async (req, res) => {
  const workspace_id = req.body.workspace_id;
  const name = String(req.body.name || '').trim();
  const description = String(req.body.description || '').trim();
  const status = req.body.status || 'active';
  const start_date = req.body.start_date || null;
  const end_date = req.body.end_date || null;
  const is_template = Boolean(req.body.is_template);
  const errors = {};

  if (!workspace_id) {
    errors.workspace_id = 'Workspace ID is required';
  }

  if (!name) {
    errors.name = 'Project name is required';
  } 
  else if (name.length > 255) {
    errors.name = 'Project name must be 255 characters or less';
  }

  if (!['active', 'on_hold', 'completed', 'archived'].includes(status)) {
    errors.status = 'Invalid status. Must be one of: active, on_hold, completed, archived';
  }

  if (!isValidDate(start_date)) {
    errors.start_date = 'Invalid start date format';
  }

  if (!isValidDate(end_date)) {
    errors.end_date = 'Invalid end date format';
  }

  if (start_date && end_date && Date.parse(start_date) > Date.parse(end_date)) {
    errors.end_date = 'End date must be after start date';
  }

  if (workspace_id) {
    const isMember = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: parseInt(workspace_id, 10),
        userId: req.currentUser.id
      },
      select: { id: true }
    });
    if (!isMember) {
      errors.workspace_id = 'Workspace access denied';
    } 
    else {
      const canCreate = await checkPermission(workspace_id, req.currentUser.id, 'projects:create');
      if (!canCreate) {
        errors.workspace_id = 'You do not have permission to create projects';
      }
    }
  }

  if (Object.keys(errors).length > 0) {
    return sendValidationError(res, errors);
  }

  const project = await prisma.$transaction(async (tx) => {
    const newProject = await tx.project.create({
      data: {
        workspaceId: parseInt(workspace_id, 10),
        name,
        description: description || null,
        status,
        ownerId: req.currentUser.id,
        startDate: start_date ? new Date(start_date) : null,
        endDate: end_date ? new Date(end_date) : null,
        isTemplate: is_template
      }
    });

    await tx.projectMember.create({
      data: {
        projectId: newProject.id,
        userId: req.currentUser.id,
        role: 'owner'
      }
    });

    await tx.activityLog.create({
      data: {
        userId: req.currentUser.id,
        workspaceId: parseInt(workspace_id, 10),
        projectId: newProject.id,
        activityType: 'project_created',
        description: `Project '${name}' was created`
      }
    });

    const projectWithRelations = await tx.project.findUnique({
      where: { id: newProject.id },
      include: {
        owner: true
      }
    });

    return mapProject(projectWithRelations);
  });

  return sendSuccess(res, { project }, 201);
}));

projectsRouter.patch('/:id', asyncHandler(async (req, res) => {
  const existingProject = await prisma.project.findFirst({
    where: {
      id: parseInt(req.params.id, 10),
      workspace: {
        members: {
          some: {
            userId: req.currentUser.id
          }
        }
      }
    },
    include: {
      members: {
        where: {
          userId: req.currentUser.id
        },
        select: {
          role: true
        }
      }
    }
  });

  if (!existingProject) {
    return sendError(res, 'Project not found', 404);
  }

  const project_role = existingProject.members[0]?.role || null;
  const canEditWorkspace = await checkPermission(existingProject.workspaceId, req.currentUser.id, 'projects:edit');
  const canEdit = project_role === 'owner' || canEditWorkspace;
  if (!canEdit) {
    return sendError(res, 'You do not have permission to edit this project', 403);
  }

  if (Object.prototype.hasOwnProperty.call(req.body, 'name') && !String(req.body.name || '').trim()) {
    return sendValidationError(res, { name: 'Project name cannot be empty' });
  }

  if (Object.prototype.hasOwnProperty.call(req.body, 'status') && !['active', 'on_hold', 'completed', 'archived'].includes(req.body.status)) {
    return sendValidationError(res, { status: 'Invalid status' });
  }
  
  if (Object.prototype.hasOwnProperty.call(req.body, 'health_status') && !['on_track', 'at_risk', 'off_track', 'not_set'].includes(req.body.health_status)) {
    return sendValidationError(res, { health_status: 'Invalid health status' });
  }

  const updateData = {};
  if (Object.prototype.hasOwnProperty.call(req.body, 'name')) updateData.name = String(req.body.name || '').trim();
  if (Object.prototype.hasOwnProperty.call(req.body, 'description')) updateData.description = req.body.description || null;
  if (Object.prototype.hasOwnProperty.call(req.body, 'status')) updateData.status = req.body.status;
  if (Object.prototype.hasOwnProperty.call(req.body, 'start_date')) updateData.startDate = req.body.start_date ? new Date(req.body.start_date) : null;
  if (Object.prototype.hasOwnProperty.call(req.body, 'end_date')) updateData.endDate = req.body.end_date ? new Date(req.body.end_date) : null;
  if (Object.prototype.hasOwnProperty.call(req.body, 'progress_percentage')) updateData.progressPercentage = parseInt(req.body.progress_percentage, 10);
  if (Object.prototype.hasOwnProperty.call(req.body, 'health_status')) updateData.healthStatus = req.body.health_status;

  if (Object.keys(updateData).length === 0) {
    return sendError(res, 'No fields to update', 400);
  }

  await prisma.$transaction(async (tx) => {
    await tx.project.update({
      where: { id: parseInt(req.params.id, 10) },
      data: updateData
    });

    await tx.activityLog.create({
      data: {
        userId: req.currentUser.id,
        workspaceId: existingProject.workspaceId,
        projectId: parseInt(req.params.id, 10),
        activityType: 'project_updated',
        description: 'Project details were updated'
      }
    });
  });

  const updatedProject = await prisma.project.findUnique({
    where: { id: parseInt(req.params.id, 10) }
  });

  return sendSuccess(res, {
    project: {
      id: updatedProject.id,
      workspace_id: updatedProject.workspaceId,
      name: updatedProject.name,
      description: updatedProject.description,
      status: updatedProject.status,
      owner_id: updatedProject.ownerId,
      start_date: updatedProject.startDate,
      end_date: updatedProject.endDate,
      progress_percentage: updatedProject.progressPercentage,
      health_status: updatedProject.healthStatus,
      is_template: updatedProject.isTemplate,
      created_at: updatedProject.createdAt,
      updated_at: updatedProject.updatedAt
    }
  });
}));

projectsRouter.delete('/:id', asyncHandler(async (req, res) => {
  const existingProject = await prisma.project.findFirst({
    where: {
      id: parseInt(req.params.id, 10),
      workspace: {
        members: {
          some: {
            userId: req.currentUser.id
          }
        }
      }
    },
    include: {
      members: {
        where: {
          userId: req.currentUser.id
        },
        select: {
          role: true
        }
      }
    }
  });

  if (!existingProject) {
    return sendError(res, 'Project not found', 404);
  }

  const project_role = existingProject.members[0]?.role || null;
  const canDeleteWorkspace = await checkPermission(existingProject.workspaceId, req.currentUser.id, 'projects:delete');
  const canDelete = project_role === 'owner' || canDeleteWorkspace;
  if (!canDelete) {
    return sendError(res, 'You do not have permission to delete this project', 403);
  }

  await prisma.$transaction(async (tx) => {
    await tx.activityLog.create({
      data: {
        userId: req.currentUser.id,
        workspaceId: existingProject.workspaceId,
        activityType: 'project_deleted',
        description: 'A project was deleted'
      }
    });

    await tx.project.delete({
      where: { id: parseInt(req.params.id, 10) }
    });
  });

  return sendSuccess(res, { message: 'Project deleted successfully' });
}));

projectsRouter.get('/:projectId/members', asyncHandler(async (req, res) => {
  const project = await prisma.project.findFirst({
    where: {
      id: parseInt(req.params.projectId, 10),
      workspace: {
        members: {
          some: {
            userId: req.currentUser.id
          }
        }
      }
    },
    select: {
      workspaceId: true
    }
  });

  if (!project) {
    return sendError(res, 'Project access denied or project not found', 403);
  }

  const workspaceMembers = await prisma.workspaceMember.findMany({
    where: {
      workspaceId: project.workspaceId
    },
    include: {
      user: true
    },
    orderBy: [
      { user: { firstName: 'asc' } },
      { user: { lastName: 'asc' } }
    ]
  });

  const members = workspaceMembers.map((wm) => ({
    id: wm.user.id,
    first_name: wm.user.firstName,
    last_name: wm.user.lastName,
    email: wm.user.email,
    workspace_role: wm.role
  }));

  return sendSuccess(res, { members });
}));

module.exports = { projectsRouter };
