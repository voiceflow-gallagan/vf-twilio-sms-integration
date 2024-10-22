import { Elysia, t } from 'elysia'
import { Dialog, sendMessages } from './api'
import axios from 'axios'

const app = new Elysia().decorate('api', Dialog)

app.get('/', ({ set }) => (set.status = 200))

app.get('/health', ({ set }) => {
  set.status = 200
  return { health: 'ok' }
})

app.post('/sms', ({ api, body, set }) => {
  console.log('Webhook received a message')
  console.log(body)
  if (body) {
    api.interact(body.From, body.To, body, set, null)
  }
})

app.post('/send', ({ api, body, set }) => {
  console.log('Received a request to send SMS')
  console.log(body)

  if (body && body.from && body.to && body.payload) {
    const { from, to, direct, payload } = body
    const { messages, userId, action } = payload

    const messageArray = Array.isArray(messages) ? messages : [messages]

    if (direct) {
      // Send message directly using Twilio
      sendMessages(from, to, messageArray)
        .then(() => {
          set.status = 200
          return { success: true, message: 'Message(s) sent directly' }
        })
        .catch((error) => {
          set.status = 500
          return { success: false, error: error.message }
        })
    } else {
      let requestData = {
        config: {
          tts: false,
          stripSSML: true,
          stopAll: true,
          excludeTypes: ['block', 'debug', 'flow'],
        },
      }

      if (action) {
        requestData.action = { type: action }
      } else {
        // Use the first message as the payload if no action is specified
        requestData.action = { type: 'text', payload: messageArray[0] }
      }

      api
        .interact(from, to, { Body: messageArray[0], From: from, To: to }, set)
        .then((response) => {
          set.status = 200
          return { success: true, response }
        })
        .catch((error) => {
          set.status = 500
          return { success: false, error: error.message }
        })
    }
  } else {
    set.status = 400
    return { error: 'Invalid request body' }
  }
})

app.listen(
  {
    port: Bun.env.PORT ?? 3000,
  },
  ({ hostname, port }) => {
    console.log(
      `Voiceflow Twilio SMS Integration is up and running at ${hostname}:${port}`
    )
  }
)
