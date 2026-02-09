import { useRef, useEffect } from 'react'
import Editor, { Monaco } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'

interface MonacoQueryEditorProps {
  value: string
  onChange: (value: string) => void
  height?: string
  readOnly?: boolean
  language?: 'javascript' | 'sql' | 'redis'
  schemaFields?: string[]
  collectionNames?: string[]
}

// SQL keywords for PostgreSQL autocomplete
const SQL_KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'BETWEEN', 'LIKE', 'ILIKE',
  'IS', 'NULL', 'AS', 'ON', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'FULL', 'CROSS',
  'ORDER', 'BY', 'ASC', 'DESC', 'GROUP', 'HAVING', 'LIMIT', 'OFFSET', 'DISTINCT',
  'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'CREATE', 'TABLE', 'DROP',
  'ALTER', 'ADD', 'COLUMN', 'INDEX', 'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES',
  'UNION', 'ALL', 'EXISTS', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'CAST',
  'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'COALESCE', 'NULLIF', 'EXTRACT',
  'TRUE', 'FALSE', 'RETURNING', 'WITH', 'RECURSIVE', 'EXPLAIN', 'ANALYZE',
  'BEGIN', 'COMMIT', 'ROLLBACK', 'TRUNCATE', 'VACUUM', 'SERIAL', 'BIGSERIAL',
  'INTEGER', 'BIGINT', 'SMALLINT', 'TEXT', 'VARCHAR', 'BOOLEAN', 'TIMESTAMP', 'DATE', 'JSONB', 'JSON', 'UUID',
]

// Redis commands
const REDIS_COMMANDS = [
  'PING', 'GET', 'SET', 'DEL', 'EXISTS', 'EXPIRE', 'TTL', 'KEYS', 'SCAN',
  'HGET', 'HSET', 'HDEL', 'HGETALL', 'HMSET', 'HMGET', 'HKEYS', 'HVALS', 'HLEN',
  'LPUSH', 'RPUSH', 'LPOP', 'RPOP', 'LRANGE', 'LLEN', 'LINDEX',
  'SADD', 'SREM', 'SMEMBERS', 'SISMEMBER', 'SCARD', 'SUNION', 'SINTER',
  'ZADD', 'ZREM', 'ZRANGE', 'ZRANGEBYSCORE', 'ZSCORE', 'ZCARD', 'ZRANK',
  'INCR', 'DECR', 'INCRBY', 'DECRBY', 'APPEND', 'STRLEN', 'MGET', 'MSET',
  'TYPE', 'RENAME', 'PERSIST', 'PEXPIRE', 'PTTL', 'DBSIZE', 'FLUSHDB', 'INFO', 'SELECT',
]

const schemaFieldsRef = { current: [] as string[] }
const collectionNamesRef = { current: [] as string[] }

