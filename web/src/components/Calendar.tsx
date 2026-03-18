import { useState } from 'react'

function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function CalendarPanel({
  selectedDate,
  onSelect,
  onClose,
}: {
  selectedDate: string | null
  onSelect: (date: string) => void
  onClose: () => void
}) {
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())

  const firstDay = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const todayStr = formatDate(today)

  const monthNames = [
    '1月', '2月', '3月', '4月', '5月', '6月',
    '7月', '8月', '9月', '10月', '11月', '12月',
  ]

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewYear(viewYear - 1)
      setViewMonth(11)
    } else {
      setViewMonth(viewMonth - 1)
    }
  }
  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewYear(viewYear + 1)
      setViewMonth(0)
    } else {
      setViewMonth(viewMonth + 1)
    }
  }

  const cells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div className="absolute right-0 top-full mt-2 z-50 bg-dark-card border border-dark-border rounded-xl p-4 shadow-xl w-72">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={prevMonth} className="text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-dark-hover">
          &lt;
        </button>
        <span className="text-white font-medium text-sm">{viewYear}年 {monthNames[viewMonth]}</span>
        <button onClick={nextMonth} className="text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-dark-hover">
          &gt;
        </button>
      </div>
      {/* Week days */}
      <div className="grid grid-cols-7 text-center text-xs text-gray-500 mb-1">
        {['日', '一', '二', '三', '四', '五', '六'].map((d) => (
          <div key={d} className="py-1">{d}</div>
        ))}
      </div>
      {/* Days */}
      <div className="grid grid-cols-7 text-center text-sm">
        {cells.map((day, i) => {
          if (day === null) return <div key={`e${i}`} />
          const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const isToday = dateStr === todayStr
          const isSelected = dateStr === selectedDate
          const isFuture = dateStr > todayStr
          return (
            <button
              key={dateStr}
              disabled={isFuture}
              onClick={() => { onSelect(dateStr); onClose() }}
              className={`py-1.5 rounded-md transition-colors ${
                isFuture
                  ? 'text-gray-700 cursor-not-allowed'
                  : isSelected
                    ? 'bg-gold-500 text-black font-bold'
                    : isToday
                      ? 'text-gold-400 font-bold hover:bg-dark-hover'
                      : 'text-gray-300 hover:bg-dark-hover'
              }`}
            >
              {day}
            </button>
          )
        })}
      </div>
      {/* Clear */}
      <div className="mt-3 pt-2 border-t border-dark-border flex justify-end">
        <button
          onClick={() => { onSelect(''); onClose() }}
          className="text-xs text-gray-400 hover:text-white px-3 py-1 rounded hover:bg-dark-hover"
        >
          清除日期
        </button>
      </div>
    </div>
  )
}

export default function CalendarPicker({
  pickedDate,
  onDatePick,
}: {
  pickedDate: string | null
  onDatePick: (date: string | null) => void
}) {
  const [calOpen, setCalOpen] = useState(false)

  const handleSelect = (date: string) => {
    onDatePick(date || null)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setCalOpen(!calOpen)}
        className={`flex items-center gap-2 px-4 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
          pickedDate
            ? 'bg-gold-500 text-black border-gold-500'
            : 'bg-dark-card border-dark-border text-gray-400 hover:text-white hover:bg-dark-hover'
        }`}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        {pickedDate || '选择日期'}
      </button>
      {calOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setCalOpen(false)} />
          <CalendarPanel
            selectedDate={pickedDate}
            onSelect={handleSelect}
            onClose={() => setCalOpen(false)}
          />
        </>
      )}
    </div>
  )
}
