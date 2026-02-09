import { Kafka, Admin, Consumer, Producer, logLevel } from 'kafkajs'

interface KafkaConnectionInfo {
  kafka: Kafka
  admin: Admin
  producer: Producer
  consumer?: Consumer
}

const connections = new Map<string, KafkaConnectionInfo>()

/** Parse kafka:// connection string into broker list and SASL config */
function parseKafkaConnectionString(connectionString: string): { brokers: string[]; sasl?: any; ssl?: boolean } {
  let str = connectionString.trim()
  // Remove kafka:// prefix
  if (str.startsWith('kafka://')) str = str.slice(8)
  if (str.startsWith('kafka+ssl://')) {
    str = str.slice(12)
    const result = parseBrokersAndAuth(str)
    return { ...result, ssl: true }
  }
  return parseBrokersAndAuth(str)
}

function parseBrokersAndAuth(str: string): { brokers: string[]; sasl?: any } {
  // Check for auth: user:pass@brokers
  const atIndex = str.lastIndexOf('@')
  if (atIndex > 0) {
    const authPart = str.slice(0, atIndex)
    const brokerPart = str.slice(atIndex + 1)
    const colonIndex = authPart.indexOf(':')
    if (colonIndex > 0) {
      const username = decodeURIComponent(authPart.slice(0, colonIndex))
      const password = decodeURIComponent(authPart.slice(colonIndex + 1))
      return {
        brokers: brokerPart.split(',').map(b => b.trim()).filter(Boolean),
        sasl: { mechanism: 'plain', username, password },
      }
    }
  }
  return { brokers: str.split(',').map(b => b.trim()).filter(Boolean) }
}

export const connectToKafka = async (connectionId: string, connectionString: string) => {
  try {
    if (connections.has(connectionId)) {
      await disconnectFromKafka(connectionId)
    }

    const { brokers, sasl, ssl } = parseKafkaConnectionString(connectionString)
    if (!brokers.length) throw new Error('No brokers specified')

    const kafka = new Kafka({
      clientId: `queryai-${connectionId}`,
      brokers,
      sasl: sasl || undefined,
      ssl: ssl || !!sasl,
      connectionTimeout: 10000,
      logLevel: logLevel.WARN,
    })

    const admin = kafka.admin()
    await admin.connect()

    const producer = kafka.producer()
    await producer.connect()

    connections.set(connectionId, { kafka, admin, producer })
    console.log(`Connected to Kafka: ${connectionId}`)
    return { success: true, connectionId }
  } catch (error: any) {
    console.error('Kafka connection error:', error)
    return { success: false, error: error.message }
  }
}

export const disconnectFromKafka = async (connectionId: string) => {
  try {
    const conn = connections.get(connectionId)
    if (conn) {
      if (conn.consumer) await conn.consumer.disconnect().catch(() => {})
      await conn.producer.disconnect().catch(() => {})
      await conn.admin.disconnect().catch(() => {})
      connections.delete(connectionId)
    }
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export const pingKafka = async (connectionId: string) => {
  try {
    const conn = connections.get(connectionId)
    if (!conn) return { success: false, error: 'Not connected' }
    // List topics as a lightweight health check
    await conn.admin.listTopics()
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export const kafkaListTopics = async (connectionId: string) => {
  const conn = connections.get(connectionId)
  if (!conn) throw new Error('Not connected to Kafka')

  const topics = await conn.admin.listTopics()
  const metadata = await conn.admin.fetchTopicMetadata({ topics })

  const databases = topics.map(name => {
    const topicMeta = metadata.topics.find(t => t.name === name)
    return {
      name,
      partitions: topicMeta?.partitions?.length || 0,
    }
  })

  return { success: true, databases }
}

export const kafkaGetTopicMetadata = async (connectionId: string, topic: string) => {
  const conn = connections.get(connectionId)
  if (!conn) throw new Error('Not connected to Kafka')

  const metadata = await conn.admin.fetchTopicMetadata({ topics: [topic] })
  const offsets = await conn.admin.fetchTopicOffsets(topic)

  return {
    success: true,
    metadata: metadata.topics[0],
    offsets,
  }
}

export const kafkaConsumeMessages = async (
  connectionId: string,
  topic: string,
  limit: number = 50,
  fromBeginning: boolean = true
) => {
  const conn = connections.get(connectionId)
  if (!conn) throw new Error('Not connected to Kafka')

  const messages: any[] = []

  // Use a temporary consumer with unique groupId
  const groupId = `queryai-consume-${connectionId}-${Date.now()}`
  const consumer = conn.kafka.consumer({ groupId })

  try {
    await consumer.connect()
    await consumer.subscribe({ topic, fromBeginning })

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => resolve(), 5000)

      consumer.run({
        eachMessage: async ({ partition, message: msg }) => {
          messages.push({
            partition,
            offset: msg.offset,
            key: msg.key?.toString() || null,
            value: msg.value?.toString() || null,
            timestamp: msg.timestamp,
            headers: msg.headers
              ? Object.fromEntries(Object.entries(msg.headers).map(([k, v]) => [k, v?.toString()]))
              : {},
          })
          if (messages.length >= limit) {
            clearTimeout(timeout)
            resolve()
          }
        },
      })
    })
  } finally {
    await consumer.disconnect().catch(() => {})
  }

  return { success: true, documents: messages, count: messages.length }
}

export const kafkaProduceMessage = async (
  connectionId: string,
  topic: string,
  messages: Array<{ key?: string; value: string; headers?: Record<string, string> }>
) => {
  const conn = connections.get(connectionId)
  if (!conn) throw new Error('Not connected to Kafka')

  const kafkaMessages = messages.map(m => ({
    key: m.key || undefined,
    value: m.value,
    headers: m.headers || undefined,
  }))

  const result = await conn.producer.send({
    topic,
    messages: kafkaMessages,
  })

  return { success: true, result }
}

export const kafkaCreateTopic = async (
  connectionId: string,
  topic: string,
  numPartitions: number = 1,
  replicationFactor: number = 1
) => {
  const conn = connections.get(connectionId)
  if (!conn) throw new Error('Not connected to Kafka')

  const created = await conn.admin.createTopics({
    topics: [{ topic, numPartitions, replicationFactor }],
  })

  return { success: true, created }
}

export const kafkaDeleteTopic = async (connectionId: string, topic: string) => {
  const conn = connections.get(connectionId)
  if (!conn) throw new Error('Not connected to Kafka')

  await conn.admin.deleteTopics({ topics: [topic] })
  return { success: true }
}

export const kafkaGetClusterInfo = async (connectionId: string) => {
  const conn = connections.get(connectionId)
  if (!conn) throw new Error('Not connected to Kafka')

  const cluster = await conn.admin.describeCluster()
  return { success: true, cluster }
}



/** Disconnect all Kafka connections (used on app quit) */
export const disconnectAll = async () => {
  const tasks = Array.from(connections.keys()).map((id) => disconnectFromKafka(id).catch(() => {}))
  await Promise.allSettled(tasks)
}
