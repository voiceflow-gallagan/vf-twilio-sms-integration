import { Elysia, t } from 'elysia'
import { Dialog } from './api'
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
    api.interact(body.From, body.To, body, set)
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
