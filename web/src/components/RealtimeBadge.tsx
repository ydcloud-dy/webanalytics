interface Props {
  count: number
}

export default function RealtimeBadge({ count }: Props) {
  return (
    <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-full text-sm border border-emerald-500/20">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
      </span>
      <span className="font-bold">{count}</span>
      <span className="text-emerald-500 text-xs">人在线</span>
    </div>
  )
}
