import { Kafka, Admin, Consumer, Producer, logLevel } from 'kafkajs'

interface KafkaConnectionInfo {
  kafka: Kafka
  admin: Admin
  producer: Producer
  consumer?: Consumer
}

const connections = new Map<string, KafkaConnectionInfo>()

/**
 * Parse kafka:// connection string into broker list, SASL config, and SSL flag.
 *
 * Supported formats:
 *   kafka://broker1:9092,broker2:9092
 *   kafka+ssl://broker1:9092
 *   kafka+sasl_plain://user:pass@broker1:9092
 *   kafka+sasl_scram256://user:pass@broker1:9092
 *   kafka+sasl_scram512://user:pass@broker1:9092
 *   kafka+sasl_plain+ssl://user:pass@broker1:9092
 *   kafka+sasl_scram256+ssl://user:pass@broker1:9092
 */
function parseKafkaConnectionString(connectionString: string): { brokers: string[]; sasl?: any; ssl?: boolean } {
  let str = connectionString.trim()

  let ssl = false
  let saslMechanism: string | null = null

  // Parse protocol prefix: kafka+sasl_xxx+ssl:// or kafka+ssl:// or kafka://
  const protoMatch = str.match(/^kafka(\+[^:]+)?:\/\//)
  if (protoMatch) {
    const flags = protoMatch[1] || '' // e.g. "+sasl_plain+ssl"
    str = str.slice(protoMatch[0].length)
    if (flags.includes('+ssl')) ssl = true
    if (flags.includes('+sasl_scram512')) saslMechanism = 'scram-sha-512'
    else if (flags.includes('+sasl_scram256')) saslMechanism = 'scram-sha-256'
    else if (flags.includes('+sasl_plain')) saslMechanism = 'plain'
  }

  // Parse auth: user:pass@brokers
  const atIndex = str.lastIndexOf('@')
  let sasl: any = undefined
  let brokerPart = str

  if (atIndex > 0) {
    const authPart = str.slice(0, atIndex)
    brokerPart = str.slice(atIndex + 1)
    const colonIndex = authPart.indexOf(':')
    if (colonIndex > 0) {
      const username = decodeURIComponent(authPart.slice(0, colonIndex))
      const password = decodeURIComponent(authPart.slice(colonIndex + 1))
      const mechanism = saslMechanism || 'plain'
      sasl = { mechanism, username, password }
    }
  }

  const brokers = brokerPart.split(',').map(b => b.trim()).filter(Boolean)

  // If SASL is used, default SSL to true (common for cloud Kafka)
  if (sasl && !ssl) ssl = true

  return { brokers, sasl, ssl }
}

export const connectToKafka = async (connectionId: string, connectionString: string) => {
  try {
    if (connections.has(connectionId)) {
      await disconnectFromKafka(connectionId)
    }

    const { brokers, sasl, ssl } = parseKafkaConnectionString(connectionString)
    if (!brokers.length) throw new Error('No brokers specified')

    const kafka = new Kafka({
      clientId: `zentab-${connectionId}`,
      brokers,
      sasl: sasl || undefined,
      ssl: ssl || false,
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
  const groupId = `zentab-consume-${connectionId}-${Date.now()}`
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



/* ── Consumer Groups ── */

export const kafkaListConsumerGroups = async (connectionId: string) => {
  const conn = connections.get(connectionId)
  if (!conn) throw new Error('Not connected to Kafka')
  const { groups } = await conn.admin.listGroups()
  return { success: true, groups }
}

export const kafkaDescribeConsumerGroup = async (connectionId: string, groupId: string) => {
  const conn = connections.get(connectionId)
  if (!conn) throw new Error('Not connected to Kafka')
  const result = await conn.admin.describeGroups([groupId])
  const group = result.groups[0]
  return { success: true, group }
}

export const kafkaGetConsumerGroupOffsets = async (connectionId: string, groupId: string, topic?: string) => {
  const conn = connections.get(connectionId)
  if (!conn) throw new Error('Not connected to Kafka')
  const offsets = await conn.admin.fetchOffsets({ groupId, topics: topic ? [topic] : undefined })
  // Also get topic end offsets for lag calculation
  const topicNames = offsets.map((o: any) => o.topic)
  const lagInfo = []
  for (const t of topicNames) {
    try {
      const topicOffsets = await conn.admin.fetchTopicOffsets(t)
      lagInfo.push({ topic: t, endOffsets: topicOffsets })
    } catch { /* skip */ }
  }
  return { success: true, offsets, lagInfo }
}

export const kafkaResetConsumerGroupOffsets = async (
  connectionId: string, groupId: string, topic: string, earliest: boolean = true
) => {
  const conn = connections.get(connectionId)
  if (!conn) throw new Error('Not connected to Kafka')
  await conn.admin.resetOffsets({ groupId, topic, earliest })
  return { success: true }
}

export const kafkaDeleteConsumerGroup = async (connectionId: string, groupId: string) => {
  const conn = connections.get(connectionId)
  if (!conn) throw new Error('Not connected to Kafka')
  await conn.admin.deleteGroups([groupId])
  return { success: true }
}

/* ── Topic Configuration ── */

export const kafkaGetTopicConfig = async (connectionId: string, topic: string) => {
  const conn = connections.get(connectionId)
  if (!conn) throw new Error('Not connected to Kafka')
  const { resources } = await conn.admin.describeConfigs({
    includeSynonyms: false,
    resources: [{ type: 2 /* TOPIC */, name: topic }],
  })
  return { success: true, configs: resources[0]?.configEntries || [] }
}

export const kafkaAlterTopicConfig = async (
  connectionId: string, topic: string, configEntries: Array<{ name: string; value: string }>
) => {
  const conn = connections.get(connectionId)
  if (!conn) throw new Error('Not connected to Kafka')
  await conn.admin.alterConfigs({
    validateOnly: false,
    resources: [{
      type: 2 /* TOPIC */,
      name: topic,
      configEntries,
    }],
  })
  return { success: true }
}

/* ── Kafka Stats (for Monitoring) ── */

export const kafkaGetStats = async (connectionId: string) => {
  const conn = connections.get(connectionId)
  if (!conn) throw new Error('Not connected to Kafka')

  const [cluster, topics, { groups }] = await Promise.all([
    conn.admin.describeCluster(),
    conn.admin.listTopics(),
    conn.admin.listGroups(),
  ])

  const metadata = await conn.admin.fetchTopicMetadata({ topics })
  const totalPartitions = metadata.topics.reduce((sum, t) => sum + (t.partitions?.length || 0), 0)

  return {
    success: true,
    stats: {
      cluster: {
        clusterId: cluster.clusterId,
        controller: cluster.controller,
        brokers: cluster.brokers,
        brokerCount: cluster.brokers.length,
      },
      topics: {
        count: topics.length,
        totalPartitions,
        names: topics,
      },
      consumerGroups: {
        count: groups.length,
        groups: groups.map((g: any) => ({ groupId: g.groupId, protocolType: g.protocolType })),
      },
    },
  }
}

/** Disconnect all Kafka connections (used on app quit) */
export const disconnectAll = async () => {
  const tasks = Array.from(connections.keys()).map((id) => disconnectFromKafka(id).catch(() => {}))
  await Promise.allSettled(tasks)
}
