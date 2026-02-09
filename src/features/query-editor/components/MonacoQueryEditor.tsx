import { useRef, useEffect } from 'react'
import Editor, { Monaco } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'

interface MonacoQueryEditorProps {
  value: string
  onChange: (value: string) => void
  height?: string
  readOnly?: boolean
}

export const MonacoQueryEditor = ({
  value,
  onChange,
  height = '400px',
  readOnly = false,
}: MonacoQueryEditorProps) => {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)

  const handleEditorDidMount = (editor: monaco.editor.IStandaloneCodeEditor, monaco: Monaco) => {
    editorRef.current = editor

    // Configure MongoDB/JavaScript language features
    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: false,
    })

    monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ES2020,
      allowNonTsExtensions: true,
    })

    // Add MongoDB-specific autocomplete suggestions
    monaco.languages.registerCompletionItemProvider('javascript', {
      provideCompletionItems: (model, position) => {
        const word = model.getWordUntilPosition(position)
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        }

        const suggestions: monaco.languages.CompletionItem[] = [
          // Query operators
          { label: '$eq', kind: monaco.languages.CompletionItemKind.Operator, insertText: '$eq', range },
          { label: '$ne', kind: monaco.languages.CompletionItemKind.Operator, insertText: '$ne', range },
          { label: '$gt', kind: monaco.languages.CompletionItemKind.Operator, insertText: '$gt', range },
          { label: '$gte', kind: monaco.languages.CompletionItemKind.Operator, insertText: '$gte', range },
          { label: '$lt', kind: monaco.languages.CompletionItemKind.Operator, insertText: '$lt', range },
          { label: '$lte', kind: monaco.languages.CompletionItemKind.Operator, insertText: '$lte', range },
          { label: '$in', kind: monaco.languages.CompletionItemKind.Operator, insertText: '$in', range },
          { label: '$nin', kind: monaco.languages.CompletionItemKind.Operator, insertText: '$nin', range },
          { label: '$and', kind: monaco.languages.CompletionItemKind.Operator, insertText: '$and', range },
          { label: '$or', kind: monaco.languages.CompletionItemKind.Operator, insertText: '$or', range },
          { label: '$not', kind: monaco.languages.CompletionItemKind.Operator, insertText: '$not', range },
          { label: '$nor', kind: monaco.languages.CompletionItemKind.Operator, insertText: '$nor', range },
          { label: '$exists', kind: monaco.languages.CompletionItemKind.Operator, insertText: '$exists', range },
          { label: '$type', kind: monaco.languages.CompletionItemKind.Operator, insertText: '$type', range },
          { label: '$regex', kind: monaco.languages.CompletionItemKind.Operator, insertText: '$regex', range },
          { label: '$text', kind: monaco.languages.CompletionItemKind.Operator, insertText: '$text', range },
          { label: '$where', kind: monaco.languages.CompletionItemKind.Operator, insertText: '$where', range },
          
          // Aggregation stages
          { label: '$match', kind: monaco.languages.CompletionItemKind.Function, insertText: '$match', range },
          { label: '$group', kind: monaco.languages.CompletionItemKind.Function, insertText: '$group', range },
          { label: '$project', kind: monaco.languages.CompletionItemKind.Function, insertText: '$project', range },
          { label: '$sort', kind: monaco.languages.CompletionItemKind.Function, insertText: '$sort', range },
          { label: '$limit', kind: monaco.languages.CompletionItemKind.Function, insertText: '$limit', range },
          { label: '$skip', kind: monaco.languages.CompletionItemKind.Function, insertText: '$skip', range },
          { label: '$unwind', kind: monaco.languages.CompletionItemKind.Function, insertText: '$unwind', range },
          { label: '$lookup', kind: monaco.languages.CompletionItemKind.Function, insertText: '$lookup', range },
          { label: '$addFields', kind: monaco.languages.CompletionItemKind.Function, insertText: '$addFields', range },
          { label: '$count', kind: monaco.languages.CompletionItemKind.Function, insertText: '$count', range },
        ]

        return { suggestions }
      },
    })

    // Focus editor
    editor.focus()
  }

  const handleChange = (value: string | undefined) => {
    if (value !== undefined) {
      onChange(value)
    }
  }

  return (
    <Editor
      height={height}
      defaultLanguage="javascript"
      value={value}
      onChange={handleChange}
      onMount={handleEditorDidMount}
      theme="vs-dark"
      options={{
        minimap: { enabled: false },
        fontSize: 14,
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

