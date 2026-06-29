type TimeRange = [string, string];
type DaySchedule = TimeRange[] | null;

export const workingHours: Record<string, DaySchedule> = {
    "Monday": [["15:00", "23:59"]],
    "Tuesday": [["15:00", "23:59"]],
    "Wednesday": [["15:00", "23:59"]],
    "Thursday": [["16:30", "01:30"]],
    "Friday": [["16:30", "01:30"]],
    "Saturday": [["14:00", "23:59"]],
    "Sunday": null,
}

export const ramadanHours: Record<string, DaySchedule> = {
    "Sunday": null,
    "Monday": [["15:30", "18:30"], ["20:30", "03:30"]],
    "Tuesday": [["15:30", "18:30"], ["20:30", "03:30"]],
    "Wednesday": [["15:30", "18:30"], ["20:30", "03:30"]],
    "Thursday": [["15:30", "17:30"], ["20:30", "03:30"]],
    "Friday": null,
    "Saturday": [["15:30", "18:30"], ["20:30", "03:30"]],
}
