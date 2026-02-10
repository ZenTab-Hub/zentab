import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Radio, Users, Settings, Layers, MessageSquare } from 'lucide-react'
import { useConnectionStore } from '@/store/connectionStore'
import { useToast } from '@/components/common/Toast'
import { KafkaTopicsTab } from '../components/KafkaTopicsTab'
import { KafkaMessagesTab } from '../components/KafkaMessagesTab'
import { KafkaConsumerGroupsTab } from '../components/KafkaConsumerGroupsTab'
import { KafkaTopicConfigTab } from '../components/KafkaTopicConfigTab'

type Tab = 'topics' | 'messages' | 'consumer-groups' | 'topic-config'

export const KafkaToolsPage = () => {
  const { activeConnectionId, getActiveConnection } = useConnectionStore()
  const activeConnection = getActiveConnection()
  const dbType = activeConnection?.type
  const tt = useToast()
  const [searchParams] = useSearchParams()
  const urlTab = searchParams.get('tab')
  const urlTopic = searchParams.get('topic')

  const initialTab = (): Tab => {
    if (urlTab === 'config') return 'topic-config'
    if (urlTab === 'groups') return 'consumer-groups'
    if (urlTab === 'messages') return 'messages'
    return 'topics'
  }
  const [tab, setTab] = useState<Tab>(initialTab)

  if (!activeConnectionId || dbType !== 'kafka') {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <Layers className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Connect to a Kafka cluster to use Kafka Tools</p>
        </div>
      </div>
    )
  }

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'topics', label: 'Topics', icon: Radio },
    { id: 'messages', label: 'Messages', icon: MessageSquare },
    { id: 'consumer-groups', label: 'Consumer Groups', icon: Users },
    { id: 'topic-config', label: 'Topic Config', icon: Settings },
  ]

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center gap-1 px-4 py-2 border-b bg-card/50">
        <Radio className="h-4 w-4 text-amber-400" />
        <h2 className="text-sm font-semibold mr-4">Kafka Tools</h2>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-md transition-colors ${tab === t.id ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}>
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto p-4">
        {tab === 'topics' && <KafkaTopicsTab connectionId={activeConnectionId} tt={tt} />}
        {tab === 'messages' && <KafkaMessagesTab connectionId={activeConnectionId} tt={tt} initialTopic={urlTopic || undefined} />}
        {tab === 'consumer-groups' && <KafkaConsumerGroupsTab connectionId={activeConnectionId} tt={tt} />}
        {tab === 'topic-config' && <KafkaTopicConfigTab connectionId={activeConnectionId} tt={tt} initialTopic={urlTopic || undefined} />}
      </div>
    </div>
  )
}
