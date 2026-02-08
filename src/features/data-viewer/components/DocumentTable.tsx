import { useState } from 'react'
import { Edit, Trash2, Copy, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/common/Button'
import { formatJSON } from '@/utils/formatters'

interface DocumentTableProps {
  documents: any[]
  onEdit: (document: any) => void
  onDelete: (document: any) => void
}

export const DocumentTable = ({ documents, onEdit, onDelete }: DocumentTableProps) => {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  if (documents.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center">
        <p className="text-muted-foreground">No documents found</p>
      </div>
    )
  }

  // Extract all unique keys from all documents
  const allKeys = Array.from(
    new Set(documents.flatMap((doc) => Object.keys(doc)))
  )

  // Helper to format cell value
  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return ''
    if (typeof value === 'object') {
      // Handle MongoDB ObjectId with $oid
      if (value.$oid) return value.$oid

      // Handle Buffer (MongoDB ObjectId as buffer)
      if (value.buffer && typeof value.buffer === 'object') {
        // Convert buffer to hex string
        const bufferArray = Object.values(value.buffer) as number[]
        return bufferArray.map(b => b.toString(16).padStart(2, '0')).join('')
      }

      // Handle Date
      if (value instanceof Date) return value.toISOString()

      // Handle Array
      if (Array.isArray(value)) return `[${value.length} items]`

      // Handle other objects - show compact JSON
      const str = JSON.stringify(value)
      return str.length > 50 ? str.slice(0, 47) + '...' : str
    }
    return String(value)
  }

  // Helper to get unique key for row
  const getRowKey = (doc: any, index: number): string => {
    if (doc._id) {
      // Handle MongoDB ObjectId with $oid
      if (typeof doc._id === 'object' && doc._id.$oid) {
        return doc._id.$oid
      }
      // Handle Buffer (MongoDB ObjectId as buffer)
      if (typeof doc._id === 'object' && doc._id.buffer) {
        const bufferArray = Object.values(doc._id.buffer) as number[]
        return bufferArray.map(b => b.toString(16).padStart(2, '0')).join('')
      }
      return String(doc._id)
    }
    return `row-${index}`
  }

  const toggleRow = (key: string) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(key)) {
      newExpanded.delete(key)
    } else {
      newExpanded.add(key)
    }
    setExpandedRows(newExpanded)
  }

  const copyToClipboard = (doc: any) => {
    navigator.clipboard.writeText(formatJSON(doc))
    alert('Copied to clipboard!')
  }

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-10">
                {/* Expand icon */}
              </th>
              {allKeys.map((key) => (
                <th
                  key={key}
                  className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
                >
                  {key}
                </th>
              ))}
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider w-32">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {documents.map((doc, index) => {
              const rowKey = getRowKey(doc, index)
              const isExpanded = expandedRows.has(rowKey)

              return (
                <>
                  <tr key={rowKey} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleRow(rowKey)}
                        className="text-muted-foreground hover:text-primary"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>
                    </td>
                    {allKeys.map((key) => (
                      <td
                        key={key}
                        className="px-4 py-3 text-sm font-mono max-w-xs truncate"
                        title={formatValue(doc[key])}
                      >
                        {formatValue(doc[key])}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right">
                      <div className="flex gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyToClipboard(doc)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => onEdit(doc)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => onDelete(doc)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${rowKey}-expanded`}>
                      <td colSpan={allKeys.length + 2} className="px-4 py-3 bg-muted/20">
                        <pre className="overflow-x-auto text-xs">
                          {formatJSON(doc)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

