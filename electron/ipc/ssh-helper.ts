import { createSSHTunnel } from '../ssh-tunnel'

/**
 * Helper: if SSH tunnel is enabled, create a tunnel and rewrite the connection string
 * to route through localhost:<localPort> instead of the original host:port.
 */
export async function applySSHTunnel(
  connectionId: string,
  connectionString: string,
  sshTunnel?: { enabled: boolean; host: string; port: number; username: string; password?: string; privateKey?: string }
): Promise<string> {
  if (!sshTunnel?.enabled) return connectionString

  // Parse host:port from the connection string
  let targetHost = '127.0.0.1'
  let targetPort = 27017
  try {
    const url = new URL(connectionString)
    targetHost = url.hostname || '127.0.0.1'
    targetPort = Number(url.port) || targetPort
  } catch {
    // For non-standard schemes (kafka://), do basic parsing
    const m = connectionString.match(/:\/\/(?:[^@]+@)?([^/:]+)(?::(\d+))?/)
    if (m) {
      targetHost = m[1]
      targetPort = m[2] ? Number(m[2]) : targetPort
    }
  }

  const localPort = await createSSHTunnel(connectionId, sshTunnel, targetHost, targetPort)

  // Replace host:port in the connection string with 127.0.0.1:localPort
  return connectionString.replace(
    /(:\/\/(?:[^@]+@)?)([^/:]+)(:\d+)?/,
    `$1127.0.0.1:${localPort}`
  )
}

