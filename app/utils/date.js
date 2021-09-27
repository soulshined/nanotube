module.exports = class DateUtils {

    static isDateToday(date) {
        const now = new Date();
        const monthNumber = now.getDate(),
            year = now.getFullYear(),
            month = now.getMonth();

        return date.getDate() === monthNumber &&
            date.getMonth() === month &&
            date.getFullYear() === year
    }

    static isDateWithinLastNumOfDays(date, numOfDays) {
        if (numOfDays === 0) return DateUtils.isDateToday(date);

        const now = new Date();
        now.setDate(now.getDate() - numOfDays);

        return date.getTime() >= now.getTime();
    }
}