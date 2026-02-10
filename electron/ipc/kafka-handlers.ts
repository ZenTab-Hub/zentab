import { type IpcMain } from 'electron'
import { closeSSHTunnel } from '../ssh-tunnel'
import { applySSHTunnel } from './ssh-helper'
import {
  connectToKafka, disconnectFromKafka, kafkaListTopics, kafkaGetTopicMetadata,
  kafkaConsumeMessages, kafkaProduceMessage, kafkaCreateTopic, kafkaDeleteTopic,
  kafkaGetClusterInfo, kafkaListConsumerGroups, kafkaDescribeConsumerGroup,
  kafkaGetConsumerGroupOffsets, kafkaResetConsumerGroupOffsets, kafkaDeleteConsumerGroup,
  kafkaGetTopicConfig, kafkaAlterTopicConfig, kafkaGetStats,
} from '../kafka'

export function setupKafkaHandlers(ipcMain: IpcMain) {
  ipcMain.handle('kafka:connect', async (_event, connectionId, connectionString, sshTunnel) => {
    const finalConnStr = await applySSHTunnel(connectionId, connectionString, sshTunnel)
    return await connectToKafka(connectionId, finalConnStr)
  })

  ipcMain.handle('kafka:disconnect', async (_event, connectionId) => {
    await closeSSHTunnel(connectionId)
    return await disconnectFromKafka(connectionId)
  })

  ipcMain.handle('kafka:listTopics', async (_event, connectionId) => {
    return await kafkaListTopics(connectionId)
  })

  ipcMain.handle('kafka:getTopicMetadata', async (_event, connectionId, topic) => {
    return await kafkaGetTopicMetadata(connectionId, topic)
  })

  ipcMain.handle('kafka:consumeMessages', async (_event, connectionId, topic, limit, fromBeginning) => {
    return await kafkaConsumeMessages(connectionId, topic, limit, fromBeginning)
  })

  ipcMain.handle('kafka:produceMessage', async (_event, connectionId, topic, messages) => {
    return await kafkaProduceMessage(connectionId, topic, messages)
  })

  ipcMain.handle('kafka:createTopic', async (_event, connectionId, topic, numPartitions, replicationFactor) => {
    return await kafkaCreateTopic(connectionId, topic, numPartitions, replicationFactor)
  })

  ipcMain.handle('kafka:deleteTopic', async (_event, connectionId, topic) => {
    return await kafkaDeleteTopic(connectionId, topic)
  })

  ipcMain.handle('kafka:getClusterInfo', async (_event, connectionId) => {
    return await kafkaGetClusterInfo(connectionId)
  })

  ipcMain.handle('kafka:listConsumerGroups', async (_event, connectionId) => {
    return await kafkaListConsumerGroups(connectionId)
  })

  ipcMain.handle('kafka:describeConsumerGroup', async (_event, connectionId, groupId) => {
    return await kafkaDescribeConsumerGroup(connectionId, groupId)
  })

  ipcMain.handle('kafka:getConsumerGroupOffsets', async (_event, connectionId, groupId, topic) => {
    return await kafkaGetConsumerGroupOffsets(connectionId, groupId, topic)
  })

  ipcMain.handle('kafka:resetConsumerGroupOffsets', async (_event, connectionId, groupId, topic, earliest) => {
    return await kafkaResetConsumerGroupOffsets(connectionId, groupId, topic, earliest)
  })

  ipcMain.handle('kafka:deleteConsumerGroup', async (_event, connectionId, groupId) => {
    return await kafkaDeleteConsumerGroup(connectionId, groupId)
  })

  ipcMain.handle('kafka:getTopicConfig', async (_event, connectionId, topic) => {
    return await kafkaGetTopicConfig(connectionId, topic)
  })

  ipcMain.handle('kafka:alterTopicConfig', async (_event, connectionId, topic, configEntries) => {
    return await kafkaAlterTopicConfig(connectionId, topic, configEntries)
  })

  ipcMain.handle('kafka:getStats', async (_event, connectionId) => {
    return await kafkaGetStats(connectionId)
  })
}

