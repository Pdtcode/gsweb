import { createClient } from '@sanity/client'

export const client = createClient({
  projectId: 'arbp7h2s',
  dataset: 'production',
  useCdn: true,
  apiVersion: '2023-05-03',
})