export const MonacoQueryEditor = ({
  value,
  onChange,
  height = '400px',
  readOnly = false,
  language = 'javascript',
  schemaFields = [],
  collectionNames = [],
}: MonacoQueryEditorProps) => {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)

  // Keep refs updated for completion provider
  useEffect(() => {
    schemaFieldsRef.current = schemaFields
    collectionNamesRef.current = collectionNames
  }, [schemaFields, collectionNames])

  const handleEditorDidMount = (editor: monaco.editor.IStandaloneCodeEditor, monacoInstance: Monaco) => {
    editorRef.current = editor

    monacoInstance.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: false,
    })
    monacoInstance.languages.typescript.javascriptDefaults.setCompilerOptions({
      target: monacoInstance.languages.typescript.ScriptTarget.ES2020,
      allowNonTsExtensions: true,
    })

    // MongoDB + schema autocomplete
    monacoInstance.languages.registerCompletionItemProvider('javascript', {
      provideCompletionItems: (model, position) => {
        const word = model.getWordUntilPosition(position)
        const range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: word.startColumn, endColumn: word.endColumn }
        const suggestions: monaco.languages.CompletionItem[] = [
          // MongoDB operators
          ...['$eq','$ne','$gt','$gte','$lt','$lte','$in','$nin','$and','$or','$not','$nor','$exists','$type','$regex','$text','$where','$elemMatch','$size','$all'].map(op => ({
            label: op, kind: monacoInstance.languages.CompletionItemKind.Operator, insertText: op, range, detail: 'MongoDB Operator',
          })),
          // Aggregation stages
          ...['$match','$group','$project','$sort','$limit','$skip','$unwind','$lookup','$addFields','$count','$facet','$bucket','$replaceRoot','$merge','$out','$set','$unset'].map(s => ({
            label: s, kind: monacoInstance.languages.CompletionItemKind.Function, insertText: s, range, detail: 'Aggregation Stage',
          })),
          // Accumulator operators
          ...['$sum','$avg','$min','$max','$first','$last','$push','$addToSet'].map(a => ({
            label: a, kind: monacoInstance.languages.CompletionItemKind.Function, insertText: a, range, detail: 'Accumulator',
          })),
          // Schema fields
          ...schemaFieldsRef.current.map(f => ({
            label: f, kind: monacoInstance.languages.CompletionItemKind.Field, insertText: `"${f}"`, range, detail: 'Field',
          })),
          // Collection names
          ...collectionNamesRef.current.map(c => ({
            label: c, kind: monacoInstance.languages.CompletionItemKind.Module, insertText: c, range, detail: 'Collection',
          })),
        ]
        return { suggestions }
      },
    })

    // SQL autocomplete
    monacoInstance.languages.registerCompletionItemProvider('sql', {
      provideCompletionItems: (model, position) => {
        const word = model.getWordUntilPosition(position)
        const range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: word.startColumn, endColumn: word.endColumn }
        const suggestions: monaco.languages.CompletionItem[] = [
          ...SQL_KEYWORDS.map(kw => ({
            label: kw, kind: monacoInstance.languages.CompletionItemKind.Keyword, insertText: kw, range, detail: 'SQL Keyword',
          })),
          ...schemaFieldsRef.current.map(f => ({
            label: f, kind: monacoInstance.languages.CompletionItemKind.Field, insertText: `"${f}"`, range, detail: 'Column',
          })),
          ...collectionNamesRef.current.map(t => ({
            label: t, kind: monacoInstance.languages.CompletionItemKind.Module, insertText: `"${t}"`, range, detail: 'Table',
          })),
        ]
        return { suggestions }
      },
    })

    // Redis autocomplete
    monacoInstance.languages.registerCompletionItemProvider('plaintext', {
      provideCompletionItems: (model, position) => {
        const word = model.getWordUntilPosition(position)
        const range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: word.startColumn, endColumn: word.endColumn }
        return {
          suggestions: REDIS_COMMANDS.map(cmd => ({
            label: cmd, kind: monacoInstance.languages.CompletionItemKind.Function, insertText: cmd, range, detail: 'Redis Command',
          })),
        }
      },
    })

    editor.focus()
  }

  const monacoLang = language === 'sql' ? 'sql' : language === 'redis' ? 'plaintext' : 'javascript'

  return (
    <Editor
      height={height}
      defaultLanguage={monacoLang}
      language={monacoLang}
      value={value}
      onChange={v => v !== undefined && onChange(v)}
      onMount={handleEditorDidMount}
      theme="vs-dark"
      options={{
        minimap: { enabled: false },
        fontSize: 13,
        lineNumbers: 'on',
        roundedSelection: false,
        scrollBeyondLastLine: false,
        readOnly,
        automaticLayout: true,
        tabSize: 2,
        wordWrap: 'on',
        formatOnPaste: true,
        formatOnType: true,
        suggestOnTriggerCharacters: true,
        quickSuggestions: true,
        folding: true,
        bracketPairColorization: { enabled: true },
      }}
    />
  )
}

