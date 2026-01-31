import dayjs from 'dayjs'
import { useState } from 'react';
import { cn } from './lib/utils';

const toDayJs = (ref: dayjs.Dayjs, day: number) => {
    return dayjs(`${ref.format('YYYY-MM')}-${day}`)
}

const getGrid = (date: dayjs.Dayjs) => {
    const daysInMonth = date.daysInMonth();
    const daysInWeek = 7;

    const firstDayOfMonth = date.startOf('month').day();
    const lastDayOfMonth = date.endOf('month').day();

    const daysOfPreviousMonth = firstDayOfMonth; // in current month's grid
    const previousMonth = date.subtract(1, 'month')

    const daysOfNextMonth = daysInWeek - lastDayOfMonth; // in current month's grid
    const nextMonth = date.add(1, 'month')

    const daysGrid = [
        ...Array.from({ length: daysOfPreviousMonth }).map((_, i) => toDayJs(previousMonth, previousMonth.daysInMonth() - daysOfPreviousMonth + i + 1)),
        ...Array.from({ length: daysInMonth }).map((_, i) => toDayJs(date, i + 1)),
        ...Array.from({ length: daysOfNextMonth }).map((_, i) => toDayJs(nextMonth, i + 1))
    ]

    const grid = [];
    const weeks = Math.floor((daysOfPreviousMonth + daysInMonth + daysOfNextMonth) / daysInWeek);

    console.log({ daysGrid: daysGrid.map(day => day.format('YYYY-MM-DD')), weeks })
    for (let i = 0; i < weeks; i++) {
        const row: { current: boolean, days: dayjs.Dayjs[] } = { current: false, days: [] };
        for (let j = 0; j < 7; j++) {
            const index = i * 7 + j
            const day = daysGrid[index]
            row.days.push(day)

            const sameDay = day.isSame(date, 'day')
            const sameMonth = day.isSame(date, 'month')
            const sameYear = day.isSame(date, 'year')
            if (sameDay && sameMonth && sameYear) {
                row.current = true;
            }
        }
        grid.push(row)
    }


    return grid;
}

export function DatePickerDemo() {
    const [selectedDate, setSelectedDate] = useState<dayjs.Dayjs | null>(null)
    const [currentDate, setCurrentDate] = useState<dayjs.Dayjs>(dayjs())
    const grid = getGrid(currentDate)
    const today = dayjs()

    return (
        <div>
            <div className="py-2 px-4 flex flex-row justify-between items-center">
                <span className="text-xl font-bold">
                    {currentDate.format('MMMM, YYYY')}
                </span>
                <div className="flex flex-row gap-2">
                    {!currentDate.isSame(dayjs(), 'month') && currentDate.isAfter(dayjs(), 'month') && (
                        <span className="text-lg text-gray-500 cursor-pointer p-2 hover:underline" onClick={() => setCurrentDate(dayjs())}>&lt;&lt;</span>
                    )}
                    <span className="text-lg text-gray-500 cursor-pointer p-2" onClick={() => setCurrentDate(currentDate.subtract(1, 'month'))}>&lt;</span>
                    <span className="text-lg text-gray-500 cursor-pointer p-2" onClick={() => setCurrentDate(currentDate.add(1, 'month'))}>&gt;</span>
                    {!currentDate.isSame(dayjs(), 'month') && currentDate.isBefore(dayjs(), 'month') && (
                        <span className="text-lg text-gray-500 cursor-pointer p-2 hover:underline" onClick={() => setCurrentDate(dayjs())}>&gt;&gt;</span>
                    )}
                </div>
            </div>
            <div className="grid grid-cols-7 bg-zinc-300">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day}>
                        <span className="flex justify-center">{day}</span>
                    </div>
                ))}
            </div>
            {grid.map(row => (
                <div key={row.days.join(',')} className={cn("grid grid-cols-7", row.current ? 'bg-zinc-100' : '')}>
                    {row.days.map(date => {
                        const isToday = date.isSame(today, 'day') && date.isSame(today, 'month') && date.isSame(today, 'year')
                        return (
                            <div key={date.format('YYYY-MM-DD')} className={cn('cursor-pointer rounded-md p-1', isToday ? 'font-bold' : '', selectedDate?.isSame(date, 'day') ? 'bg-blue-500 text-white' : '')}>
                                <span className={cn("flex justify-center", date.month() !== currentDate.month() ? 'text-gray-500' : '')} onClick={() => setSelectedDate(date)}>{date.date()}</span>
                            </div>
                        )
                    })}
                </div>))}
        </div>
    )
} 