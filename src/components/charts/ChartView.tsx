import { useState, useMemo } from 'react'
import { BarChart, Bar, LineChart, Line, PieChart, Pie, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts'

interface ChartViewProps {
  data: any[]
}

type ChartType = 'bar' | 'line' | 'pie' | 'area'

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#0088fe', '#00c49f', '#ffbb28', '#ff8042', '#a4de6c', '#d0ed57']

export const ChartView = ({ data }: ChartViewProps) => {
  const [chartType, setChartType] = useState<ChartType>('bar')

  // Extract numeric and string fields
  const { numericFields, stringFields } = useMemo(() => {
    if (!data || data.length === 0) return { numericFields: [] as string[], stringFields: [] as string[] }
    const nf: string[] = []
    const sf: string[] = []
    const keys = Object.keys(data[0])
    for (const key of keys) {
      const sample = data.find(d => d[key] !== null && d[key] !== undefined)
      if (sample && typeof sample[key] === 'number') nf.push(key)
      else if (sample && typeof sample[key] === 'string') sf.push(key)
    }
    return { numericFields: nf, stringFields: sf }
  }, [data])

  const [xField, setXField] = useState<string>('')
  const [yFields, setYFields] = useState<string[]>([])

  // Auto-select fields on data change
  useMemo(() => {
    if (stringFields.length > 0 && !xField) setXField(stringFields[0])
    else if (numericFields.length > 0 && !xField) setXField(numericFields[0])
    if (numericFields.length > 0 && yFields.length === 0) setYFields([numericFields[0]])
  }, [stringFields, numericFields])

  const toggleYField = (field: string) => {
    setYFields(prev => prev.includes(field) ? prev.filter(f => f !== field) : [...prev, field])
  }

  if (!data || data.length === 0 || numericFields.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-xs p-8">
        <p>No numeric data available for charting. Query results need at least one numeric field.</p>
      </div>
    )
  }

  const chartData = data.slice(0, 500) // Limit for performance

  return (
    <div className="flex flex-col h-full gap-2 p-2">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground">Type:</span>
          {(['bar', 'line', 'area', 'pie'] as ChartType[]).map(t => (
            <button key={t} onClick={() => setChartType(t)}
              className={`px-2 py-0.5 text-[10px] font-medium rounded ${chartType === t ? 'bg-primary text-primary-foreground' : 'border hover:bg-accent'}`}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <span className="text-muted-foreground/30">|</span>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground">X:</span>
          <select value={xField} onChange={e => setXField(e.target.value)}
            className="px-1.5 py-0.5 text-[10px] rounded border bg-background">
            {[...stringFields, ...numericFields].map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground">Y:</span>
          {numericFields.map(f => (
            <button key={f} onClick={() => toggleYField(f)}
              className={`px-1.5 py-0.5 text-[10px] rounded ${yFields.includes(f) ? 'bg-primary/20 text-primary border border-primary/50' : 'border hover:bg-accent'}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'pie' ? (
            <PieChart>
              <Pie data={chartData} dataKey={yFields[0] || numericFields[0]} nameKey={xField} cx="50%" cy="50%" outerRadius="80%" label={({ name, value }) => `${name}: ${value}`}>
                {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#1e1e2e', border: '1px solid #333', borderRadius: 6, fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          ) : chartType === 'line' ? (
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey={xField} tick={{ fontSize: 10 }} stroke="#888" />
              <YAxis tick={{ fontSize: 10 }} stroke="#888" />
              <Tooltip contentStyle={{ background: '#1e1e2e', border: '1px solid #333', borderRadius: 6, fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {yFields.map((f, i) => <Line key={f} type="monotone" dataKey={f} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 2 }} />)}
            </LineChart>
          ) : chartType === 'area' ? (
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey={xField} tick={{ fontSize: 10 }} stroke="#888" />
              <YAxis tick={{ fontSize: 10 }} stroke="#888" />
              <Tooltip contentStyle={{ background: '#1e1e2e', border: '1px solid #333', borderRadius: 6, fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {yFields.map((f, i) => <Area key={f} type="monotone" dataKey={f} stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.3} />)}
            </AreaChart>
          ) : (
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey={xField} tick={{ fontSize: 10 }} stroke="#888" />
              <YAxis tick={{ fontSize: 10 }} stroke="#888" />
              <Tooltip contentStyle={{ background: '#1e1e2e', border: '1px solid #333', borderRadius: 6, fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {yFields.map((f, i) => <Bar key={f} dataKey={f} fill={COLORS[i % COLORS.length]} radius={[2, 2, 0, 0]} />)}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  )
}

