import { Client } from 'ssh2'
import net from 'net'

export interface SSHTunnelConfig {
  enabled: boolean
  host: string
  port: number
  username: string
  password?: string
  privateKey?: string
}

interface TunnelInfo {
  server: net.Server
  sshClient: Client
  localPort: number
}

/** Active tunnels keyed by connectionId */
const tunnels = new Map<string, TunnelInfo>()

/**
 * Create an SSH tunnel that forwards a random local port to targetHost:targetPort
 * through the SSH server defined in sshConfig.
 * Returns the local port number to connect to.
 */
export const createSSHTunnel = (
  connectionId: string,
  sshConfig: SSHTunnelConfig,
  targetHost: string,
  targetPort: number
): Promise<number> => {
  return new Promise((resolve, reject) => {
    // Close any existing tunnel for this connection
    closeSSHTunnel(connectionId).catch(() => {})

    const sshClient = new Client()

    sshClient.on('ready', () => {
      // Create a local TCP server that forwards traffic through the SSH tunnel
      const server = net.createServer((sock) => {
        sshClient.forwardOut(
          sock.remoteAddress || '127.0.0.1',
          sock.remotePort || 0,
          targetHost,
          targetPort,
          (err, stream) => {
            if (err) {
              sock.end()
              return
            }
            sock.pipe(stream).pipe(sock)
          }
        )
      })

      // Listen on a random available port
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as net.AddressInfo
        const localPort = addr.port
        tunnels.set(connectionId, { server, sshClient, localPort })
        console.log(`SSH tunnel created: 127.0.0.1:${localPort} → ${sshConfig.host}:${sshConfig.port} → ${targetHost}:${targetPort}`)
        resolve(localPort)
      })

      server.on('error', (err) => {
        sshClient.end()
        reject(err)
      })
    })

    sshClient.on('error', (err) => {
      reject(new Error(`SSH connection failed: ${err.message}`))
    })

    // Build SSH connection config
    const connectConfig: any = {
      host: sshConfig.host,
      port: sshConfig.port || 22,
      username: sshConfig.username,
      readyTimeout: 10000,
    }

    if (sshConfig.privateKey) {
      connectConfig.privateKey = sshConfig.privateKey
    } else if (sshConfig.password) {
      connectConfig.password = sshConfig.password
    }

    sshClient.connect(connectConfig)
  })
}

/** Close an SSH tunnel for a given connectionId */
export const closeSSHTunnel = async (connectionId: string): Promise<void> => {
  const tunnel = tunnels.get(connectionId)
  if (tunnel) {
    tunnel.server.close()
    tunnel.sshClient.end()
    tunnels.delete(connectionId)
    console.log(`SSH tunnel closed for connection: ${connectionId}`)
  }
}

/** Close all SSH tunnels (called on app quit) */
export const closeAllSSHTunnels = async (): Promise<void> => {
  for (const [id] of tunnels) {
    await closeSSHTunnel(id)
  }
}

/** Check if a tunnel is active for a connectionId */
export const hasTunnel = (connectionId: string): boolean => {
  return tunnels.has(connectionId)
}

