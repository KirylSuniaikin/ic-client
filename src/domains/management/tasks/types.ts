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
    deadline: string | null; // ISO YYYY-MM-DD, date only
    hasImage: boolean;
};

export type CreateTaskCardPayload = {
    title: string;
    description: string | null;
    priority?: TaskCardPriority;
    status?: TaskCardStatus; // omitted = BACKLOG, matching the backend default
    assigneeId?: number;
    deadline: string | null;
};

export type EditTaskCardPayload = {
    title: string;
    description: string | null;
    priority: TaskCardPriority;
    deadline: string | null;
};

export type ChangeTaskCardPriorityPayload = {
    priority: TaskCardPriority;
};

export type MoveTaskCardPayload = {
    targetStatus: TaskCardStatus;
    targetIndex: number; // 0-based, matches backend's PositiveOrZero contract
};

/** Metadata returned by the task-card-photo upload endpoint. The bytes are never inlined in JSON. */
export type TaskCardImageMetaTO = {
    taskCardId: number;
    contentType: string;
    sizeBytes: number;
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

export const TASK_CARD_OVERDUE_BG = '#FDECEC';
export const TASK_CARD_OVERDUE_TEXT = '#C62828';

export const TASK_TITLE_MAX_LENGTH = 255;
export const TASK_DESCRIPTION_MAX_LENGTH = 4000;

// Mirrors backend BoardOwnerTO exactly — role is always MANAGER, SUPER_MANAGER, or OWNER.
export type BoardOwner = {
    id: number;
    username: string;
    role: StaffRoles;
    /**
     * Cards not yet in DONE. Excludes finished work on purpose: nothing archives DONE cards, so a
     * lifetime total would only ever climb and would stop saying anything about who is busy.
     */
    openCardCount: number;
};
