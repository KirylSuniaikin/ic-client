import type { StaffRoles } from '../../auth/types';

export type TaskCardStatus = 'BACKLOG' | 'DOING' | 'DONE';
export type TaskCardPriority = 'GREEN' | 'YELLOW' | 'RED';

export type TaskCard = {
    id: number;
    title: string;
    description: string | null;
    priority: TaskCardPriority;
    status: TaskCardStatus;
    position: number;
    assigneeId: number;
    createdAt: string;
    updatedAt: string;
};

export type CreateTaskCardPayload = {
    title: string;
    description: string | null;
    priority?: TaskCardPriority;
    status?: TaskCardStatus; // omitted = BACKLOG, matching the backend default
    assigneeId?: number;
};

export type EditTaskCardPayload = {
    title: string;
    description: string | null;
    priority: TaskCardPriority;
};

export type ChangeTaskCardPriorityPayload = {
    priority: TaskCardPriority;
};

export type MoveTaskCardPayload = {
    targetStatus: TaskCardStatus;
    targetIndex: number; // 0-based, matches backend's PositiveOrZero contract
};

export const TASK_CARD_STATUSES: readonly TaskCardStatus[] = ['BACKLOG', 'DOING', 'DONE'];

export const TASK_CARD_STATUS_LABELS: Record<TaskCardStatus, string> = {
    BACKLOG: 'Backlog',
    DOING: 'Doing',
    DONE: 'Done',
};

export const TASK_CARD_PRIORITY_COLORS: Record<TaskCardPriority, string> = {
    GREEN: '#32a852',
    YELLOW: '#E4B11B',
    RED: '#E44B4C',
};

export const TASK_TITLE_MAX_LENGTH = 255;
export const TASK_DESCRIPTION_MAX_LENGTH = 4000;

// Mirrors backend BoardOwnerTO exactly — id/username/role, role always MANAGER or SUPER_MANAGER.
export type BoardOwner = {
    id: number;
    username: string;
    role: StaffRoles;
};
