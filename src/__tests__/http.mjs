import { IncomingMessage, ServerResponse } from 'node:http'
import { Duplex } from 'node:stream'

// Exercise Express's real request/response pipeline without opening a TCP port.
export const request = (
  app,
  path,
  { method = 'GET', body, headers = {}, secure = false } = {}
) =>
  new Promise((resolve, reject) => {
    const chunks = []
    const socket = new Duplex({
      read() {},
      write(chunk, _encoding, callback) {
        chunks.push(Buffer.from(chunk))
        callback()
      }
    })
    socket.remoteAddress = '127.0.0.1'
    socket.encrypted = secure
    const req = new IncomingMessage(socket)
    req.method = method
    req.url = path
    req.headers = { host: 'localhost', ...headers }
    if (body !== undefined) {
      const data = Buffer.isBuffer(body)
        ? body
        : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body))
      req.headers['content-type'] ??= 'application/json'
      req.headers['content-length'] = String(data.length)
      req.push(data)
    }
    req.complete = true
    req.push(null)
    const res = new ServerResponse(req)
    socket.on('drain', () => res.emit('drain'))
    res.assignSocket(socket)
    res.on('error', reject)
    socket.on('error', reject)
    res.on('finish', () => {
      const raw = Buffer.concat(chunks)
      let data = raw.subarray(raw.indexOf('\r\n\r\n') + 4)
      if (
        res.getHeader('transfer-encoding') === 'chunked' ||
        (!res.getHeader('content-length') &&
          raw.includes('Transfer-Encoding: chunked'))
      ) {
        const decoded = []
        while (data.length) {
          const end = data.indexOf('\r\n')
          const size = Number.parseInt(data.subarray(0, end).toString(), 16)
          if (!size) break
          decoded.push(data.subarray(end + 2, end + 2 + size))
          data = data.subarray(end + 2 + size + 2)
        }
        data = Buffer.concat(decoded)
      }
      const text = data.toString()
      let json
      try {
        json = JSON.parse(text)
      } catch {
        /* Non-JSON responses are asserted as text or bytes. */
      }
      resolve({
        status: res.statusCode,
        headers: res.getHeaders(),
        body: json,
        text,
        bytes: data
      })
      socket.destroy()
    })
    app.handle(req, res, error => {
      if (error) reject(error)
      else {
        res.statusCode = 404
        res.end()
      }
    })
  })
