import type { DaySchedule } from "../../../shared/api/management";

export const workingHours: Record<string, DaySchedule> = {
    "Monday": { isOpen: true, shifts: [["15:00", "23:59"]] },
    "Tuesday": { isOpen: true, shifts: [["15:00", "23:59"]] },
    "Wednesday": { isOpen: true, shifts: [["15:00", "23:59"]] },
    "Thursday": { isOpen: true, shifts: [["16:30", "01:30"]] },
    "Friday": { isOpen: true, shifts: [["16:30", "01:30"]] },
    "Saturday": { isOpen: true, shifts: [["14:00", "23:59"]] },
    "Sunday": { isOpen: false, shifts: [] },
};

export const ramadanHours: Record<string, DaySchedule> = {
    "Sunday": { isOpen: false, shifts: [] },
    "Monday": { isOpen: true, shifts: [["15:30", "18:30"], ["20:30", "03:30"]] },
    "Tuesday": { isOpen: true, shifts: [["15:30", "18:30"], ["20:30", "03:30"]] },
    "Wednesday": { isOpen: true, shifts: [["15:30", "18:30"], ["20:30", "03:30"]] },
    "Thursday": { isOpen: true, shifts: [["15:30", "17:30"], ["20:30", "03:30"]] },
    "Friday": { isOpen: false, shifts: [] },
    "Saturday": { isOpen: true, shifts: [["15:30", "18:30"], ["20:30", "03:30"]] },
};
