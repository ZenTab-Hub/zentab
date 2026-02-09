import { useState } from 'react'
import { ChevronRight, ChevronDown, Zap, Clock, Database, Search } from 'lucide-react'
import { formatCompactNumber } from '@/utils/formatters'

interface ExplainNodeProps {
  node: any
  depth?: number
  dbType: 'mongodb' | 'postgresql'
}

const formatNumber = formatCompactNumber

const getNodeColor = (cost: number, maxCost: number) => {
  if (maxCost === 0) return 'text-green-400'
  const ratio = cost / maxCost
  if (ratio > 0.7) return 'text-red-400'
  if (ratio > 0.3) return 'text-yellow-400'
  return 'text-green-400'
}

const MongoNode = ({ node, depth = 0 }: { node: any; depth?: number }) => {
  const [expanded, setExpanded] = useState(depth < 3)
  const stage = node.stage || node.executionStages?.stage || 'Unknown'
  const nReturned = node.nReturned ?? node.executionStages?.nReturned ?? '-'
  const execMs = node.executionTimeMillisEstimate ?? node.executionStages?.executionTimeMillisEstimate ?? '-'
  const docsExamined = node.totalDocsExamined ?? node.executionStages?.totalDocsExamined ?? '-'
  const keysExamined = node.totalKeysExamined ?? node.executionStages?.totalKeysExamined ?? '-'
  const indexName = node.indexName || node.executionStages?.indexName
  const children = node.inputStage ? [node.inputStage] : node.inputStages || []

  return (
    <div style={{ marginLeft: depth * 16 }}>
      <div className="flex items-center gap-1.5 py-1 px-1.5 rounded hover:bg-accent/50 cursor-pointer group" onClick={() => setExpanded(!expanded)}>
        {children.length > 0 ? (expanded ? <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />) : <span className="w-3" />}
        <span className={`text-[11px] font-bold ${stage === 'COLLSCAN' ? 'text-red-400' : stage === 'IXSCAN' ? 'text-green-400' : 'text-blue-400'}`}>{stage}</span>
        {indexName && <span className="text-[10px] text-purple-400 bg-purple-400/10 px-1 rounded">idx: {indexName}</span>}
        <div className="flex items-center gap-2 ml-auto text-[10px] text-muted-foreground">
          {nReturned !== '-' && <span title="Rows returned"><Database className="h-2.5 w-2.5 inline mr-0.5" />{formatNumber(nReturned)}</span>}
          {docsExamined !== '-' && <span title="Docs examined"><Search className="h-2.5 w-2.5 inline mr-0.5" />{formatNumber(docsExamined)}</span>}
          {execMs !== '-' && <span title="Execution time"><Clock className="h-2.5 w-2.5 inline mr-0.5" />{execMs}ms</span>}
        </div>
      </div>
      {expanded && children.map((child: any, i: number) => <MongoNode key={i} node={child} depth={depth + 1} />)}
    </div>
  )
}

const PgNode = ({ node, depth = 0, maxCost = 0 }: { node: any; depth?: number; maxCost?: number }) => {
  const [expanded, setExpanded] = useState(depth < 3)
  const nodeType = node['Node Type'] || 'Unknown'
  const totalCost = node['Total Cost'] || 0
  const actualTime = node['Actual Total Time'] || 0
  const rows = node['Actual Rows'] ?? node['Plan Rows'] ?? '-'
  const relation = node['Relation Name']
  const indexName = node['Index Name']
  const children = node.Plans || []

  return (
    <div style={{ marginLeft: depth * 16 }}>
      <div className="flex items-center gap-1.5 py-1 px-1.5 rounded hover:bg-accent/50 cursor-pointer group" onClick={() => setExpanded(!expanded)}>
        {children.length > 0 ? (expanded ? <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />) : <span className="w-3" />}
        <span className={`text-[11px] font-bold ${getNodeColor(totalCost, maxCost)}`}>{nodeType}</span>
        {relation && <span className="text-[10px] text-blue-400 bg-blue-400/10 px-1 rounded">{relation}</span>}
        {indexName && <span className="text-[10px] text-purple-400 bg-purple-400/10 px-1 rounded">idx: {indexName}</span>}
        <div className="flex items-center gap-2 ml-auto text-[10px] text-muted-foreground">
          {rows !== '-' && <span title="Rows"><Database className="h-2.5 w-2.5 inline mr-0.5" />{formatNumber(rows)}</span>}
          <span title="Cost"><Zap className="h-2.5 w-2.5 inline mr-0.5" />{totalCost.toFixed(1)}</span>
          {actualTime > 0 && <span title="Actual time"><Clock className="h-2.5 w-2.5 inline mr-0.5" />{actualTime.toFixed(2)}ms</span>}
        </div>
      </div>
      {expanded && children.map((child: any, i: number) => <PgNode key={i} node={child} depth={depth + 1} maxCost={maxCost} />)}
    </div>
  )
}

const getMaxCost = (node: any): number => {
  const cost = node['Total Cost'] || 0
  const children = node.Plans || []
  return Math.max(cost, ...children.map(getMaxCost))
}

export const ExplainPlanTree = ({ plan, dbType }: { plan: any; dbType: 'mongodb' | 'postgresql' }) => {
  if (!plan) return <p className="text-xs text-muted-foreground">No execution plan available</p>

  if (dbType === 'mongodb') {
    const stats = plan.executionStats || plan
    const winningPlan = plan.queryPlanner?.winningPlan || stats.executionStages || plan
    return (
      <div>
        {stats.executionSuccess !== undefined && (
          <div className="flex flex-wrap gap-3 mb-3 p-2 rounded bg-muted/50 text-[10px]">
            <span>Status: <b className={stats.executionSuccess ? 'text-green-400' : 'text-red-400'}>{stats.executionSuccess ? 'Success' : 'Failed'}</b></span>
            {stats.nReturned !== undefined && <span>Returned: <b>{formatNumber(stats.nReturned)}</b></span>}
            {stats.totalDocsExamined !== undefined && <span>Docs Examined: <b>{formatNumber(stats.totalDocsExamined)}</b></span>}
            {stats.totalKeysExamined !== undefined && <span>Keys Examined: <b>{formatNumber(stats.totalKeysExamined)}</b></span>}
            {stats.executionTimeMillis !== undefined && <span>Time: <b>{stats.executionTimeMillis}ms</b></span>}
          </div>
        )}
        <MongoNode node={winningPlan} />
      </div>
    )
  }

  // PostgreSQL
  const pgPlan = Array.isArray(plan) ? plan[0]?.Plan || plan[0] : plan?.Plan || plan
  if (!pgPlan) return <p className="text-xs text-muted-foreground">Could not parse execution plan</p>

  const maxCost = getMaxCost(pgPlan)
  const planningTime = Array.isArray(plan) ? plan[0]?.['Planning Time'] : plan?.['Planning Time']
  const executionTime = Array.isArray(plan) ? plan[0]?.['Execution Time'] : plan?.['Execution Time']

  return (
    <div>
      {(planningTime || executionTime) && (
        <div className="flex flex-wrap gap-3 mb-3 p-2 rounded bg-muted/50 text-[10px]">
          {planningTime && <span>Planning: <b>{planningTime.toFixed(2)}ms</b></span>}
          {executionTime && <span>Execution: <b>{executionTime.toFixed(2)}ms</b></span>}
          {planningTime && executionTime && <span>Total: <b>{(planningTime + executionTime).toFixed(2)}ms</b></span>}
        </div>
      )}
      <PgNode node={pgPlan} maxCost={maxCost} />
    </div>
  )
}

